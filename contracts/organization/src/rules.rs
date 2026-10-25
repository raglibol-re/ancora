//! The approval engine, a port of app/src/domain/rules. Pure over its inputs: callers pass the
//! ranked member list, so the same code is tested against the shared vectors without storage.

use soroban_sdk::{Address, Env, Symbol, Vec};

use crate::types::{Error, Evaluation, Policy, Requirement, Tier};

/// A member with the rank of their role: 0 is the highest role.
pub type Ranked = (Address, u32);

/// Rank of a role in the organization's role list; `None` for unknown roles.
pub fn rank_of(roles: &Vec<Symbol>, role: &Symbol) -> Option<u32> {
    roles.iter().position(|r| r == *role).map(|i| i as u32)
}

pub fn rank_of_member(members: &Vec<Ranked>, who: &Address) -> Option<u32> {
    members
        .iter()
        .find(|(address, _)| address == who)
        .map(|(_, rank)| rank)
}

pub fn validate_policy(policy: &Policy, roles: &Vec<Symbol>) -> Result<(), Error> {
    let count = policy.tiers.len();
    let Some(last) = policy.tiers.last() else {
        return Err(Error::InvalidPolicy);
    };
    if last.up_to.is_some() {
        return Err(Error::InvalidPolicy);
    }
    let mut previous: Option<i128> = None;
    for (index, tier) in policy.tiers.iter().enumerate() {
        let is_last = index as u32 == count - 1;
        match tier.up_to {
            Some(limit) if limit <= 0 => return Err(Error::InvalidPolicy),
            Some(limit) => {
                if let Some(prev) = previous {
                    if limit <= prev {
                        return Err(Error::InvalidPolicy);
                    }
                }
                previous = Some(limit);
            }
            None if !is_last => return Err(Error::InvalidPolicy),
            None => {}
        }
        validate_requirements(&tier.approvals, roles)?;
    }
    if policy.seal_threshold <= 0 {
        return Err(Error::InvalidPolicy);
    }
    validate_requirements(&policy.new_recipient_approvals, roles)
}

fn validate_requirements(
    requirements: &Vec<Requirement>,
    roles: &Vec<Symbol>,
) -> Result<(), Error> {
    for requirement in requirements.iter() {
        if rank_of(roles, &requirement.role).is_none() {
            return Err(Error::UnknownRole);
        }
        if requirement.count == 0 {
            return Err(Error::InvalidPolicy);
        }
    }
    Ok(())
}

/// Per role, keep the higher count.
pub fn merge_requirements(base: &Vec<Requirement>, extra: &Vec<Requirement>) -> Vec<Requirement> {
    let mut merged: Vec<Requirement> = base.clone();
    for addition in extra.iter() {
        let existing = merged.iter().position(|r| r.role == addition.role);
        match existing {
            Some(index) => {
                let current = merged.get_unchecked(index as u32);
                if addition.count > current.count {
                    merged.set(index as u32, addition);
                }
            }
            None => merged.push_back(addition),
        }
    }
    merged
}

fn strictest_tier(policy: &Policy) -> Option<Tier> {
    policy.tiers.last()
}

/// `amount_in_base` is the amount in the currency the rules are written in. `None` means the
/// payment is in another currency and no rate is available: it then takes the strictest tier
/// and the seal, so a payment is never under-approved.
pub fn evaluate_payment(
    policy: &Policy,
    amount_in_base: Option<i128>,
    recipient_is_new: bool,
) -> Result<Evaluation, Error> {
    let index = match amount_in_base {
        Some(amount) => policy
            .tiers
            .iter()
            .position(|tier| tier.up_to.is_none_or(|limit| amount <= limit))
            .ok_or(Error::InvalidPolicy)?,
        None => {
            let last = policy
                .tiers
                .len()
                .checked_sub(1)
                .ok_or(Error::InvalidPolicy)?;
            last as usize
        }
    };
    let tier = policy.tiers.get_unchecked(index as u32);
    let approvals = if recipient_is_new {
        merge_requirements(&tier.approvals, &policy.new_recipient_approvals)
    } else {
        tier.approvals.clone()
    };
    Ok(Evaluation {
        tier: Some(index as u32),
        approvals,
        objection_window_hours: tier.objection_window_hours,
        seal_required: amount_in_base.is_none_or(|amount| amount >= policy.seal_threshold),
    })
}

/// Membership and rule changes always use the strictest (last) tier, without the seal.
pub fn evaluate_governance(policy: &Policy) -> Result<Evaluation, Error> {
    let tier = strictest_tier(policy).ok_or(Error::InvalidPolicy)?;
    Ok(Evaluation {
        tier: None,
        approvals: tier.approvals.clone(),
        objection_window_hours: tier.objection_window_hours,
        seal_required: false,
    })
}

