//! ancora confidential pot verifier.
//!
//! OpenZeppelin's UltraHonk verifier registry (stellar-confidential 0.8.0) with its keys fixed
//! at deployment: the constructor registers the verification keys of the five core circuits,
//! built into this Wasm from the circuits OpenZeppelin pinned (nargo 1.0.0-beta.11, bb 0.87.0),
//! and nothing can register or replace a key afterwards. No admin, so nobody (ancora included)
//! can swap in a key that would accept forged proofs; a new circuit release is a new deployment.
#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, panic_with_error, Address, Bytes, Env};
use stellar_confidential::verifier::{storage as verifier, CircuitType, ConfidentialVerifier};

const REGISTER_VK: &[u8] = include_bytes!("../vks/register.vk.bin");
const WITHDRAW_VK: &[u8] = include_bytes!("../vks/withdraw.vk.bin");
const TRANSFER_VK: &[u8] = include_bytes!("../vks/transfer.vk.bin");
const SPENDER_TRANSFER_VK: &[u8] = include_bytes!("../vks/spender_transfer.vk.bin");
const SET_SPENDER_VK: &[u8] = include_bytes!("../vks/set_spender.vk.bin");

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    /// The keys are fixed at deployment.
    KeysFixed = 1,
}

#[contract]
pub struct PotVerifier;

#[contractimpl]
impl PotVerifier {
    /// Registers the five core circuits' verification keys, once and for good.
    ///
    /// Auth: none (runs only at deployment).
    pub fn __constructor(e: &Env) {
        for (circuit, key) in [
            (CircuitType::Register, REGISTER_VK),
            (CircuitType::Withdraw, WITHDRAW_VK),
            (CircuitType::Transfer, TRANSFER_VK),
            (CircuitType::SpenderTransfer, SPENDER_TRANSFER_VK),
            (CircuitType::SetSpender, SET_SPENDER_VK),
        ] {
            verifier::register_verification_key(e, circuit, &Bytes::from_slice(e, key));
        }
    }
}

#[contractimpl(contracttrait)]
impl ConfidentialVerifier for PotVerifier {
    /// Always fails: the keys are fixed at deployment.
    ///
    /// Auth: none (it never changes anything).
    fn register_verification_key(e: &Env, _circuit: CircuitType, _key: Bytes, _operator: Address) {
        panic_with_error!(e, Error::KeysFixed)
    }

    /// Always fails: the keys are fixed at deployment.
    ///
    /// Auth: none (it never changes anything).
    fn update_verification_key(e: &Env, _circuit: CircuitType, _key: Bytes, _operator: Address) {
        panic_with_error!(e, Error::KeysFixed)
    }
}

#[cfg(test)]
mod test;
