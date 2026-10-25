//! ancora organization.
//!
//! One contract per organization. It is the organization's account on Stellar: it holds the
//! organization's balances in the stablecoins it accepts, knows its members by address (their
//! passkey-secured smart accounts) through OpenZeppelin AccessControl, and enforces the
//! approval rules itself.
//! A payment or a membership/rule change is a request; members approve with their own
//! `require_auth`; once the rules are satisfied the contract executes it.
#![no_std]

mod rules;
mod templates;
mod types;

use soroban_sdk::auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation};
use soroban_sdk::{
    contract, contractclient, contractevent, contractimpl, contracttype, panic_with_error, token,
    vec, Address, BytesN, Env, IntoVal, String, Symbol, Val, Vec,
};
use stellar_access::access_control::{self as access_control, AccessControl};

pub use types::*;

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_EXTEND: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const REQUEST_EXTEND: u32 = 60 * DAY_IN_LEDGERS;
const REQUEST_THRESHOLD: u32 = 14 * DAY_IN_LEDGERS;
const MAX_MEMO_LEN: u32 = 140;
const MAX_NAME_LEN: u32 = 64;
const MAX_LOGO_LEN: u32 = 256;
const MAX_PAGE: u32 = 50;
const SECONDS_PER_HOUR: u64 = 3_600;

#[contractclient(name = "RegistryClient")]
pub trait RegistryInterface {
    fn set_membership(e: Env, org: Address, member: Address, is_member: bool);
}

/// The part of a DeFindex vault the Reserve uses (paltalabs/defindex `vault`). The vault is also
/// the share token, so `balance` is the organization's shares.
#[contractclient(name = "VaultClient")]
pub trait VaultInterface {
    fn deposit(
        e: Env,
        amounts_desired: Vec<i128>,
        amounts_min: Vec<i128>,
        from: Address,
        invest: bool,
    ) -> (Vec<i128>, i128, Val);
    fn withdraw(
        e: Env,
        withdraw_shares: i128,
        min_amounts_out: Vec<i128>,
        from: Address,
    ) -> Vec<i128>;
    fn balance(e: Env, id: Address) -> i128;
    fn get_asset_amounts_per_shares(e: Env, vault_shares: i128) -> Vec<i128>;
}

/// Tolerated rounding on a Reserve withdrawal, in basis points of the requested amount.
const WITHDRAW_TOLERANCE_BPS: i128 = 100;

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Info,
    Policy,
    PolicyHash,
    Assets,
    RequestCount,
    /// Amount promised to open payment requests, per token.
    Committed(Address),
    /// What was moved into the Reserve of a token and not taken out again.
    ReservePrincipal(Address),
    /// A member's spending limit (crew / agent allowance).
    Limit(Address),
    /// Spent per budget category in the running window.
    BudgetUse(Symbol),
    Request(u64),
    Paid(Address),
}

/// Emitted whenever a request is created or changes status.
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct RequestEvent {
    #[topic]
    pub id: u64,
    pub status: u32,
}

/// Emitted when a Lifeline recovery hands a position to a new pass.
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct MemberRecovered {
    #[topic]
    pub old: Address,
    pub new: Address,
}

#[contract]
pub struct Organization;

