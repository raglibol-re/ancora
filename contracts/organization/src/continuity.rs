//! Lifeline inside the organization: who takes over a position when its holder goes quiet.
//!
//! Every member action records when the member was last seen. A member may have a named
//! successor (another member), an inactivity period and a waiting period, set as a rule change.
//! Once the member was inactive that long, the successor claims the position; any action of the
//! member during the wait (or "I'm still here") cancels the claim. After the wait anyone may
//! finish it: the successor takes the higher of the two roles and the quiet member leaves. Money
//! never moves. This keeps rules like "two of two" from deadlocking when someone is gone.

use soroban_sdk::{contractevent, contractimpl, Address, Env, Vec};
use stellar_access::access_control;

use crate::types::{Error, Succession, SuccessionView};
use crate::{
    controls, extend_instance, load_info, ranked, revoke_current_role, rules, DataKey,
    Organization, OrganizationArgs, OrganizationClient, RegistryClient, REQUEST_EXTEND,
    REQUEST_THRESHOLD,
};

const MIN_PERIOD_SECONDS: u64 = 60;
const MAX_PERIOD_SECONDS: u64 = 2 * 365 * 86_400;

/// 1 claimed, 2 cancelled by the member's activity, 3 handed over.
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct SuccessionEvent {
    #[topic]
    pub member: Address,
    pub successor: Address,
    pub status: u32,
}

#[contractimpl]
impl Organization {
    /// Records that the member is still around; cancels a succession claim on their position.
    ///
    /// Auth: `by`, a member.
    pub fn still_here(e: &Env, by: Address) -> Result<(), Error> {
        by.require_auth();
        extend_instance(e);
        let info = load_info(e);
        rules::rank_of_member(&ranked(e, &info.roles), &by).ok_or(Error::NotMember)?;
        touch(e, &by);
        Ok(())
    }

    /// The named successor claims a quiet member's position; the waiting period starts.
    ///
    /// Auth: `by`, the successor named for `member`.
    pub fn claim_succession(e: &Env, by: Address, member: Address) -> Result<u64, Error> {
        by.require_auth();
        extend_instance(e);
        let info = load_info(e);
        let members = ranked(e, &info.roles);
        rules::rank_of_member(&members, &member).ok_or(Error::NotMember)?;
        rules::rank_of_member(&members, &by).ok_or(Error::NotMember)?;
        let plan = load_plan(e, &member).ok_or(Error::NotSuccessor)?;
        if plan.successor != by {
            return Err(Error::NotSuccessor);
        }
        let now = e.ledger().timestamp();
        if now < last_seen(e, &member, &plan).saturating_add(plan.inactive_seconds) {
            return Err(Error::StillActive);
        }
        let ready_at = now.saturating_add(plan.wait_seconds);
        let key = DataKey::SuccessionClaim(member.clone());
        e.storage().persistent().set(&key, &ready_at);
        e.storage()
            .persistent()
            .extend_ttl(&key, REQUEST_THRESHOLD, REQUEST_EXTEND);
        SuccessionEvent {
            member,
            successor: by,
            status: 1,
        }
        .publish(e);
        Ok(ready_at)
    }

    /// Hands the quiet member's position to their successor once the wait is over.
    ///
    /// Auth: none (the decision was the successor's claim and the member's silence).
    pub fn finish_succession(e: &Env, member: Address) -> Result<(), Error> {
        extend_instance(e);
        let mut info = load_info(e);
        let members = ranked(e, &info.roles);
        let plan = load_plan(e, &member).ok_or(Error::NoSuccessionClaim)?;
        let ready_at: u64 = e
            .storage()
            .persistent()
            .get(&DataKey::SuccessionClaim(member.clone()))
            .ok_or(Error::NoSuccessionClaim)?;
        if e.ledger().timestamp() < ready_at {
            return Err(Error::SuccessionNotReady);
        }
        let member_rank = rules::rank_of_member(&members, &member).ok_or(Error::NotMember)?;
        let successor_rank =
            rules::rank_of_member(&members, &plan.successor).ok_or(Error::NotMember)?;
        // Lower rank numbers are higher roles; the successor keeps whichever is higher.
        let rank = member_rank.min(successor_rank);
        let role = info.roles.get(rank).ok_or(Error::UnknownRole)?;
        let me = e.current_contract_address();
        if rank != successor_rank {
            revoke_current_role(e, &info, &plan.successor);
            access_control::grant_role_no_auth(e, &plan.successor, &role, &me);
        }
        revoke_current_role(e, &info, &member);
        e.storage()
            .persistent()
            .remove(&DataKey::Limit(member.clone()));
        forget(e, &member);
        controls::move_allowances(e, &member, None);
        if info.founder == member {
            info.founder = plan.successor.clone();
            e.storage().instance().set(&DataKey::Info, &info);
        }
        RegistryClient::new(e, &info.registry).set_membership(&me, &member, &false);
        SuccessionEvent {
            member,
            successor: plan.successor,
            status: 3,
        }
        .publish(e);
        Ok(())
    }

