//! ancora registry.
//!
//! A person is an address (their passkey-secured smart account). This contract keeps the
//! person's profile (display name, picture URL) and the list of organizations they belong to, so any device can find
//! them with one read. Organization contracts update the membership index themselves: the
//! registry trusts an organization because the operator registered it after deploying it, and
//! because Soroban treats `require_auth` for the direct invoker contract as authorized.
#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String, Vec};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_EXTEND: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const MAX_NAME_LEN: u32 = 64;
const MAX_AVATAR_LEN: u32 = 256;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// The organization was not registered by the operator.
    NotRegistered = 1,
    /// The organization is already registered.
    AlreadyRegistered = 2,
    /// Display names are limited to 64 bytes.
    NameTooLong = 3,
    /// Picture URLs are limited to 256 bytes.
    AvatarTooLong = 4,
}

/// What a person shows about themselves in every organization. The picture is a URL (an
/// https address of a small image), never the image itself.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Profile {
    pub name: String,
    pub avatar: String,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Org(Address),
    Orgs(Address),
    Profile(Address),
}

#[contract]
pub struct Registry;

#[contractimpl]
impl Registry {
    /// Sets the operator that may register organizations. The operator holds no power over
    /// any organization; it only vouches that a contract is an ancora organization.
    ///
    /// Auth: none (deployment).
    pub fn __constructor(e: &Env, admin: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Registers a freshly deployed organization and indexes its founder as a member.
    ///
    /// Auth: the admin (operator).
    pub fn register_org(e: &Env, org: Address, founder: Address) -> Result<(), Error> {
        let admin: Address = e
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotRegistered)?;
        admin.require_auth();
        if e.storage().persistent().has(&DataKey::Org(org.clone())) {
            return Err(Error::AlreadyRegistered);
        }
        e.storage()
            .persistent()
            .set(&DataKey::Org(org.clone()), &true);
        set_membership_index(e, &org, &founder, true);
        extend_ttl(e);
        Ok(())
    }

    /// Records that `member` joined or left `org`.
    ///
    /// Auth: the organization contract itself (it is the direct invoker when it applies a
    /// membership change), and only if the operator registered it.
    pub fn set_membership(
        e: &Env,
        org: Address,
        member: Address,
        is_member: bool,
    ) -> Result<(), Error> {
        org.require_auth();
        if !e.storage().persistent().has(&DataKey::Org(org.clone())) {
            return Err(Error::NotRegistered);
        }
        set_membership_index(e, &org, &member, is_member);
        extend_ttl(e);
        Ok(())
    }

    /// The organizations `member` belongs to.
    ///
    /// Auth: none (read).
    pub fn orgs_of(e: &Env, member: Address) -> Vec<Address> {
        e.storage()
            .persistent()
            .get(&DataKey::Orgs(member))
            .unwrap_or_else(|| Vec::new(e))
    }

    /// Whether the operator registered `org` as an ancora organization.
    ///
    /// Auth: none (read).
    pub fn is_registered(e: &Env, org: Address) -> bool {
        e.storage().persistent().has(&DataKey::Org(org))
    }

    /// Sets the name and picture shown next to `who` in every organization. An empty avatar
    /// means "no picture".
    ///
    /// Auth: `who`.
    pub fn set_profile(e: &Env, who: Address, name: String, avatar: String) -> Result<(), Error> {
        who.require_auth();
        if name.len() > MAX_NAME_LEN {
            return Err(Error::NameTooLong);
        }
        if avatar.len() > MAX_AVATAR_LEN {
            return Err(Error::AvatarTooLong);
        }
        e.storage()
            .persistent()
            .set(&DataKey::Profile(who), &Profile { name, avatar });
        extend_ttl(e);
        Ok(())
    }

    /// The profile of `who`, if they set one.
    ///
    /// Auth: none (read).
    pub fn profile(e: &Env, who: Address) -> Option<Profile> {
        e.storage().persistent().get(&DataKey::Profile(who))
    }
}

fn set_membership_index(e: &Env, org: &Address, member: &Address, is_member: bool) {
    let key = DataKey::Orgs(member.clone());
    let current: Vec<Address> = e
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(e));
    let mut next = Vec::new(e);
    for existing in current.iter() {
        if existing != *org {
            next.push_back(existing);
        }
    }
    if is_member {
        next.push_back(org.clone());
    }
    e.storage().persistent().set(&key, &next);
}

fn extend_ttl(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_EXTEND);
}

#[cfg(test)]
mod test;