#[contractimpl]
impl Organization {
    /// Creates the organization from a template: the founder gets `founder_role`, roles and
    /// rules come from the template; `policy_hash` is the SHA-256 of its canonical policy
    /// document. The rules are written in `base_currency`; `assets` are the tokens it accepts
    /// (at least one). The contract is its own AccessControl admin, so positions change only
    /// through its governance; the deployer (operator) holds no role. `recovery` is ancora's
    /// Lifeline contract, the only caller allowed to hand a position to a person's new pass.
    ///
    /// Auth: none (deployment).
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        e: &Env,
        registry: Address,
        recovery: Address,
        base_currency: Symbol,
        assets: Vec<AssetSpec>,
        founder: Address,
        founder_role: Symbol,
        template: Symbol,
        name: String,
        policy_hash: BytesN<32>,
    ) {
        if name.len() > MAX_NAME_LEN {
            panic_with_error!(e, Error::TextTooLong);
        }
        if assets.is_empty() {
            panic_with_error!(e, Error::UnknownAsset);
        }
        let mut accepted: Vec<Asset> = Vec::new(e);
        for spec in assets.iter() {
            match register_asset(e, &accepted, &spec) {
                Ok(asset) => accepted.push_back(asset),
                Err(error) => panic_with_error!(e, error),
            }
        }
        e.storage().instance().set(&DataKey::Assets, &accepted);
        let Some(blueprint) = templates::template(e, &template) else {
            panic_with_error!(e, Error::UnknownTemplate);
        };
        if rules::rank_of(&blueprint.roles, &founder_role).is_none() {
            panic_with_error!(e, Error::UnknownRole);
        }
        access_control::set_admin(e, &e.current_contract_address());
        access_control::grant_role_no_auth(e, &founder, &founder_role, &founder);
        let info = OrgInfo {
            name,
            template,
            base_currency,
            registry,
            recovery,
            founder,
            roles: blueprint.roles,
            created_at: e.ledger().timestamp(),
            logo: String::from_str(e, ""),
        };
        e.storage().instance().set(&DataKey::Info, &info);
        e.storage()
            .instance()
            .set(&DataKey::Policy, &blueprint.policy);
        e.storage()
            .instance()
            .set(&DataKey::PolicyHash, &policy_hash);
        e.storage().instance().set(&DataKey::RequestCount, &0u64);
        extend_instance(e);
    }

    /// Name, template, base currency, registry, founder, ranked roles and logo.
    ///
    /// Auth: none (read).
    pub fn info(e: &Env) -> OrgInfo {
        load_info(e)
    }

    /// Sets the logo URL (empty clears it). Cosmetic, so no request: the top role decides.
    ///
    /// Auth: `by`, a member holding the highest role.
    pub fn set_logo(e: &Env, by: Address, logo: String) -> Result<(), Error> {
        by.require_auth();
        extend_instance(e);
        let mut info = load_info(e);
        let members = ranked(e, &info.roles);
        match rules::rank_of_member(&members, &by) {
            None => return Err(Error::NotMember),
            Some(0) => {}
            Some(_) => return Err(Error::NotTopRole),
        }
        if logo.len() > MAX_LOGO_LEN {
            return Err(Error::TextTooLong);
        }
        info.logo = logo;
        e.storage().instance().set(&DataKey::Info, &info);
        Ok(())
    }

    /// The approval rules, amounts in minor units of the base currency.
    ///
    /// Auth: none (read).
    pub fn policy(e: &Env) -> Policy {
        load_policy(e)
    }

    /// The tokens the organization accepts, each with the currency it stands for.
    ///
    /// Auth: none (read).
    pub fn assets(e: &Env) -> Vec<Asset> {
        load_assets(e)
    }

    /// SHA-256 of the canonical policy document the active rules were compiled from, so anyone
    /// can check the readable rules against the contract.
    ///
    /// Auth: none (read).
    pub fn policy_hash(e: &Env) -> BytesN<32> {
        let Some(hash) = e.storage().instance().get(&DataKey::PolicyHash) else {
            panic_with_error!(e, Error::NotFound);
        };
        hash
    }

    /// The rules' budgets with what was booked against each in its running window.
    ///
    /// Auth: none (read).
    pub fn budgets(e: &Env) -> Vec<BudgetView> {
        let policy = load_policy(e);
        let mut result = Vec::new(e);
        for budget in policy.budgets.iter() {
            let used = current_budget_use(e, &budget);
            result.push_back(BudgetView {
                budget,
                spent: used.spent,
                window_start: used.window_start,
            });
        }
        result
    }

    /// Spending limits currently granted, with what was spent in the running window.
    ///
    /// Auth: none (read).
    pub fn spending_limits(e: &Env) -> Vec<MemberLimit> {
        let info = load_info(e);
        let mut result = Vec::new(e);
        for (member, _) in ranked(e, &info.roles).iter() {
            if let Some(limit) = e
                .storage()
                .persistent()
                .get::<DataKey, SpendingLimit>(&DataKey::Limit(member.clone()))
            {
                result.push_back(MemberLimit {
                    member,
                    limit: current_window(e, limit),
                });
            }
        }
        result
    }

    /// Every member with their position, highest roles first.
    ///
    /// Auth: none (read).
    pub fn members(e: &Env) -> Vec<Member> {
        let info = load_info(e);
        let mut result = Vec::new(e);
        for role in info.roles.iter() {
            let count = access_control::get_role_member_count(e, &role);
            for index in 0..count {
                result.push_back(Member {
                    address: access_control::get_role_member(e, &role, index),
                    role: role.clone(),
                });
            }
        }
        result
    }

    /// Hands `old`'s position and spending limit to `new`: a Lifeline recovery, after the
    /// person's guardians confirmed the new pass and the waiting period passed. The founder
    /// flag moves along so a recovered founder can finish setting up. Money never moves.
    ///
    /// Auth: the recovery contract named at deployment.
    pub fn recover_member(e: &Env, old: Address, new: Address) -> Result<(), Error> {
        let mut info = load_info(e);
        info.recovery.require_auth();
        extend_instance(e);
        let members = ranked(e, &info.roles);
        let rank = rules::rank_of_member(&members, &old).ok_or(Error::NotMember)?;
        if rules::rank_of_member(&members, &new).is_some() {
            return Err(Error::AlreadyMember);
        }
        let role = info.roles.get(rank).ok_or(Error::UnknownRole)?;
        let me = e.current_contract_address();
        // Grant first, then revoke: the role's member list then updates an entry in place instead
        // of deleting and re-creating the same storage key within one call.
        access_control::grant_role_no_auth(e, &new, &role, &me);
        revoke_current_role(e, &info, &old);
        let old_limit = DataKey::Limit(old.clone());
        if let Some(limit) = e
            .storage()
            .persistent()
            .get::<DataKey, SpendingLimit>(&old_limit)
        {
            e.storage()
                .persistent()
                .set(&DataKey::Limit(new.clone()), &limit);
            e.storage().persistent().remove(&old_limit);
        }
        if info.founder == old {
            info.founder = new.clone();
            e.storage().instance().set(&DataKey::Info, &info);
        }
        let registry = RegistryClient::new(e, &info.registry);
        registry.set_membership(&me, &old, &false);
        registry.set_membership(&me, &new, &true);
        MemberRecovered { old, new }.publish(e);
        Ok(())
    }

    /// Whether only the founder could act: nobody else can satisfy the strictest tier yet, so
    /// the founder changes members and rules directly, like choosing initial signers.
    ///
    /// Auth: none (read).
    pub fn is_setup_phase(e: &Env) -> bool {
        let info = load_info(e);
        let members = ranked(e, &info.roles);
        rules::is_setup_phase(e, &info.roles, &members, &load_policy(e), &info.founder)
    }

    /// Number of requests ever created; ids run from 1 to this number.
    ///
    /// Auth: none (read).
    pub fn request_count(e: &Env) -> u64 {
        load_count(e)
    }

    /// Requests newest first, skipping `offset` and returning at most `limit` (≤ 50).
    ///
    /// Auth: none (read).
    pub fn requests(e: &Env, offset: u32, limit: u32) -> Vec<Request> {
        let count = load_count(e);
        let mut result = Vec::new(e);
        let mut id = count.saturating_sub(u64::from(offset));
        while id >= 1 && result.len() < limit.min(MAX_PAGE) {
            if let Some(request) = e.storage().persistent().get(&DataKey::Request(id)) {
                result.push_back(request);
            }
            id -= 1;
        }
        result
    }

    /// One request by id.
    ///
    /// Auth: none (read).
    pub fn request(e: &Env, id: u64) -> Result<Request, Error> {
        load_request(e, id)
    }

    /// Whether a payment to `to` has gone out before (the new-recipient rule).
    ///
    /// Auth: none (read).
    pub fn has_paid(e: &Env, to: Address) -> bool {
        has_paid(e, &to)
    }

    /// Balance of `token` minus what open payment requests in it have promised.
    ///
    /// Auth: none (read).
    pub fn available(e: &Env, token: Address) -> Result<i128, Error> {
        find_asset(&load_assets(e), &token)?;
        Ok(available(e, &token))
    }

    /// The Reserve of `token`: shares in its vault, their value today and the principal put in.
    ///
    /// Auth: none (read).
    pub fn reserve(e: &Env, token: Address) -> Result<ReserveView, Error> {
        let asset = find_asset(&load_assets(e), &token)?;
        let vault = asset.vault.ok_or(Error::NoReserve)?;
        let (shares, value) = reserve_value(e, &vault);
        Ok(ReserveView {
            vault,
            shares,
            value,
            principal: reserve_principal(e, &token),
        })
    }

    /// Moves `amount` of `token` from the account into its Reserve vault. Money never leaves
    /// the organization, so this needs no request: the top role or anyone who could approve
    /// the strictest tier may do it.
    ///
    /// Auth: `by`, a member with treasury rights.
    pub fn move_to_reserve(
        e: &Env,
        by: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        by.require_auth();
        extend_instance(e);
        let (asset, vault) = reserve_asset(e, &by, &token)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if amount > available(e, &asset.token) {
            return Err(Error::InsufficientFunds);
        }
        let me = e.current_contract_address();
        // The vault pulls the tokens from this contract, which must authorize that sub-call.
        e.authorize_as_current_contract(vec![
            e,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: asset.token.clone(),
                    fn_name: Symbol::new(e, "transfer"),
                    args: (me.clone(), vault.clone(), amount).into_val(e),
                },
                sub_invocations: vec![e],
            }),
        ]);
        VaultClient::new(e, &vault).deposit(&vec![e, amount], &vec![e, amount], &me, &true);
        set_reserve_principal(e, &token, reserve_principal(e, &token) + amount);
        Ok(())
    }

    /// Takes `amount` of `token` out of its Reserve back to the account.
    ///
    /// Auth: `by`, a member with treasury rights.
    pub fn withdraw_from_reserve(
        e: &Env,
        by: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        by.require_auth();
        extend_instance(e);
        let (_, vault) = reserve_asset(e, &by, &token)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let (shares, value) = reserve_value(e, &vault);
        if amount > value || value <= 0 {
            return Err(Error::InsufficientFunds);
        }
        // Shares worth `amount`, rounded up, never more than we hold.
        let burn = shares
            .checked_mul(amount)
            .and_then(|product| product.checked_add(value - 1))
            .map(|rounded| (rounded / value).min(shares))
            .ok_or(Error::InvalidAmount)?;
        let minimum = amount - amount * WITHDRAW_TOLERANCE_BPS / 10_000;
        let me = e.current_contract_address();
        VaultClient::new(e, &vault).withdraw(&burn, &vec![e, minimum], &me);
        let principal = reserve_principal(e, &token);
        set_reserve_principal(e, &token, principal - amount.min(principal));
        Ok(())
    }

    /// Proposes a payment in one of the accepted tokens. Executes at once if the rules need
    /// no approval; otherwise waits for approvals (and the seal) and the objection window.
    /// A token of another currency than the rules' takes the strictest tier and the seal.
    ///
    /// Auth: `by`, a member.
    pub fn propose_payment(
        e: &Env,
        by: Address,
        token: Address,
        to: Address,
        amount: i128,
        memo: String,
        category: Option<Symbol>,
    ) -> Result<u64, Error> {
        by.require_auth();
        extend_instance(e);
        let info = load_info(e);
        let members = ranked(e, &info.roles);
        rules::rank_of_member(&members, &by).ok_or(Error::NotMember)?;
        let asset = find_asset(&load_assets(e), &token)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if memo.len() > MAX_MEMO_LEN {
            return Err(Error::TextTooLong);
        }
        if amount > available(e, &token) {
            return Err(Error::InsufficientFunds);
        }
        let policy = load_policy(e);
        let amount_in_base = (asset.currency == info.base_currency).then_some(amount);
        // Budgets are measured in the rules' currency: a payment in another currency can't be
        // counted, so a hard budget refuses it and a soft one treats it as over budget.
        let budget = match &category {
            Some(name) => Some(find_budget(&policy, name)?),
            None => None,
        };
        let over_budget = match (&budget, amount_in_base) {
            (None, _) => false,
            (Some(b), Some(a)) if a <= budget_room(e, b) => false,
            (Some(b), _) if b.hard => return Err(Error::BudgetExceeded),
            (Some(_), _) => true,
        };
        // Inside the requester's spending limit (rules' currency only) nothing needs approval,
        // unless the payment is over its budget: then approvers must see it.
        let within_limit =
            !over_budget && amount_in_base.and_then(|a| use_limit(e, &by, a)).is_some();
        let evaluation = if within_limit {
            rules::limit_evaluation(e)
        } else {
            rules::evaluate_payment(&policy, amount_in_base, !has_paid(e, &to), over_budget)?
        };
        if let (Some(b), Some(a)) = (&budget, amount_in_base) {
            book_budget(e, b, a);
        }
        let request = new_request(
            e,
            RequestKind::Payment(Payment {
                token: token.clone(),
                to,
                amount,
                memo,
                category,
            }),
            by,
            evaluation,
        );
        add_committed(e, &token, amount);
        let settled = settle(e, request, &info);
        save_request(e, &settled);
        Ok(settled.id)
    }

    /// Proposes a membership or rule change. Always uses the strictest tier.
    ///
    /// Auth: `by`, a member.
    pub fn propose_change(e: &Env, by: Address, change: Change) -> Result<u64, Error> {
        by.require_auth();
        extend_instance(e);
        let info = load_info(e);
        let members = ranked(e, &info.roles);
        rules::rank_of_member(&members, &by).ok_or(Error::NotMember)?;
        let policy = load_policy(e);
        plan_change(e, &info, &members, &policy, &change)?;
        let evaluation = rules::evaluate_governance(&policy)?;
        let request = new_request(e, RequestKind::Change(change), by, evaluation);
        let settled = settle(e, request, &info);
        save_request(e, &settled);
        Ok(settled.id)
    }

    /// Applies a change without a request. Only the founder, only while nobody else could
    /// satisfy the rules (the setup phase).
    ///
    /// Auth: `by`, the founder.
    pub fn change_directly(e: &Env, by: Address, change: Change) -> Result<(), Error> {
        by.require_auth();
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
        apply_change(e, &info, &change)
    }

    /// Approves a pending request. The requester's approval never counts; each person counts
    /// once; only roles the request asks for (or higher) may approve.
    ///
    /// Auth: `by`, a member.
    pub fn approve(e: &Env, by: Address, id: u64) -> Result<(), Error> {
        by.require_auth();
        extend_instance(e);
        let info = load_info(e);
        let members = ranked(e, &info.roles);
        let mut request = load_request(e, id)?;
        if request.status != Status::Pending {
            return Err(Error::NotPending);
        }
        let rank = rules::rank_of_member(&members, &by).ok_or(Error::NotMember)?;
        if by == request.requester {
            return Err(Error::RequesterCannotApprove);
        }
        if request.approvals.contains(&by) {
            return Err(Error::AlreadyApproved);
        }
        let required = &request.evaluation.approvals;
        if !rules::is_eligible(&info.roles, required, Some(rank)) {
            return Err(Error::RoleCannotApprove);
        }
        if !rules::approval_would_count(
            e,
            &info.roles,
            &members,
            required,
            &request.approvals,
            &request.requester,
            &by,
        ) {
            return Err(Error::ApprovalNotNeeded);
        }
        request.approvals.push_back(by);
        let settled = settle(e, request, &info);
        save_request(e, &settled);
        Ok(())
    }

    /// Adds the security seal to a pending request that needs one. Until the ML-DSA verifier
    /// lands (see docs/ROADMAP.md), any eligible approver other than the requester may seal.
    ///
    /// Auth: `by`, a member.
    pub fn seal(e: &Env, by: Address, id: u64) -> Result<(), Error> {
        by.require_auth();
        extend_instance(e);
        let info = load_info(e);
        let members = ranked(e, &info.roles);
        let mut request = load_request(e, id)?;
        if request.status != Status::Pending {
            return Err(Error::NotPending);
        }
        if !request.evaluation.seal_required {
            return Err(Error::SealNotRequired);
        }
        if request.sealed_by.is_some() {
            return Err(Error::AlreadySealed);
        }
        let rank = rules::rank_of_member(&members, &by).ok_or(Error::NotMember)?;
        if by == request.requester {
            return Err(Error::RequesterCannotApprove);
        }
        if !rules::is_eligible(&info.roles, &request.evaluation.approvals, Some(rank)) {
            return Err(Error::RoleCannotApprove);
        }
        request.sealed_by = Some(by);
        let settled = settle(e, request, &info);
        save_request(e, &settled);
        Ok(())
    }

    /// Declines a pending request, objects during the objection window, or cancels one's own.
    ///
    /// Auth: `by`, the requester or an eligible approver.
    pub fn decline(e: &Env, by: Address, id: u64) -> Result<(), Error> {
        by.require_auth();
        extend_instance(e);
        let info = load_info(e);
        let members = ranked(e, &info.roles);
        let mut request = load_request(e, id)?;
        if request.status != Status::Pending && request.status != Status::Scheduled {
            return Err(Error::CannotDecline);
        }
        let rank = rules::rank_of_member(&members, &by);
        let may_decline = by == request.requester
            || rules::is_eligible(&info.roles, &request.evaluation.approvals, rank);
        if !may_decline {
            return Err(Error::CannotDecline);
        }
        request.status = Status::Declined;
        request.decided_by = Some(by);
        if let RequestKind::Payment(payment) = &request.kind {
            add_committed(e, &payment.token, -payment.amount);
            release_budget(e, &info, payment);
        }
        save_request(e, &request);
        Ok(())
    }

    /// Executes a request whose objection window has passed. Anyone may call it: the decision
    /// was taken when the approvals completed.
    ///
    /// Auth: none.
    pub fn execute(e: &Env, id: u64) -> Result<(), Error> {
        extend_instance(e);
        let info = load_info(e);
        let mut request = load_request(e, id)?;
        if request.status == Status::Scheduled
            && request
                .execute_after
                .is_some_and(|after| e.ledger().timestamp() >= after)
        {
            request.status = Status::Ready;
        }
        if request.status != Status::Ready {
            return Err(Error::NotReady);
        }
        let executed = execute_now(e, request, &info);
        save_request(e, &executed);
        Ok(())
    }
}

