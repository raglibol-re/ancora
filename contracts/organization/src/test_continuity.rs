//! Succession per position (Lifeline inside the organization) and ML-DSA seals.

use ancora_seal_verifier::SealVerifier;
use fips204::ml_dsa_44;
use fips204::traits::{KeyGen, SerDes, Signer};
use soroban_sdk::testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke};
use soroban_sdk::{Address, Bytes, Env, IntoVal, String};

use crate::test::{board_member, club, euros, World};
use crate::types::{Change, Error, Status};

const DAY: u64 = 86_400;

fn later(w: &World, seconds: u64) {
    w.e.ledger()
        .set_timestamp(w.e.ledger().timestamp() + seconds);
}

/// A club whose founder (treasurer) names `bo` as successor: one day quiet, one hour to object.
fn club_with_successor() -> (World, Address, Address) {
    let w = club(1_000);
    let bo = board_member(&w);
    w.org.change_directly(
        &w.founder,
        &Change::SetSuccessor(w.founder.clone(), Some(bo.clone()), DAY, 3_600),
    );
    let bea = board_member(&w);
    (w, bo, bea)
}

#[test]
fn a_successor_takes_over_a_quiet_members_position_after_the_wait() {
    let (w, bo, _) = club_with_successor();
    assert_eq!(
        w.org.try_claim_succession(&bo, &w.founder),
        Err(Ok(Error::StillActive))
    );
    later(&w, DAY);
    w.org.claim_succession(&bo, &w.founder);
    assert!(w
        .org
        .successions()
        .get_unchecked(0)
        .claim_ready_at
        .is_some());
    assert_eq!(
        w.org.try_finish_succession(&w.founder),
        Err(Ok(Error::SuccessionNotReady))
    );
    later(&w, 3_600);
    w.org.finish_succession(&w.founder);
    let members = w.org.members();
    assert!(!members.iter().any(|m| m.address == w.founder));
    let bo_role = members.iter().find(|m| m.address == bo).map(|m| m.role);
    assert_eq!(bo_role, Some(soroban_sdk::Symbol::new(&w.e, "treasurer")));
    assert_eq!(w.org.info().founder, bo);
    assert_eq!(w.org.successions().len(), 0);
}

#[test]
fn any_action_of_the_member_cancels_the_claim() {
    let (w, bo, _) = club_with_successor();
    later(&w, DAY);
    w.org.claim_succession(&bo, &w.founder);
    w.org.still_here(&w.founder);
    later(&w, 3_600);
    assert_eq!(
        w.org.try_finish_succession(&w.founder),
        Err(Ok(Error::NoSuccessionClaim))
    );
    // Proposing a payment counts as being around too, and resets the inactivity clock.
    later(&w, DAY - 60);
    w.org.propose_payment(
        &w.founder,
        &w.token,
        &Address::generate(&w.e),
        &euros(10),
        &String::from_str(&w.e, ""),
        &None,
        &false,
    );
    later(&w, 120);
    assert_eq!(
        w.org.try_claim_succession(&bo, &w.founder),
        Err(Ok(Error::StillActive))
    );
}

#[test]
fn successions_are_validated_and_only_the_named_successor_claims() {
    let (w, bo, bea) = club_with_successor();
    later(&w, DAY);
    assert_eq!(
        w.org.try_claim_succession(&bea, &w.founder),
        Err(Ok(Error::NotSuccessor))
    );
    let outsider = Address::generate(&w.e);
    let check = |change: Change| {
        w.org
            .try_propose_change(&bo, &change)
            .map(|_| ())
            .map_err(|e| e.ok())
    };
    assert_eq!(
        check(Change::SetSuccessor(bo.clone(), Some(outsider), DAY, 60)),
        Err(Some(Error::InvalidSuccession))
    );
    assert_eq!(
        check(Change::SetSuccessor(bo.clone(), Some(bo.clone()), DAY, 60)),
        Err(Some(Error::InvalidSuccession))
    );
    assert_eq!(
        check(Change::SetSuccessor(bo.clone(), Some(bea.clone()), 10, 60)),
        Err(Some(Error::InvalidSuccession))
    );
}

