extern crate std;

use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    Address, BytesN, Env, IntoVal,
};

use crate::{PotAuditors, PotAuditorsClient};

/// Grumpkin generator `(1, sqrt(-16))`, on the curve.
const G: [u8; 64] = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xcf, 0x13, 0x5e, 0x75, 0x06, 0xa4, 0x5d, 0x63,
    0x2d, 0x27, 0x0d, 0x45, 0xf1, 0x18, 0x12, 0x94, 0x83, 0x3f, 0xc4, 0x8d, 0x82, 0x3f, 0x27, 0x2c,
];

fn setup(e: &Env) -> PotAuditorsClient<'_> {
    PotAuditorsClient::new(e, &e.register(PotAuditors, ()))
}

#[test]
fn numbers_keys_in_order_and_remembers_owners() {
    let e = Env::default();
    e.mock_all_auths();
    let client = setup(&e);
    let (org_a, org_b) = (Address::generate(&e), Address::generate(&e));
    let key = BytesN::from_array(&e, &G);
    assert_eq!(client.next_id(), 0);
    client.register_key(&0, &key, &org_a);
    client.register_key(&1, &key, &org_b);
    assert_eq!(client.next_id(), 2);
    assert_eq!(client.owner(&1), Some(org_b));
    assert_eq!(client.get_key(&0), key);
    assert!(client.try_register_key(&5, &key, &org_a).is_err());
    assert!(client.try_register_key(&0, &key, &org_a).is_err());
}

#[test]
fn only_the_owner_rotates() {
    let e = Env::default();
    e.mock_all_auths();
    let client = setup(&e);
    let (owner, other) = (Address::generate(&e), Address::generate(&e));
    let key = BytesN::from_array(&e, &G);
    client.register_key(&0, &key, &owner);
    assert!(client.try_rotate_key(&0, &key, &other).is_err());
    client.rotate_key(&0, &key, &owner);
}

#[test]
fn refuses_points_off_the_curve() {
    let e = Env::default();
    e.mock_all_auths();
    let client = setup(&e);
    let bad = BytesN::from_array(&e, &[1u8; 64]);
    assert!(client
        .try_register_key(&0, &bad, &Address::generate(&e))
        .is_err());
    assert_eq!(client.next_id(), 0);
}

#[test]
fn registering_needs_the_operators_own_auth() {
    let e = Env::default();
    let client = setup(&e);
    let (owner, intruder) = (Address::generate(&e), Address::generate(&e));
    let key = BytesN::from_array(&e, &G);
    // Without any authorization the call fails.
    assert!(client.try_register_key(&0, &key, &owner).is_err());
    // Authorized by someone else, it still fails for `owner`.
    let args = (0u32, key.clone(), owner.clone()).into_val(&e);
    let invoke = MockAuthInvoke {
        contract: &client.address,
        fn_name: "register_key",
        args,
        sub_invokes: &[],
    };
    assert!(client
        .mock_auths(&[MockAuth {
            address: &intruder,
            invoke: &invoke
        }])
        .try_register_key(&0, &key, &owner)
        .is_err());
    // Authorized by the owner, it works.
    assert!(client
        .mock_auths(&[MockAuth {
            address: &owner,
            invoke: &invoke
        }])
        .try_register_key(&0, &key, &owner)
        .is_ok());
}
