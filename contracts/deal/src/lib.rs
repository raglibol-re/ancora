//! ancora Deals: milestone escrow between two parties.
//!
//! A creates a deal with B; B accepts the terms; A deposits the total; B asks for each
//! milestone's payout, which goes out when A approves or automatically once the objection
//! period passes without an objection. An optional arbiter settles disputes by splitting what
//! is left between A and B. There is no admin and no upgrade: nobody but the parties and the
//! arbiter can move the money, and the arbiter only between the two parties.
//!
//! Parties are usually ancora organizations. Their `require_auth` is met when the organization
//! itself calls, which it does only after its own rules approved the action (level 2); the
//! deal contract never repeats those rules (level 1 is the party's consent).
#![no_std]

mod types;

use soroban_sdk::{contract, contractevent, contractimpl, token, Address, Env, Symbol, Vec};

pub use types::*;

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_EXTEND: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
/// Deals can run for months; every action pushes their lifetime out again.
const DEAL_EXTEND: u32 = 120 * DAY_IN_LEDGERS;
const DEAL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const MAX_MILESTONES: u32 = 20;
const MAX_LABEL_LEN: u32 = 64;
const MIN_OBJECTION_SECONDS: u64 = 60;
const MAX_OBJECTION_SECONDS: u64 = 90 * 86_400;
/// Deals listed per party (newest kept when full).
const MAX_DEALS_PER_PARTY: u32 = 200;

#[soroban_sdk::contracttype]
#[derive(Clone)]
enum Key {
    Count,
    Deal(u64),
    /// Deal ids a party takes part in, oldest first.
    Party(Address),
}

/// Every status change, so an app or indexer can follow deals without reading them all.
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct DealEvent {
    #[topic]
    pub name: Symbol,
    #[topic]
    pub id: u64,
    pub status: DealStatus,
    /// The milestone concerned, if any.
    pub milestone: Option<u32>,
}

#[contract]
pub struct Deals;

#[contractimpl]
impl Deals {
    /// Creates a deal: `party_a` pays `party_b` by the milestones in `terms`. Nothing moves yet.
    ///
    /// Auth: `party_a`.
    pub fn create(
        e: &Env,
        party_a: Address,
        party_b: Address,
        terms: DealTerms,
    ) -> Result<u64, Error> {
        party_a.require_auth();
        extend_instance(e);
        let total = validate(&party_a, &party_b, &terms)?;
        let id: u64 = e.storage().instance().get(&Key::Count).unwrap_or(0u64) + 1;
        e.storage().instance().set(&Key::Count, &id);
        let mut milestones = Vec::new(e);
        for m in terms.milestones.iter() {
            milestones.push_back(Milestone {
                label: m.label,
                amount: m.amount,
                status: MilestoneStatus::Open,
                requested_at: 0,
            });
        }
        let deal = Deal {
            id,
            kind: DealKind::MilestoneEscrow,
            party_a: party_a.clone(),
            party_b: party_b.clone(),
            asset: terms.asset,
            milestones,
            objection_seconds: terms.objection_seconds,
            arbiter: terms.arbiter,
            document_hash: terms.document_hash,
            status: DealStatus::Draft,
            total,
            paid_out: 0,
            created_at: e.ledger().timestamp(),
            cancel_asks: Vec::new(e),
        };
        save(e, &deal);
        index(e, &party_a, id);
        index(e, &party_b, id);
        emit(e, "deal_created", &deal, None);
        Ok(id)
    }

    /// B agrees to the terms.
    ///
    /// Auth: party B.
    pub fn accept(e: &Env, deal_id: u64) -> Result<(), Error> {
        let mut deal = load(e, deal_id)?;
        deal.party_b.require_auth();
        expect(&deal, &[DealStatus::Draft])?;
        deal.status = DealStatus::Accepted;
        save(e, &deal);
        emit(e, "accepted", &deal, None);
        Ok(())
    }

