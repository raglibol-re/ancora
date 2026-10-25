use soroban_sdk::testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke};
use soroban_sdk::{symbol_short, token, Address, BytesN, Env, IntoVal, String, Symbol, Vec};

use ancora_registry::{Registry, RegistryClient as RealRegistryClient};

use crate::types::{AssetSpec, Change, Error, Status, CENT};
use crate::{Organization, OrganizationClient};

struct World {
    e: Env,
    org: OrganizationClient<'static>,
    token: Address,
    token_client: token::Client<'static>,
    registry: RealRegistryClient<'static>,
    founder: Address,
}

fn euros(whole: i128) -> i128 {
    whole * 100 * CENT
}

/// A club founded by `founder` as treasurer, funded with `balance_euros`, registered.
fn club(balance_euros: i128) -> World {
    let e = Env::default();
    e.mock_all_auths();
    let operator = Address::generate(&e);
    let founder = Address::generate(&e);
    let registry_id = e.register(Registry, (&operator,));
    let registry = RealRegistryClient::new(&e, &registry_id);
    let asset = e.register_stellar_asset_contract_v2(operator.clone());
    let accepted = Vec::from_array(
        &e,
        [AssetSpec {
            token: asset.address(),
            currency: symbol_short!("EUR"),
        }],
    );
    let org_id = e.register(
        Organization,
        (
            &registry_id,
            symbol_short!("EUR"),
            accepted,
            &founder,
            Symbol::new(&e, "treasurer"),
            symbol_short!("club"),
            String::from_str(&e, "Tejo Rowing Club"),
            BytesN::from_array(&e, &[1u8; 32]),
        ),
    );
    registry.register_org(&org_id, &founder);
    token::StellarAssetClient::new(&e, &asset.address()).mint(&org_id, &euros(balance_euros));
    World {
        org: OrganizationClient::new(&e, &org_id),
        token: asset.address(),
        token_client: token::Client::new(&e, &asset.address()),
        registry,
        founder,
        e,
    }
}

/// Accepts another token tagged with `currency` (setup phase) and funds it.
fn add_asset(w: &World, currency: &str, whole: i128) -> Address {
    let asset =
        w.e.register_stellar_asset_contract_v2(Address::generate(&w.e));
    w.org.change_directly(
        &w.founder,
        &Change::AddAsset(AssetSpec {
            token: asset.address(),
            currency: Symbol::new(&w.e, currency),
        }),
    );
    token::StellarAssetClient::new(&w.e, &asset.address()).mint(&w.org.address, &euros(whole));
    asset.address()
}

fn board_member(w: &World) -> Address {
    let who = Address::generate(&w.e);
    w.org.change_directly(
        &w.founder,
        &Change::AddMember(who.clone(), symbol_short!("board")),
    );
    who
}

#[test]
fn founder_starts_alone_in_the_setup_phase() {
    let w = club(1_000);
    let members = w.org.members();
    assert_eq!(members.len(), 1);
    assert_eq!(members.get_unchecked(0).address, w.founder);
    assert!(w.org.is_setup_phase());
    assert_eq!(
        w.org.info().name,
        String::from_str(&w.e, "Tejo Rowing Club")
    );
}

#[test]
fn setup_phase_ends_once_others_can_satisfy_the_strictest_tier() {
    let w = club(1_000);
    let bo = board_member(&w);
    assert!(w.org.is_setup_phase());
    let bea = board_member(&w);
    assert!(!w.org.is_setup_phase());
    assert_eq!(w.org.members().len(), 3);
    assert_eq!(w.registry.orgs_of(&bo).len(), 1);
    let max = Address::generate(&w.e);
    assert_eq!(
        w.org
            .try_change_directly(&w.founder, &Change::AddMember(max, symbol_short!("member"))),
        Err(Ok(Error::NotInSetupPhase))
    );
    assert_eq!(
        w.org.try_change_directly(&bea, &Change::RemoveMember(bo)),
        Err(Ok(Error::NotFounder))
    );
}

#[test]
fn small_payments_go_out_at_once() {
    let w = club(1_000);
    let shop = Address::generate(&w.e);
    let id = w.org.propose_payment(
        &w.founder,
        &w.token,
        &shop,
        &euros(150),
        &String::from_str(&w.e, "Oars"),
    );
    let request = w.org.request(&id);
    assert_eq!(request.status, Status::Executed);
    assert_eq!(w.token_client.balance(&shop), euros(150));
    assert_eq!(w.org.available(&w.token), euros(850));
    assert!(w.org.has_paid(&shop));
}

