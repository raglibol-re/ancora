use soroban_sdk::testutils::{Address as _, MockAuth, MockAuthInvoke};
use soroban_sdk::{Address, Env, IntoVal, String};

use crate::{Error, Profile, Registry, RegistryClient};

fn setup() -> (Env, RegistryClient<'static>, Address) {
    let e = Env::default();
    let admin = Address::generate(&e);
    let id = e.register(Registry, (&admin,));
    let client = RegistryClient::new(&e, &id);
    (e, client, admin)
}

#[test]
fn registers_an_organization_and_indexes_its_founder() {
    let (e, registry, _admin) = setup();
    e.mock_all_auths();
    let org = Address::generate(&e);
    let founder = Address::generate(&e);
    registry.register_org(&org, &founder);
    assert!(registry.is_registered(&org));
    assert_eq!(registry.orgs_of(&founder).len(), 1);
    assert_eq!(
        registry.try_register_org(&org, &founder),
        Err(Ok(Error::AlreadyRegistered))
    );
}

#[test]
fn only_the_admin_registers_organizations() {
    let (e, registry, _admin) = setup();
    let org = Address::generate(&e);
    let founder = Address::generate(&e);
    let stranger = Address::generate(&e);
    // Authorization is granted for the stranger only; the contract asks the admin, so it fails.
    e.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &registry.address,
            fn_name: "register_org",
            args: (&org, &founder).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    assert!(registry.try_register_org(&org, &founder).is_err());
}

#[test]
fn membership_index_follows_join_and_leave() {
    let (e, registry, _admin) = setup();
    e.mock_all_auths();
    let org_a = Address::generate(&e);
    let org_b = Address::generate(&e);
    let founder = Address::generate(&e);
    let person = Address::generate(&e);
    registry.register_org(&org_a, &founder);
    registry.register_org(&org_b, &founder);
    registry.set_membership(&org_a, &person, &true);
    registry.set_membership(&org_b, &person, &true);
    assert_eq!(registry.orgs_of(&person).len(), 2);
    registry.set_membership(&org_a, &person, &false);
    let orgs = registry.orgs_of(&person);
    assert_eq!(orgs.len(), 1);
    assert_eq!(orgs.get(0), Some(org_b));
}

#[test]
fn unregistered_contracts_cannot_touch_the_index() {
    let (e, registry, _admin) = setup();
    e.mock_all_auths();
    let rogue = Address::generate(&e);
    let person = Address::generate(&e);
    assert_eq!(
        registry.try_set_membership(&rogue, &person, &true),
        Err(Ok(Error::NotRegistered))
    );
}

#[test]
fn set_membership_requires_the_organizations_own_authorization() {
    let (e, registry, _admin) = setup();
    let org = Address::generate(&e);
    let founder = Address::generate(&e);
    let person = Address::generate(&e);
    e.mock_all_auths();
    registry.register_org(&org, &founder);
    // Now only `founder` is authorized; the organization isn't, so the call must fail.
    e.mock_auths(&[MockAuth {
        address: &founder,
        invoke: &MockAuthInvoke {
            contract: &registry.address,
            fn_name: "set_membership",
            args: (&org, &person, true).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    assert!(registry.try_set_membership(&org, &person, &true).is_err());
}

#[test]
fn profiles_are_set_by_their_owner_and_capped() {
    let (e, registry, _admin) = setup();
    e.mock_all_auths();
    let person = Address::generate(&e);
    assert_eq!(registry.profile(&person), None);
    let picture = String::from_str(&e, "https://example.test/ines.webp");
    registry.set_profile(&person, &String::from_str(&e, "Inês Duarte"), &picture);
    assert_eq!(
        registry.profile(&person),
        Some(Profile {
            name: String::from_str(&e, "Inês Duarte"),
            avatar: picture.clone(),
        })
    );
    let long = String::from_str(&e, &"x".repeat(65));
    assert_eq!(
        registry.try_set_profile(&person, &long, &picture),
        Err(Ok(Error::NameTooLong))
    );
    let long_url = String::from_str(&e, &"u".repeat(257));
    assert_eq!(
        registry.try_set_profile(&person, &String::from_str(&e, "Inês"), &long_url),
        Err(Ok(Error::AvatarTooLong))
    );
}