    /// A deposits the total; the deal contract holds it until it is paid out.
    ///
    /// Auth: party A (and its authorization of the token transfer to this contract).
    pub fn fund(e: &Env, deal_id: u64) -> Result<(), Error> {
        let mut deal = load(e, deal_id)?;
        deal.party_a.require_auth();
        expect(&deal, &[DealStatus::Accepted])?;
        deal.status = DealStatus::Funded;
        save(e, &deal);
        token::Client::new(e, &deal.asset).transfer(
            &deal.party_a,
            e.current_contract_address(),
            &deal.total,
        );
        emit(e, "funded", &deal, None);
        Ok(())
    }

    /// B says a milestone is done; the objection period starts.
    ///
    /// Auth: party B.
    pub fn request_release(e: &Env, deal_id: u64, milestone: u32) -> Result<(), Error> {
        let mut deal = load(e, deal_id)?;
        deal.party_b.require_auth();
        expect(&deal, &[DealStatus::Funded, DealStatus::Active])?;
        let mut m = milestone_of(&deal, milestone)?;
        if m.status != MilestoneStatus::Open && m.status != MilestoneStatus::Objected {
            return Err(Error::MilestoneWrongState);
        }
        m.status = MilestoneStatus::Requested;
        m.requested_at = e.ledger().timestamp();
        deal.milestones.set(milestone, m);
        deal.status = DealStatus::Active;
        save(e, &deal);
        emit(e, "release_requested", &deal, Some(milestone));
        Ok(())
    }

    /// A approves a requested (or objected) milestone; B is paid at once.
    ///
    /// Auth: party A.
    pub fn approve_release(e: &Env, deal_id: u64, milestone: u32) -> Result<(), Error> {
        let deal = load(e, deal_id)?;
        deal.party_a.require_auth();
        expect(&deal, &[DealStatus::Active])?;
        let m = milestone_of(&deal, milestone)?;
        if m.status != MilestoneStatus::Requested && m.status != MilestoneStatus::Objected {
            return Err(Error::MilestoneWrongState);
        }
        release(e, deal, milestone, m);
        Ok(())
    }

    /// A objects to a requested milestone within its period: no automatic payout.
    ///
    /// Auth: party A.
    pub fn object(e: &Env, deal_id: u64, milestone: u32) -> Result<(), Error> {
        let mut deal = load(e, deal_id)?;
        deal.party_a.require_auth();
        expect(&deal, &[DealStatus::Active])?;
        let mut m = milestone_of(&deal, milestone)?;
        if m.status != MilestoneStatus::Requested {
            return Err(Error::MilestoneWrongState);
        }
        if e.ledger().timestamp() >= period_end(&deal, &m) {
            return Err(Error::PeriodOver);
        }
        m.status = MilestoneStatus::Objected;
        deal.milestones.set(milestone, m);
        save(e, &deal);
        emit(e, "objected", &deal, Some(milestone));
        Ok(())
    }

    /// Pays a requested milestone out once its objection period passed without an objection.
    ///
    /// Auth: none (anyone may trigger it; the money only goes to B).
    pub fn execute_release(e: &Env, deal_id: u64, milestone: u32) -> Result<(), Error> {
        let deal = load(e, deal_id)?;
        expect(&deal, &[DealStatus::Active])?;
        let m = milestone_of(&deal, milestone)?;
        if m.status != MilestoneStatus::Requested {
            return Err(Error::MilestoneWrongState);
        }
        if e.ledger().timestamp() < period_end(&deal, &m) {
            return Err(Error::PeriodRunning);
        }
        release(e, deal, milestone, m);
        Ok(())
    }