#[test]
fn payments_wait_for_the_right_approvals_and_apply_four_eyes() {
    let w = club(5_000);
    let bo = board_member(&w);
    let bea = board_member(&w);
    let shop = Address::generate(&w.e);
    let id = w.org.propose_payment(
        &bo,
        &w.token,
        &shop,
        &euros(500),
        &String::from_str(&w.e, "Boat"),
    );
    assert_eq!(w.org.request(&id).status, Status::Pending);
    assert_eq!(w.org.available(&w.token), euros(4_500));
    assert_eq!(
        w.org.try_approve(&bo, &id),
        Err(Ok(Error::RequesterCannotApprove))
    );
    let max = Address::generate(&w.e);
    assert_eq!(w.org.try_approve(&max, &id), Err(Ok(Error::NotMember)));
    w.org.approve(&bea, &id);
    assert_eq!(w.org.request(&id).status, Status::Executed);
    assert_eq!(w.token_client.balance(&shop), euros(500));
    assert_eq!(
        w.org.try_approve(&w.founder, &id),
        Err(Ok(Error::NotPending))
    );
}

#[test]
fn large_payments_run_through_the_objection_window() {
    let w = club(10_000);
    let bo = board_member(&w);
    let bea = board_member(&w);
    let shop = Address::generate(&w.e);
    w.e.ledger().set_timestamp(1_000);
    let id = w.org.propose_payment(
        &w.founder,
        &w.token,
        &shop,
        &euros(3_200),
        &String::from_str(&w.e, "Regatta"),
    );
    w.org.approve(&bo, &id);
    w.org.approve(&bea, &id);
    let request = w.org.request(&id);
    assert_eq!(request.status, Status::Scheduled);
    assert_eq!(request.execute_after, Some(1_000 + 48 * 3_600));
    assert_eq!(w.org.try_execute(&id), Err(Ok(Error::NotReady)));
    w.e.ledger().set_timestamp(1_000 + 48 * 3_600);
    w.org.execute(&id);
    assert_eq!(w.org.request(&id).status, Status::Executed);
    assert_eq!(w.token_client.balance(&shop), euros(3_200));
}

#[test]
fn objections_and_cancellations_release_the_money() {
    let w = club(10_000);
    let bo = board_member(&w);
    // Still the setup phase with one board member, so the founder adds a plain member directly.
    let max = Address::generate(&w.e);
    w.org.change_directly(
        &w.founder,
        &Change::AddMember(max.clone(), symbol_short!("member")),
    );
    let bea = board_member(&w);
    let shop = Address::generate(&w.e);
    let id = w.org.propose_payment(
        &bo,
        &w.token,
        &shop,
        &euros(3_000),
        &String::from_str(&w.e, ""),
    );
    w.org.approve(&bea, &id);
    w.org.approve(&w.founder, &id);
    assert_eq!(w.org.request(&id).status, Status::Scheduled);
    assert_eq!(w.org.try_decline(&max, &id), Err(Ok(Error::CannotDecline)));
    w.org.decline(&bea, &id);
    assert_eq!(w.org.request(&id).status, Status::Declined);
    assert_eq!(w.org.available(&w.token), euros(10_000));
}

#[test]
fn the_seal_is_required_above_the_threshold() {
    let w = club(20_000);
    let bo = board_member(&w);
    let bea = board_member(&w);
    let shop = Address::generate(&w.e);
    let id = w.org.propose_payment(
        &w.founder,
        &w.token,
        &shop,
        &euros(12_000),
        &String::from_str(&w.e, ""),
    );
    w.org.approve(&bo, &id);
    w.org.approve(&bea, &id);
    assert_eq!(w.org.request(&id).status, Status::Pending);
    assert_eq!(
        w.org.try_seal(&w.founder, &id),
        Err(Ok(Error::RequesterCannotApprove))
    );
    w.org.seal(&bo, &id);
    assert_eq!(w.org.request(&id).status, Status::Scheduled);
    assert_eq!(w.org.try_seal(&bea, &id), Err(Ok(Error::NotPending)));
}

