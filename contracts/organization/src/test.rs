use soroban_sdk::testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke};
use soroban_sdk::{symbol_short, token, Address, BytesN, Env, IntoVal, String, Symbol, Vec};

use ancora_registry::{Registry, RegistryClient as RealRegistryClient};

use crate::types::{AssetSpec, Budget, Change, Error, Status, CENT};
use crate::{Organization, OrganizationClient};
use mock_vault::MockVault;

struct World {
    e: Env,
    org: OrganizationClient<'static>,
    token: Address,
    token_client: token::Client<'static>,
    registry: RealRegistryClient<'static>,
    founder: Address,
    recovery: Address,
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
    let recovery = Address::generate(&e);
    let asset = e.register_stellar_asset_contract_v2(operator.clone());
    let accepted = Vec::from_array(
        &e,
        [AssetSpec {
            token: asset.address(),
            currency: symbol_short!("EUR"),
            vault: None,
        }],
    );
    let org_id = e.register(
        Organization,
        (
            &registry_id,
            &recovery,
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
        recovery,
        e,
    }
}

#[test]
fn a_recovery_hands_the_position_and_limit_to_the_new_pass() {
    let w = club(5_000);
    let bo = board_member(&w);
    let new_pass = Address::generate(&w.e);
    w.org.change_directly(
        &w.founder,
        &Change::SetSpendingLimit(bo.clone(), euros(100), 86_400),
    );
    assert!(w.registry.orgs_of(&bo).contains(&w.org.address));

    w.org.recover_member(&bo, &new_pass);

    let members = w.org.members();
    assert!(members
        .iter()
        .any(|m| m.address == new_pass && m.role == Symbol::new(&w.e, "board")));
    assert!(!members.iter().any(|m| m.address == bo));
    let limits = w.org.spending_limits();
    assert!(limits
        .iter()
        .any(|l| l.member == new_pass && l.limit.amount == euros(100)));
    assert!(!limits.iter().any(|l| l.member == bo));
    assert!(!w.registry.orgs_of(&bo).contains(&w.org.address));
    assert!(w.registry.orgs_of(&new_pass).contains(&w.org.address));

    // Strangers and existing members can't be the target; the founder flag moves along.
    assert_eq!(
        w.org.try_recover_member(&bo, &Address::generate(&w.e)),
        Err(Ok(Error::NotMember))
    );
    assert_eq!(
        w.org.try_recover_member(&new_pass, &w.founder),
        Err(Ok(Error::AlreadyMember))
    );
    let founder_pass = Address::generate(&w.e);
    w.org.recover_member(&w.founder, &founder_pass);
    assert_eq!(w.org.info().founder, founder_pass);
}

#[test]
fn recovering_requires_the_recovery_contracts_authorization() {
    let w = club(5_000);
    let bo = board_member(&w);
    let new_pass = Address::generate(&w.e);
    // Only the founder is authorized from here on: the recovery contract's auth is missing.
    w.e.mock_auths(&[MockAuth {
        address: &w.founder,
        invoke: &MockAuthInvoke {
            contract: &w.org.address,
            fn_name: "recover_member",
            args: (&bo, &new_pass).into_val(&w.e),
            sub_invokes: &[],
        },
    }]);
    assert!(w.org.try_recover_member(&bo, &new_pass).is_err());
    assert!(w.org.members().iter().any(|m| m.address == bo));
    // With the recovery contract's authorization it works; the registry trusts the organization
    // as the direct invoker of `set_membership`, so no further auth is needed.
    w.e.mock_auths(&[MockAuth {
        address: &w.recovery,
        invoke: &MockAuthInvoke {
            contract: &w.org.address,
            fn_name: "recover_member",
            args: (&bo, &new_pass).into_val(&w.e),
            sub_invokes: &[],
        },
    }]);
    w.org.recover_member(&bo, &new_pass);
    assert!(w.org.members().iter().any(|m| m.address == new_pass));
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
            vault: None,
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
fn only_the_top_role_sets_the_logo() {
    let w = club(10);
    let bo = board_member(&w);
    let logo = String::from_str(&w.e, "https://example.test/logo.webp");
    assert_eq!(w.org.info().logo, String::from_str(&w.e, ""));
    assert_eq!(w.org.try_set_logo(&bo, &logo), Err(Ok(Error::NotTopRole)));
    assert_eq!(
        w.org.try_set_logo(&Address::generate(&w.e), &logo),
        Err(Ok(Error::NotMember))
    );
    w.org.set_logo(&w.founder, &logo);
    assert_eq!(w.org.info().logo, logo);
    let long = String::from_str(&w.e, &"u".repeat(257));
    assert_eq!(
        w.org.try_set_logo(&w.founder, &long),
        Err(Ok(Error::TextTooLong))
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
        &None,
        &false,
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
        &None,
        &false,
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
        &None,
        &false,
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
        &None,
        &false,
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
        &None,
        &false,
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
        w.org.try_propose_payment(
            &w.founder,
            &w.token,
            &shop,
            &euros(101),
            &memo,
            &None,
            &false
        ),
        Err(Ok(Error::InsufficientFunds))
    );
    assert_eq!(
        w.org
            .try_propose_payment(&w.founder, &w.token, &shop, &0, &memo, &None, &false),
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
            &None,
            &false,
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
        &None,
        &false,
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
            &String::from_str(&w.e, ""),
            &None,
            &false
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
        .propose_payment(&w.founder, &eurc, &shop, &euros(100), &memo, &None, &false);
    assert_eq!(w.org.request(&id).status, Status::Executed);
    assert_eq!(token::Client::new(&w.e, &eurc).balance(&shop), euros(100));
    assert_eq!(w.org.available(&eurc), euros(400));
    assert_eq!(w.org.available(&w.token), euros(1_000));
    let stranger =
        w.e.register_stellar_asset_contract_v2(Address::generate(&w.e))
            .address();
    assert_eq!(
        w.org.try_propose_payment(
            &w.founder,
            &stranger,
            &shop,
            &euros(1),
            &memo,
            &None,
            &false
        ),
        Err(Ok(Error::UnknownAsset))
    );
    assert_eq!(w.org.try_available(&stranger), Err(Ok(Error::UnknownAsset)));
    assert_eq!(
        w.org.try_change_directly(
            &w.founder,
            &Change::AddAsset(AssetSpec {
                token: eurc,
                currency: symbol_short!("EUR"),
                vault: None,
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
        &None,
        &false,
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
        &None,
        &false,
    );
    w.org
        .change_directly(&w.founder, &Change::RemoveAsset(eurc.clone()));
    assert_eq!(w.org.assets().len(), 1);
    assert_eq!(w.org.try_available(&eurc), Err(Ok(Error::UnknownAsset)));
}

/// A stand-in for a DeFindex vault with 1:1 shares and a settable 1% yield, enough to test the
/// Reserve flow (deposit pulls the asset from the depositor, withdraw pays it back).
mod mock_vault {
    use soroban_sdk::{contract, contractimpl, contracttype, token, vec, Address, Env, Val, Vec};

    #[contracttype]
    #[derive(Clone)]
    pub enum Key {
        Asset,
        Shares(Address),
        Total,
        Bonus,
    }

    #[contract]
    pub struct MockVault;

    #[contractimpl]
    impl MockVault {
        pub fn __constructor(e: &Env, asset: Address) {
            e.storage().instance().set(&Key::Asset, &asset);
        }

        fn asset(e: &Env) -> Address {
            e.storage().instance().get(&Key::Asset).unwrap()
        }

        /// Adds yield: every share is worth this many extra stroops.
        pub fn set_bonus(e: &Env, bonus: i128) {
            e.storage().instance().set(&Key::Bonus, &bonus);
        }

        pub fn deposit(
            e: &Env,
            amounts_desired: Vec<i128>,
            _amounts_min: Vec<i128>,
            from: Address,
            _invest: bool,
        ) -> (Vec<i128>, i128, Val) {
            from.require_auth();
            let amount = amounts_desired.get_unchecked(0);
            let me = e.current_contract_address();
            token::Client::new(e, &Self::asset(e)).transfer(&from, &me, &amount);
            let shares = Self::balance(e, from.clone()) + amount;
            e.storage().instance().set(&Key::Shares(from), &shares);
            (vec![e, amount], amount, Val::VOID.into())
        }

        pub fn withdraw(
            e: &Env,
            withdraw_shares: i128,
            min_amounts_out: Vec<i128>,
            from: Address,
        ) -> Vec<i128> {
            from.require_auth();
            let held = Self::balance(e, from.clone());
            assert!(withdraw_shares <= held, "not enough shares");
            let amount = Self::get_asset_amounts_per_shares(e, withdraw_shares).get_unchecked(0);
            assert!(amount >= min_amounts_out.get_unchecked(0), "slippage");
            e.storage()
                .instance()
                .set(&Key::Shares(from.clone()), &(held - withdraw_shares));
            let me = e.current_contract_address();
            token::Client::new(e, &Self::asset(e)).transfer(&me, &from, &amount);
            vec![e, amount]
        }

        pub fn balance(e: &Env, id: Address) -> i128 {
            e.storage().instance().get(&Key::Shares(id)).unwrap_or(0)
        }

        pub fn get_asset_amounts_per_shares(e: &Env, vault_shares: i128) -> Vec<i128> {
            let bonus: i128 = e.storage().instance().get(&Key::Bonus).unwrap_or(0);
            vec![e, vault_shares + vault_shares / 100 * bonus]
        }
    }
}

/// Accepts a token with a Reserve vault (setup phase) and funds the account with it.
fn add_asset_with_vault(w: &World, whole: i128) -> (Address, Address) {
    let asset =
        w.e.register_stellar_asset_contract_v2(Address::generate(&w.e));
    let vault = w.e.register(MockVault, (asset.address(),));
    w.org.change_directly(
        &w.founder,
        &Change::AddAsset(AssetSpec {
            token: asset.address(),
            currency: symbol_short!("EUR"),
            vault: Some(vault.clone()),
        }),
    );
    token::StellarAssetClient::new(&w.e, &asset.address()).mint(&w.org.address, &euros(whole));
    (asset.address(), vault)
}

#[test]
fn treasury_moves_need_treasury_rights_but_no_request() {
    let w = club(1_000);
    let (usdc, vault) = add_asset_with_vault(&w, 1_000);
    let max = Address::generate(&w.e);
    w.org.change_directly(
        &w.founder,
        &Change::AddMember(max.clone(), symbol_short!("member")),
    );
    assert_eq!(
        w.org.try_move_to_reserve(&max, &usdc, &euros(100)),
        Err(Ok(Error::NotTreasurer))
    );
    assert_eq!(
        w.org.try_move_to_reserve(&w.founder, &w.token, &euros(100)),
        Err(Ok(Error::NoReserve))
    );
    assert_eq!(
        w.org.try_move_to_reserve(&w.founder, &usdc, &euros(1_001)),
        Err(Ok(Error::InsufficientFunds))
    );
    w.org.move_to_reserve(&w.founder, &usdc, &euros(300));
    assert_eq!(w.org.available(&usdc), euros(700));
    let reserve = w.org.reserve(&usdc);
    assert_eq!(reserve.vault, vault);
    assert_eq!(reserve.value, euros(300));
    assert_eq!(reserve.principal, euros(300));
    assert_eq!(w.org.request_count(), 0);
    // Shares are worth more now; earnings show as value above principal.
    mock_vault::MockVaultClient::new(&w.e, &vault).set_bonus(&1);
    assert_eq!(w.org.reserve(&usdc).value, euros(303));
    w.org.withdraw_from_reserve(&w.founder, &usdc, &euros(100));
    assert_eq!(w.org.available(&usdc), euros(800));
    let after = w.org.reserve(&usdc);
    assert_eq!(after.principal, euros(200));
    assert!(after.value >= euros(203) - CENT && after.value <= euros(203) + CENT);
    assert_eq!(
        w.org
            .try_withdraw_from_reserve(&w.founder, &usdc, &euros(1_000)),
        Err(Ok(Error::InsufficientFunds))
    );
    // A board member could approve the strictest tier, so they have treasury rights too.
    let bo = board_member(&w);
    w.org.move_to_reserve(&bo, &usdc, &euros(50));
    assert_eq!(w.org.reserve(&usdc).principal, euros(250));
}

#[test]
fn reserve_moves_require_the_movers_own_authorization() {
    let w = club(1_000);
    let (usdc, _vault) = add_asset_with_vault(&w, 1_000);
    let stranger = Address::generate(&w.e);
    w.e.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &w.org.address,
            fn_name: "move_to_reserve",
            args: (&w.founder, &usdc, euros(10)).into_val(&w.e),
            sub_invokes: &[],
        },
    }]);
    assert!(w
        .org
        .try_move_to_reserve(&w.founder, &usdc, &euros(10))
        .is_err());
    assert_eq!(w.org.available(&usdc), euros(1_000));
}

#[test]
fn spending_limits_let_crew_pay_small_amounts_without_approvals() {
    let w = club(5_000);
    let bo = board_member(&w);
    let max = Address::generate(&w.e);
    w.org.change_directly(
        &w.founder,
        &Change::AddMember(max.clone(), symbol_short!("member")),
    );
    // Not a member yet, bad amounts, bad periods.
    assert_eq!(
        w.org.try_change_directly(
            &w.founder,
            &Change::SetSpendingLimit(Address::generate(&w.e), euros(100), 86_400)
        ),
        Err(Ok(Error::NotMember))
    );
    assert_eq!(
        w.org.try_change_directly(
            &w.founder,
            &Change::SetSpendingLimit(max.clone(), -1, 86_400)
        ),
        Err(Ok(Error::InvalidLimit))
    );
    assert_eq!(
        w.org.try_change_directly(
            &w.founder,
            &Change::SetSpendingLimit(max.clone(), euros(500), 0)
        ),
        Err(Ok(Error::InvalidLimit))
    );
    w.e.ledger().set_timestamp(10_000);
    w.org.change_directly(
        &w.founder,
        &Change::SetSpendingLimit(max.clone(), euros(500), 30 * 86_400),
    );
    let shop = Address::generate(&w.e);
    let memo = String::from_str(&w.e, "crew");
    // €400 would normally need a board member; inside the allowance it goes out at once.
    let id = w
        .org
        .propose_payment(&max, &w.token, &shop, &euros(400), &memo, &None, &false);
    let request = w.org.request(&id);
    assert_eq!(request.status, Status::Executed);
    assert!(request.evaluation.within_limit);
    assert_eq!(w.token_client.balance(&shop), euros(400));
    let limits = w.org.spending_limits();
    assert_eq!(limits.len(), 1);
    assert_eq!(limits.get_unchecked(0).limit.spent, euros(400));
    // The next €400 doesn't fit: normal rules, so it waits for a board member.
    let second = w
        .org
        .propose_payment(&max, &w.token, &shop, &euros(400), &memo, &None, &false);
    assert_eq!(w.org.request(&second).status, Status::Pending);
    assert!(!w.org.request(&second).evaluation.within_limit);
    w.org.approve(&bo, &second);
    assert_eq!(w.org.request(&second).status, Status::Executed);
    // A new period resets the allowance.
    w.e.ledger().set_timestamp(10_000 + 30 * 86_400);
    assert_eq!(w.org.spending_limits().get_unchecked(0).limit.spent, 0);
    let third = w
        .org
        .propose_payment(&max, &w.token, &shop, &euros(500), &memo, &None, &false);
    assert_eq!(w.org.request(&third).status, Status::Executed);
    // Removing the limit (amount 0) and removing the member both clear it.
    w.org
        .change_directly(&w.founder, &Change::SetSpendingLimit(max.clone(), 0, 0));
    assert_eq!(w.org.spending_limits().len(), 0);
}

#[test]
fn spending_limits_apply_only_to_the_rules_currency() {
    let w = club(1_000);
    let usdc = add_asset(&w, "USD", 1_000);
    let max = Address::generate(&w.e);
    w.org.change_directly(
        &w.founder,
        &Change::AddMember(max.clone(), symbol_short!("member")),
    );
    w.org.change_directly(
        &w.founder,
        &Change::SetSpendingLimit(max.clone(), euros(500), 86_400),
    );
    let shop = Address::generate(&w.e);
    let id = w.org.propose_payment(
        &max,
        &usdc,
        &shop,
        &euros(10),
        &String::from_str(&w.e, ""),
        &None,
        &false,
    );
    // Dollars in a euro organization: strictest tier and seal, the allowance doesn't apply.
    assert_eq!(w.org.request(&id).status, Status::Pending);
    assert!(w.org.request(&id).evaluation.seal_required);
}

#[test]
fn budgets_count_categorised_payments_and_escalate_or_refuse() {
    let w = club(50_000);
    let events = Symbol::new(&w.e, "events");
    let gear = symbol_short!("gear");
    let mut policy = w.org.policy();
    policy.budgets = Vec::from_array(
        &w.e,
        [
            Budget {
                category: events.clone(),
                amount: euros(1_000),
                period_seconds: 30 * 86_400,
                hard: false,
            },
            Budget {
                category: gear.clone(),
                amount: euros(500),
                period_seconds: 30 * 86_400,
                hard: true,
            },
        ],
    );
    w.org.change_directly(
        &w.founder,
        &Change::UpdatePolicy(policy, BytesN::from_array(&w.e, &[3u8; 32])),
    );
    let bo = board_member(&w);
    let shop = Address::generate(&w.e);
    let memo = String::from_str(&w.e, "");

    assert_eq!(
        w.org.try_propose_payment(
            &bo,
            &w.token,
            &shop,
            &euros(10),
            &memo,
            &Some(symbol_short!("other")),
            &false
        ),
        Err(Ok(Error::UnknownBudget))
    );
    // Within the events budget: the amount's own tier.
    let first = w.org.propose_payment(
        &bo,
        &w.token,
        &shop,
        &euros(600),
        &memo,
        &Some(events.clone()),
        &false,
    );
    let request = w.org.request(&first);
    assert_eq!(request.evaluation.tier, Some(1));
    assert!(!request.evaluation.over_budget);
    assert_eq!(w.org.budgets().get(0).unwrap().spent, euros(600));
    // Beyond it (soft): strictest tier, flagged, still booked.
    let second = w.org.propose_payment(
        &bo,
        &w.token,
        &shop,
        &euros(600),
        &memo,
        &Some(events.clone()),
        &false,
    );
    let request = w.org.request(&second);
    assert_eq!(request.evaluation.tier, Some(2));
    assert!(request.evaluation.over_budget);
    assert_eq!(w.org.budgets().get(0).unwrap().spent, euros(1_200));
    // Declining gives the amount back.
    w.org.decline(&bo, &second);
    assert_eq!(w.org.budgets().get(0).unwrap().spent, euros(600));
    // A hard budget refuses what doesn't fit.
    w.org.propose_payment(
        &bo,
        &w.token,
        &shop,
        &euros(300),
        &memo,
        &Some(gear.clone()),
        &false,
    );
    assert_eq!(
        w.org.try_propose_payment(
            &bo,
            &w.token,
            &shop,
            &euros(300),
            &memo,
            &Some(gear.clone()),
            &false
        ),
        Err(Ok(Error::BudgetExceeded))
    );
    // A new period starts empty.
    w.e.ledger()
        .set_timestamp(w.e.ledger().timestamp() + 30 * 86_400);
    assert!(w
        .org
        .try_propose_payment(
            &bo,
            &w.token,
            &shop,
            &euros(300),
            &memo,
            &Some(gear),
            &false
        )
        .is_ok());
    // Payments without a category are untouched.
    let plain = w
        .org
        .propose_payment(&bo, &w.token, &shop, &euros(50), &memo, &None, &false);
    assert!(!w.org.request(&plain).evaluation.over_budget);
    // Rules with a bad budget are refused.
    let mut broken = w.org.policy();
    broken.budgets = Vec::from_array(
        &w.e,
        [Budget {
            category: symbol_short!("zero"),
            amount: 0,
            period_seconds: 86_400,
            hard: false,
        }],
    );
    assert_eq!(
        w.org.try_propose_change(
            &bo,
            &Change::UpdatePolicy(broken, BytesN::from_array(&w.e, &[4u8; 32]))
        ),
        Err(Ok(Error::InvalidPolicy))
    );
}

#[test]
fn escrowed_payments_go_out_only_when_both_sides_confirm() {
    let w = club(5_000);
    let bo = board_member(&w);
    let shop = Address::generate(&w.e);
    let memo = String::from_str(&w.e, "Deposit for the new boat");
    let id = w
        .org
        .propose_payment(&bo, &w.token, &shop, &euros(100), &memo, &None, &true);
    assert_eq!(w.org.request(&id).status, Status::Escrowed);
    assert_eq!(w.token_client.balance(&shop), 0);
    assert_eq!(w.org.available(&w.token), euros(4_900));
    let stranger = Address::generate(&w.e);
    assert_eq!(
        w.org.try_confirm_escrow(&stranger, &id),
        Err(Ok(Error::NotEscrowParty))
    );
    w.org.confirm_escrow(&shop, &id);
    assert!(w.org.escrow(&id).recipient_ok);
    assert_eq!(w.org.request(&id).status, Status::Escrowed);
    w.org.confirm_escrow(&bo, &id);
    assert_eq!(w.org.request(&id).status, Status::Executed);
    assert_eq!(w.token_client.balance(&shop), euros(100));
    assert_eq!(w.org.available(&w.token), euros(4_900));
    // Cancelling is the sender's call, not the recipient's; the money comes back.
    let second = w
        .org
        .propose_payment(&bo, &w.token, &shop, &euros(50), &memo, &None, &true);
    assert_eq!(
        w.org.try_cancel_escrow(&shop, &second),
        Err(Ok(Error::NotEscrowParty))
    );
    w.org.cancel_escrow(&bo, &second);
    assert_eq!(w.org.request(&second).status, Status::Declined);
    assert_eq!(w.org.available(&w.token), euros(4_900));
    assert_eq!(
        w.org.try_confirm_escrow(&bo, &second),
        Err(Ok(Error::NotEscrowed))
    );
}

#[test]
fn confirming_an_escrow_requires_the_confirming_partys_authorization() {
    let w = club(5_000);
    let bo = board_member(&w);
    let shop = Address::generate(&w.e);
    let id = w.org.propose_payment(
        &bo,
        &w.token,
        &shop,
        &euros(100),
        &String::from_str(&w.e, ""),
        &None,
        &true,
    );
    // Only `bo` is authorized from here on: confirming as the recipient must fail.
    w.e.mock_auths(&[MockAuth {
        address: &bo,
        invoke: &MockAuthInvoke {
            contract: &w.org.address,
            fn_name: "confirm_escrow",
            args: (&shop, id).into_val(&w.e),
            sub_invokes: &[],
        },
    }]);
    assert!(w.org.try_confirm_escrow(&shop, &id).is_err());
    assert!(!w.org.escrow(&id).recipient_ok);
}

#[test]
fn standing_orders_repeat_a_payment_under_the_rules_and_skip_missed_runs() {
    let w = club(5_000);
    let coach = Address::generate(&w.e);
    w.e.ledger().set_timestamp(1_000);
    // Monthly, first due at once; the founder's small payment needs no approval.
    let id = w.org.set_standing_order(
        &w.founder,
        &w.token,
        &coach,
        &euros(150),
        &String::from_str(&w.e, "Coaching"),
        &None,
        &(30 * 86_400),
        &0,
    );
    let order = w.org.standing_orders().get(0).unwrap();
    assert_eq!(order.id, id);
    assert_eq!(order.next_at, 1_000);
    assert!(order.active);

    let request_id = w.org.run_standing_order(&id);
    assert_eq!(w.org.request(&request_id).status, Status::Executed);
    assert_eq!(w.token_client.balance(&coach), euros(150));
    let order = w.org.standing_orders().get(0).unwrap();
    assert_eq!(order.runs, 1);
    assert_eq!(order.last_request, Some(request_id));
    assert_eq!(order.next_at, 1_000 + 30 * 86_400);
    // Not due again until the next month.
    assert_eq!(
        w.org.try_run_standing_order(&id),
        Err(Ok(Error::OrderNotDue))
    );

    // Three months pass unattended: one run, and the next due time lands in the future.
    w.e.ledger().set_timestamp(1_000 + 95 * 86_400);
    w.org.run_standing_order(&id);
    let order = w.org.standing_orders().get(0).unwrap();
    assert_eq!(order.runs, 2);
    assert_eq!(order.next_at, 1_000 + 120 * 86_400);
    assert_eq!(w.token_client.balance(&coach), euros(300));
}

#[test]
fn standing_orders_are_validated_and_stop_only_for_their_owner_or_the_top_role() {
    let w = club(5_000);
    let bo = board_member(&w);
    let max = Address::generate(&w.e);
    w.org.change_directly(
        &w.founder,
        &Change::AddMember(max.clone(), symbol_short!("member")),
    );
    let landlord = Address::generate(&w.e);
    let memo = String::from_str(&w.e, "Rent");
    assert_eq!(
        w.org.try_set_standing_order(
            &Address::generate(&w.e),
            &w.token,
            &landlord,
            &euros(10),
            &memo,
            &None,
            &86_400,
            &0
        ),
        Err(Ok(Error::NotMember))
    );
    assert_eq!(
        w.org
            .try_set_standing_order(&max, &w.token, &landlord, &0, &memo, &None, &86_400, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        w.org.try_set_standing_order(
            &max,
            &w.token,
            &landlord,
            &euros(10),
            &memo,
            &None,
            &600,
            &0
        ),
        Err(Ok(Error::InvalidInterval))
    );
    assert_eq!(
        w.org.try_set_standing_order(
            &max,
            &w.token,
            &landlord,
            &euros(10),
            &memo,
            &Some(symbol_short!("travel")),
            &86_400,
            &0
        ),
        Err(Ok(Error::UnknownBudget))
    );
    let id = w.org.set_standing_order(
        &max,
        &w.token,
        &landlord,
        &euros(10),
        &memo,
        &None,
        &86_400,
        &0,
    );
    // A board member isn't the owner and not the top role; the treasurer (top role) is.
    assert_eq!(
        w.org.try_cancel_standing_order(&bo, &id),
        Err(Ok(Error::NotOrderOwner))
    );
    assert_eq!(
        w.org
            .try_cancel_standing_order(&Address::generate(&w.e), &id),
        Err(Ok(Error::NotMember))
    );
    w.org.cancel_standing_order(&w.founder, &id);
    assert!(!w.org.standing_orders().get(0).unwrap().active);
    assert_eq!(
        w.org.try_run_standing_order(&id),
        Err(Ok(Error::OrderStopped))
    );
    assert_eq!(
        w.org.try_cancel_standing_order(&max, &id),
        Err(Ok(Error::OrderStopped))
    );
    assert_eq!(
        w.org.try_run_standing_order(&99),
        Err(Ok(Error::UnknownOrder))
    );
}

#[test]
fn a_standing_orders_run_waits_for_approvals_like_any_payment() {
    let w = club(50_000);
    let bo = board_member(&w);
    let builder = Address::generate(&w.e);
    // Beyond the first tier: the run creates a pending request instead of paying.
    let id = w.org.set_standing_order(
        &bo,
        &w.token,
        &builder,
        &euros(2_000),
        &String::from_str(&w.e, "Boathouse works"),
        &None,
        &(7 * 86_400),
        &0,
    );
    let request_id = w.org.run_standing_order(&id);
    assert_eq!(w.org.request(&request_id).status, Status::Pending);
    assert_eq!(w.token_client.balance(&builder), 0);
    assert_eq!(w.org.available(&w.token), euros(48_000));
}

#[test]
fn setting_a_standing_order_requires_the_members_authorization() {
    let w = club(5_000);
    let landlord = Address::generate(&w.e);
    let memo = String::from_str(&w.e, "Rent");
    // Only a stranger is authorized: the founder's signature is missing.
    let stranger = Address::generate(&w.e);
    w.e.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &w.org.address,
            fn_name: "set_standing_order",
            args: (
                &w.founder,
                &w.token,
                &landlord,
                euros(10),
                &memo,
                None::<Symbol>,
                86_400u64,
                0u64,
            )
                .into_val(&w.e),
            sub_invokes: &[],
        },
    }]);
    assert!(w
        .org
        .try_set_standing_order(
            &w.founder,
            &w.token,
            &landlord,
            &euros(10),
            &memo,
            &None,
            &86_400,
            &0
        )
        .is_err());
    assert_eq!(w.org.standing_orders().len(), 0);
}

