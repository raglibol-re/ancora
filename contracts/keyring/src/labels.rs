//! Labels: what members call an address (the name and note of a saved recipient), stored
//! encrypted with the organization's key so the address book can be private too. The contract
//! only holds ciphertext; only members (and auditors) holding the key read it.

use soroban_sdk::{contractimpl, Address, Bytes, Env, Map, Vec};

use crate::{member_check, DataKey, Error, Keyring, KeyringArgs, KeyringClient, EXTEND, THRESHOLD};

const MAX_LABELS: u32 = 200;
const MAX_LABEL_LEN: u32 = 512;

#[contractimpl]
impl Keyring {
    /// Stores (or, with an empty label, removes) the encrypted label of `subject`.
    ///
    /// Auth: `by`, a member of `org`.
    pub fn set_label(
        e: &Env,
        by: Address,
        org: Address,
        subject: Address,
        label: Bytes,
    ) -> Result<(), Error> {
        by.require_auth();
        member_check(e, &org, &by)?;
        if label.len() > MAX_LABEL_LEN {
            return Err(Error::TooLong);
        }
        let key = DataKey::Label(org.clone(), subject.clone());
        let index_key = DataKey::Labelled(org.clone());
        let mut index: Vec<Address> = e
            .storage()
            .persistent()
            .get(&index_key)
            .unwrap_or_else(|| Vec::new(e));
        let position = index.first_index_of(&subject);
        if label.is_empty() {
            e.storage().persistent().remove(&key);
            if let Some(at) = position {
                index.remove(at);
            }
        } else {
            if position.is_none() {
                if index.len() >= MAX_LABELS {
                    return Err(Error::TooMany);
                }
                index.push_back(subject);
            }
            e.storage().persistent().set(&key, &label);
            e.storage().persistent().extend_ttl(&key, THRESHOLD, EXTEND);
        }
        e.storage().persistent().set(&index_key, &index);
        e.storage()
            .persistent()
            .extend_ttl(&index_key, THRESHOLD, EXTEND);
        Ok(())
    }

    /// Every labelled address of the organization with its encrypted label.
    ///
    /// Auth: none (read; ciphertext).
    pub fn labels(e: &Env, org: Address) -> Map<Address, Bytes> {
        let index: Vec<Address> = e
            .storage()
            .persistent()
            .get(&DataKey::Labelled(org.clone()))
            .unwrap_or_else(|| Vec::new(e));
        let mut labels = Map::new(e);
        for subject in index.iter() {
            if let Some(label) = e
                .storage()
                .persistent()
                .get::<DataKey, Bytes>(&DataKey::Label(org.clone(), subject.clone()))
            {
                labels.set(subject, label);
            }
        }
        labels
    }
}
