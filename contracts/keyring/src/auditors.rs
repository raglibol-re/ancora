//! Auditors: people outside the organization (an accountant, a funder's reviewer) its members
//! let read its private details. Members share the organization's key with them like with a
//! member; removing one and renewing the key keeps them out of what follows.

use soroban_sdk::{contractevent, contractimpl, Address, Env, Vec};

use crate::{member_check, DataKey, Error, Keyring, KeyringArgs, KeyringClient, EXTEND, THRESHOLD};

const MAX_AUDITORS: u32 = 10;

/// An auditor was added (`added` true) or removed.
#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct AuditorEvent {
    #[topic]
    pub org: Address,
    pub auditor: Address,
    pub added: bool,
    pub by: Address,
}

#[contractimpl]
impl Keyring {
    /// Lets `auditor` receive the organization's key. Everyone sees who was added, and by whom.
    ///
    /// Auth: `by`, a member of `org`.
    pub fn add_auditor(e: &Env, by: Address, org: Address, auditor: Address) -> Result<(), Error> {
        by.require_auth();
        member_check(e, &org, &by)?;
        let mut list = Self::auditors(e, org.clone());
        if !list.contains(&auditor) {
            if list.len() >= MAX_AUDITORS {
                return Err(Error::TooMany);
            }
            list.push_back(auditor.clone());
            save(e, &org, &list);
        }
        AuditorEvent {
            org,
            auditor,
            added: true,
            by,
        }
        .publish(e);
        Ok(())
    }

    /// Takes `auditor` off the list; renew the key afterwards so they can't read what follows.
    ///
    /// Auth: `by`, a member of `org`.
    pub fn remove_auditor(
        e: &Env,
        by: Address,
        org: Address,
        auditor: Address,
    ) -> Result<(), Error> {
        by.require_auth();
        member_check(e, &org, &by)?;
        let mut kept = Vec::new(e);
        for existing in Self::auditors(e, org.clone()).iter() {
            if existing != auditor {
                kept.push_back(existing);
            }
        }
        save(e, &org, &kept);
        AuditorEvent {
            org,
            auditor,
            added: false,
            by,
        }
        .publish(e);
        Ok(())
    }

    /// The organization's auditors.
    ///
    /// Auth: none (read).
    pub fn auditors(e: &Env, org: Address) -> Vec<Address> {
        e.storage()
            .persistent()
            .get(&DataKey::Auditors(org))
            .unwrap_or_else(|| Vec::new(e))
    }
}

pub(crate) fn is_auditor(e: &Env, org: &Address, who: &Address) -> bool {
    Keyring::auditors(e, org.clone()).contains(who)
}

fn save(e: &Env, org: &Address, list: &Vec<Address>) {
    let key = DataKey::Auditors(org.clone());
    e.storage().persistent().set(&key, list);
    e.storage().persistent().extend_ttl(&key, THRESHOLD, EXTEND);
}
