//! ancora organization.
//!
//! One contract per organization. It is the organization's account on Stellar: it holds the
//! organization's token balance, knows its members by address (their passkey-secured smart
//! accounts) through OpenZeppelin AccessControl, and enforces the approval rules itself.
//! A payment or a membership/rule change is a request; members approve with their own
//! `require_auth`; once the rules are satisfied the contract executes it.
#![no_std]

mod rules;
mod templates;
mod types;

use soroban_sdk::{
    contract, contractclient, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, BytesN, Env, String, Symbol, Vec,
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
const MAX_PAGE: u32 = 50;
const SECONDS_PER_HOUR: u64 = 3_600;

#[contractclient(name = "RegistryClient")]
pub trait RegistryInterface {
    fn set_membership(e: Env, org: Address, member: Address, is_member: bool);
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Info,
    Policy,
    PolicyHash,
    RequestCount,
    Committed,
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

#[contract]
pub struct Organization;

#[contractimpl]
impl Organization {
    /// Creates the organization from a template: the founder gets `founder_role`, roles and
    /// rules come from the template; `policy_hash` is the SHA-256 of its canonical policy document. The contract is its own AccessControl admin, so positions
    /// change only through its governance; the deployer (operator) holds no role.
    ///
    /// Auth: none (deployment).
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        e: &Env,
        registry: Address,
        token: Address,
        founder: Address,
        founder_role: Symbol,
        template: Symbol,
        name: String,
        policy_hash: BytesN<32>,
    ) {
        if name.len() > MAX_NAME_LEN {
            panic_with_error!(e, Error::TextTooLong);
        }
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
            token,
            registry,
            founder,
            roles: blueprint.roles,
            created_at: e.ledger().timestamp(),
        };
        e.storage().instance().set(&DataKey::Info, &info);
        e.storage()
            .instance()
            .set(&DataKey::Policy, &blueprint.policy);
        e.storage()
            .instance()
            .set(&DataKey::PolicyHash, &policy_hash);
        e.storage().instance().set(&DataKey::RequestCount, &0u64);
        e.storage().instance().set(&DataKey::Committed, &0i128);
        extend_instance(e);
    }

    /// Name, template, token, registry, founder and ranked roles.
    ///
    /// Auth: none (read).
    pub fn info(e: &Env) -> OrgInfo {
        load_info(e)
    }

    /// The approval rules in token minor units.
    ///
    /// Auth: none (read).
    pub fn policy(e: &Env) -> Policy {
        load_policy(e)
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

    /// Token balance minus what open payment requests have promised.
    ///
    /// Auth: none (read).
    pub fn available(e: &Env) -> i128 {
        available(e, &load_info(e))
    }

    /// Proposes a payment from the organization's balance. Executes at once if the rules need
    /// no approval; otherwise waits for approvals (and the seal) and the objection window.
    ///
    /// Auth: `by`, a member.
    pub fn propose_payment(
        e: &Env,
        by: Address,
        to: Address,
        amount: i128,
        memo: String,
    ) -> Result<u64, Error> {
        by.require_auth();
        extend_instance(e);
        let info = load_info(e);
        let members = ranked(e, &info.roles);
        rules::rank_of_member(&members, &by).ok_or(Error::NotMember)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if memo.len() > MAX_MEMO_LEN {
            return Err(Error::TextTooLong);
        }
        if amount > available(e, &info) {
            return Err(Error::InsufficientFunds);
        }
        let policy = load_policy(e);
        let evaluation = rules::evaluate_payment(&policy, amount, !has_paid(e, &to))?;
        let request = new_request(
            e,
            RequestKind::Payment(Payment { to, amount, memo }),
            by,
            evaluation,
        );
        add_committed(e, amount);
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
            add_committed(e, -payment.amount);
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

fn committed(e: &Env) -> i128 {
    e.storage().instance().get(&DataKey::Committed).unwrap_or(0)
}

fn add_committed(e: &Env, delta: i128) {
    e.storage()
        .instance()
        .set(&DataKey::Committed, &(committed(e) + delta));
}

fn available(e: &Env, info: &OrgInfo) -> i128 {
    let balance = token::Client::new(e, &info.token).balance(&e.current_contract_address());
    balance - committed(e)
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
            token::Client::new(e, &info.token).transfer(
                &e.current_contract_address(),
                &payment.to,
                &payment.amount,
            );
            add_committed(e, -payment.amount);
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
    }
    Ok(())
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