#[test]
fn refuses_overdrafts_and_bad_amounts() {
    let w = club(100);
    let shop = Address::generate(&w.e);
    let memo = String::from_str(&w.e, "");
    assert_eq!(
        w.org
            .try_propose_payment(&w.founder, &w.token, &shop, &euros(101), &memo),
        Err(Ok(Error::InsufficientFunds))
    );
    assert_eq!(
        w.org
            .try_propose_payment(&w.founder, &w.token, &shop, &0, &memo),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn membership_changes_are_requests_after_setup_and_index_the_registry() {
    let w = club(1_000);
    let bo = board_member(&w);
    let bea = board_member(&w);
    let nina = Address::generate(&w.e);
    let id = w.org.propose_change(
        &bo,
        &Change::AddMember(nina.clone(), symbol_short!("member")),
    );
    assert_eq!(w.org.request(&id).status, Status::Pending);
    w.org.approve(&bea, &id);
    w.org.approve(&w.founder, &id);
    // Governance uses the strictest tier, including its 48-hour objection window.
    assert_eq!(w.org.request(&id).status, Status::Scheduled);
    w.e.ledger()
        .set_timestamp(w.e.ledger().timestamp() + 48 * 3_600);
    w.org.execute(&id);
    assert_eq!(w.org.request(&id).status, Status::Executed);
    assert_eq!(w.org.members().len(), 4);
    assert_eq!(w.registry.orgs_of(&nina).len(), 1);
    assert_eq!(
        w.org
            .try_propose_change(&bo, &Change::AddMember(nina, symbol_short!("member"))),
        Err(Ok(Error::AlreadyMember))
    );
}

#[test]
fn rule_updates_carry_their_document_hash() {
    let w = club(1_000);
    let bo = board_member(&w);
    let bea = board_member(&w);
    assert_eq!(w.org.policy_hash(), BytesN::from_array(&w.e, &[1u8; 32]));
    let mut policy = w.org.policy();
    policy.seal_threshold = euros(25_000);
    let new_hash = BytesN::from_array(&w.e, &[7u8; 32]);
    let id = w
        .org
        .propose_change(&bo, &Change::UpdatePolicy(policy, new_hash.clone()));
    w.org.approve(&bea, &id);
    w.org.approve(&w.founder, &id);
    w.e.ledger()
        .set_timestamp(w.e.ledger().timestamp() + 48 * 3_600);
    w.org.execute(&id);
    assert_eq!(w.org.policy().seal_threshold, euros(25_000));
    assert_eq!(w.org.policy_hash(), new_hash);
    let mut broken = w.org.policy();
    broken.seal_threshold = 0;
    let bad_hash = BytesN::from_array(&w.e, &[9u8; 32]);
    assert_eq!(
        w.org
            .try_propose_change(&bo, &Change::UpdatePolicy(broken, bad_hash)),
        Err(Ok(Error::InvalidPolicy))
    );
}

#[test]
fn refuses_changes_that_would_lock_the_organization_out() {
    let w = club(1_000);
    // Treasurer + one board member can satisfy "2 board members" (a higher role fills a lower
    // slot); removing the board member would leave nobody able to approve anything large.
    let bo = board_member(&w);
    assert_eq!(
        w.org
            .try_propose_change(&bo, &Change::RemoveMember(bo.clone())),
        Err(Ok(Error::WouldLockAccount))
    );
}

#[test]
fn rejected_changes_mark_the_request_failed() {
    let w = club(1_000);
    let bo = board_member(&w);
    let bea = board_member(&w);
    let nina = Address::generate(&w.e);
    let first = w.org.propose_change(
        &bo,
        &Change::AddMember(nina.clone(), symbol_short!("member")),
    );
    let second = w.org.propose_change(
        &bea,
        &Change::AddMember(nina.clone(), symbol_short!("board")),
    );
    for id in [first, second] {
        w.org.approve(&w.founder, &id);
        w.org.approve(if id == first { &bea } else { &bo }, &id);
    }
    w.e.ledger()
        .set_timestamp(w.e.ledger().timestamp() + 48 * 3_600);
    w.org.execute(&first);
    w.org.execute(&second);
    assert_eq!(w.org.request(&first).status, Status::Executed);
    let failed = w.org.request(&second);
    assert_eq!(failed.status, Status::Failed);
    assert_eq!(failed.failure, Some(Error::AlreadyMember as u32));
}

#[test]
fn requests_are_listed_newest_first() {
    let w = club(1_000);
    let shop = Address::generate(&w.e);
    for _ in 0..3 {
        w.org.propose_payment(
            &w.founder,
            &w.token,
            &shop,
            &euros(10),
            &String::from_str(&w.e, ""),
        );
    }
    let page = w.org.requests(&0, &2);
    assert_eq!(page.len(), 2);
    assert_eq!(page.get_unchecked(0).id, 3);
    assert_eq!(page.get_unchecked(1).id, 2);
    assert_eq!(w.org.requests(&2, &50).len(), 1);
    assert_eq!(w.org.request_count(), 3);
}

#[test]
fn approving_requires_the_approvers_own_authorization() {
    let w = club(5_000);
    let bo = board_member(&w);
    let bea = board_member(&w);
    let shop = Address::generate(&w.e);
    let id = w.org.propose_payment(
        &bo,
        &w.token,
        &shop,
        &euros(500),
        &String::from_str(&w.e, ""),
    );
    // From here on, only `bo` is authorized; approving as `bea` must fail at the auth check.
    w.e.mock_auths(&[MockAuth {
        address: &bo,
        invoke: &MockAuthInvoke {
            contract: &w.org.address,
            fn_name: "approve",
            args: (&bea, id).into_val(&w.e),
            sub_invokes: &[],
        },
    }]);
    assert!(w.org.try_approve(&bea, &id).is_err());
    assert_eq!(w.org.request(&id).status, Status::Pending);
}

#[test]
fn proposing_requires_the_requesters_own_authorization() {
    let w = club(5_000);
    let shop = Address::generate(&w.e);
    let stranger = Address::generate(&w.e);
    w.e.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &w.org.address,
            fn_name: "propose_payment",
            args: (
                &w.founder,
                &w.token,
                &shop,
                euros(10),
                String::from_str(&w.e, ""),
            )
                .into_val(&w.e),
            sub_invokes: &[],
        },
    }]);
    assert!(w
        .org
        .try_propose_payment(
            &w.founder,
            &w.token,
            &shop,
            &euros(10),
            &String::from_str(&w.e, "")
        )
        .is_err());
    assert_eq!(w.token_client.balance(&shop), 0);
}

