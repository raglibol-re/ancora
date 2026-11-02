//! The quantum-safe security seal. Once the organization names an ML-DSA verifier (a rule
//! change), a seal must carry an ML-DSA-44 signature by the sealing member's registered key over
//! SHA-256(organization address XDR ‖ request id XDR). The key lives on the member's device;
//! the verifier (contracts/seal_verifier) checks the signature. Without a verifier, seals stay
//! passkey-only as before.

use soroban_sdk::xdr::ToXdr;
use soroban_sdk::{contractclient, contractimpl, Address, Bytes, BytesN, Env};

use crate::types::Error;
use crate::{
    continuity, extend_instance, load_info, ranked, rules, seal_request, DataKey, Organization,
    OrganizationArgs, OrganizationClient, REQUEST_EXTEND, REQUEST_THRESHOLD,
};

/// FIPS 204 ML-DSA-44 public key size.
const KEY_LEN: u32 = 1_312;

/// OpenZeppelin's external-verifier interface, as `contracts/seal_verifier` implements it.
#[allow(dead_code)]
#[contractclient(name = "SealVerifierClient")]
pub trait SealVerifierInterface {
    fn verify(e: Env, signature_payload: Bytes, key_data: Bytes, sig_data: Bytes) -> bool;
}

#[contractimpl]
impl Organization {
    /// Registers (or replaces) the member's ML-DSA-44 public key for seals.
    ///
    /// Auth: `by`, a member.
    pub fn set_seal_key(e: &Env, by: Address, key: Bytes) -> Result<(), Error> {
        by.require_auth();
        extend_instance(e);
        let info = load_info(e);
        rules::rank_of_member(&ranked(e, &info.roles), &by).ok_or(Error::NotMember)?;
        if key.len() != KEY_LEN {
            return Err(Error::BadSealSignature);
        }
        let storage_key = DataKey::SealKey(by.clone());
        e.storage().persistent().set(&storage_key, &key);
        e.storage()
            .persistent()
            .extend_ttl(&storage_key, REQUEST_THRESHOLD, REQUEST_EXTEND);
        continuity::touch(e, &by);
        Ok(())
    }

    /// The member's registered seal key, if any.
    ///
    /// Auth: none (read).
    pub fn seal_key(e: &Env, member: Address) -> Option<Bytes> {
        e.storage().persistent().get(&DataKey::SealKey(member))
    }

    /// The ML-DSA verifier seals are checked with; `None` means passkey seals.
    ///
    /// Auth: none (read).
    pub fn seal_verifier(e: &Env) -> Option<Address> {
        e.storage().instance().get(&DataKey::SealVerifier)
    }

    /// Seals a request with the member's ML-DSA signature over `seal_payload(id)`.
    ///
    /// Auth: `by`, an eligible approver other than the requester.
    pub fn seal_with_key(e: &Env, by: Address, id: u64, signature: Bytes) -> Result<(), Error> {
        by.require_auth();
        extend_instance(e);
        let verifier: Address = e
            .storage()
            .instance()
            .get(&DataKey::SealVerifier)
            .ok_or(Error::SealNotRequired)?;
        let key: Bytes = e
            .storage()
            .persistent()
            .get(&DataKey::SealKey(by.clone()))
            .ok_or(Error::SealKeyRequired)?;
        let payload: Bytes = payload(e, id).into();
        if !SealVerifierClient::new(e, &verifier).verify(&payload, &key, &signature) {
            return Err(Error::BadSealSignature);
        }
        continuity::touch(e, &by);
        seal_request(e, by, id)
    }

    /// What a member signs to seal request `id`: SHA-256(organization address XDR ‖ id XDR).
    ///
    /// Auth: none (read).
    pub fn seal_payload(e: &Env, id: u64) -> BytesN<32> {
        payload(e, id)
    }
}

fn payload(e: &Env, id: u64) -> BytesN<32> {
    let mut message = e.current_contract_address().to_xdr(e);
    message.append(&id.to_xdr(e));
    e.crypto().sha256(&message).into()
}

/// Whether plain (passkey) seals are still accepted: only while no verifier is named.
pub(crate) fn passkey_seals_allowed(e: &Env) -> bool {
    !e.storage().instance().has(&DataKey::SealVerifier)
}

/// Accepts a verifier only if it answers `verify` (false for an empty signature).
pub(crate) fn plan_verifier(e: &Env, verifier: &Option<Address>) -> Result<(), Error> {
    let Some(address) = verifier else {
        return Ok(());
    };
    let empty = Bytes::new(e);
    match SealVerifierClient::new(e, address).try_verify(&empty, &empty, &empty) {
        Ok(Ok(false)) => Ok(()),
        _ => Err(Error::BadSealSignature),
    }
}

pub(crate) fn apply_verifier(e: &Env, verifier: &Option<Address>) {
    match verifier {
        Some(address) => e.storage().instance().set(&DataKey::SealVerifier, address),
        None => e.storage().instance().remove(&DataKey::SealVerifier),
    }
}