pub struct Progress {
    pub satisfied: bool,
    /// Approvals that count: ignores the requester, non-members, duplicates and surplus.
    pub counted: u32,
}

/// Assigns approvers to required slots. A person fills a slot for their own role or any lower
/// role, and counts at most once. The requester never counts (four-eyes). Slots are filled from
/// the most to the least demanding; anyone who qualifies for a slot qualifies for all lower ones.
pub fn approval_progress(
    e: &Env,
    roles: &Vec<Symbol>,
    members: &Vec<Ranked>,
    requirements: &Vec<Requirement>,
    approvers: &Vec<Address>,
    requester: &Address,
) -> Progress {
    // Eligible pool: unique members other than the requester, with their rank.
    let mut pool: Vec<Ranked> = Vec::new(e);
    for approver in approvers.iter() {
        if approver == *requester || pool.iter().any(|(a, _)| a == approver) {
            continue;
        }
        if let Some(rank) = rank_of_member(members, &approver) {
            pool.push_back((approver, rank));
        }
    }
    let mut used: Vec<bool> = Vec::new(e);
    for _ in 0..pool.len() {
        used.push_back(false);
    }
    let mut counted = 0u32;
    let mut satisfied = true;
    // Requirements in rank order, most demanding (rank 0) first.
    for slot_rank in 0..roles.len() {
        for requirement in requirements.iter() {
            if rank_of(roles, &requirement.role) != Some(slot_rank) {
                continue;
            }
            for _ in 0..requirement.count {
                match pick(&pool, &used, slot_rank) {
                    Some(index) => {
                        used.set(index, true);
                        counted += 1;
                    }
                    None => satisfied = false,
                }
            }
        }
    }
    Progress { satisfied, counted }
}

/// The unused pool member with the highest role (lowest rank) who qualifies for `slot_rank`.
fn pick(pool: &Vec<Ranked>, used: &Vec<bool>, slot_rank: u32) -> Option<u32> {
    let mut best: Option<(u32, u32)> = None;
    for (index, (_, rank)) in pool.iter().enumerate() {
        let index = index as u32;
        if used.get_unchecked(index) || rank > slot_rank {
            continue;
        }
        if best.is_none_or(|(_, best_rank)| rank < best_rank) {
            best = Some((index, rank));
        }
    }
    best.map(|(index, _)| index)
}

/// Holds a role that could fill at least one of the requirements (or any member if none).
pub fn is_eligible(
    roles: &Vec<Symbol>,
    requirements: &Vec<Requirement>,
    rank: Option<u32>,
) -> bool {
    let Some(rank) = rank else {
        return false;
    };
    requirements.is_empty()
        || requirements
            .iter()
            .any(|r| rank_of(roles, &r.role).is_some_and(|slot| rank <= slot))
}

/// True if adding `who` fills one more slot.
pub fn approval_would_count(
    e: &Env,
    roles: &Vec<Symbol>,
    members: &Vec<Ranked>,
    requirements: &Vec<Requirement>,
    approvers: &Vec<Address>,
    requester: &Address,
    who: &Address,
) -> bool {
    let before = approval_progress(e, roles, members, requirements, approvers, requester).counted;
    let mut with = approvers.clone();
    with.push_back(who.clone());
    approval_progress(e, roles, members, requirements, &with, requester).counted > before
}

/// Whether the members (minus those excluded) could ever satisfy the requirements.
pub fn can_be_satisfied(
    e: &Env,
    roles: &Vec<Symbol>,
    members: &Vec<Ranked>,
    requirements: &Vec<Requirement>,
    excluded: Option<&Address>,
) -> bool {
    let mut everyone: Vec<Address> = Vec::new(e);
    for (address, _) in members.iter() {
        if excluded != Some(&address) {
            everyone.push_back(address);
        }
    }
    // No real requester is involved: use an address no member has.
    let nobody = Address::from_str(
        e,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    );
    approval_progress(e, roles, members, requirements, &everyone, &nobody).satisfied
}

/// Setup phase: nobody besides the founder could satisfy the strictest tier, so requests could
/// never complete. Mirrors choosing the initial signers when the account is created.
pub fn is_setup_phase(
    e: &Env,
    roles: &Vec<Symbol>,
    members: &Vec<Ranked>,
    policy: &Policy,
    founder: &Address,
) -> bool {
    match strictest_tier(policy) {
        Some(tier) => !can_be_satisfied(e, roles, members, &tier.approvals, Some(founder)),
        None => true,
    }
}