#[test]
fn accepts_several_tokens_and_pays_in_each() {
    let w = club(1_000);
    let eurc = add_asset(&w, "EUR", 500);
    let assets = w.org.assets();
    assert_eq!(assets.len(), 2);
    assert_eq!(assets.get_unchecked(1).token, eurc);
    assert_eq!(assets.get_unchecked(1).decimals, 7);
    let shop = Address::generate(&w.e);
    let memo = String::from_str(&w.e, "");
    let id = w
        .org
        .propose_payment(&w.founder, &eurc, &shop, &euros(100), &memo);
    assert_eq!(w.org.request(&id).status, Status::Executed);
    assert_eq!(token::Client::new(&w.e, &eurc).balance(&shop), euros(100));
    assert_eq!(w.org.available(&eurc), euros(400));
    assert_eq!(w.org.available(&w.token), euros(1_000));
    let stranger =
        w.e.register_stellar_asset_contract_v2(Address::generate(&w.e))
            .address();
    assert_eq!(
        w.org
            .try_propose_payment(&w.founder, &stranger, &shop, &euros(1), &memo),
        Err(Ok(Error::UnknownAsset))
    );
    assert_eq!(w.org.try_available(&stranger), Err(Ok(Error::UnknownAsset)));
    assert_eq!(
        w.org.try_change_directly(
            &w.founder,
            &Change::AddAsset(AssetSpec {
                token: eurc,
                currency: symbol_short!("EUR"),
            })
        ),
        Err(Ok(Error::AssetExists))
    );
}

#[test]
fn payments_in_another_currency_take_the_strictest_rules_and_the_seal() {
    let w = club(1_000);
    let usdc = add_asset(&w, "USD", 1_000);
    let bo = board_member(&w);
    let bea = board_member(&w);
    let shop = Address::generate(&w.e);
    let id = w.org.propose_payment(
        &w.founder,
        &usdc,
        &shop,
        &euros(150),
        &String::from_str(&w.e, "Small, but in dollars"),
    );
    let request = w.org.request(&id);
    assert_eq!(request.status, Status::Pending);
    assert_eq!(request.evaluation.tier, Some(2));
    assert!(request.evaluation.seal_required);
    assert_eq!(request.evaluation.objection_window_hours, 48);
    w.org.approve(&bo, &id);
    w.org.approve(&bea, &id);
    w.org.seal(&bo, &id);
    assert_eq!(w.org.request(&id).status, Status::Scheduled);
}

#[test]
fn tokens_in_use_or_alone_cannot_be_removed() {
    let w = club(10);
    assert_eq!(
        w.org
            .try_change_directly(&w.founder, &Change::RemoveAsset(w.token.clone())),
        Err(Ok(Error::LastAsset))
    );
    let eurc = add_asset(&w, "EUR", 50);
    assert_eq!(
        w.org
            .try_change_directly(&w.founder, &Change::RemoveAsset(eurc.clone())),
        Err(Ok(Error::AssetInUse))
    );
    assert_eq!(
        w.org
            .try_change_directly(&w.founder, &Change::RemoveAsset(Address::generate(&w.e))),
        Err(Ok(Error::UnknownAsset))
    );
    let shop = Address::generate(&w.e);
    w.org.propose_payment(
        &w.founder,
        &eurc,
        &shop,
        &euros(50),
        &String::from_str(&w.e, ""),
    );
    w.org
        .change_directly(&w.founder, &Change::RemoveAsset(eurc.clone()));
    assert_eq!(w.org.assets().len(), 1);
    assert_eq!(w.org.try_available(&eurc), Err(Ok(Error::UnknownAsset)));
}
