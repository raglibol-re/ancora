use soroban_sdk::{contracterror, contracttype, Address, BytesN, String, Symbol, Vec};

/// Amounts are token minor units (7 decimals on Stellar). Policies are entered in cents and scaled.
pub const CENT: i128 = 100_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotMember = 1,
    InvalidAmount = 2,
    InvalidPolicy = 3,
    UnknownRole = 4,
    AlreadyMember = 5,
    RequesterCannotApprove = 6,
    AlreadyApproved = 7,
    RoleCannotApprove = 8,
    ApprovalNotNeeded = 9,
    NotPending = 10,
    SealNotRequired = 11,
    AlreadySealed = 12,
    CannotDecline = 13,
    NotReady = 14,
    NotInSetupPhase = 15,
    WouldLockAccount = 16,
    InsufficientFunds = 17,
    NotFound = 18,
    NotFounder = 19,
    UnknownTemplate = 20,
    TextTooLong = 21,
    UnknownAsset = 22,
    AssetExists = 23,
    AssetInUse = 24,
    LastAsset = 25,
}

/// "count people holding `role` (or a higher-ranked role) must approve".
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Requirement {
    pub role: Symbol,
    pub count: u32,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Tier {
    /// Inclusive upper bound in token units; `None` for the last, unbounded tier.
    pub up_to: Option<i128>,
    pub approvals: Vec<Requirement>,
    pub objection_window_hours: u32,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Policy {
    /// Ascending by `up_to`; the last tier is unbounded and the strictest.
    pub tiers: Vec<Tier>,
    /// Payments at or above this amount additionally need the security seal.
    pub seal_threshold: i128,
    /// Extra requirements for a first payment to a recipient, merged per role (higher count wins).
    pub new_recipient_approvals: Vec<Requirement>,
}

/// What a request needs before it can execute; fixed when the request is created.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Evaluation {
    /// Tier index for payments; `None` for membership and rule changes (strictest tier).
    pub tier: Option<u32>,
    pub approvals: Vec<Requirement>,
    pub objection_window_hours: u32,
    pub seal_required: bool,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Member {
    pub address: Address,
    pub role: Symbol,
}

/// A token the organization should accept and the fiat currency it stands for ("EUR", "USD").
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AssetSpec {
    pub token: Address,
    pub currency: Symbol,
}

/// An accepted token, with what the token contract says about itself.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Asset {
    pub token: Address,
    pub currency: Symbol,
    pub symbol: String,
    pub decimals: u32,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum Change {
    AddMember(Address, Symbol),
    RemoveMember(Address),
    ChangeRole(Address, Symbol),
    /// New rules plus the SHA-256 of their canonical policy document (see docs/ARCHITECTURE.md).
    UpdatePolicy(Policy, BytesN<32>),
    /// Accept another token.
    AddAsset(AssetSpec),
    /// Stop accepting a token; only when its balance is zero and no open request uses it.
    RemoveAsset(Address),
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Payment {
    pub token: Address,
    pub to: Address,
    pub amount: i128,
    pub memo: String,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum RequestKind {
    Payment(Payment),
    Change(Change),
}

#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Status {
    Pending,
    Scheduled,
    Ready,
    Executed,
    Declined,
    Failed,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Request {
    pub id: u64,
    pub kind: RequestKind,
    pub requester: Address,
    pub created_at: u64,
    pub evaluation: Evaluation,
    pub approvals: Vec<Address>,
    pub sealed_by: Option<Address>,
    pub status: Status,
    pub execute_after: Option<u64>,
    pub decided_by: Option<Address>,
    /// Error code when execution failed (a change that no longer applies).
    pub failure: Option<u32>,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct OrgInfo {
    pub name: String,
    pub template: Symbol,
    /// Currency the rules are written in ("EUR", "USD"). Payments in an accepted token of
    /// another currency take the strictest tier (see `rules::evaluate_payment`).
    pub base_currency: Symbol,
    pub registry: Address,
    pub founder: Address,
    /// Highest role first.
    pub roles: Vec<Symbol>,
    pub created_at: u64,
}