    /// Cancels the deal. Before the deposit only A cancels; after it both parties must ask
    /// (each call records one party), and then what is left goes back to A.
    ///
    /// Auth: `by`, one of the parties.
    pub fn cancel(e: &Env, deal_id: u64, by: Address) -> Result<(), Error> {
        let mut deal = load(e, deal_id)?;
        by.require_auth();
        party_check(&deal, &by)?;
        match deal.status {
            DealStatus::Draft | DealStatus::Accepted => {
                if by != deal.party_a {
                    return Err(Error::NotParty);
                }
                deal.status = DealStatus::Cancelled;
                save(e, &deal);
                emit(e, "cancelled", &deal, None);
            }
            DealStatus::Funded | DealStatus::Active => {
                if deal.cancel_asks.contains(&by) {
                    return Err(Error::AlreadyAsked);
                }
                deal.cancel_asks.push_back(by);
                if deal.cancel_asks.len() < 2 {
                    save(e, &deal);
                    emit(e, "cancel_asked", &deal, None);
                    return Ok(());
                }
                let rest = deal.total - deal.paid_out;
                deal.paid_out = deal.total;
                deal.status = DealStatus::Cancelled;
                save(e, &deal);
                pay(e, &deal.asset, &deal.party_a, rest);
                emit(e, "cancelled", &deal, None);
            }
            _ => return Err(Error::WrongStatus),
        }
        Ok(())
    }

    /// Either party hands a funded deal to the arbiter; payouts stop until the ruling.
    ///
    /// Auth: `by`, one of the parties.
    pub fn dispute(e: &Env, deal_id: u64, by: Address) -> Result<(), Error> {
        let mut deal = load(e, deal_id)?;
        by.require_auth();
        party_check(&deal, &by)?;
        if deal.arbiter.is_none() {
            return Err(Error::NoArbiter);
        }
        expect(&deal, &[DealStatus::Funded, DealStatus::Active])?;
        deal.status = DealStatus::Disputed;
        save(e, &deal);
        emit(e, "disputed", &deal, None);
        Ok(())
    }

    /// The arbiter splits exactly what is left between A and B, nobody else.
    ///
    /// Auth: the arbiter named in the terms.
    pub fn resolve(
        e: &Env,
        deal_id: u64,
        amount_to_a: i128,
        amount_to_b: i128,
    ) -> Result<(), Error> {
        let mut deal = load(e, deal_id)?;
        let arbiter = deal.arbiter.clone().ok_or(Error::NoArbiter)?;
        arbiter.require_auth();
        expect(&deal, &[DealStatus::Disputed])?;
        let rest = deal.total - deal.paid_out;
        let sum = amount_to_a
            .checked_add(amount_to_b)
            .ok_or(Error::InvalidSplit)?;
        if amount_to_a < 0 || amount_to_b < 0 || sum != rest {
            return Err(Error::InvalidSplit);
        }
        deal.paid_out = deal.total;
        deal.status = DealStatus::Resolved;
        save(e, &deal);
        pay(e, &deal.asset, &deal.party_a, amount_to_a);
        pay(e, &deal.asset, &deal.party_b, amount_to_b);
        emit(e, "resolved", &deal, None);
        Ok(())
    }

    /// One deal.
    ///
    /// Auth: none (read).
    pub fn deal(e: &Env, deal_id: u64) -> Result<Deal, Error> {
        load(e, deal_id)
    }

    /// The deals a party takes part in, newest first.
    ///
    /// Auth: none (read).
    pub fn deals_of(e: &Env, party: Address) -> Vec<Deal> {
        let ids: Vec<u64> = e
            .storage()
            .persistent()
            .get(&Key::Party(party))
            .unwrap_or_else(|| Vec::new(e));
        let mut deals = Vec::new(e);
        for id in ids.iter().rev() {
            if let Ok(deal) = load(e, id) {
                deals.push_back(deal);
            }
        }
        deals
    }

    /// The deal's asset and an amount: the total (what A deposits) for `None`, a milestone's
    /// amount otherwise. Lets a party's own rules weigh an action without reading the whole deal.
    ///
    /// Auth: none (read).
    pub fn quote(e: &Env, deal_id: u64, milestone: Option<u32>) -> Result<(Address, i128), Error> {
        let deal = load(e, deal_id)?;
        let amount = match milestone {
            Some(index) => milestone_of(&deal, index)?.amount,
            None => deal.total,
        };
        Ok((deal.asset, amount))
    }
}

