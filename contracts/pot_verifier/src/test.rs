extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Bytes, Env};
use stellar_confidential::verifier::CircuitType;

use crate::{PotVerifier, PotVerifierClient};

// A register proof made in the browser stack ancora ships (noir_js 1.0.0-beta.11, bb.js 0.87.0,
// Keccak transcript) and its six public inputs, 32 bytes each.
const REGISTER_PROOF: &[u8] = include_bytes!("../../test-vectors/confidential/register.proof");
const REGISTER_INPUTS: &[u8] =
    include_bytes!("../../test-vectors/confidential/register.inputs.bin");

fn setup(e: &Env) -> PotVerifierClient<'_> {
    PotVerifierClient::new(e, &e.register(PotVerifier, ()))
}

#[test]
fn accepts_a_real_register_proof() {
    let e = Env::default();
    e.cost_estimate().budget().reset_unlimited();
    let client = setup(&e);
    let proof = Bytes::from_slice(&e, REGISTER_PROOF);
    let inputs = Bytes::from_slice(&e, REGISTER_INPUTS);
    assert!(client.verify_proof(&CircuitType::Register, &inputs, &proof));
    std::println!("register verification: {:?}", e.cost_estimate().budget());
}

#[test]
fn rejects_the_proof_for_other_inputs() {
    let e = Env::default();
    e.cost_estimate().budget().reset_unlimited();
    let client = setup(&e);
    let mut inputs = Bytes::from_slice(&e, REGISTER_INPUTS);
    // Another registering account (the last input) must not verify with this proof.
    inputs.set(
        inputs.len() - 1,
        inputs.get(inputs.len() - 1).unwrap_or(0) ^ 1,
    );
    let proof = Bytes::from_slice(&e, REGISTER_PROOF);
    assert!(!client.verify_proof(&CircuitType::Register, &inputs, &proof));
}

#[test]
fn has_every_core_key_and_refuses_new_ones() {
    let e = Env::default();
    let client = setup(&e);
    for circuit in [
        CircuitType::Register,
        CircuitType::Withdraw,
        CircuitType::Transfer,
        CircuitType::SpenderTransfer,
        CircuitType::SetSpender,
    ] {
        assert_eq!(client.get_verification_key(&circuit).len(), 1760);
    }
    // Strict auth: no auths are mocked, and the call fails on the fixed keys, not on auth.
    let anyone = Address::generate(&e);
    let key = Bytes::from_slice(&e, &[0u8; 1760]);
    assert!(client
        .try_register_verification_key(&CircuitType::Clawback, &key, &anyone)
        .is_err());
    assert!(client
        .try_update_verification_key(&CircuitType::Register, &key, &anyone)
        .is_err());
}
