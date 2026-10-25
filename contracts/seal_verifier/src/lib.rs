//! ancora security seal verifier.
//!
//! A quantum-safe signature check for the security seal: ML-DSA-44 (FIPS 204, formerly
//! Dilithium) verified in the contract, since the testnet (protocol 29) has no ML-DSA host
//! function yet. It implements the external-verifier interface of OpenZeppelin's smart
//! account, so a person's account can list an ML-DSA public key as a signer whose signatures
//! are checked here. The key and the signature are raw FIPS 204 encodings; the message is the
//! 32-byte signature payload, with an empty context string.
#![no_std]

use fips204::ml_dsa_44::{PublicKey, PK_LEN, SIG_LEN};
use fips204::traits::{SerDes, Verifier};
use soroban_sdk::{contract, contractimpl, Bytes, Env, Vec};

const PAYLOAD_LEN: u32 = 32;

#[contract]
pub struct SealVerifier;

#[contractimpl]
impl SealVerifier {
    /// Whether `sig_data` is a valid ML-DSA-44 signature by `key_data` over `signature_payload`.
    /// Malformed keys, wrong lengths and bad signatures all return false.
    ///
    /// Auth: none (pure).
    pub fn verify(_e: &Env, signature_payload: Bytes, key_data: Bytes, sig_data: Bytes) -> bool {
        if signature_payload.len() != PAYLOAD_LEN
            || key_data.len() != PK_LEN as u32
            || sig_data.len() != SIG_LEN as u32
        {
            return false;
        }
        let mut payload = [0u8; PAYLOAD_LEN as usize];
        signature_payload.copy_into_slice(&mut payload);
        let mut key = [0u8; PK_LEN];
        key_data.copy_into_slice(&mut key);
        let mut signature = [0u8; SIG_LEN];
        sig_data.copy_into_slice(&mut signature);
        match PublicKey::try_from_bytes(key) {
            Ok(public_key) => public_key.verify(&payload, &signature, &[]),
            Err(_) => false,
        }
    }

    /// The canonical form of a key is its FIPS 204 encoding itself.
    ///
    /// Auth: none (pure).
    pub fn canonicalize_key(_e: &Env, key_data: Bytes) -> Bytes {
        key_data
    }

    /// Canonical forms for several keys at once.
    ///
    /// Auth: none (pure).
    pub fn batch_canonicalize_key(_e: &Env, keys_data: Vec<Bytes>) -> Vec<Bytes> {
        keys_data
    }
}

#[cfg(test)]
extern crate std;

#[cfg(test)]
mod test {
    use soroban_sdk::{Bytes, Env};

    use super::{SealVerifier, SealVerifierClient};

    const VECTOR: &str = include_str!("../../test-vectors/ml-dsa-44.json");

    fn field(e: &Env, name: &str) -> Bytes {
        let vector: serde_json::Value = serde_json::from_str(VECTOR).expect("vector json");
        let hex = vector[name].as_str().expect("hex field");
        let bytes: std::vec::Vec<u8> = (0..hex.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).expect("hex"))
            .collect();
        Bytes::from_slice(e, &bytes)
    }

    #[test]
    fn accepts_the_shared_vector_and_rejects_tampering() {
        let e = Env::default();
        let verifier = SealVerifierClient::new(&e, &e.register(SealVerifier, ()));
        let payload = field(&e, "payload");
        let key = field(&e, "publicKey");
        let signature = field(&e, "signature");
        assert!(verifier.verify(&payload, &key, &signature));

        let mut other_payload = payload.clone();
        other_payload.set(0, payload.get_unchecked(0) ^ 1);
        assert!(!verifier.verify(&other_payload, &key, &signature));

        let mut broken = signature.clone();
        broken.set(100, signature.get_unchecked(100) ^ 1);
        assert!(!verifier.verify(&payload, &key, &broken));

        assert!(!verifier.verify(&payload, &Bytes::from_slice(&e, &[1, 2, 3]), &signature));
        assert_eq!(verifier.canonicalize_key(&key), key);
    }
}
