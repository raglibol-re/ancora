use soroban_sdk::testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke};
use soroban_sdk::{token, Address, BytesN, Env, IntoVal, String, Val, Vec};

use crate::{DealStatus, DealTerms, Deals, DealsClient, Error, MilestoneStatus, MilestoneTerms};

const PERIOD: u64 = 3 * 86_400;

struct World {
    e: Env,
    deals: DealsClient<'static>,
    asset: Address,
    tokens: token::Client<'static>,
    a: Address,
    b: Address,
    arbiter: Address,
}

fn world() -> World {
    let e = Env::default();
    e.mock_all_auths();
    let issuer = Address::generate(&e);
    let asset = e.register_stellar_asset_contract_v2(issuer).address();
    let a = Address::generate(&e);
    token::StellarAssetClient::new(&e, &asset).mint(&a, &10_000);
    let id = e.register(Deals, ());
    World {
        deals: DealsClient::new(&e, &id),
        tokens: token::Client::new(&e, &asset),
        asset,
        a,
        b: Address::generate(&e),
        arbiter: Address::generate(&e),
        e,
    }
}

fn terms(w: &World, amounts: &[i128], arbiter: bool) -> DealTerms {
    let mut milestones = Vec::new(&w.e);
    for amount in amounts {
        milestones.push_back(MilestoneTerms {
            label: String::from_str(&w.e, "Delivery"),
            amount: *amount,
        });
    }
    DealTerms {
        asset: w.asset.clone(),
        milestones,
        objection_seconds: PERIOD,
        arbiter: arbiter.then(|| w.arbiter.clone()),
        document_hash: BytesN::from_array(&w.e, &[5u8; 32]),
    }
}

/// A deal created, accepted and funded: 600 and 400 to B.
fn funded(w: &World, arbiter: bool) -> u64 {
    let id = w.deals.create(&w.a, &w.b, &terms(w, &[600, 400], arbiter));
    w.deals.accept(&id);
    w.deals.fund(&id);
    id
}

fn later(w: &World, seconds: u64) {
    w.e.ledger()
        .set_timestamp(w.e.ledger().timestamp() + seconds);
}

#[test]
fn a_deal_runs_from_draft_to_completed() {
    let w = world();
    let id = w.deals.create(&w.a, &w.b, &terms(&w, &[600, 400], false));
    assert_eq!(w.deals.deal(&id).status, DealStatus::Draft);
    w.deals.accept(&id);
    assert_eq!(w.deals.deal(&id).status, DealStatus::Accepted);
    w.deals.fund(&id);
    assert_eq!(w.deals.deal(&id).status, DealStatus::Funded);
    assert_eq!(w.tokens.balance(&w.deals.address), 1_000);
    w.deals.request_release(&id, &0);
    assert_eq!(w.deals.deal(&id).status, DealStatus::Active);
    w.deals.approve_release(&id, &0);
    assert_eq!(w.tokens.balance(&w.b), 600);
    w.deals.request_release(&id, &1);
    later(&w, PERIOD);
    w.deals.execute_release(&id, &1);
    let deal = w.deals.deal(&id);
    assert_eq!(deal.status, DealStatus::Completed);
    assert_eq!(deal.paid_out, 1_000);
    assert_eq!(w.tokens.balance(&w.b), 1_000);
    assert_eq!(w.tokens.balance(&w.deals.address), 0);
    assert_eq!(w.deals.deals_of(&w.b).len(), 1);
    assert_eq!(w.deals.quote(&id, &None), (w.asset.clone(), 1_000));
    assert_eq!(w.deals.quote(&id, &Some(1)), (w.asset.clone(), 400));
}

