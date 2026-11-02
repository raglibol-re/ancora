//! ancora keyring: what lets an organization keep details on-chain that only its members read.
//!
//! Each person publishes an X25519 public key. An organization's members share a symmetric key
//! per epoch; a member stores it for another member wrapped to that member's public key (the
//! wrapping happens in the browser, the contract only holds ciphertext). Opening a new epoch,
//! for example after someone left, keeps them out of what is written from then on. Only members
//! of the organization (asked from the organization contract itself) may open epochs or share.
//! The contract never sees a key in the clear and holds no money.
#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, Address,
    Bytes, BytesN, Env, Symbol, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const EXTEND: u32 = 180 * DAY_IN_LEDGERS;
const THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
/// Ephemeral public key (32) + nonce (12) + 32-byte key + tag (16), with room to spare.
const MAX_WRAPPED_LEN: u32 = 160;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Only members of the organization may do this, for members of the organization.
    NotMember = 1,
    /// No epoch with this number has been opened for the organization.
    UnknownEpoch = 2,
    /// A wrapped key is at most 160 bytes.
    TooLong = 3,
    /// The member hasn't published an encryption key yet.
    NoKey = 4,
}

/// A member, as the organization contract lists it (`ancora_organization::Member`).
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Member {
    pub address: Address,
    pub role: Symbol,
}

#[contractclient(name = "OrganizationClient")]
pub trait OrganizationInterface {
    fn members(e: Env) -> Vec<Member>;
}

/// An organization key wrapped for one member: for which of their public keys, and by whom.
/// A member who sets up a new device publishes a new key; wraps for the old one are then stale.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Wrapped {
    pub key: Bytes,
    pub for_key: BytesN<32>,
    pub by: Address,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    PublicKey(Address),
    Epoch(Address),
    Wrapped(Address, Address, u32),
}

/// A new epoch was opened, or a member received the key of one.
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct KeyEvent {
    #[topic]
    pub org: Address,
    pub epoch: u32,
    /// The member who received a wrapped key; `None` when an epoch opened.
    pub member: Option<Address>,
}

#[contract]
pub struct Keyring;

#[contractimpl]
impl Keyring {
    /// Publishes (or replaces) the person's X25519 public key.
    ///
    /// Auth: `person`.
    pub fn set_key(e: &Env, person: Address, key: BytesN<32>) {
        person.require_auth();
        let storage_key = DataKey::PublicKey(person);
        e.storage().persistent().set(&storage_key, &key);
        e.storage()
            .persistent()
            .extend_ttl(&storage_key, THRESHOLD, EXTEND);
    }

    /// The person's published public key, if any.
    ///
    /// Auth: none (read).
    pub fn key(e: &Env, person: Address) -> Option<BytesN<32>> {
        e.storage().persistent().get(&DataKey::PublicKey(person))
    }

    /// The organization's current epoch; 0 while it keeps nothing private.
    ///
    /// Auth: none (read).
    pub fn epoch(e: &Env, org: Address) -> u32 {
        e.storage()
            .persistent()
            .get(&DataKey::Epoch(org))
            .unwrap_or(0)
    }

    /// Opens the organization's next epoch (the first turns private details on). The member then
    /// shares the new key with every member.
    ///
    /// Auth: `by`, a member of `org`.
    pub fn open_epoch(e: &Env, by: Address, org: Address) -> Result<u32, Error> {
        by.require_auth();
        member_check(e, &org, &by)?;
        let epoch = Self::epoch(e, org.clone()) + 1;
        let storage_key = DataKey::Epoch(org.clone());
        e.storage().persistent().set(&storage_key, &epoch);
        e.storage()
            .persistent()
            .extend_ttl(&storage_key, THRESHOLD, EXTEND);
        KeyEvent {
            org,
            epoch,
            member: None,
        }
        .publish(e);
        Ok(epoch)
    }

    /// Stores the organization's key of `epoch`, wrapped for `member`'s current public key.
    ///
    /// Auth: `by`, a member of `org`; `member` must be a member with a published key.
    pub fn share(
        e: &Env,
        by: Address,
        org: Address,
        member: Address,
        epoch: u32,
        wrapped: Bytes,
    ) -> Result<(), Error> {
        by.require_auth();
        if wrapped.len() > MAX_WRAPPED_LEN {
            return Err(Error::TooLong);
        }
        if epoch == 0 || epoch > Self::epoch(e, org.clone()) {
            return Err(Error::UnknownEpoch);
        }
        member_check(e, &org, &by)?;
        member_check(e, &org, &member)?;
        let for_key = Self::key(e, member.clone()).ok_or(Error::NoKey)?;
        let storage_key = DataKey::Wrapped(org.clone(), member.clone(), epoch);
        e.storage().persistent().set(
            &storage_key,
            &Wrapped {
                key: wrapped,
                for_key,
                by,
            },
        );
        e.storage()
            .persistent()
            .extend_ttl(&storage_key, THRESHOLD, EXTEND);
        KeyEvent {
            org,
            epoch,
            member: Some(member),
        }
        .publish(e);
        Ok(())
    }

    /// The organization's key of `epoch` as wrapped for `member`, if shared.
    ///
    /// Auth: none (read; it is ciphertext only `member` can open).
    pub fn wrapped(e: &Env, org: Address, member: Address, epoch: u32) -> Option<Wrapped> {
        e.storage()
            .persistent()
            .get(&DataKey::Wrapped(org, member, epoch))
    }
}

fn member_check(e: &Env, org: &Address, who: &Address) -> Result<(), Error> {
    let members = OrganizationClient::new(e, org).members();
    if members.iter().any(|m| m.address == *who) {
        Ok(())
    } else {
        Err(Error::NotMember)
    }
}

#[cfg(test)]
mod test;