fn roles(e: &Env, names: &[&str]) -> Vec<Symbol> {
    let mut list = Vec::new(e);
    for name in names {
        list.push_back(Symbol::new(e, name));
    }
    list
}

#[test]
fn an_organization_adds_reorders_and_drops_its_own_roles() {
    let w = club(5_000);
    let hash = BytesN::from_array(&w.e, &[7u8; 32]);
    // A new role below the board, then a member in it.
    w.org.change_directly(
        &w.founder,
        &Change::SetRoles(
            roles(&w.e, &["treasurer", "board", "coach", "member"]),
            hash.clone(),
        ),
    );
    assert_eq!(
        w.org.info().roles,
        roles(&w.e, &["treasurer", "board", "coach", "member"])
    );
    assert_eq!(w.org.policy_hash(), hash);
    let coach = Address::generate(&w.e);
    w.org.change_directly(
        &w.founder,
        &Change::AddMember(coach.clone(), Symbol::new(&w.e, "coach")),
    );
    assert!(w
        .org
        .members()
        .iter()
        .any(|m| m.address == coach && m.role == Symbol::new(&w.e, "coach")));
    // "member" has nobody: it may go. "coach" has someone: it may not.
    w.org.change_directly(
        &w.founder,
        &Change::SetRoles(roles(&w.e, &["treasurer", "board", "coach"]), hash.clone()),
    );
    assert_eq!(
        w.org.try_change_directly(
            &w.founder,
            &Change::SetRoles(roles(&w.e, &["treasurer", "board"]), hash.clone())
        ),
        Err(Ok(Error::RoleInUse))
    );
}