#[test]
fn terms_are_checked() {
    let w = world();
    let bad = |t: DealTerms, b: &Address| w.deals.try_create(&w.a, b, &t);
    assert_eq!(
        bad(terms(&w, &[], false), &w.b),
        Err(Ok(Error::InvalidTerms))
    );
    assert_eq!(
        bad(terms(&w, &[0], false), &w.b),
        Err(Ok(Error::InvalidTerms))
    );
    assert_eq!(
        bad(terms(&w, &[5], false), &w.a),
        Err(Ok(Error::InvalidTerms))
    );
    let mut short = terms(&w, &[5], false);
    short.objection_seconds = 10;
    assert_eq!(bad(short, &w.b), Err(Ok(Error::InvalidTerms)));
    let mut party_arbiter = terms(&w, &[5], false);
    party_arbiter.arbiter = Some(w.b.clone());
    assert_eq!(bad(party_arbiter, &w.b), Err(Ok(Error::InvalidTerms)));
    let mut long = terms(&w, &[5], false);
    long.milestones.set(
        0,
        MilestoneTerms {
            label: String::from_str(&w.e, &"x".repeat(65)),
            amount: 5,
        },
    );
    assert_eq!(bad(long, &w.b), Err(Ok(Error::TextTooLong)));
}

#[test]
fn steps_out_of_order_are_refused() {
    let w = world();
    let id = w.deals.create(&w.a, &w.b, &terms(&w, &[600], false));
    assert_eq!(w.deals.try_fund(&id), Err(Ok(Error::WrongStatus)));
    assert_eq!(
        w.deals.try_request_release(&id, &0),
        Err(Ok(Error::WrongStatus))
    );
    w.deals.accept(&id);
    assert_eq!(w.deals.try_accept(&id), Err(Ok(Error::WrongStatus)));
    w.deals.fund(&id);
    assert_eq!(w.deals.try_fund(&id), Err(Ok(Error::WrongStatus)));
    assert_eq!(
        w.deals.try_request_release(&id, &3),
        Err(Ok(Error::UnknownMilestone))
    );
    assert_eq!(w.deals.try_deal(&99), Err(Ok(Error::NotFound)));
}

#[test]
fn the_automatic_payout_waits_for_the_period_and_never_pays_twice() {
    let w = world();
    let id = funded(&w, false);
    w.deals.request_release(&id, &0);
    later(&w, PERIOD - 1);
    assert_eq!(
        w.deals.try_execute_release(&id, &0),
        Err(Ok(Error::PeriodRunning))
    );
    later(&w, 1);
    w.deals.execute_release(&id, &0);
    assert_eq!(w.tokens.balance(&w.b), 600);
    assert_eq!(
        w.deals.try_execute_release(&id, &0),
        Err(Ok(Error::MilestoneWrongState))
    );
    assert_eq!(
        w.deals.try_approve_release(&id, &0),
        Err(Ok(Error::MilestoneWrongState))
    );
    assert_eq!(w.tokens.balance(&w.b), 600);
}

#[test]
fn an_objection_stops_the_automatic_payout() {
    let w = world();
    let id = funded(&w, false);
    w.deals.request_release(&id, &0);
    later(&w, PERIOD / 2);
    w.deals.object(&id, &0);
    later(&w, PERIOD);
    assert_eq!(
        w.deals.try_execute_release(&id, &0),
        Err(Ok(Error::MilestoneWrongState))
    );
    assert_eq!(w.tokens.balance(&w.b), 0);
    // B can ask again; A can still approve after objecting.
    w.deals.request_release(&id, &0);
    assert_eq!(
        w.deals.deal(&id).milestones.get_unchecked(0).status,
        MilestoneStatus::Requested
    );
    w.deals.approve_release(&id, &0);
    assert_eq!(w.tokens.balance(&w.b), 600);
}

#[test]
fn objections_come_only_within_the_period() {
    let w = world();
    let id = funded(&w, false);
    w.deals.request_release(&id, &0);
    later(&w, PERIOD);
    assert_eq!(w.deals.try_object(&id, &0), Err(Ok(Error::PeriodOver)));
}

#[test]
fn a_funded_deal_is_cancelled_only_when_both_parties_ask() {
    let w = world();
    let id = funded(&w, false);
    w.deals.request_release(&id, &0);
    w.deals.approve_release(&id, &0);
    w.deals.cancel(&id, &w.a);
    assert_eq!(w.deals.deal(&id).status, DealStatus::Active);
    assert_eq!(w.deals.try_cancel(&id, &w.a), Err(Ok(Error::AlreadyAsked)));
    w.deals.cancel(&id, &w.b);
    let deal = w.deals.deal(&id);
    assert_eq!(deal.status, DealStatus::Cancelled);
    assert_eq!(w.tokens.balance(&w.a), 10_000 - 600);
    assert_eq!(w.tokens.balance(&w.deals.address), 0);
}