/// Read-only AccessControl entry points (`has_role`, member enumeration). The admin is the
/// contract itself, so the administrative ones can't be invoked by anyone.
#[contractimpl(contracttrait)]
impl AccessControl for Organization {}

fn load_info(e: &Env) -> OrgInfo {
    let Some(info) = e.storage().instance().get(&DataKey::Info) else {
        panic_with_error!(e, Error::NotFound);
    };
    info
}

fn load_policy(e: &Env) -> Policy {
    let Some(policy) = e.storage().instance().get(&DataKey::Policy) else {
        panic_with_error!(e, Error::NotFound);
    };
    policy
}

fn load_count(e: &Env) -> u64 {
    e.storage()
        .instance()
        .get(&DataKey::RequestCount)
        .unwrap_or(0)
}

fn load_request(e: &Env, id: u64) -> Result<Request, Error> {
    e.storage()
        .persistent()
        .get(&DataKey::Request(id))
        .ok_or(Error::NotFound)
}

fn save_request(e: &Env, request: &Request) {
    let key = DataKey::Request(request.id);
    e.storage().persistent().set(&key, request);
    e.storage()
        .persistent()
        .extend_ttl(&key, REQUEST_THRESHOLD, REQUEST_EXTEND);
    RequestEvent {
        id: request.id,
        status: request.status as u32,
    }
    .publish(e);
}