    /// Every succession plan with when the member was last seen and any open claim.
    ///
    /// Auth: none (read).
    pub fn successions(e: &Env) -> Vec<SuccessionView> {
        let info = load_info(e);
        let mut result = Vec::new(e);
        for (member, _) in ranked(e, &info.roles).iter() {
            if let Some(plan) = load_plan(e, &member) {
                result.push_back(SuccessionView {
                    member: member.clone(),
                    last_seen: last_seen(e, &member, &plan),
                    claim_ready_at: e
                        .storage()
                        .persistent()
                        .get(&DataKey::SuccessionClaim(member.clone())),
                    successor: plan.successor,
                    inactive_seconds: plan.inactive_seconds,
                    wait_seconds: plan.wait_seconds,
                });
            }
        }
        result
    }
}

/// Records a member action; a member who acts is not gone, so a claim on them ends.
pub(crate) fn touch(e: &Env, member: &Address) {
    let key = DataKey::LastSeen(member.clone());
    e.storage().persistent().set(&key, &e.ledger().timestamp());
    e.storage()
        .persistent()
        .extend_ttl(&key, REQUEST_THRESHOLD, REQUEST_EXTEND);
    let claim = DataKey::SuccessionClaim(member.clone());
    if e.storage().persistent().has(&claim) {
        e.storage().persistent().remove(&claim);
        if let Some(plan) = load_plan(e, member) {
            SuccessionEvent {
                member: member.clone(),
                successor: plan.successor,
                status: 2,
            }
            .publish(e);
        }
    }
}

/// Checks a `SetSuccessor` change: both are members, different, periods within bounds.
pub(crate) fn plan_successor(
    members: &Vec<rules::Ranked>,
    member: &Address,
    successor: &Option<Address>,
    inactive_seconds: u64,
    wait_seconds: u64,
) -> Result<(), Error> {
    rules::rank_of_member(members, member).ok_or(Error::NotMember)?;
    let Some(successor) = successor else {
        return Ok(());
    };
    let in_bounds = |s: u64| (MIN_PERIOD_SECONDS..=MAX_PERIOD_SECONDS).contains(&s);
    if successor == member
        || rules::rank_of_member(members, successor).is_none()
        || !in_bounds(inactive_seconds)
        || !in_bounds(wait_seconds)
    {
        return Err(Error::InvalidSuccession);
    }
    Ok(())
}

pub(crate) fn apply_successor(
    e: &Env,
    member: &Address,
    successor: &Option<Address>,
    inactive_seconds: u64,
    wait_seconds: u64,
) {
    let key = DataKey::Successor(member.clone());
    e.storage()
        .persistent()
        .remove(&DataKey::SuccessionClaim(member.clone()));
    match successor {
        Some(successor) => {
            e.storage().persistent().set(
                &key,
                &Succession {
                    successor: successor.clone(),
                    inactive_seconds,
                    wait_seconds,
                    set_at: e.ledger().timestamp(),
                },
            );
            e.storage()
                .persistent()
                .extend_ttl(&key, REQUEST_THRESHOLD, REQUEST_EXTEND);
        }
        None => e.storage().persistent().remove(&key),
    }
}

/// Drops a removed member's succession plan and any claim on them.
pub(crate) fn forget(e: &Env, member: &Address) {
    for key in [
        DataKey::Successor(member.clone()),
        DataKey::SuccessionClaim(member.clone()),
        DataKey::LastSeen(member.clone()),
    ] {
        e.storage().persistent().remove(&key);
    }
}

fn load_plan(e: &Env, member: &Address) -> Option<Succession> {
    e.storage()
        .persistent()
        .get(&DataKey::Successor(member.clone()))
}

fn last_seen(e: &Env, member: &Address, plan: &Succession) -> u64 {
    let seen: u64 = e
        .storage()
        .persistent()
        .get(&DataKey::LastSeen(member.clone()))
        .unwrap_or(0);
    seen.max(plan.set_at)
}
