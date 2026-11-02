//! The organization's side of a deal (contracts/deal). Every deal action is a request under
//! the organization's own rules (level 2); once they are met, the organization calls the deal
//! contract itself, which is what satisfies the deal's `require_auth` for this party (level 1).
//! Depositing is weighed like a payment of the deal's total and holds that money back;
//! approving a payout like a payment of the milestone; everything else like a rule change.

use soroban_sdk::auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation};
use soroban_sdk::{contractclient, contractimpl, vec, Address, Env, IntoVal, Symbol};

use crate::types::{DealAction, DealCall, DealTerms, Error, Evaluation, OrgInfo, RequestKind};
use crate::{
    add_committed, available, continuity, controls, extend_instance, find_asset, load_assets,
    load_info, load_policy, new_request, ranked, rules, save_request, settle, Organization,
    OrganizationArgs, OrganizationClient,
};

/// The deal contract's interface as the organization uses it (contracts/deal).
#[allow(dead_code)]
#[contractclient(name = "DealsClient")]
pub trait DealsInterface {
    fn create(e: Env, party_a: Address, party_b: Address, terms: DealTerms) -> u64;
    fn accept(e: Env, deal_id: u64);
    fn fund(e: Env, deal_id: u64);
    fn request_release(e: Env, deal_id: u64, milestone: u32);
    fn approve_release(e: Env, deal_id: u64, milestone: u32);
    fn object(e: Env, deal_id: u64, milestone: u32);
    fn cancel(e: Env, deal_id: u64, by: Address);
    fn dispute(e: Env, deal_id: u64, by: Address);
    fn quote(e: Env, deal_id: u64, milestone: Option<u32>) -> (Address, i128);
}

#[contractimpl]
impl Organization {
    /// Proposes a deal action; it runs once the organization's rules are met (at once if they
    /// need no approvals).
    ///
    /// Auth: `by`, a member.
    pub fn propose_deal(e: &Env, by: Address, call: DealCall) -> Result<u64, Error> {
        by.require_auth();
        continuity::touch(e, &by);
        extend_instance(e);
        let info = load_info(e);
        rules::rank_of_member(&ranked(e, &info.roles), &by).ok_or(Error::NotMember)?;
        let (evaluation, call) = weigh(e, &info, call)?;
        if let Some(token) = &call.reserved_token {
            add_committed(e, token, call.reserved_amount);
        }
        let request = new_request(e, RequestKind::Deal(call), by, evaluation);
        let settled = settle(e, request, &info);
        save_request(e, &settled);
        Ok(settled.id)
    }

    /// Takes a deal action without a request. Only the founder, only in the setup phase.
    ///
    /// Auth: `by`, the founder.
    pub fn deal_directly(e: &Env, by: Address, call: DealCall) -> Result<(), Error> {
        by.require_auth();
        continuity::touch(e, &by);
        extend_instance(e);
        let info = load_info(e);
        if by != info.founder {
            return Err(Error::NotFounder);
        }
        let members = ranked(e, &info.roles);
        let policy = load_policy(e);
        if !rules::is_setup_phase(e, &info.roles, &members, &policy, &info.founder) {
            return Err(Error::NotInSetupPhase);
        }
        let (_, call) = weigh(e, &info, call)?;
        perform(e, &call).map_err(|_| Error::DealRefused)
    }
}

/// What the rules require for this action, and the call with what it holds back for a deposit.
fn weigh(e: &Env, info: &OrgInfo, call: DealCall) -> Result<(Evaluation, DealCall), Error> {
    let policy = load_policy(e);
    let deals = DealsClient::new(e, &call.deals);
    let mut reserved: (Option<Address>, i128) = (None, 0);
    let evaluation = match &call.action {
        DealAction::Fund(id) => {
            let (token, total) = quote(&deals, *id, None)?;
            let asset = find_asset(&load_assets(e), &token)?;
            if total > available(e, &token) {
                return Err(Error::InsufficientFunds);
            }
            reserved = (Some(token.clone()), total);
            let amount = controls::tier_amount(e, info, &asset, total);
            rules::evaluate_payment(&policy, amount, false, false, false)?
        }
        DealAction::ApproveRelease(id, milestone) => {
            let (token, amount) = quote(&deals, *id, Some(*milestone))?;
            let in_tiers = find_asset(&load_assets(e), &token)
                .ok()
                .and_then(|asset| controls::tier_amount(e, info, &asset, amount));
            rules::evaluate_payment(&policy, in_tiers, false, false, false)?
        }
        DealAction::Create(party_b, terms) => {
            find_asset(&load_assets(e), &terms.asset)?;
            // The counterparty is who will be paid: the allowlist applies to them.
            controls::recipient_escalates(e, party_b)?;
            rules::evaluate_governance(&policy)?
        }
        _ => rules::evaluate_governance(&policy)?,
    };
    let (reserved_token, reserved_amount) = reserved;
    Ok((
        evaluation,
        DealCall {
            reserved_token,
            reserved_amount,
            ..call
        },
    ))
}

fn quote(deals: &DealsClient, id: u64, milestone: Option<u32>) -> Result<(Address, i128), Error> {
    match deals.try_quote(&id, &milestone) {
        Ok(Ok(quote)) => Ok(quote),
        _ => Err(Error::DealUnavailable),
    }
}

/// Runs an approved deal action as this organization; releases what it held back. On failure,
/// returns the code the request records (1000 + the deal contract's error, or 1000).
pub(crate) fn perform(e: &Env, call: &DealCall) -> Result<(), u32> {
    release_reserved(e, call);
    let me = e.current_contract_address();
    let deals = DealsClient::new(e, &call.deals);
    let outcome = match &call.action {
        DealAction::Create(party_b, terms) => deals.try_create(&me, party_b, terms).map(|_| Ok(())),
        DealAction::Accept(id) => deals.try_accept(id),
        DealAction::Fund(id) => {
            let Some(token) = &call.reserved_token else {
                return Err(1000);
            };
            let amount = &call.reserved_amount;
            // The deal contract pulls the deposit from this contract, which must authorize it.
            e.authorize_as_current_contract(vec![
                e,
                InvokerContractAuthEntry::Contract(SubContractInvocation {
                    context: ContractContext {
                        contract: token.clone(),
                        fn_name: Symbol::new(e, "transfer"),
                        args: (me.clone(), call.deals.clone(), *amount).into_val(e),
                    },
                    sub_invocations: vec![e],
                }),
            ]);
            deals.try_fund(id)
        }
        DealAction::RequestRelease(id, m) => deals.try_request_release(id, m),
        DealAction::ApproveRelease(id, m) => deals.try_approve_release(id, m),
        DealAction::Object(id, m) => deals.try_object(id, m),
        DealAction::Cancel(id) => deals.try_cancel(id, &me),
        DealAction::Dispute(id) => deals.try_dispute(id, &me),
    };
    match outcome {
        Ok(Ok(())) => Ok(()),
        Err(Ok(error)) if error.is_type(soroban_sdk::xdr::ScErrorType::Contract) => {
            Err(1000 + error.get_code())
        }
        _ => Err(1000),
    }
}

/// Releases what a declined deposit request held back.
pub(crate) fn release_reserved(e: &Env, call: &DealCall) {
    if let Some(token) = &call.reserved_token {
        add_committed(e, token, -call.reserved_amount);
    }
}