#[test]
fn role_lists_are_validated_against_members_and_rules() {
    let w = club(5_000);
    let hash = BytesN::from_array(&w.e, &[7u8; 32]);
    let set = |names: &[&str]| Change::SetRoles(roles(&w.e, names), hash.clone());
    assert_eq!(
        w.org.try_change_directly(&w.founder, &set(&[])),
        Err(Ok(Error::InvalidRoles))
    );
    assert_eq!(
        w.org
            .try_change_directly(&w.founder, &set(&["treasurer", "board", "board", "member"])),
        Err(Ok(Error::InvalidRoles))
    );
    assert_eq!(
        w.org.try_change_directly(
            &w.founder,
            &set(&["treasurer", "board", "a", "b", "c", "d", "e", "f", "g"])
        ),
        Err(Ok(Error::InvalidRoles))
    );
    // The founder holds "treasurer".
    assert_eq!(
        w.org
            .try_change_directly(&w.founder, &set(&["board", "member"])),
        Err(Ok(Error::RoleInUse))
    );
    // The club's rules ask for board approvals, so "board" can't go even while it's empty.
    assert_eq!(
        w.org
            .try_change_directly(&w.founder, &set(&["treasurer", "member"])),
        Err(Ok(Error::UnknownRole))
    );
}

#[test]
fn after_the_setup_phase_a_role_change_needs_the_strictest_tier() {
    let w = club(5_000);
    let bo = board_member(&w);
    let ana = board_member(&w);
    assert!(!w.org.is_setup_phase());
    let hash = BytesN::from_array(&w.e, &[7u8; 32]);
    let change = Change::SetRoles(
        roles(&w.e, &["treasurer", "board", "coach", "member"]),
        hash,
    );
    assert_eq!(
        w.org.try_change_directly(&w.founder, &change),
        Err(Ok(Error::NotInSetupPhase))
    );
    let id = w.org.propose_change(&w.founder, &change);
    assert_eq!(w.org.request(&id).status, Status::Pending);
    w.org.approve(&bo, &id);
    w.org.approve(&ana, &id);
    // The strictest tier has an objection window; once it passes the change applies.
    w.e.ledger()
        .set_timestamp(w.e.ledger().timestamp() + 48 * 3_600);
    w.org.execute(&id);
    assert_eq!(w.org.request(&id).status, Status::Executed);
    assert_eq!(w.org.info().roles.len(), 4);
}

