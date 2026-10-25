//! ancora Lifeline: recovery of a person's pass.
//!
//! A person names guardians (other ancora passes), a threshold and a waiting period. If the
//! person loses their passkey, they create a new pass and ask their guardians to confirm it.
//! Once enough guardians have confirmed and the waiting period has passed, anyone can finish
//! the claim: every registered organization the person belongs to hands the person's position
//! and spending limit to the new pass. While the claim waits, the old pass can cancel it.
//! Recovery restores control; it never moves money.
#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, Address,
    Env, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_EXTEND: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const PERSISTENT_EXTEND: u32 = 180 * DAY_IN_LEDGERS;
const PERSISTENT_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const MAX_GUARDIANS: u32 = 5;
/// Short enough for a testnet demo; a real plan uses days.
const MIN_WAIT_SECONDS: u64 = 60;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// The person has no recovery plan.
    NoPlan = 1,
    /// One to five distinct guardians (not the person), a threshold within them, a waiting
    /// period of at least a minute.
    BadPlan = 2,
    /// Only the person's guardians may start or confirm a claim.
    NotGuardian = 3,
    /// There is no open claim for this person.
    NoClaim = 4,
    /// A claim is already open; the old pass can cancel it.
    ClaimOpen = 5,
    /// This guardian already confirmed the claim.
    AlreadyApproved = 6,
    /// Not enough confirmations yet, or the waiting period hasn't passed.
    NotReady = 7,
    /// The new pass must differ from the old one.
    SameAccount = 8,
    /// Positions move only within organizations the registry knows.
    NotRegistered = 9,
}

/// The organization entry point a recovery calls once a claim is ready.
#[contractclient(name = "OrganizationClient")]
pub trait OrganizationInterface {
    fn recover_member(e: Env, old: Address, new: Address);
}

#[contractclient(name = "RegistryClient")]
pub trait RegistryInterface {
    fn is_registered(e: Env, org: Address) -> bool;
}

/// Whom the person trusts, how many of them must agree, and how long a claim waits.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Plan {
    pub guardians: Vec<Address>,
    pub threshold: u32,
    pub wait_seconds: u64,
}

/// A claim that `successor` is the person's new pass.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Claim {
    pub successor: Address,
    pub approvals: Vec<Address>,
    pub started_at: u64,
    /// Earliest time the claim can be finished (start + waiting period).
    pub ready_at: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Registry,
    Plan(Address),
    Claim(Address),
    /// People who named this guardian.
    Protects(Address),
    /// Old pass → new pass, once a claim finished.
    Recovered(Address),
}

/// 1 started, 2 confirmed, 3 cancelled, 4 finished.
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct ClaimEvent {
    #[topic]
    pub person: Address,
    pub status: u32,
}

#[contract]
pub struct Recovery;

#[contractimpl]
impl Recovery {
    /// Deploys the recovery service for the organizations of one registry.
    ///
    /// Auth: none (deployment).
    pub fn __constructor(e: &Env, registry: Address) {
        e.storage().instance().set(&DataKey::Registry, &registry);
    }

