//! Allowances per asset and category, recipient allowlists, exchange rates for the tiers.

use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{symbol_short, Address, BytesN, Env, String, Symbol, Vec};

use crate::test::{add_asset, board_member, club, euros, World};
use crate::types::{Budget, Change, Error, RecipientMode, Status};

/// A SEP-40 oracle quoting currencies against USD with 14 decimals, like Reflector's forex feed.
mod mock_oracle {
    use soroban_sdk::{contract, contractimpl, Env, Symbol};

    use crate::controls::{OracleAsset, PriceData};

    #[contract]
    pub struct MockOracle;

    #[contractimpl]
    impl MockOracle {
        pub fn set(e: Env, currency: Symbol, price: i128, timestamp: u64) {
            e.storage()
                .instance()
                .set(&currency, &PriceData { price, timestamp });
        }

        pub fn decimals(_e: Env) -> u32 {
            14
        }

        pub fn lastprice(e: Env, asset: OracleAsset) -> Option<PriceData> {
            match asset {
                OracleAsset::Other(currency) => e.storage().instance().get(&currency),
                OracleAsset::Stellar(_) => None,
            }
        }
    }
}

const ONE: i128 = 100_000_000_000_000;

fn pay(w: &World, by: &Address, token: &Address, to: &Address, amount: i128) -> u64 {
    w.org.propose_payment(
        by,
        token,
        to,
        &amount,
        &String::from_str(&w.e, ""),
        &None,
        &false,
    )
}

fn pay_in(w: &World, by: &Address, to: &Address, amount: i128, category: &str) -> u64 {
    w.org.propose_payment(
        by,
        &w.token,
        to,
        &amount,
        &String::from_str(&w.e, ""),
        &Some(Symbol::new(&w.e, category)),
        &false,
    )
}

/// A club whose rules have a soft "gear" budget, with one board member.
fn club_with_gear_budget() -> (World, Address) {
    let w = club(10_000);
    let mut policy = w.org.policy();
    policy.budgets = Vec::from_array(
        &w.e,
        [Budget {
            category: symbol_short!("gear"),
            amount: euros(5_000),
            period_seconds: 30 * 86_400,
            hard: false,
        }],
    );
    w.org.change_directly(
        &w.founder,
        &Change::UpdatePolicy(policy, BytesN::from_array(&w.e, &[4u8; 32])),
    );
    let bo = board_member(&w);
    (w, bo)
}

#[test]
fn a_category_allowance_covers_only_that_category() {
    let (w, bo) = club_with_gear_budget();
    w.org.change_directly(
        &w.founder,
        &Change::SetAllowance(
            bo.clone(),
            None,
            Some(symbol_short!("gear")),
            euros(500),
            86_400,
        ),
    );
    let shop = Address::generate(&w.e);
    // 300 is above the first tier, so without the allowance it would wait for approvals.
    let inside = pay_in(&w, &bo, &shop, euros(300), "gear");
    assert_eq!(w.org.request(&inside).status, Status::Executed);
    assert!(w.org.request(&inside).evaluation.within_limit);
    let outside = pay(&w, &bo, &w.token, &shop, euros(300));
    assert_eq!(w.org.request(&outside).status, Status::Pending);
    let spent = w.org.allowances().get_unchecked(0).allowance.spent;
    assert_eq!(spent, euros(300));
}

#[test]
fn an_asset_allowance_covers_another_currency_in_the_tokens_own_units() {
    let (w, bo) = club_with_gear_budget();
    let usdc = add_asset(&w, "USD", 1_000);
    w.org.change_directly(
        &w.founder,
        &Change::SetAllowance(bo.clone(), Some(usdc.clone()), None, euros(100), 86_400),
    );
    // A USD payment in a EUR organization: no rate, but the USD allowance covers it.
    let id = pay(&w, &bo, &usdc, &Address::generate(&w.e), euros(40));
    assert_eq!(w.org.request(&id).status, Status::Executed);
    assert_eq!(
        w.org.allowances().get_unchecked(0).allowance.spent,
        euros(40)
    );
    // Budgets count only euros, so a USD allowance can't be tied to a category.
    assert_eq!(
        w.org.try_change_directly(
            &w.founder,
            &Change::SetAllowance(
                bo,
                Some(usdc),
                Some(symbol_short!("gear")),
                euros(10),
                86_400
            ),
        ),
        Err(Ok(Error::InvalidLimit))
    );
}

