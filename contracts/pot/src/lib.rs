//! ancora confidential pot (preview).
//!
//! OpenZeppelin's confidential token (stellar-confidential 0.8.0) over one SEP-41 asset, with
//! no hooks and no admin: nobody can freeze an account, claw money back, or change the verifier
//! or the auditor registry. Balances and the amounts moved between accounts are Pedersen
//! commitments checked by zero-knowledge proofs (contracts/pot_verifier); who pays whom, and
//! what goes in or comes out, stays public. The proving recipe is provisional upstream, so this
//! runs on the testnet as a preview.
#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Bytes, Env};
use stellar_confidential::{
    storage as confidential, ConfidentialAccount, ConfidentialToken, NoHooks, SpenderDelegation,
};

#[contract]
pub struct Pot;

#[contractimpl]
impl Pot {
    /// Wraps `asset`, checks proofs with `verifier`, reads auditor keys from `auditors`.
    ///
    /// Auth: none (runs only at deployment).
    pub fn __constructor(e: &Env, asset: Address, verifier: Address, auditors: Address) {
        confidential::set_underlying_asset(e, &asset);
        confidential::set_verifier(e, &verifier);
        confidential::set_auditor(e, &auditors);
        confidential::set_address_as_field_element(e);
    }

    /// The asset this pot holds.
    ///
    /// Auth: none (read-only).
    pub fn asset(e: &Env) -> Address {
        confidential::get_underlying_asset(e)
    }
}

#[contractimpl(contracttrait)]
impl ConfidentialToken for Pot {
    type Hooks = NoHooks;
}

#[cfg(test)]
mod test;