fn new_request(e: &Env, kind: RequestKind, requester: Address, evaluation: Evaluation) -> Request {
    let id = load_count(e) + 1;
    e.storage().instance().set(&DataKey::RequestCount, &id);
    Request {
        id,
        kind,
        requester,
        created_at: e.ledger().timestamp(),
        evaluation,
        approvals: Vec::new(e),
        sealed_by: None,
        status: Status::Pending,
        execute_after: None,
        decided_by: None,
        failure: None,
    }
}

fn has_paid(e: &Env, to: &Address) -> bool {
    e.storage().persistent().has(&DataKey::Paid(to.clone()))
}

fn committed(e: &Env, token: &Address) -> i128 {
    e.storage()
        .instance()
        .get(&DataKey::Committed(token.clone()))
        .unwrap_or(0)
}

fn add_committed(e: &Env, token: &Address, delta: i128) {
    e.storage().instance().set(
        &DataKey::Committed(token.clone()),
        &(committed(e, token) + delta),
    );
}

fn available(e: &Env, token: &Address) -> i128 {
    let balance = token::Client::new(e, token).balance(&e.current_contract_address());
    balance - committed(e, token)
}

/// The asset and its vault, once `by` is known to have treasury rights.
fn reserve_asset(e: &Env, by: &Address, token: &Address) -> Result<(Asset, Address), Error> {
    let info = load_info(e);
    let members = ranked(e, &info.roles);
    let rank = rules::rank_of_member(&members, by).ok_or(Error::NotMember)?;
    if !rules::can_manage_treasury(&info.roles, &load_policy(e), Some(rank)) {
        return Err(Error::NotTreasurer);
    }
    let asset = find_asset(&load_assets(e), token)?;
    let vault = asset.vault.clone().ok_or(Error::NoReserve)?;
    Ok((asset, vault))
}