#[test]
fn the_most_specific_allowance_with_room_is_used() {
    let (w, bo) = club_with_gear_budget();
    for (category, amount) in [
        (None, euros(1_000)),
        (Some(symbol_short!("gear")), euros(500)),
    ] {
        w.org.change_directly(
            &w.founder,
            &Change::SetAllowance(bo.clone(), Some(w.token.clone()), category, amount, 86_400),
        );
    }
    let id = pay_in(&w, &bo, &Address::generate(&w.e), euros(400), "gear");
    assert_eq!(w.org.request(&id).status, Status::Executed);
    for row in w.org.allowances().iter() {
        let expected = if row.allowance.category.is_some() {
            euros(400)
        } else {
            0
        };
        assert_eq!(row.allowance.spent, expected);
    }
    // The gear allowance has 100 left, so the next 400 falls back to the asset-wide one.
    pay_in(&w, &bo, &Address::generate(&w.e), euros(400), "gear");
    let asset_wide = w
        .org
        .allowances()
        .iter()
        .find(|row| row.allowance.category.is_none())
        .map(|row| row.allowance.spent);
    assert_eq!(asset_wide, Some(euros(400)));
}

#[test]
fn allowances_are_validated_and_follow_the_member() {
    let (w, bo) = club_with_gear_budget();
    let set = |who: &Address, token: Option<Address>, category: Option<Symbol>, amount| {
        w.org.try_change_directly(
            &w.founder,
            &Change::SetAllowance(who.clone(), token, category, amount, 86_400),
        )
    };
    assert_eq!(
        set(&bo, None, None, euros(10)),
        Err(Ok(Error::InvalidLimit))
    );
    assert_eq!(
        set(&bo, None, Some(symbol_short!("food")), euros(10)),
        Err(Ok(Error::UnknownBudget))
    );
    assert_eq!(
        set(&bo, Some(Address::generate(&w.e)), None, euros(10)),
        Err(Ok(Error::UnknownAsset))
    );
    assert_eq!(
        set(
            &Address::generate(&w.e),
            None,
            Some(symbol_short!("gear")),
            euros(10)
        ),
        Err(Ok(Error::NotMember))
    );
    assert!(set(&bo, None, Some(symbol_short!("gear")), euros(10)).is_ok());
    // Lifeline hands the allowance to the member's new pass.
    let new_pass = Address::generate(&w.e);
    w.org.recover_member(&bo, &new_pass);
    assert_eq!(w.org.allowances().get_unchecked(0).member, new_pass);
    // Removing the member (a request once a third person makes the rules satisfiable) drops it.
    let bea = board_member(&w);
    let id = w
        .org
        .propose_change(&w.founder, &Change::RemoveMember(new_pass.clone()));
    w.org.approve(&new_pass, &id);
    w.org.approve(&bea, &id);
    w.e.ledger()
        .set_timestamp(w.e.ledger().timestamp() + 48 * 3_600);
    w.org.execute(&id);
    assert_eq!(w.org.request(&id).status, Status::Executed);
    assert_eq!(w.org.allowances().len(), 0);
}

#[test]
fn only_listed_recipients_are_paid_when_the_list_is_strict() {
    let w = club(1_000);
    let listed = Address::generate(&w.e);
    let other = Address::generate(&w.e);
    w.org.change_directly(
        &w.founder,
        &Change::SetRecipients(RecipientMode::Only, Vec::from_array(&w.e, [listed.clone()])),
    );
    assert_eq!(w.org.recipient_rule().mode, RecipientMode::Only);
    let id = pay(&w, &w.founder, &w.token, &listed, euros(10));
    assert_eq!(w.org.request(&id).status, Status::Executed);
    assert_eq!(
        w.org.try_propose_payment(
            &w.founder,
            &w.token,
            &other,
            &euros(10),
            &String::from_str(&w.e, ""),
            &None,
            &false
        ),
        Err(Ok(Error::RecipientNotAllowed))
    );
}

