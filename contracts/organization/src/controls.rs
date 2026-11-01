//! Finer controls on top of the approval rules: allowances per asset and budget category, a
//! recipient allowlist, and exchange rates from a SEP-40 oracle (Reflector) for the tiers of
//! payments in another currency. Each lives under its own storage key, so organizations that
//! move to this release from an earlier one keep reading their existing state unchanged.

use soroban_sdk::{contractclient, contractimpl, contracttype, Address, Env, Symbol, Vec};

use crate::types::{
    Allowance, Asset, Error, MemberAllowance, OrgInfo, Policy, RecipientMode, RecipientRule,
};
use crate::{
    find_asset, find_budget, load_assets, load_info, ranked, rules, DataKey, Organization,
    OrganizationArgs, OrganizationClient, REQUEST_EXTEND, REQUEST_THRESHOLD,
};

/// Scoped allowances per member, beyond the general spending limit.
const MAX_ALLOWANCES: u32 = 8;
const MAX_RECIPIENTS: u32 = 100;
/// Exchange rates older than this don't count; foreign-exchange markets close at weekends.
const MAX_RATE_AGE_SECONDS: u64 = 4 * 24 * 3_600;

/// SEP-40 asset reference (stellar/stellar-protocol ecosystem/sep-0040.md).
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum OracleAsset {
    Stellar(Address),
    Other(Symbol),
}

/// SEP-40 price record: `price` in the oracle's base asset with `decimals()` decimals.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

/// The two SEP-40 reads ancora needs (Reflector's free "Pulse" forex oracle answers them).
/// Only the generated `OracleClient` is used; the trait itself describes the interface.
#[allow(dead_code)]
#[contractclient(name = "OracleClient")]
pub trait OracleInterface {
    fn decimals(e: Env) -> u32;
    fn lastprice(e: Env, asset: OracleAsset) -> Option<PriceData>;
}

#[contractimpl]
impl Organization {
    /// Allowances per asset or budget category, with what was spent in the running window.
    ///
    /// Auth: none (read).
    pub fn allowances(e: &Env) -> Vec<MemberAllowance> {
        let info = load_info(e);
        let mut result = Vec::new(e);
        for (member, _) in ranked(e, &info.roles).iter() {
            for allowance in load_allowances(e, &member).iter() {
                result.push_back(MemberAllowance {
                    member: member.clone(),
                    allowance: rolled(e, allowance),
                });
            }
        }
        result
    }

    /// Who the organization pays (open to everyone until set).
    ///
    /// Auth: none (read).
    pub fn recipient_rule(e: &Env) -> RecipientRule {
        load_recipient_rule(e)
    }

    /// The oracle whose exchange rates set the tier of payments in another currency, if any.
    ///
    /// Auth: none (read).
    pub fn fx_oracle(e: &Env) -> Option<Address> {
        e.storage().instance().get(&DataKey::FxOracle)
    }
}

/// The amount the tiers and the seal see: the amount itself in the rules' currency, converted
/// at a fresh oracle rate otherwise (rounded up, so a payment is never under-approved), or
/// `None` (strictest tier and seal) when no fresh rate is available.
pub(crate) fn tier_amount(e: &Env, info: &OrgInfo, asset: &Asset, amount: i128) -> Option<i128> {
    if asset.currency == info.base_currency {
        return Some(amount);
    }
    let oracle: Address = e.storage().instance().get(&DataKey::FxOracle)?;
    let client = OracleClient::new(e, &oracle);
    let from = fresh_price(e, &client, &asset.currency)?;
    let to = fresh_price(e, &client, &info.base_currency)?;
    let scaled = amount.checked_mul(from)?;
    scaled.checked_add(to - 1)?.checked_div(to)
}