/// Checks the terms and returns their total.
fn validate(party_a: &Address, party_b: &Address, terms: &DealTerms) -> Result<i128, Error> {
    let count = terms.milestones.len();
    if party_a == party_b
        || count == 0
        || count > MAX_MILESTONES
        || terms.objection_seconds < MIN_OBJECTION_SECONDS
        || terms.objection_seconds > MAX_OBJECTION_SECONDS
        || terms
            .arbiter
            .as_ref()
            .is_some_and(|a| a == party_a || a == party_b)
    {
        return Err(Error::InvalidTerms);
    }
    let mut total: i128 = 0;
    for m in terms.milestones.iter() {
        if m.label.len() > MAX_LABEL_LEN {
            return Err(Error::TextTooLong);
        }
        if m.amount <= 0 {
            return Err(Error::InvalidTerms);
        }
        total = total.checked_add(m.amount).ok_or(Error::InvalidTerms)?;
    }
    Ok(total)
}

/// Marks the milestone paid before the transfer, so it can never be paid twice.
fn release(e: &Env, mut deal: Deal, index: u32, mut m: Milestone) {
    m.status = MilestoneStatus::Released;
    let amount = m.amount;
    deal.milestones.set(index, m);
    deal.paid_out += amount;
    if deal
        .milestones
        .iter()
        .all(|x| x.status == MilestoneStatus::Released)
    {
        deal.status = DealStatus::Completed;
    }
    save(e, &deal);
    pay(e, &deal.asset, &deal.party_b, amount);
    emit(e, "released", &deal, Some(index));
}

fn pay(e: &Env, asset: &Address, to: &Address, amount: i128) {
    if amount > 0 {
        token::Client::new(e, asset).transfer(&e.current_contract_address(), to, &amount);
    }
}

fn period_end(deal: &Deal, m: &Milestone) -> u64 {
    m.requested_at.saturating_add(deal.objection_seconds)
}

fn expect(deal: &Deal, allowed: &[DealStatus]) -> Result<(), Error> {
    if allowed.contains(&deal.status) {
        Ok(())
    } else {
        Err(Error::WrongStatus)
    }
}

fn party_check(deal: &Deal, by: &Address) -> Result<(), Error> {
    if *by == deal.party_a || *by == deal.party_b {
        Ok(())
    } else {
        Err(Error::NotParty)
    }
}

fn milestone_of(deal: &Deal, index: u32) -> Result<Milestone, Error> {
    deal.milestones.get(index).ok_or(Error::UnknownMilestone)
}

fn load(e: &Env, id: u64) -> Result<Deal, Error> {
    let deal = e
        .storage()
        .persistent()
        .get(&Key::Deal(id))
        .ok_or(Error::NotFound)?;
    extend_instance(e);
    Ok(deal)
}

fn save(e: &Env, deal: &Deal) {
    let key = Key::Deal(deal.id);
    e.storage().persistent().set(&key, deal);
    e.storage()
        .persistent()
        .extend_ttl(&key, DEAL_THRESHOLD, DEAL_EXTEND);
}

fn index(e: &Env, party: &Address, id: u64) {
    let key = Key::Party(party.clone());
    let mut ids: Vec<u64> = e
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(e));
    if ids.len() >= MAX_DEALS_PER_PARTY {
        ids.pop_front();
    }
    ids.push_back(id);
    e.storage().persistent().set(&key, &ids);
    e.storage()
        .persistent()
        .extend_ttl(&key, DEAL_THRESHOLD, DEAL_EXTEND);
}

fn emit(e: &Env, name: &str, deal: &Deal, milestone: Option<u32>) {
    DealEvent {
        name: Symbol::new(e, name),
        id: deal.id,
        status: deal.status,
        milestone,
    }
    .publish(e);
}

fn extend_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_EXTEND);
}

#[cfg(test)]
mod test;