#[test]
fn unlisted_recipients_take_the_strictest_tier_and_skip_allowances() {
    let (w, bo) = club_with_gear_budget();
    w.org.change_directly(
        &w.founder,
        &Change::SetSpendingLimit(bo.clone(), euros(1_000), 86_400),
    );
    let listed = Address::generate(&w.e);
    w.org.change_directly(
        &w.founder,
        &Change::SetRecipients(
            RecipientMode::Approve,
            Vec::from_array(&w.e, [listed.clone()]),
        ),
    );
    let fine = pay(&w, &bo, &w.token, &listed, euros(20));
    assert_eq!(w.org.request(&fine).status, Status::Executed);
    let unlisted = pay(&w, &bo, &w.token, &Address::generate(&w.e), euros(20));
    let request = w.org.request(&unlisted);
    assert_eq!(request.status, Status::Pending);
    assert!(!request.evaluation.within_limit);
    assert_eq!(request.evaluation.tier, Some(2));
}

#[test]
fn an_allowlist_holds_distinct_addresses() {
    let w = club(10);
    let a = Address::generate(&w.e);
    assert_eq!(
        w.org.try_change_directly(
            &w.founder,
            &Change::SetRecipients(RecipientMode::Only, Vec::from_array(&w.e, [a.clone(), a])),
        ),
        Err(Ok(Error::InvalidRecipients))
    );
}

/// A EUR club accepting USD, with an oracle quoting EUR at 1.10 USD.
fn club_with_oracle(e_rate_age: u64) -> (World, Address) {
    let w = club(1_000);
    let usdc = add_asset(&w, "USD", 1_000);
    w.e.ledger().set_timestamp(10_000_000);
    let oracle = w.e.register(mock_oracle::MockOracle, ());
    let client = mock_oracle::MockOracleClient::new(&w.e, &oracle);
    let at = 10_000_000 - e_rate_age;
    client.set(&symbol_short!("EUR"), &(ONE * 110 / 100), &at);
    client.set(&symbol_short!("USD"), &ONE, &at);
    w.org
        .change_directly(&w.founder, &Change::SetFxOracle(Some(oracle)));
    (w, usdc)
}

#[test]
fn a_fresh_rate_sets_the_tier_of_payments_in_another_currency() {
    let (w, usdc) = club_with_oracle(3_600);
    // 210 USD is 190.91 EUR: inside the first tier (up to 200 EUR), so it goes out at once.
    let small = pay(&w, &w.founder, &usdc, &Address::generate(&w.e), euros(210));
    let request = w.org.request(&small);
    assert_eq!(request.status, Status::Executed);
    assert!(!request.evaluation.seal_required);
    // 230 USD is 209.09 EUR: the second tier.
    let larger = pay(&w, &w.founder, &usdc, &Address::generate(&w.e), euros(230));
    assert_eq!(w.org.request(&larger).evaluation.tier, Some(1));
}

#[test]
fn a_stale_or_missing_rate_falls_back_to_the_strictest_tier_and_the_seal() {
    let (w, usdc) = club_with_oracle(5 * 86_400);
    let id = pay(&w, &w.founder, &usdc, &Address::generate(&w.e), euros(10));
    let request = w.org.request(&id);
    assert_eq!(request.evaluation.tier, Some(2));
    assert!(request.evaluation.seal_required);
    w.org
        .change_directly(&w.founder, &Change::SetFxOracle(None));
    assert_eq!(w.org.fx_oracle(), None);
}

#[test]
fn only_an_oracle_that_answers_like_sep_40_is_accepted() {
    let w = club(10);
    let not_an_oracle = Address::generate(&Env::default());
    assert_eq!(
        w.org
            .try_change_directly(&w.founder, &Change::SetFxOracle(Some(not_an_oracle))),
        Err(Ok(Error::OracleUnavailable))
    );
}