#[test]
fn claiming_needs_the_successors_own_signature() {
    let (w, bo, bea) = club_with_successor();
    later(&w, DAY);
    w.e.set_auths(&[]);
    let invoke = MockAuthInvoke {
        contract: &w.org.address,
        fn_name: "claim_succession",
        args: (bo.clone(), w.founder.clone()).into_val(&w.e),
        sub_invokes: &[],
    };
    assert!(w
        .org
        .mock_auths(&[MockAuth {
            address: &bea,
            invoke: &invoke,
        }])
        .try_claim_succession(&bo, &w.founder)
        .is_err());
    w.org
        .mock_auths(&[MockAuth {
            address: &bo,
            invoke: &invoke,
        }])
        .claim_succession(&bo, &w.founder);
}

/// An ML-DSA-44 key pair from a fixed seed, the public key as contract bytes.
fn seal_keys(e: &Env, seed: u8) -> (ml_dsa_44::PrivateKey, Bytes) {
    let (public, private) = ml_dsa_44::KG::keygen_from_seed(&[seed; 32]);
    (private, Bytes::from_slice(e, &public.into_bytes()))
}

fn sign(e: &Env, key: &ml_dsa_44::PrivateKey, message: &[u8; 32]) -> Bytes {
    match key.try_sign_with_seed(&[3u8; 32], message, &[]) {
        Ok(signature) => Bytes::from_slice(e, &signature),
        Err(reason) => panic!("signing failed: {reason}"),
    }
}

/// A 12,000 payment needs the seal; the organization checks seals with the real ML-DSA verifier.
fn sealed_club() -> (World, Address, u64) {
    let w = club(50_000);
    let bo = board_member(&w);
    let verifier = w.e.register(SealVerifier, ());
    w.org
        .change_directly(&w.founder, &Change::SetSealVerifier(Some(verifier)));
    let id = w.org.propose_payment(
        &w.founder,
        &w.token,
        &Address::generate(&w.e),
        &euros(12_000),
        &String::from_str(&w.e, "Boat"),
        &None,
        &false,
    );
    assert!(w.org.request(&id).evaluation.seal_required);
    (w, bo, id)
}

#[test]
fn with_a_verifier_a_seal_needs_the_members_ml_dsa_signature() {
    let (w, bo, id) = sealed_club();
    assert_eq!(w.org.try_seal(&bo, &id), Err(Ok(Error::SealKeyRequired)));
    let (private, public) = seal_keys(&w.e, 7);
    assert_eq!(
        w.org
            .try_seal_with_key(&bo, &id, &Bytes::from_slice(&w.e, &[1u8; 2_420])),
        Err(Ok(Error::SealKeyRequired))
    );
    w.org.set_seal_key(&bo, &public);
    assert_eq!(w.org.seal_key(&bo), Some(public));
    // A signature for another request doesn't count.
    let other = sign(&w.e, &private, &w.org.seal_payload(&(id + 1)).to_array());
    assert_eq!(
        w.org.try_seal_with_key(&bo, &id, &other),
        Err(Ok(Error::BadSealSignature))
    );
    let signature = sign(&w.e, &private, &w.org.seal_payload(&id).to_array());
    w.org.seal_with_key(&bo, &id, &signature);
    assert_eq!(w.org.request(&id).sealed_by, Some(bo));
}

#[test]
fn a_signature_from_another_key_is_refused() {
    let (w, bo, id) = sealed_club();
    let (_, public) = seal_keys(&w.e, 7);
    let (impostor, _) = seal_keys(&w.e, 9);
    w.org.set_seal_key(&bo, &public);
    let signature = sign(&w.e, &impostor, &w.org.seal_payload(&id).to_array());
    assert_eq!(
        w.org.try_seal_with_key(&bo, &id, &signature),
        Err(Ok(Error::BadSealSignature))
    );
    assert_eq!(w.org.request(&id).status, Status::Pending);
}

#[test]
fn only_a_working_verifier_is_accepted() {
    let w = club(10);
    assert_eq!(
        w.org.try_change_directly(
            &w.founder,
            &Change::SetSealVerifier(Some(Address::generate(&w.e)))
        ),
        Err(Ok(Error::BadSealSignature))
    );
    assert_eq!(
        w.org
            .try_set_seal_key(&w.founder, &Bytes::from_slice(&w.e, &[0u8; 10])),
        Err(Ok(Error::BadSealSignature))
    );
}
