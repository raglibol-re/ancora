use soroban_sdk::testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, IntoVal, Vec};

use crate::{Error, Recovery, RecoveryClient};

/// Enough of the registry for the recovery contract: which organizations exist.
#[contract]
pub struct MockRegistry;

#[contractimpl]
impl MockRegistry {
    pub fn register(e: Env, org: Address) {
        e.storage().persistent().set(&org, &true);
    }

    pub fn is_registered(e: Env, org: Address) -> bool {
        e.storage().persistent().has(&org)
    }
}

#[contracttype]
#[derive(Clone)]
pub enum OrgKey {
    Handover,
}

/// An organization that records the handover it was asked for.
#[contract]
pub struct MockOrg;

#[contractimpl]
impl MockOrg {
    pub fn recover_member(e: Env, old: Address, new: Address) {
        e.storage().instance().set(&OrgKey::Handover, &(old, new));
    }

    pub fn handover(e: Env) -> Option<(Address, Address)> {
        e.storage().instance().get(&OrgKey::Handover)
    }
}

struct World {
    e: Env,
    recovery: RecoveryClient<'static>,
    org: Address,
    org_client: MockOrgClient<'static>,
    person: Address,
    guardians: [Address; 3],
    successor: Address,
}

fn world() -> World {
    let e = Env::default();
    e.mock_all_auths();
    let registry_id = e.register(MockRegistry, ());
    let registry = MockRegistryClient::new(&e, &registry_id);
    let recovery_id = e.register(Recovery, (&registry_id,));
    let org = e.register(MockOrg, ());
    registry.register(&org);
    World {
        recovery: RecoveryClient::new(&e, &recovery_id),
        org_client: MockOrgClient::new(&e, &org),
        org,
        person: Address::generate(&e),
        guardians: [
            Address::generate(&e),
            Address::generate(&e),
            Address::generate(&e),
        ],
        successor: Address::generate(&e),
        e,
    }
}

fn guardians(w: &World) -> Vec<Address> {
    Vec::from_array(&w.e, w.guardians.clone())
}

fn two_of_three(w: &World) {
    w.recovery.set_plan(&w.person, &guardians(w), &2, &600);
}

fn advance(w: &World, seconds: u64) {
    let now = w.e.ledger().timestamp();
    w.e.ledger().set_timestamp(now + seconds);
}

#[test]
fn plans_need_distinct_guardians_a_threshold_and_a_waiting_period() {
    let w = world();
    let g = guardians(&w);
    assert_eq!(
        w.recovery.try_set_plan(&w.person, &g, &0, &600),
        Err(Ok(Error::BadPlan))
    );
    assert_eq!(
        w.recovery.try_set_plan(&w.person, &g, &4, &600),
        Err(Ok(Error::BadPlan))
    );
    assert_eq!(
        w.recovery.try_set_plan(&w.person, &g, &2, &30),
        Err(Ok(Error::BadPlan))
    );
    let with_self = Vec::from_array(&w.e, [w.person.clone(), w.guardians[0].clone()]);
    assert_eq!(
        w.recovery.try_set_plan(&w.person, &with_self, &1, &600),
        Err(Ok(Error::BadPlan))
    );
    let twice = Vec::from_array(&w.e, [w.guardians[0].clone(), w.guardians[0].clone()]);
    assert_eq!(
        w.recovery.try_set_plan(&w.person, &twice, &1, &600),
        Err(Ok(Error::BadPlan))
    );
    assert_eq!(w.recovery.plan(&w.person), None);

    two_of_three(&w);
    let plan = w.recovery.plan(&w.person).unwrap();
    assert_eq!(plan.threshold, 2);
    assert_eq!(plan.wait_seconds, 600);
    for guardian in w.guardians.iter() {
        assert!(w.recovery.protects(guardian).contains(&w.person));
    }

    // Replacing the plan moves the guardian index along.
    let only_first = Vec::from_array(&w.e, [w.guardians[0].clone()]);
    w.recovery.set_plan(&w.person, &only_first, &1, &600);
    assert!(w.recovery.protects(&w.guardians[0]).contains(&w.person));
    assert!(w.recovery.protects(&w.guardians[1]).is_empty());

    w.recovery.clear_plan(&w.person);
    assert_eq!(w.recovery.plan(&w.person), None);
    assert!(w.recovery.protects(&w.guardians[0]).is_empty());
    assert_eq!(w.recovery.try_clear_plan(&w.person), Err(Ok(Error::NoPlan)));
}

