use soroban_sdk::{contracterror, contracttype, Address, BytesN, String, Vec};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// No deal with this id.
    NotFound = 1,
    /// The deal isn't in a status that allows this.
    WrongStatus = 2,
    /// Only the deal's parties (or, for `resolve`, its arbiter) may do this.
    NotParty = 3,
    /// Terms need two different parties, 1–20 milestones with amounts above zero, an objection
    /// period from one minute to 90 days, and an arbiter who is not a party.
    InvalidTerms = 4,
    /// No milestone with this number.
    UnknownMilestone = 5,
    /// The milestone isn't in a state that allows this.
    MilestoneWrongState = 6,
    /// The objection period is still running.
    PeriodRunning = 7,
    /// The objection period is over.
    PeriodOver = 8,
    /// Disputes need an arbiter named in the terms.
    NoArbiter = 9,
    /// The arbiter splits exactly what is left, between the two parties.
    InvalidSplit = 10,
    /// This party already asked for the cancellation.
    AlreadyAsked = 11,
    /// A label is longer than 64 bytes.
    TextTooLong = 12,
}

/// How a deal settles. Only milestone escrow exists today; netting, delivery-versus-payment
/// and shared pots become further kinds with their own state, next to this one.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DealKind {
    MilestoneEscrow,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DealStatus {
    /// Created by A, waiting for B to accept the terms.
    Draft,
    /// B accepted, waiting for A to deposit.
    Accepted,
    /// The total is deposited; no milestone requested yet.
    Funded,
    /// At least one milestone was requested.
    Active,
    /// Every milestone was paid out.
    Completed,
    Cancelled,
    /// A party raised a dispute; only the arbiter can settle it.
    Disputed,
    /// The arbiter split what was left.
    Resolved,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MilestoneStatus {
    /// Not requested yet (or requested again after an objection).
    Open,
    /// B asked for the payout; it goes out automatically once the period passes.
    Requested,
    /// A objected within the period; B may ask again, A may still approve.
    Objected,
    Released,
}

/// A milestone as proposed in the terms.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneTerms {
    pub label: String,
    pub amount: i128,
}

/// What A proposes and B accepts.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DealTerms {
    /// The token paid (a Stellar Asset Contract such as USDC or EURC).
    pub asset: Address,
    pub milestones: Vec<MilestoneTerms>,
    /// How long A has to object after B asks for a milestone, in seconds.
    pub objection_seconds: u64,
    pub arbiter: Option<Address>,
    /// SHA-256 of the contract documents, which stay off-chain.
    pub document_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub label: String,
    pub amount: i128,
    pub status: MilestoneStatus,
    /// When B last asked for the payout (seconds); 0 before.
    pub requested_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Deal {
    pub id: u64,
    pub kind: DealKind,
    /// Pays (deposits, approves payouts, objects).
    pub party_a: Address,
    /// Delivers (accepts, asks for payouts) and is paid.
    pub party_b: Address,
    pub asset: Address,
    pub milestones: Vec<Milestone>,
    pub objection_seconds: u64,
    pub arbiter: Option<Address>,
    pub document_hash: BytesN<32>,
    pub status: DealStatus,
    pub total: i128,
    /// Paid out so far (to B by milestones, or to either party by a cancellation or ruling).
    pub paid_out: i128,
    pub created_at: u64,
    /// Parties who asked to cancel a funded deal; both must ask.
    pub cancel_asks: Vec<Address>,
}