#[test]
fn before_funding_only_a_cancels() {
    let w = world();
    let id = w.deals.create(&w.a, &w.b, &terms(&w, &[600], false));
    assert_eq!(w.deals.try_cancel(&id, &w.b), Err(Ok(Error::NotParty)));
    let stranger = Address::generate(&w.e);
    assert_eq!(w.deals.try_cancel(&id, &stranger), Err(Ok(Error::NotParty)));
    w.deals.cancel(&id, &w.a);
    assert_eq!(w.deals.deal(&id).status, DealStatus::Cancelled);
    assert_eq!(w.deals.try_accept(&id), Err(Ok(Error::WrongStatus)));
}

#[test]
fn the_arbiter_splits_what_is_left_between_the_parties_only() {
    let w = world();
    let id = funded(&w, true);
    w.deals.request_release(&id, &0);
    w.deals.approve_release(&id, &0);
    w.deals.dispute(&id, &w.b);
    assert_eq!(w.deals.deal(&id).status, DealStatus::Disputed);
    // Payouts stop while disputed.
    assert_eq!(
        w.deals.try_request_release(&id, &1),
        Err(Ok(Error::WrongStatus))
    );
    assert_eq!(
        w.deals.try_resolve(&id, &400, &100),
        Err(Ok(Error::InvalidSplit))
    );
    assert_eq!(
        w.deals.try_resolve(&id, &500, &-100),
        Err(Ok(Error::InvalidSplit))
    );
    w.deals.resolve(&id, &150, &250);
    assert_eq!(w.deals.deal(&id).status, DealStatus::Resolved);
    assert_eq!(w.tokens.balance(&w.a), 10_000 - 1_000 + 150);
    assert_eq!(w.tokens.balance(&w.b), 600 + 250);
    assert_eq!(w.tokens.balance(&w.deals.address), 0);
}

#[test]
fn disputes_need_an_arbiter() {
    let w = world();
    let id = funded(&w, false);
    assert_eq!(w.deals.try_dispute(&id, &w.a), Err(Ok(Error::NoArbiter)));
}

/// Builds the one authorization `who` gives for `function` with `args`.
fn invocation<'a>(w: &'a World, function: &'a str, args: Vec<Val>) -> MockAuthInvoke<'a> {
    MockAuthInvoke {
        contract: &w.deals.address,
        fn_name: function,
        args,
        sub_invokes: &[],
    }
}

/// Strict authorization: each step needs its own party's signature, and nobody else's works.
#[test]
fn only_the_intended_roles_can_act() {
    let w = world();
    let id = funded(&w, true);
    let stranger = Address::generate(&w.e);
    w.e.set_auths(&[]);
    // B can't approve their own payout; A can't ask for it; a stranger can't rule.
    let approve = invocation(&w, "approve_release", (id, 0u32).into_val(&w.e));
    assert!(w
        .deals
        .mock_auths(&[MockAuth {
            address: &w.b,
            invoke: &approve
        }])
        .try_approve_release(&id, &0)
        .is_err());
    let request = invocation(&w, "request_release", (id, 0u32).into_val(&w.e));
    assert!(w
        .deals
        .mock_auths(&[MockAuth {
            address: &w.a,
            invoke: &request
        }])
        .try_request_release(&id, &0)
        .is_err());
    let resolve = invocation(&w, "resolve", (id, 1_000i128, 0i128).into_val(&w.e));
    assert!(w
        .deals
        .mock_auths(&[MockAuth {
            address: &stranger,
            invoke: &resolve
        }])
        .try_resolve(&id, &1_000, &0)
        .is_err());
    let cancel = invocation(&w, "cancel", (id, stranger.clone()).into_val(&w.e));
    assert_eq!(
        w.deals
            .mock_auths(&[MockAuth {
                address: &stranger,
                invoke: &cancel
            }])
            .try_cancel(&id, &stranger),
        Err(Ok(Error::NotParty))
    );
    // B's own signature does let B ask for the payout; the money stays put.
    w.deals
        .mock_auths(&[MockAuth {
            address: &w.b,
            invoke: &request,
        }])
        .request_release(&id, &0);
    assert_eq!(w.tokens.balance(&w.deals.address), 1_000);
}