    /// Sets (or replaces) the person's recovery plan. Replacing a plan cancels an open claim.
    ///
    /// Auth: `person`.
    pub fn set_plan(
        e: &Env,
        person: Address,
        guardians: Vec<Address>,
        threshold: u32,
        wait_seconds: u64,
    ) -> Result<(), Error> {
        person.require_auth();
        if guardians.is_empty()
            || guardians.len() > MAX_GUARDIANS
            || threshold == 0
            || threshold > guardians.len()
            || wait_seconds < MIN_WAIT_SECONDS
        {
            return Err(Error::BadPlan);
        }
        for (index, guardian) in guardians.iter().enumerate() {
            if guardian == person {
                return Err(Error::BadPlan);
            }
            for later in guardians.iter().skip(index + 1) {
                if later == guardian {
                    return Err(Error::BadPlan);
                }
            }
        }
        if let Some(previous) = load_plan(e, &person) {
            for guardian in previous.guardians.iter() {
                set_protects(e, &guardian, &person, false);
            }
        }
        for guardian in guardians.iter() {
            set_protects(e, &guardian, &person, true);
        }
        let key = DataKey::Plan(person.clone());
        e.storage().persistent().set(
            &key,
            &Plan {
                guardians,
                threshold,
                wait_seconds,
            },
        );
        e.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_THRESHOLD, PERSISTENT_EXTEND);
        e.storage().persistent().remove(&DataKey::Claim(person));
        extend_instance(e);
        Ok(())
    }

    /// Removes the person's plan and any open claim.
    ///
    /// Auth: `person`.
    pub fn clear_plan(e: &Env, person: Address) -> Result<(), Error> {
        person.require_auth();
        let plan = load_plan(e, &person).ok_or(Error::NoPlan)?;
        for guardian in plan.guardians.iter() {
            set_protects(e, &guardian, &person, false);
        }
        e.storage()
            .persistent()
            .remove(&DataKey::Plan(person.clone()));
        e.storage().persistent().remove(&DataKey::Claim(person));
        extend_instance(e);
        Ok(())
    }

    /// The person's plan, if any.
    ///
    /// Auth: none (read).
    pub fn plan(e: &Env, person: Address) -> Option<Plan> {
        load_plan(e, &person)
    }

    /// The open claim on the person's pass, if any.
    ///
    /// Auth: none (read).
    pub fn claim(e: &Env, person: Address) -> Option<Claim> {
        e.storage().persistent().get(&DataKey::Claim(person))
    }

    /// The people who named `guardian` in their plan.
    ///
    /// Auth: none (read).
    pub fn protects(e: &Env, guardian: Address) -> Vec<Address> {
        e.storage()
            .persistent()
            .get(&DataKey::Protects(guardian))
            .unwrap_or_else(|| Vec::new(e))
    }

    /// The new pass a finished recovery handed the person's positions to, if any.
    ///
    /// Auth: none (read).
    pub fn recovered_to(e: &Env, person: Address) -> Option<Address> {
        e.storage().persistent().get(&DataKey::Recovered(person))
    }

    /// A guardian starts a claim that `successor` is the person's new pass; it counts as their
    /// confirmation. The claim can be finished after the plan's waiting period.
    ///
    /// Auth: `guardian`, one of the person's guardians.
    pub fn start_claim(
        e: &Env,
        person: Address,
        guardian: Address,
        successor: Address,
    ) -> Result<(), Error> {
        guardian.require_auth();
        let plan = guardian_plan(e, &person, &guardian)?;
        if successor == person {
            return Err(Error::SameAccount);
        }
        if e.storage()
            .persistent()
            .has(&DataKey::Claim(person.clone()))
        {
            return Err(Error::ClaimOpen);
        }
        let now = e.ledger().timestamp();
        let mut approvals = Vec::new(e);
        approvals.push_back(guardian);
        save_claim(
            e,
            &person,
            &Claim {
                successor,
                approvals,
                started_at: now,
                ready_at: now + plan.wait_seconds,
            },
        );
        ClaimEvent { person, status: 1 }.publish(e);
        Ok(())
    }

    /// A guardian confirms the open claim.
    ///
    /// Auth: `guardian`, one of the person's guardians.
    pub fn approve_claim(e: &Env, person: Address, guardian: Address) -> Result<(), Error> {
        guardian.require_auth();
        guardian_plan(e, &person, &guardian)?;
        let mut claim = load_claim(e, &person)?;
        if claim.approvals.contains(&guardian) {
            return Err(Error::AlreadyApproved);
        }
        claim.approvals.push_back(guardian);
        save_claim(e, &person, &claim);
        ClaimEvent { person, status: 2 }.publish(e);
        Ok(())
    }

    /// The person's current pass cancels the open claim: recovery never overrides a key that
    /// still works.
    ///
    /// Auth: `person`.
    pub fn cancel_claim(e: &Env, person: Address) -> Result<(), Error> {
        person.require_auth();
        load_claim(e, &person)?;
        e.storage()
            .persistent()
            .remove(&DataKey::Claim(person.clone()));
        ClaimEvent { person, status: 3 }.publish(e);
        Ok(())
    }

    /// Hands the person's positions in `orgs` to the new pass. The first call needs a ready
    /// claim (enough confirmations, waiting period over) and records the successor; later
    /// calls (for organizations missed or upgraded later) reuse the recorded successor.
    /// Returns the successor.
    ///
    /// Auth: none. Only registered organizations are called, and each checks that the old pass
    /// holds a position there.
    pub fn finish_claim(e: &Env, person: Address, orgs: Vec<Address>) -> Result<Address, Error> {
        let registry: Address = e
            .storage()
            .instance()
            .get(&DataKey::Registry)
            .ok_or(Error::NotRegistered)?;
        let registry = RegistryClient::new(e, &registry);
        for org in orgs.iter() {
            if !registry.is_registered(&org) {
                return Err(Error::NotRegistered);
            }
        }
        let recorded: Option<Address> = e
            .storage()
            .persistent()
            .get(&DataKey::Recovered(person.clone()));
        let successor = match recorded {
            Some(successor) => successor,
            None => {
                let plan = load_plan(e, &person).ok_or(Error::NoPlan)?;
                let claim = load_claim(e, &person)?;
                if claim.approvals.len() < plan.threshold || e.ledger().timestamp() < claim.ready_at
                {
                    return Err(Error::NotReady);
                }
                let key = DataKey::Recovered(person.clone());
                e.storage().persistent().set(&key, &claim.successor);
                e.storage()
                    .persistent()
                    .extend_ttl(&key, PERSISTENT_THRESHOLD, PERSISTENT_EXTEND);
                e.storage()
                    .persistent()
                    .remove(&DataKey::Claim(person.clone()));
                ClaimEvent {
                    person: person.clone(),
                    status: 4,
                }
                .publish(e);
                claim.successor
            }
        };
        for org in orgs.iter() {
            OrganizationClient::new(e, &org).recover_member(&person, &successor);
        }
        extend_instance(e);
        Ok(successor)
    }
}

