//! ancora confidential pot auditors.
//!
//! OpenZeppelin's auditor-key registry (stellar-confidential 0.8.0) without a manager: anyone
//! registers their own Grumpkin key under the next free number and only they can replace it.
//! An organization registers the key it derives from its own secret, so the auditor ciphertexts
//! of its confidential payments reach the organization (and whoever it shares its key with),
//! never ancora. Taking the next number keeps anyone from claiming a number someone else picked.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, BytesN, Env,
};
use stellar_confidential::auditor::{storage as auditors, ConfidentialAuditor};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    /// Only the next free number can be registered.
    NotNextNumber = 1,
    /// Only whoever registered a key can replace it.
    NotTheOwner = 2,
}

#[contracttype]
enum DataKey {
    Next,
    Owner(u32),
}

#[contract]
pub struct PotAuditors;

#[contractimpl]
impl PotAuditors {
    /// The number the next registered key gets.
    ///
    /// Auth: none (read-only).
    pub fn next_id(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::Next).unwrap_or(0)
    }

    /// Who registered the key under `auditor_id`, if anyone.
    ///
    /// Auth: none (read-only).
    pub fn owner(e: &Env, auditor_id: u32) -> Option<Address> {
        e.storage().persistent().get(&DataKey::Owner(auditor_id))
    }
}

#[contractimpl(contracttrait)]
impl ConfidentialAuditor for PotAuditors {
    /// Registers `point` as the key under `auditor_id`, which must be `next_id()`.
    ///
    /// Auth: `operator`, who then owns the number.
    fn register_key(e: &Env, auditor_id: u32, point: BytesN<64>, operator: Address) {
        operator.require_auth();
        let next = Self::next_id(e);
        if auditor_id != next {
            panic_with_error!(e, Error::NotNextNumber);
        }
        auditors::register_key(e, auditor_id, &point);
        e.storage()
            .persistent()
            .set(&DataKey::Owner(auditor_id), &operator);
        e.storage().instance().set(&DataKey::Next, &(next + 1));
    }

    /// Replaces the key under `auditor_id`.
    ///
    /// Auth: `operator`, who must have registered it.
    fn rotate_key(e: &Env, auditor_id: u32, new_point: BytesN<64>, operator: Address) {
        operator.require_auth();
        if Self::owner(e, auditor_id) != Some(operator) {
            panic_with_error!(e, Error::NotTheOwner);
        }
        auditors::rotate_key(e, auditor_id, &new_point);
    }
}

#[cfg(test)]
mod test;