fn fresh_price(e: &Env, client: &OracleClient, currency: &Symbol) -> Option<i128> {
    let data = client
        .try_lastprice(&OracleAsset::Other(currency.clone()))
        .ok()?
        .ok()??;
    let age = e.ledger().timestamp().saturating_sub(data.timestamp);
    (data.price > 0 && age <= MAX_RATE_AGE_SECONDS).then_some(data.price)
}

/// `Ok(true)` when the recipient is outside an `Approve` allowlist (strictest tier, no
/// allowance); refuses one outside an `Only` allowlist.
pub(crate) fn recipient_escalates(e: &Env, to: &Address) -> Result<bool, Error> {
    let rule = load_recipient_rule(e);
    let listed = rule.allowed.contains(to);
    match rule.mode {
        RecipientMode::Open => Ok(false),
        RecipientMode::Approve => Ok(!listed),
        RecipientMode::Only if listed => Ok(false),
        RecipientMode::Only => Err(Error::RecipientNotAllowed),
    }
}

/// Books the payment against the most specific allowance of `by` that covers it and has room:
/// asset and category, then asset, then category. `None` when none fits.
pub(crate) fn use_allowance(
    e: &Env,
    by: &Address,
    token: &Address,
    category: &Option<Symbol>,
    amount: i128,
    amount_in_base: Option<i128>,
) -> Option<()> {
    let mut allowances = load_allowances(e, by);
    let mut best: Option<(u32, u32)> = None;
    for (index, allowance) in allowances.iter().enumerate() {
        let token_matches = allowance.token.as_ref().is_none_or(|t| t == token);
        let category_matches = allowance
            .category
            .as_ref()
            .is_none_or(|c| category.as_ref() == Some(c));
        if !token_matches || !category_matches {
            continue;
        }
        // Token-scoped allowances count in the token's units, the others in the rules' currency.
        let counted = if allowance.token.is_some() {
            amount
        } else {
            amount_in_base?
        };
        let current = rolled(e, allowance.clone());
        if current.spent.checked_add(counted)? > current.amount {
            continue;
        }
        let specificity =
            u32::from(allowance.token.is_some()) * 2 + u32::from(allowance.category.is_some());
        if best.is_none_or(|(_, s)| specificity > s) {
            best = Some((index as u32, specificity));
        }
    }
    let (index, _) = best?;
    let chosen = rolled(e, allowances.get(index)?);
    let counted = if chosen.token.is_some() {
        amount
    } else {
        amount_in_base?
    };
    allowances.set(
        index,
        Allowance {
            spent: chosen.spent + counted,
            ..chosen
        },
    );
    save_allowances(e, by, &allowances);
    Some(())
}

/// Checks a `SetAllowance` change against the members, accepted assets and budgets. A category
/// with an asset of another currency is refused: budgets count only the rules' currency, so
/// such payments are always "over budget" and could never use the allowance.
pub(crate) fn plan_allowance(
    e: &Env,
    info: &OrgInfo,
    members: &Vec<rules::Ranked>,
    policy: &Policy,
    change: (&Address, &Option<Address>, &Option<Symbol>, i128, u64),
) -> Result<(), Error> {
    let (who, token, category, amount, period) = change;
    rules::rank_of_member(members, who).ok_or(Error::NotMember)?;
    if (token.is_none() && category.is_none()) || amount < 0 || (amount > 0 && period == 0) {
        return Err(Error::InvalidLimit);
    }
    if let Some(token) = token {
        let asset = find_asset(&load_assets(e), token)?;
        if category.is_some() && asset.currency != info.base_currency {
            return Err(Error::InvalidLimit);
        }
    }
    if let Some(category) = category {
        find_budget(policy, category)?;
    }
    let existing = load_allowances(e, who);
    let replaces = existing
        .iter()
        .any(|a| a.token == *token && a.category == *category);
    if amount > 0 && !replaces && existing.len() >= MAX_ALLOWANCES {
        return Err(Error::InvalidLimit);
    }
    Ok(())
}