fn load_plan(e: &Env, person: &Address) -> Option<Plan> {
    e.storage().persistent().get(&DataKey::Plan(person.clone()))
}

fn load_claim(e: &Env, person: &Address) -> Result<Claim, Error> {
    e.storage()
        .persistent()
        .get(&DataKey::Claim(person.clone()))
        .ok_or(Error::NoClaim)
}

fn guardian_plan(e: &Env, person: &Address, guardian: &Address) -> Result<Plan, Error> {
    let plan = load_plan(e, person).ok_or(Error::NoPlan)?;
    if !plan.guardians.contains(guardian) {
        return Err(Error::NotGuardian);
    }
    Ok(plan)
}

fn save_claim(e: &Env, person: &Address, claim: &Claim) {
    let key = DataKey::Claim(person.clone());
    e.storage().persistent().set(&key, claim);
    e.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_THRESHOLD, PERSISTENT_EXTEND);
}

fn set_protects(e: &Env, guardian: &Address, person: &Address, protects: bool) {
    let key = DataKey::Protects(guardian.clone());
    let current: Vec<Address> = e
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(e));
    let mut next = Vec::new(e);
    for existing in current.iter() {
        if existing != *person {
            next.push_back(existing);
        }
    }
    if protects {
        next.push_back(person.clone());
    }
    e.storage().persistent().set(&key, &next);
    e.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_THRESHOLD, PERSISTENT_EXTEND);
}

fn extend_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_EXTEND);
}

#[cfg(test)]
mod test;