/// Shares held in `vault` and what they are worth in the vault's asset right now.
fn reserve_value(e: &Env, vault: &Address) -> (i128, i128) {
    let client = VaultClient::new(e, vault);
    let shares = client.balance(&e.current_contract_address());
    if shares <= 0 {
        return (0, 0);
    }
    let value = client
        .get_asset_amounts_per_shares(&shares)
        .first()
        .unwrap_or(0);
    (shares, value)
}

fn reserve_principal(e: &Env, token: &Address) -> i128 {
    e.storage()
        .instance()
        .get(&DataKey::ReservePrincipal(token.clone()))
        .unwrap_or(0)
}

fn set_reserve_principal(e: &Env, token: &Address, principal: i128) {
    e.storage()
        .instance()
        .set(&DataKey::ReservePrincipal(token.clone()), &principal);
}

fn load_assets(e: &Env) -> Vec<Asset> {
    e.storage()
        .instance()
        .get(&DataKey::Assets)
        .unwrap_or_else(|| Vec::new(e))
}

fn save_assets(e: &Env, assets: &Vec<Asset>) {
    e.storage().instance().set(&DataKey::Assets, assets);
}

fn find_asset(assets: &Vec<Asset>, token: &Address) -> Result<Asset, Error> {
    assets
        .iter()
        .find(|asset| asset.token == *token)
        .ok_or(Error::UnknownAsset)
}

