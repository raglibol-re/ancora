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
    /// The asset has no Reserve vault.
    NoReserve = 26,
    /// Only the top role or someone who could approve the strictest tier moves money to the Reserve.
    NotTreasurer = 27,
    /// Only the top role changes the organization's profile (logo).
    NotTopRole = 28,
    /// A spending limit needs a non-negative amount and, when set, a period above zero.
    InvalidLimit = 29,
    /// The payment goes beyond what is left of a hard budget in this period.
    BudgetExceeded = 30,
    /// The rules have no budget for this category.
    UnknownBudget = 31,
    /// The request is not an escrowed payment waiting for confirmations.
    NotEscrowed = 32,
    /// Only the recipient, the requester or an eligible approver act on an escrow.
    NotEscrowParty = 33,
    /// No standing order with this id.
    UnknownOrder = 34,
    /// The standing order's next payment isn't due yet.
    OrderNotDue = 35,
    /// A standing order repeats at least hourly.
    InvalidInterval = 36,
    /// Only the member who set a standing order, or the top role, may stop it.
    NotOrderOwner = 37,
    /// The standing order was stopped.
    OrderStopped = 38,
    /// A role that still has members can't be dropped; move them to another role first.
    RoleInUse = 39,
    /// A role list needs one to eight distinct roles.
    InvalidRoles = 40,
    /// The address book is full.
    TooManyPayees = 41,
    /// A saved recipient needs a name.
    EmptyName = 42,
    /// A batch has one to fifty lines.
    InvalidBatch = 43,
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

/// A spending envelope for one category per rolling period, in the rules' currency. Payments
/// tagged with the category count against it. Beyond the remaining amount a soft budget
/// escalates the payment to the strictest tier and flags it; a hard budget refuses it.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Budget {
    pub category: Symbol,
    pub amount: i128,
    pub period_seconds: u64,
    pub hard: bool,
}

/// What was booked against a budget in its running window.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BudgetUse {
    pub spent: i128,
    pub window_start: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BudgetView {
    pub budget: Budget,
    pub spent: i128,
    pub window_start: u64,
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
    /// Spending envelopes per category; part of the rules, so the document hash covers them.
    pub budgets: Vec<Budget>,
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
    /// The payment fits the requester's spending limit, so no approval is needed.
    pub within_limit: bool,
    /// The payment goes beyond its (soft) budget: strictest tier, and approvers see the flag.
    pub over_budget: bool,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Member {
    pub address: Address,
    pub role: Symbol,
}

/// A crew or agent allowance: up to `amount` (rules' currency) per rolling `period_seconds`
/// goes out without approvals; anything beyond follows the normal rules.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct SpendingLimit {
    pub amount: i128,
    pub period_seconds: u64,
    /// Spent in the current window, which started at `window_start`.
    pub spent: i128,
    pub window_start: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct MemberLimit {
    pub member: Address,
    pub limit: SpendingLimit,
}

/// A token the organization should accept, the fiat currency it stands for ("EUR", "USD") and,
/// optionally, the DeFindex vault its Reserve earns in.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AssetSpec {
    pub token: Address,
    pub currency: Symbol,
    pub vault: Option<Address>,
}

/// An accepted token, with what the token contract says about itself.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Asset {
    pub token: Address,
    pub currency: Symbol,
    pub symbol: String,
    pub decimals: u32,
    pub vault: Option<Address>,
}

/// What the organization holds in one asset's Reserve: vault shares, what they are worth today,
/// and what was put in (so earnings = value - principal).
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ReserveView {
    pub vault: Address,
    pub shares: i128,
    pub value: i128,
    pub principal: i128,
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
    /// Give a member a spending limit (amount per period, rules' currency); amount 0 removes it.
    SetSpendingLimit(Address, i128, u64),
    /// The organization's own roles, highest first, plus the SHA-256 of the rules document that
    /// names them: add roles, reorder them, drop roles nobody holds.
    SetRoles(Vec<Symbol>, BytesN<32>),
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Payment {
    pub token: Address,
    pub to: Address,
    pub amount: i128,
    pub memo: String,
    /// The budget category this payment counts against, if any.
    pub category: Option<Symbol>,
    /// Held after approval until the recipient and the sender's side both confirm.
    pub escrow: bool,
}

/// One payment inside a batch.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BatchLine {
    pub to: Address,
    pub amount: i128,
    pub memo: String,
}

/// Several payments in one asset, decided once on their total and paid out together (payroll,
/// reimbursements): either every line goes out or none does.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Batch {
    pub token: Address,
    pub lines: Vec<BatchLine>,
    pub memo: String,
    pub category: Option<Symbol>,
}

impl Batch {
    /// The sum of the lines (each checked positive when proposed).
    pub fn total(&self) -> i128 {
        self.lines.iter().map(|line| line.amount).sum()
    }
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum RequestKind {
    Payment(Payment),
    Change(Change),
    Batch(Batch),
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
    /// Approved and funded, held until both the recipient and the sender's side confirm.
    Escrowed,
}

/// Who has confirmed an escrowed payment so far.
#[contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct EscrowState {
    pub recipient_ok: bool,
    pub sender_ok: bool,
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

/// A standing order: a payment the organization repeats on a schedule. Every run is proposed
/// as a payment from `by` under the rules of that moment (spending limit, tiers, budgets), so
/// setting one up needs only the member's own signature and takes nothing past the rules.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct StandingOrder {
    pub id: u64,
    pub by: Address,
    pub token: Address,
    pub to: Address,
    pub amount: i128,
    pub memo: String,
    pub category: Option<Symbol>,
    pub interval_seconds: u64,
    /// Ledger time the next run is due; missed runs are skipped, never caught up.
    pub next_at: u64,
    pub active: bool,
    pub runs: u32,
    /// The request the last run created.
    pub last_request: Option<u64>,
}

/// A recipient saved in the organization's address book: shared by every member, so a name
/// typed once is what everybody sees when paying that address.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PayeeEntry {
    pub address: Address,
    pub name: String,
    pub note: String,
    pub saved_by: Address,
    pub saved_at: u64,
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
    /// ancora's Lifeline contract: the only caller of `recover_member`.
    pub recovery: Address,
    pub founder: Address,
    /// Highest role first.
    pub roles: Vec<Symbol>,
    pub created_at: u64,
    /// https URL of the logo (an image in ancora's store); empty for none.
    pub logo: String,
}
