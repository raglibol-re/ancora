//! Auditors and encrypted labels.

use soroban_sdk::testutils::{Address as _, MockAuth, MockAuthInvoke};
use soroban_sdk::{Address, Bytes, BytesN, IntoVal};

use crate::test::{world, wrapped};
use crate::Error;

#[test]
fn members_add_auditors_who_then_receive_the_key() {
    let w = world();
    let auditor = Address::generate(&w.e);
    w.keyring
        .set_key(&auditor, &BytesN::from_array(&w.e, &[9u8; 32]));
    w.keyring.open_epoch(&w.ana, &w.org);
    assert_eq!(
        w.keyring
            .try_share(&w.ana, &w.org, &auditor, &1, &wrapped(&w.e, 1)),
        Err(Ok(Error::NotMember))
    );
    w.keyring.add_auditor(&w.ana, &w.org, &auditor);
    assert_eq!(w.keyring.auditors(&w.org).len(), 1);
    w.keyring
        .share(&w.ana, &w.org, &auditor, &1, &wrapped(&w.e, 1));
    assert!(w.keyring.wrapped(&w.org, &auditor, &1).is_some());
    // An auditor reads, but doesn't run the organization's keys.
    assert_eq!(
        w.keyring.try_open_epoch(&auditor, &w.org),
        Err(Ok(Error::NotMember))
    );
    w.keyring.remove_auditor(&w.bo, &w.org, &auditor);
    assert_eq!(w.keyring.auditors(&w.org).len(), 0);
    w.keyring.open_epoch(&w.ana, &w.org);
    assert_eq!(
        w.keyring
            .try_share(&w.ana, &w.org, &auditor, &2, &wrapped(&w.e, 2)),
        Err(Ok(Error::NotMember))
    );
}

#[test]
fn only_members_add_auditors_with_their_own_signature() {
    let w = world();
    let stranger = Address::generate(&w.e);
    assert_eq!(
        w.keyring.try_add_auditor(&stranger, &w.org, &stranger),
        Err(Ok(Error::NotMember))
    );
    w.e.set_auths(&[]);
    let invoke = MockAuthInvoke {
        contract: &w.keyring.address,
        fn_name: "add_auditor",
        args: (w.ana.clone(), w.org.clone(), stranger.clone()).into_val(&w.e),
        sub_invokes: &[],
    };
    assert!(w
        .keyring
        .mock_auths(&[MockAuth {
            address: &w.bo,
            invoke: &invoke,
        }])
        .try_add_auditor(&w.ana, &w.org, &stranger)
        .is_err());
}

#[test]
fn members_keep_encrypted_labels_for_addresses() {
    let w = world();
    let shop = Address::generate(&w.e);
    let label = Bytes::from_slice(&w.e, b"enc1:1:ciphertext");
    w.keyring.set_label(&w.ana, &w.org, &shop, &label);
    assert_eq!(w.keyring.labels(&w.org).get(shop.clone()), Some(label));
    assert_eq!(
        w.keyring
            .try_set_label(&w.ana, &w.org, &shop, &Bytes::from_slice(&w.e, &[0u8; 513])),
        Err(Ok(Error::TooLong))
    );
    let stranger = Address::generate(&w.e);
    assert_eq!(
        w.keyring
            .try_set_label(&stranger, &w.org, &shop, &Bytes::new(&w.e)),
        Err(Ok(Error::NotMember))
    );
    w.keyring.set_label(&w.bo, &w.org, &shop, &Bytes::new(&w.e));
    assert_eq!(w.keyring.labels(&w.org).len(), 0);
}
