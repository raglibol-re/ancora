//! The organization's confidential pot (contracts/pot, preview). Every pot action is a request
//! under the organization's own rules; once they are met, the organization calls the pot itself,
//! which is what satisfies the pot's `require_auth` for this account. A deposit is weighed like
//! a payment of its amount and holds that money back; a confidential payment like a payment of
//! unknown size, so it takes the strictest tier (the contract can't see the amount; members see
//! it in the app); opening the account and taking money back out like a rule change.
use soroban_sdk::auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation};
use soroban_sdk::{contractclient, contractimpl, vec, Address, Bytes, Env, IntoVal, Symbol};

use crate::types::{Error, Evaluation, OrgInfo, PotAction, PotCall, RequestKind};
use crate::{
    add_committed, available, continuity, controls, extend_instance, find_asset, load_assets,
    load_info, load_policy, new_request, ranked, rules, save_request, settle, Organization,
    OrganizationArgs, OrganizationClient,
};

/// The pot's interface as the organization uses it (OpenZeppelin's confidential token).
#[allow(dead_code)]
#[contractclient(name = "PotClient")]
pub trait PotInterface {
    fn asset(e: Env) -> Address;
    fn register(e: Env, account: Address, auditor_id: u32, data: Bytes);
    fn deposit(e: Env, from: Address, to: Address, amount: i128);
    fn merge(e: Env, account: Address);
    fn withdraw(e: Env, from: Address, to: Address, amount: i128, data: Bytes);
    fn confidential_transfer(e: Env, from: Address, to: Address, data: Bytes);
}

#[contractimpl]
impl Organization {
    /// Proposes a pot action; it runs once the organization's rules are met (at once if they
    /// need no approvals).
    ///
    /// Auth: `by`, a member.
    pub fn propose_pot(e: &Env, by: Address, call: PotCall) -> Result<u64, Error> {
        by.require_auth();
        continuity::touch(e, &by);
        extend_instance(e);
        let info = load_info(e);
        rules::rank_of_member(&ranked(e, &info.roles), &by).ok_or(Error::NotMember)?;
        let (evaluation, call) = weigh(e, &info, call)?;
        if let Some(token) = &call.reserved_token {
            add_committed(e, token, call.reserved_amount);
        }
        let request = new_request(e, RequestKind::Pot(call), by, evaluation);
        let settled = settle(e, request, &info);
        save_request(e, &settled);
        Ok(settled.id)
    }

    /// Makes what the pot received spendable. It moves nothing out, so any member may.
    ///
    /// Auth: `by`, a member.
    pub fn pot_merge(e: &Env, by: Address, pot: Address) -> Result<(), Error> {
        by.require_auth();
        continuity::touch(e, &by);
        extend_instance(e);
        let info = load_info(e);
        rules::rank_of_member(&ranked(e, &info.roles), &by).ok_or(Error::NotMember)?;
        let me = e.current_contract_address();
        match PotClient::new(e, &pot).try_merge(&me) {
            Ok(Ok(())) => Ok(()),
            _ => Err(Error::PotUnavailable),
        }
    }
}

/// What the rules require for this action, and the call with what a deposit holds back.
fn weigh(e: &Env, info: &OrgInfo, call: PotCall) -> Result<(Evaluation, PotCall), Error> {
    let policy = load_policy(e);
    let mut reserved: (Option<Address>, i128) = (None, 0);
    let evaluation = match &call.action {
        PotAction::Deposit(amount) => {
            let token = match PotClient::new(e, &call.pot).try_asset() {
                Ok(Ok(token)) => token,
                _ => return Err(Error::PotUnavailable),
            };
            let asset = find_asset(&load_assets(e), &token)?;
            if *amount <= 0 {
                return Err(Error::InvalidAmount);
            }
            if *amount > available(e, &token) {
                return Err(Error::InsufficientFunds);
            }
            reserved = (Some(token), *amount);
            let in_tiers = controls::tier_amount(e, info, &asset, *amount);
            rules::evaluate_payment(&policy, in_tiers, false, false, false)?
        }
        PotAction::Transfer(to, _) => {
            // Who is paid stays public, so the allowlist applies; the amount doesn't.
            let escalate = controls::recipient_escalates(e, to)?;
            rules::evaluate_payment(&policy, None, false, false, escalate)?
        }
        PotAction::Register(..) | PotAction::Withdraw(..) => rules::evaluate_governance(&policy)?,
    };
    let (reserved_token, reserved_amount) = reserved;
    Ok((
        evaluation,
        PotCall {
            reserved_token,
            reserved_amount,
            ..call
        },
    ))
}

/// Runs an approved pot action as this organization; releases what it held back. On failure,
/// returns the code the request records (2000 + the pot's error, or 2000).
pub(crate) fn perform(e: &Env, call: &PotCall) -> Result<(), u32> {
    release_reserved(e, call);
    let me = e.current_contract_address();
    let pot = PotClient::new(e, &call.pot);
    let outcome = match &call.action {
        PotAction::Register(auditor, data) => pot.try_register(&me, auditor, data),
        PotAction::Deposit(amount) => {
            let Some(token) = &call.reserved_token else {
                return Err(2000);
            };
            // The pot pulls the deposit from this contract, which must authorize it.
            e.authorize_as_current_contract(vec![
                e,
                InvokerContractAuthEntry::Contract(SubContractInvocation {
                    context: ContractContext {
                        contract: token.clone(),
                        fn_name: Symbol::new(e, "transfer"),
                        args: (me.clone(), call.pot.clone(), *amount).into_val(e),
                    },
                    sub_invocations: vec![e],
                }),
            ]);
            pot.try_deposit(&me, &me, amount)
        }
        PotAction::Withdraw(amount, data) => pot.try_withdraw(&me, &me, amount, data),
        PotAction::Transfer(to, data) => pot.try_confidential_transfer(&me, to, data),
    };
    match outcome {
        Ok(Ok(())) => Ok(()),
        Err(Ok(error)) if error.is_type(soroban_sdk::xdr::ScErrorType::Contract) => {
            Err(2000 + error.get_code())
        }
        _ => Err(2000),
    }
}

/// Releases what a declined or finished deposit request held back.
pub(crate) fn release_reserved(e: &Env, call: &PotCall) {
    if let Some(token) = &call.reserved_token {
        add_committed(e, token, -call.reserved_amount);
    }
}