#[test]
fn changing_roles_requires_the_founders_authorization() {
    let w = club(5_000);
    let hash = BytesN::from_array(&w.e, &[7u8; 32]);
    let change = Change::SetRoles(
        roles(&w.e, &["treasurer", "board", "coach", "member"]),
        hash,
    );
    let stranger = Address::generate(&w.e);
    w.e.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &w.org.address,
            fn_name: "change_directly",
            args: (&w.founder, change.clone()).into_val(&w.e),
            sub_invokes: &[],
        },
    }]);
    assert!(w.org.try_change_directly(&w.founder, &change).is_err());
    assert_eq!(w.org.info().roles.len(), 3);
}

#[test]
fn the_contract_reports_its_interface_version() {
    let w = club(1_000);
    assert_eq!(w.org.version(), 4);
}

#[test]
fn members_share_an_address_book() {
    let w = club(1_000);
    let bo = board_member(&w);
    let shop = Address::generate(&w.e);
    let name = String::from_str(&w.e, "Lisbon Boat Supplies");
    let note = String::from_str(&w.e, "Oars and repairs");
    w.e.ledger().set_timestamp(5_000);
    w.org.set_payee(&w.founder, &shop, &name, &note);
    let book = w.org.payees();
    assert_eq!(book.len(), 1);
    let entry = book.get(0).unwrap();
    assert_eq!(entry.name, name);
    assert_eq!(entry.saved_by, w.founder);
    assert_eq!(entry.saved_at, 5_000);
    // Another member renames it: still one entry, now theirs.
    let renamed = String::from_str(&w.e, "Boat Supplies Lisboa");
    w.org.set_payee(&bo, &shop, &renamed, &note);
    assert_eq!(w.org.payees().len(), 1);
    assert_eq!(w.org.payees().get(0).unwrap().saved_by, bo);
    w.org.remove_payee(&bo, &shop);
    assert_eq!(w.org.payees().len(), 0);
    assert_eq!(w.org.try_remove_payee(&bo, &shop), Err(Ok(Error::NotFound)));
}