#[test]
fn guardians_confirm_a_new_pass_and_the_positions_move_after_the_wait() {
    let w = world();
    two_of_three(&w);
    let orgs = Vec::from_array(&w.e, [w.org.clone()]);

    w.recovery
        .start_claim(&w.person, &w.guardians[0], &w.successor);
    let claim = w.recovery.claim(&w.person).unwrap();
    assert_eq!(claim.successor, w.successor);
    assert_eq!(claim.approvals.len(), 1);
    assert_eq!(claim.ready_at, claim.started_at + 600);

    // One confirmation of two: not ready, whatever the clock says.
    advance(&w, 600);
    assert_eq!(
        w.recovery.try_finish_claim(&w.person, &orgs),
        Err(Ok(Error::NotReady))
    );
    w.recovery.approve_claim(&w.person, &w.guardians[1]);
    assert_eq!(
        w.recovery.try_approve_claim(&w.person, &w.guardians[1]),
        Err(Ok(Error::AlreadyApproved))
    );
    assert_eq!(w.recovery.finish_claim(&w.person, &orgs), w.successor);
    assert_eq!(
        w.org_client.handover(),
        Some((w.person.clone(), w.successor.clone()))
    );
    assert_eq!(w.recovery.claim(&w.person), None);
    assert_eq!(
        w.recovery.recovered_to(&w.person),
        Some(w.successor.clone())
    );
    // Organizations missed the first time can still be handed over.
    assert_eq!(w.recovery.finish_claim(&w.person, &orgs), w.successor);
}

#[test]
fn the_waiting_period_must_pass_even_with_every_confirmation() {
    let w = world();
    two_of_three(&w);
    let orgs = Vec::from_array(&w.e, [w.org.clone()]);
    w.recovery
        .start_claim(&w.person, &w.guardians[0], &w.successor);
    w.recovery.approve_claim(&w.person, &w.guardians[1]);
    w.recovery.approve_claim(&w.person, &w.guardians[2]);
    advance(&w, 599);
    assert_eq!(
        w.recovery.try_finish_claim(&w.person, &orgs),
        Err(Ok(Error::NotReady))
    );
    advance(&w, 1);
    assert_eq!(w.recovery.finish_claim(&w.person, &orgs), w.successor);
}

#[test]
fn the_old_pass_cancels_an_open_claim() {
    let w = world();
    two_of_three(&w);
    assert_eq!(
        w.recovery.try_cancel_claim(&w.person),
        Err(Ok(Error::NoClaim))
    );
    w.recovery
        .start_claim(&w.person, &w.guardians[0], &w.successor);
    w.recovery.cancel_claim(&w.person);
    assert_eq!(w.recovery.claim(&w.person), None);
    assert_eq!(
        w.recovery.try_approve_claim(&w.person, &w.guardians[1]),
        Err(Ok(Error::NoClaim))
    );
    assert_eq!(w.org_client.handover(), None);
}

#[test]
fn claims_are_guarded_against_strangers_repeats_and_self_recovery() {
    let w = world();
    let stranger = Address::generate(&w.e);
    assert_eq!(
        w.recovery
            .try_start_claim(&w.person, &w.guardians[0], &w.successor),
        Err(Ok(Error::NoPlan))
    );
    two_of_three(&w);
    assert_eq!(
        w.recovery
            .try_start_claim(&w.person, &stranger, &w.successor),
        Err(Ok(Error::NotGuardian))
    );
    assert_eq!(
        w.recovery
            .try_start_claim(&w.person, &w.guardians[0], &w.person),
        Err(Ok(Error::SameAccount))
    );
    w.recovery
        .start_claim(&w.person, &w.guardians[0], &w.successor);
    assert_eq!(
        w.recovery
            .try_start_claim(&w.person, &w.guardians[1], &w.successor),
        Err(Ok(Error::ClaimOpen))
    );
    let unregistered = Vec::from_array(&w.e, [Address::generate(&w.e)]);
    assert_eq!(
        w.recovery.try_finish_claim(&w.person, &unregistered),
        Err(Ok(Error::NotRegistered))
    );
}

#[test]
fn confirming_requires_the_guardians_own_authorization() {
    let w = world();
    two_of_three(&w);
    w.recovery
        .start_claim(&w.person, &w.guardians[0], &w.successor);
    let stranger = Address::generate(&w.e);
    // Only the stranger is authorized from here on; confirming as a guardian must fail.
    w.e.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &w.recovery.address,
            fn_name: "approve_claim",
            args: (&w.person, &w.guardians[1]).into_val(&w.e),
            sub_invokes: &[],
        },
    }]);
    assert!(w
        .recovery
        .try_approve_claim(&w.person, &w.guardians[1])
        .is_err());
    assert_eq!(w.recovery.claim(&w.person).unwrap().approvals.len(), 1);
}