/// Describes a token to accept, refusing one that is already accepted. Symbol and decimals
/// come from the token contract itself, so a non-token address fails here.
fn register_asset(e: &Env, accepted: &Vec<Asset>, spec: &AssetSpec) -> Result<Asset, Error> {
    if find_asset(accepted, &spec.token).is_ok() {
        return Err(Error::AssetExists);
    }
    let client = token::Client::new(e, &spec.token);
    Ok(Asset {
        token: spec.token.clone(),
        currency: spec.currency.clone(),
        symbol: client.symbol(),
        decimals: client.decimals(),
        vault: spec.vault.clone(),
    })
}

/// Members with the rank of their role (0 = highest).
fn ranked(e: &Env, roles: &Vec<Symbol>) -> Vec<rules::Ranked> {
    let mut result = Vec::new(e);
    for (rank, role) in roles.iter().enumerate() {
        let count = access_control::get_role_member_count(e, &role);
        for index in 0..count {
            result.push_back((
                access_control::get_role_member(e, &role, index),
                rank as u32,
            ));
        }
    }
    result
}

/// Moves a fully approved pending request on: into the objection window, or straight to
/// execution when there is none.
fn settle(e: &Env, mut request: Request, info: &OrgInfo) -> Request {
    if request.status != Status::Pending {
        return request;
    }
    let members = ranked(e, &info.roles);
    let progress = rules::approval_progress(
        e,
        &info.roles,
        &members,
        &request.evaluation.approvals,
        &request.approvals,
        &request.requester,
    );
    let sealed = !request.evaluation.seal_required || request.sealed_by.is_some();
    if !progress.satisfied || !sealed {
        return request;
    }
    let hours = u64::from(request.evaluation.objection_window_hours);
    if hours > 0 {
        request.status = Status::Scheduled;
        request.execute_after = Some(e.ledger().timestamp() + hours * SECONDS_PER_HOUR);
        return request;
    }
    request.status = Status::Ready;
    execute_now(e, request, info)
}