/// Sets, replaces or (amount 0) removes the allowance with this scope.
pub(crate) fn apply_allowance(
    e: &Env,
    who: &Address,
    token: &Option<Address>,
    category: &Option<Symbol>,
    amount: i128,
    period_seconds: u64,
) {
    let mut kept: Vec<Allowance> = Vec::new(e);
    for allowance in load_allowances(e, who).iter() {
        if allowance.token != *token || allowance.category != *category {
            kept.push_back(allowance);
        }
    }
    if amount > 0 {
        kept.push_back(Allowance {
            token: token.clone(),
            category: category.clone(),
            amount,
            period_seconds,
            spent: 0,
            window_start: e.ledger().timestamp(),
        });
    }
    save_allowances(e, who, &kept);
}

/// Hands a member's allowances to their new pass (Lifeline) or drops them (removal: `to` None).
pub(crate) fn move_allowances(e: &Env, from: &Address, to: Option<&Address>) {
    let allowances = load_allowances(e, from);
    e.storage()
        .persistent()
        .remove(&DataKey::Allowances(from.clone()));
    if let Some(to) = to {
        if !allowances.is_empty() {
            save_allowances(e, to, &allowances);
        }
    }
}

/// Checks a `SetRecipients` change: at most 100 distinct addresses.
pub(crate) fn plan_recipients(allowed: &Vec<Address>) -> Result<(), Error> {
    if allowed.len() > MAX_RECIPIENTS {
        return Err(Error::InvalidRecipients);
    }
    for (index, address) in allowed.iter().enumerate() {
        if allowed.first_index_of(&address) != Some(index as u32) {
            return Err(Error::InvalidRecipients);
        }
    }
    Ok(())
}

pub(crate) fn apply_recipients(e: &Env, mode: RecipientMode, allowed: &Vec<Address>) {
    e.storage().instance().set(
        &DataKey::Recipients,
        &RecipientRule {
            mode,
            allowed: allowed.clone(),
        },
    );
}

/// Accepts an oracle only if it answers `decimals()` like a SEP-40 oracle.
pub(crate) fn plan_fx_oracle(e: &Env, oracle: &Option<Address>) -> Result<(), Error> {
    match oracle {
        Some(address) => match OracleClient::new(e, address).try_decimals() {
            Ok(Ok(_)) => Ok(()),
            _ => Err(Error::OracleUnavailable),
        },
        None => Ok(()),
    }
}

pub(crate) fn apply_fx_oracle(e: &Env, oracle: &Option<Address>) {
    match oracle {
        Some(address) => e.storage().instance().set(&DataKey::FxOracle, address),
        None => e.storage().instance().remove(&DataKey::FxOracle),
    }
}

fn load_recipient_rule(e: &Env) -> RecipientRule {
    e.storage()
        .instance()
        .get(&DataKey::Recipients)
        .unwrap_or(RecipientRule {
            mode: RecipientMode::Open,
            allowed: Vec::new(e),
        })
}

fn load_allowances(e: &Env, who: &Address) -> Vec<Allowance> {
    e.storage()
        .persistent()
        .get(&DataKey::Allowances(who.clone()))
        .unwrap_or_else(|| Vec::new(e))
}

fn save_allowances(e: &Env, who: &Address, allowances: &Vec<Allowance>) {
    let key = DataKey::Allowances(who.clone());
    if allowances.is_empty() {
        e.storage().persistent().remove(&key);
        return;
    }
    e.storage().persistent().set(&key, allowances);
    e.storage()
        .persistent()
        .extend_ttl(&key, REQUEST_THRESHOLD, REQUEST_EXTEND);
}

/// The allowance with its window rolled forward to now (spent resets when a period has passed).
fn rolled(e: &Env, allowance: Allowance) -> Allowance {
    let now = e.ledger().timestamp();
    if now
        >= allowance
            .window_start
            .saturating_add(allowance.period_seconds)
    {
        Allowance {
            spent: 0,
            window_start: now,
            ..allowance
        }
    } else {
        allowance
    }
}
