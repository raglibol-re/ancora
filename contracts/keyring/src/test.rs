use soroban_sdk::testutils::{Address as _, MockAuth, MockAuthInvoke};
use soroban_sdk::{Address, Bytes, BytesN, Env, IntoVal, Vec};

use crate::{Error, Keyring, KeyringClient};

/// Stands in for an organization contract: just its member list.
mod mock_org {
    use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Vec};

    use crate::Member;

    #[contract]
    pub struct MockOrg;

    #[contractimpl]
    impl MockOrg {
        pub fn set_members(e: Env, members: Vec<Address>) {
            e.storage().instance().set(&symbol_short!("m"), &members);
        }

        pub fn members(e: Env) -> Vec<Member> {
            let addresses: Vec<Address> = e
                .storage()
                .instance()
                .get(&symbol_short!("m"))
                .unwrap_or_else(|| Vec::new(&e));
            let mut members = Vec::new(&e);
            for address in addresses.iter() {
                members.push_back(Member {
                    address,
                    role: symbol_short!("board"),
                });
            }
            members
        }
    }
}

struct World {
    e: Env,
    keyring: KeyringClient<'static>,
    org: Address,
    ana: Address,
    bo: Address,
}

fn world() -> World {
    let e = Env::default();
    e.mock_all_auths();
    let ana = Address::generate(&e);
    let bo = Address::generate(&e);
    let org = e.register(mock_org::MockOrg, ());
    mock_org::MockOrgClient::new(&e, &org)
        .set_members(&Vec::from_array(&e, [ana.clone(), bo.clone()]));
    let keyring = KeyringClient::new(&e, &e.register(Keyring, ()));
    // Bo has set up a device: his public key is published.
    keyring.set_key(&bo, &BytesN::from_array(&e, &[4u8; 32]));
    World {
        e,
        keyring,
        org,
        ana,
        bo,
    }
}

fn wrapped(e: &Env, fill: u8) -> Bytes {
    Bytes::from_slice(e, &[fill; 92])
}

#[test]
fn members_open_epochs_and_share_the_key_with_each_other() {
    let w = world();
    w.keyring
        .set_key(&w.bo, &BytesN::from_array(&w.e, &[4u8; 32]));
    assert_eq!(
        w.keyring.key(&w.bo),
        Some(BytesN::from_array(&w.e, &[4u8; 32]))
    );
    assert_eq!(w.keyring.epoch(&w.org), 0);
    assert_eq!(w.keyring.open_epoch(&w.ana, &w.org), 1);
    // Ana hasn't published a key, so nobody can share with her yet.
    assert_eq!(
        w.keyring
            .try_share(&w.bo, &w.org, &w.ana, &1, &wrapped(&w.e, 1)),
        Err(Ok(Error::NoKey))
    );
    w.keyring
        .share(&w.ana, &w.org, &w.bo, &1, &wrapped(&w.e, 1));
    let stored = w.keyring.wrapped(&w.org, &w.bo, &1);
    assert_eq!(stored.clone().map(|s| s.by), Some(w.ana.clone()));
    // The wrap records the key it was made for, so a new device's key shows it is stale.
    assert_eq!(
        stored.map(|s| s.for_key),
        Some(BytesN::from_array(&w.e, &[4u8; 32]))
    );
    // A new epoch (after someone left) needs a fresh share; the old one stays readable.
    assert_eq!(w.keyring.open_epoch(&w.bo, &w.org), 2);
    assert!(w.keyring.wrapped(&w.org, &w.bo, &2).is_none());
    assert!(w.keyring.wrapped(&w.org, &w.bo, &1).is_some());
}

#[test]
fn outsiders_neither_open_nor_receive_and_epochs_must_exist() {
    let w = world();
    let stranger = Address::generate(&w.e);
    assert_eq!(
        w.keyring.try_open_epoch(&stranger, &w.org),
        Err(Ok(Error::NotMember))
    );
    assert_eq!(
        w.keyring
            .try_share(&w.ana, &w.org, &w.bo, &1, &wrapped(&w.e, 1)),
        Err(Ok(Error::UnknownEpoch))
    );
    w.keyring.open_epoch(&w.ana, &w.org);
    assert_eq!(
        w.keyring
            .try_share(&w.ana, &w.org, &stranger, &1, &wrapped(&w.e, 1)),
        Err(Ok(Error::NotMember))
    );
    assert_eq!(
        w.keyring.try_share(
            &w.ana,
            &w.org,
            &w.bo,
            &1,
            &Bytes::from_slice(&w.e, &[0u8; 161])
        ),
        Err(Ok(Error::TooLong))
    );
}

#[test]
fn each_step_needs_its_own_signature() {
    let w = world();
    w.keyring.open_epoch(&w.ana, &w.org);
    w.e.set_auths(&[]);
    let args = (
        w.ana.clone(),
        w.org.clone(),
        w.bo.clone(),
        1u32,
        wrapped(&w.e, 1),
    )
        .into_val(&w.e);
    let invoke = MockAuthInvoke {
        contract: &w.keyring.address,
        fn_name: "share",
        args,
        sub_invokes: &[],
    };
    // Bo can't share in Ana's name.
    assert!(w
        .keyring
        .mock_auths(&[MockAuth {
            address: &w.bo,
            invoke: &invoke,
        }])
        .try_share(&w.ana, &w.org, &w.bo, &1, &wrapped(&w.e, 1))
        .is_err());
    w.keyring
        .mock_auths(&[MockAuth {
            address: &w.ana,
            invoke: &invoke,
        }])
        .share(&w.ana, &w.org, &w.bo, &1, &wrapped(&w.e, 1));
    let key_invoke = MockAuthInvoke {
        contract: &w.keyring.address,
        fn_name: "set_key",
        args: (w.bo.clone(), BytesN::from_array(&w.e, &[1u8; 32])).into_val(&w.e),
        sub_invokes: &[],
    };
    assert!(w
        .keyring
        .mock_auths(&[MockAuth {
            address: &w.ana,
            invoke: &key_invoke,
        }])
        .try_set_key(&w.bo, &BytesN::from_array(&w.e, &[1u8; 32]))
        .is_err());
}