#[test]
fn the_address_book_checks_members_and_text() {
    let w = club(1_000);
    let shop = Address::generate(&w.e);
    let empty = String::from_str(&w.e, "");
    let name = String::from_str(&w.e, "Shop");
    assert_eq!(
        w.org
            .try_set_payee(&Address::generate(&w.e), &shop, &name, &empty),
        Err(Ok(Error::NotMember))
    );
    assert_eq!(
        w.org.try_set_payee(&w.founder, &shop, &empty, &empty),
        Err(Ok(Error::EmptyName))
    );
    let long = String::from_str(&w.e, &"x".repeat(65));
    assert_eq!(
        w.org.try_set_payee(&w.founder, &shop, &long, &empty),
        Err(Ok(Error::TextTooLong))
    );
}

#[test]
fn saving_a_recipient_requires_the_members_authorization() {
    let w = club(1_000);
    let shop = Address::generate(&w.e);
    let name = String::from_str(&w.e, "Shop");
    let note = String::from_str(&w.e, "");
    let stranger = Address::generate(&w.e);
    w.e.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &w.org.address,
            fn_name: "set_payee",
            args: (&w.founder, &shop, &name, &note).into_val(&w.e),
            sub_invokes: &[],
        },
    }]);
    assert!(w
        .org
        .try_set_payee(&w.founder, &shop, &name, &note)
        .is_err());
    assert_eq!(w.org.payees().len(), 0);
}