fn execute_now(e: &Env, mut request: Request, info: &OrgInfo) -> Request {
    match &request.kind {
        RequestKind::Payment(payment) => {
            // The contract is the direct invoker of the token, so its own authorization is implied.
            token::Client::new(e, &payment.token).transfer(
                &e.current_contract_address(),
                &payment.to,
                &payment.amount,
            );
            add_committed(e, &payment.token, -payment.amount);
            e.storage()
                .persistent()
                .set(&DataKey::Paid(payment.to.clone()), &true);
            request.status = Status::Executed;
        }
        RequestKind::Change(change) => match apply_change(e, info, change) {
            Ok(()) => request.status = Status::Executed,
            Err(error) => {
                request.status = Status::Failed;
                request.failure = Some(error as u32);
            }
        },
    }
    request
}

/// Validates a change against the current members and rules and returns the membership it
/// would leave behind, refusing changes that would lock the organization out of its rules.
fn plan_change(
    e: &Env,
    info: &OrgInfo,
    members: &Vec<rules::Ranked>,
    policy: &Policy,
    change: &Change,
) -> Result<(Vec<rules::Ranked>, Policy), Error> {
    let mut after: Vec<rules::Ranked> = Vec::new(e);
    for member in members.iter() {
        after.push_back(member);
    }
    let mut next_policy = policy.clone();
    match change {
        Change::AddMember(who, role) => {
            if rules::rank_of_member(members, who).is_some() {
                return Err(Error::AlreadyMember);
            }
            let rank = rules::rank_of(&info.roles, role).ok_or(Error::UnknownRole)?;
            after.push_back((who.clone(), rank));
        }
        Change::RemoveMember(who) => {
            let index = members
                .iter()
                .position(|(address, _)| address == *who)
                .ok_or(Error::NotMember)?;
            after.remove(index as u32);
        }
        Change::ChangeRole(who, role) => {
            let index = members
                .iter()
                .position(|(address, _)| address == *who)
                .ok_or(Error::NotMember)?;
            let rank = rules::rank_of(&info.roles, role).ok_or(Error::UnknownRole)?;
            after.set(index as u32, (who.clone(), rank));
        }
        Change::UpdatePolicy(updated, _) => {
            rules::validate_policy(updated, &info.roles)?;
            next_policy = updated.clone();
        }
        Change::AddAsset(spec) => {
            if find_asset(&load_assets(e), &spec.token).is_ok() {
                return Err(Error::AssetExists);
            }
        }
        Change::RemoveAsset(token) => {
            let assets = load_assets(e);
            find_asset(&assets, token)?;
            if assets.len() <= 1 {
                return Err(Error::LastAsset);
            }
            let balance = token::Client::new(e, token).balance(&e.current_contract_address());
            if balance != 0 || committed(e, token) != 0 {
                return Err(Error::AssetInUse);
            }
        }
        Change::SetSpendingLimit(who, amount, period) => {
            rules::rank_of_member(members, who).ok_or(Error::NotMember)?;
            if *amount < 0 || (*amount > 0 && *period == 0) {
                return Err(Error::InvalidLimit);
            }
        }
    }
    let strictest = |p: &Policy| {
        p.tiers
            .last()
            .map(|t| t.approvals)
            .unwrap_or_else(|| Vec::new(e))
    };
    let satisfiable_now =
        rules::can_be_satisfied(e, &info.roles, members, &strictest(policy), None);
    let satisfiable_after =
        rules::can_be_satisfied(e, &info.roles, &after, &strictest(&next_policy), None);
    if satisfiable_now && !satisfiable_after {
        return Err(Error::WouldLockAccount);
    }
    Ok((after, next_policy))
}

