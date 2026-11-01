//! Upgrades to the latest `ancora-organization` release on the Stellar Registry.

use soroban_sdk::testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke};
use soroban_sdk::{Address, Bytes, BytesN, Env, IntoVal};

use crate::test::{board_member, club};
use crate::types::{Change, Error, Status};

/// Stands in for the Stellar Registry's `fetch_hash` (stellar-registry/contracts): the latest
/// published hash under one name, nothing until something is published.
pub(crate) mod mock_releases {
    use soroban_sdk::{contract, contractimpl, symbol_short, BytesN, Env, String};

    #[contract]
    pub struct MockReleases;

    #[contractimpl]
    impl MockReleases {
        pub fn publish(e: Env, wasm_hash: BytesN<32>) {
            e.storage()
                .instance()
                .set(&symbol_short!("latest"), &wasm_hash);
        }

        pub fn fetch_hash(e: Env, wasm_name: String, version: Option<String>) -> BytesN<32> {
            assert_eq!(wasm_name, String::from_str(&e, "ancora-organization"));
            assert!(version.is_none(), "organizations only ask for the latest");
            e.storage()
                .instance()
                .get(&symbol_short!("latest"))
                .expect("nothing published")
        }
    }
}

/// The smallest module the host accepts as contract code: a Wasm header and the
/// `contractenvmetav0` section naming the ledger's protocol. It exports nothing, so after an
/// upgrade to it every call fails, which shows the code really changed.
fn empty_contract(e: &Env) -> BytesN<32> {
    let protocol = e.ledger().get().protocol_version.to_be_bytes();
    let name = b"contractenvmetav0";
    let mut meta = [0u8; 12];
    meta[4..8].copy_from_slice(&protocol);
    let payload_len = 1 + name.len() + meta.len();
    let mut wasm = Bytes::from_slice(e, b"\0asm\x01\0\0\0");
    wasm.extend_from_array(&[0, payload_len as u8, name.len() as u8]);
    wasm.extend_from_slice(name);
    wasm.extend_from_array(&meta);
    e.deployer().upload_contract_wasm(wasm)
}

#[test]
fn upgrades_to_the_latest_release_and_runs_its_code() {
    let w = club(100);
    let release = empty_contract(&w.e);
    w.releases.publish(&release);
    assert_eq!(w.org.version(), 7);
    w.org
        .change_directly(&w.founder, &Change::Upgrade(release.clone()));
    assert!(w.org.try_version().is_err());
}

#[test]
fn refuses_code_that_is_not_the_latest_release() {
    let w = club(100);
    w.releases.publish(&empty_contract(&w.e));
    let other = BytesN::from_array(&w.e, &[7u8; 32]);
    assert_eq!(
        w.org
            .try_change_directly(&w.founder, &Change::Upgrade(other)),
        Err(Ok(Error::NotLatestRelease))
    );
    assert_eq!(w.org.version(), 7);
}

#[test]
fn refuses_upgrades_while_nothing_is_published() {
    let w = club(100);
    let hash = BytesN::from_array(&w.e, &[7u8; 32]);
    assert_eq!(
        w.org
            .try_change_directly(&w.founder, &Change::Upgrade(hash)),
        Err(Ok(Error::ReleaseUnavailable))
    );
}

#[test]
fn after_setup_an_upgrade_waits_for_approvals_and_fails_if_a_newer_release_appears() {
    let w = club(100);
    let bo = board_member(&w);
    let bea = board_member(&w);
    let first = empty_contract(&w.e);
    w.releases.publish(&first);
    let id = w.org.propose_change(&bo, &Change::Upgrade(first));
    assert_eq!(w.org.request(&id).status, Status::Pending);
    w.org.approve(&w.founder, &id);
    w.org.approve(&bea, &id);
    // A newer release lands while the objection window runs: the approved hash is no longer
    // the latest, so the change fails instead of running code nobody approved.
    w.releases.publish(&BytesN::from_array(&w.e, &[9u8; 32]));
    w.e.ledger()
        .set_timestamp(w.e.ledger().timestamp() + 48 * 3_600);
    w.org.execute(&id);
    let failed = w.org.request(&id);
    assert_eq!(failed.status, Status::Failed);
    assert_eq!(failed.failure, Some(Error::NotLatestRelease as u32));
    assert_eq!(w.org.version(), 7);
}

#[test]
fn an_upgrade_needs_the_founders_own_authorization_in_the_setup_phase() {
    let w = club(100);
    let release = empty_contract(&w.e);
    w.releases.publish(&release);
    let change = Change::Upgrade(release);
    let stranger = Address::generate(&w.e);
    w.e.set_auths(&[]);
    assert!(w
        .org
        .mock_auths(&[MockAuth {
            address: &stranger,
            invoke: &MockAuthInvoke {
                contract: &w.org.address,
                fn_name: "change_directly",
                args: (&w.founder, &change).into_val(&w.e),
                sub_invokes: &[],
            },
        }])
        .try_change_directly(&w.founder, &change)
        .is_err());
    assert_eq!(w.org.version(), 7);
}