fn apply_change(e: &Env, info: &OrgInfo, change: &Change) -> Result<(), Error> {
    let members = ranked(e, &info.roles);
    let policy = load_policy(e);
    let (_, next_policy) = plan_change(e, info, &members, &policy, change)?;
    let registry = RegistryClient::new(e, &info.registry);
    let me = e.current_contract_address();
    match change {
        Change::AddMember(who, role) => {
            access_control::grant_role_no_auth(e, who, role, &me);
            registry.set_membership(&me, who, &true);
        }
        Change::RemoveMember(who) => {
            revoke_current_role(e, info, who);
            e.storage()
                .persistent()
                .remove(&DataKey::Limit(who.clone()));
            registry.set_membership(&me, who, &false);
        }
        Change::ChangeRole(who, role) => {
            revoke_current_role(e, info, who);
            access_control::grant_role_no_auth(e, who, role, &me);
        }
        Change::UpdatePolicy(_, document_hash) => {
            e.storage().instance().set(&DataKey::Policy, &next_policy);
            e.storage()
                .instance()
                .set(&DataKey::PolicyHash, document_hash);
        }
        Change::AddAsset(spec) => {
            let mut assets = load_assets(e);
            let asset = register_asset(e, &assets, spec)?;
            assets.push_back(asset);
            save_assets(e, &assets);
        }
        Change::RemoveAsset(token) => {
            let mut kept = Vec::new(e);
            for asset in load_assets(e).iter() {
                if asset.token != *token {
                    kept.push_back(asset);
                }
            }
            save_assets(e, &kept);
        }
        Change::SetSpendingLimit(who, amount, period) => {
            let key = DataKey::Limit(who.clone());
            if *amount == 0 {
                e.storage().persistent().remove(&key);
            } else {
                let limit = SpendingLimit {
                    amount: *amount,
                    period_seconds: *period,
                    spent: 0,
                    window_start: e.ledger().timestamp(),
                };
                e.storage().persistent().set(&key, &limit);
                e.storage()
                    .persistent()
                    .extend_ttl(&key, REQUEST_THRESHOLD, REQUEST_EXTEND);
            }
        }
    }
    Ok(())
}

/// The limit with its window rolled forward to now (spent resets when a period has passed).
fn current_window(e: &Env, limit: SpendingLimit) -> SpendingLimit {
    let now = e.ledger().timestamp();
    if now >= limit.window_start.saturating_add(limit.period_seconds) {
        SpendingLimit {
            spent: 0,
            window_start: now,
            ..limit
        }
    } else {
        limit
    }
}

/// Books `amount` against `by`'s spending limit if it fits; `None` when there is no limit or
/// the window has no room left, in which case the normal rules apply.
fn use_limit(e: &Env, by: &Address, amount: i128) -> Option<()> {
    let key = DataKey::Limit(by.clone());
    let limit = current_window(e, e.storage().persistent().get(&key)?);
    if limit.spent.checked_add(amount)? > limit.amount {
        return None;
    }
    e.storage().persistent().set(
        &key,
        &SpendingLimit {
            spent: limit.spent + amount,
            ..limit
        },
    );
    e.storage()
        .persistent()
        .extend_ttl(&key, REQUEST_THRESHOLD, REQUEST_EXTEND);
    Some(())
}

fn find_budget(policy: &Policy, category: &Symbol) -> Result<Budget, Error> {
    policy
        .budgets
        .iter()
        .find(|b| b.category == *category)
        .ok_or(Error::UnknownBudget)
}

/// What was booked against the budget, with the window rolled forward to now.
fn current_budget_use(e: &Env, budget: &Budget) -> BudgetUse {
    let now = e.ledger().timestamp();
    let used: BudgetUse = e
        .storage()
        .persistent()
        .get(&DataKey::BudgetUse(budget.category.clone()))
        .unwrap_or(BudgetUse {
            spent: 0,
            window_start: now,
        });
    if now >= used.window_start.saturating_add(budget.period_seconds) {
        BudgetUse {
            spent: 0,
            window_start: now,
        }
    } else {
        used
    }
}

fn budget_room(e: &Env, budget: &Budget) -> i128 {
    (budget.amount - current_budget_use(e, budget).spent).max(0)
}

fn save_budget_use(e: &Env, category: &Symbol, used: &BudgetUse) {
    let key = DataKey::BudgetUse(category.clone());
    e.storage().persistent().set(&key, used);
    e.storage()
        .persistent()
        .extend_ttl(&key, REQUEST_THRESHOLD, REQUEST_EXTEND);
}

fn book_budget(e: &Env, budget: &Budget, amount: i128) {
    let used = current_budget_use(e, budget);
    save_budget_use(
        e,
        &budget.category,
        &BudgetUse {
            spent: used.spent + amount,
            ..used
        },
    );
}

/// Gives a declined payment's amount back to its budget, when it was booked in this window.
fn release_budget(e: &Env, info: &OrgInfo, payment: &Payment) {
    let Some(category) = &payment.category else {
        return;
    };
    let Ok(asset) = find_asset(&load_assets(e), &payment.token) else {
        return;
    };
    if asset.currency != info.base_currency {
        return;
    }
    let Ok(budget) = find_budget(&load_policy(e), category) else {
        return;
    };
    let used = current_budget_use(e, &budget);
    save_budget_use(
        e,
        category,
        &BudgetUse {
            spent: (used.spent - payment.amount).max(0),
            ..used
        },
    );
}

fn revoke_current_role(e: &Env, info: &OrgInfo, who: &Address) {
    let me = e.current_contract_address();
    for role in info.roles.iter() {
        if access_control::has_role(e, who, &role).is_some() {
            access_control::revoke_role_no_auth(e, who, &role, &me);
        }
    }
}

fn extend_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_EXTEND);
}

#[cfg(test)]
extern crate std;

#[cfg(test)]
mod test;

#[cfg(test)]
mod test_vectors;
