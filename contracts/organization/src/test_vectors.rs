//! The same vectors drive app/src/domain/rules/vectors.test.ts, so both engines provably agree.

use std::collections::BTreeMap;
use std::string::String as StdString;
use std::vec::Vec as StdVec;

use serde::Deserialize;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env, Symbol, Vec};

use crate::rules::{self, Ranked};
use crate::templates::template_in_cents;
use crate::types::{Policy, Requirement, Tier};

const VECTORS: &str = include_str!("../../test-vectors/approval-rules.json");

#[derive(Deserialize)]
struct Vectors {
    orgs: BTreeMap<StdString, OrgFixture>,
    payments: StdVec<PaymentVector>,
    governance: StdVec<GovernanceVector>,
    #[serde(rename = "setupPhase")]
    setup_phase: StdVec<SetupVector>,
}

#[derive(Deserialize)]
struct OrgFixture {
    roles: StdVec<StdString>,
    members: StdVec<MemberFixture>,
    policy: PolicyRef,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum PolicyRef {
    Named(StdString),
    Inline(PolicyJson),
}

#[derive(Deserialize)]
struct MemberFixture {
    #[serde(rename = "personId")]
    person_id: StdString,
    #[serde(rename = "roleId")]
    role_id: StdString,
}

// Amounts are i64 here: serde buffers untagged enums through a type without i128 support, and
// the vectors are in cents, which fit comfortably.
#[derive(Deserialize, Clone)]
struct PolicyJson {
    tiers: StdVec<TierJson>,
    #[serde(rename = "sealThreshold")]
    seal_threshold: i64,
    #[serde(rename = "newRecipientApprovals")]
    new_recipient_approvals: StdVec<RequirementJson>,
}

#[derive(Deserialize, Clone)]
struct TierJson {
    #[serde(rename = "upTo")]
    up_to: Option<i64>,
    approvals: StdVec<RequirementJson>,
    #[serde(rename = "objectionWindowHours")]
    objection_window_hours: u32,
}

#[derive(Deserialize, Clone)]
struct RequirementJson {
    #[serde(rename = "roleId")]
    role_id: StdString,
    count: u32,
}

#[derive(Deserialize)]
struct PaymentVector {
    name: StdString,
    org: StdString,
    amount: i64,
    requester: StdString,
    #[serde(rename = "recipientIsNew")]
    recipient_is_new: bool,
    approvals: StdVec<StdString>,
    sealed: bool,
    expect: PaymentExpect,
}

#[derive(Deserialize)]
struct PaymentExpect {
    tier: u32,
    approvals: StdVec<RequirementJson>,
    #[serde(rename = "objectionWindowHours")]
    objection_window_hours: u32,
    #[serde(rename = "sealRequired")]
    seal_required: bool,
    #[serde(rename = "countedCount")]
    counted_count: u32,
    complete: bool,
}

#[derive(Deserialize)]
struct GovernanceVector {
    name: StdString,
    org: StdString,
    requester: StdString,
    approvals: StdVec<StdString>,
    expect: GovernanceExpect,
}

#[derive(Deserialize)]
struct GovernanceExpect {
    approvals: StdVec<RequirementJson>,
    #[serde(rename = "objectionWindowHours")]
    objection_window_hours: u32,
    #[serde(rename = "countedCount")]
    counted_count: u32,
    complete: bool,
}

#[derive(Deserialize)]
struct SetupVector {
    name: StdString,
    org: StdString,
    expect: bool,
}

/// People are addresses; the fixture's person ids map to generated addresses.
struct People {
    e: Env,
    by_id: BTreeMap<StdString, Address>,
}

impl People {
    fn address(&mut self, id: &str) -> Address {
        self.by_id
            .entry(id.into())
            .or_insert_with(|| Address::generate(&self.e))
            .clone()
    }
}

struct Org {
    roles: Vec<Symbol>,
    members: Vec<Ranked>,
    policy: Policy,
    founder: Address,
}

fn requirements(e: &Env, list: &[RequirementJson]) -> Vec<Requirement> {
    let mut result = Vec::new(e);
    for r in list {
        result.push_back(Requirement {
            role: Symbol::new(e, &r.role_id),
            count: r.count,
        });
    }
    result
}

fn policy(e: &Env, json: &PolicyJson) -> Policy {
    let mut tiers = Vec::new(e);
    for t in &json.tiers {
        tiers.push_back(Tier {
            up_to: t.up_to.map(i128::from),
            approvals: requirements(e, &t.approvals),
            objection_window_hours: t.objection_window_hours,
        });
    }
    Policy {
        tiers,
        seal_threshold: i128::from(json.seal_threshold),
        new_recipient_approvals: requirements(e, &json.new_recipient_approvals),
        budgets: Vec::new(e),
    }
}

fn load() -> Vectors {
    serde_json::from_str(VECTORS).expect("vectors parse")
}

fn org(vectors: &Vectors, people: &mut People, key: &str) -> Org {
    let e = people.e.clone();
    let fixture = vectors.orgs.get(key).expect("org fixture");
    let policy_json = match &fixture.policy {
        PolicyRef::Inline(p) => p.clone(),
        PolicyRef::Named(name) => match &vectors.orgs.get(name).expect("named policy").policy {
            PolicyRef::Inline(p) => p.clone(),
            PolicyRef::Named(_) => panic!("nested policy reference"),
        },
    };
    let mut roles = Vec::new(&e);
    for role in &fixture.roles {
        roles.push_back(Symbol::new(&e, role));
    }
    let mut members = Vec::new(&e);
    for member in &fixture.members {
        let rank = rules::rank_of(&roles, &Symbol::new(&e, &member.role_id)).expect("role");
        members.push_back((people.address(&member.person_id), rank));
    }
    let founder = people.address(&fixture.members[0].person_id);
    Org {
        roles,
        members,
        policy: policy(&e, &policy_json),
        founder,
    }
}

/// Order-insensitive comparison of requirement lists.
fn same_requirements(a: &Vec<Requirement>, b: &Vec<Requirement>) -> bool {
    a.len() == b.len() && a.iter().all(|r| b.contains(&r)) && b.iter().all(|r| a.contains(&r))
}

fn addresses(people: &mut People, ids: &[StdString]) -> Vec<Address> {
    let mut out = Vec::new(&people.e);
    for id in ids {
        out.push_back(people.address(id));
    }
    out
}

#[test]
fn templates_match_the_shared_vectors() {
    let vectors = load();
    let e = Env::default();
    for key in ["club", "company", "team"] {
        let fixture = vectors.orgs.get(key).expect("template org");
        let PolicyRef::Inline(json) = &fixture.policy else {
            panic!("template policy must be inline");
        };
        let blueprint = template_in_cents(&e, &Symbol::new(&e, key)).expect("template");
        assert_eq!(blueprint.policy, policy(&e, json), "{key} policy");
        let mut roles = Vec::new(&e);
        for role in &fixture.roles {
            roles.push_back(Symbol::new(&e, role));
        }
        assert_eq!(blueprint.roles, roles, "{key} roles");
    }
}

#[test]
fn payment_vectors() {
    let vectors = load();
    for vector in &vectors.payments {
        let e = Env::default();
        let mut people = People {
            e: e.clone(),
            by_id: BTreeMap::new(),
        };
        let org = org(&vectors, &mut people, &vector.org);
        let evaluation = rules::evaluate_payment(
            &org.policy,
            Some(i128::from(vector.amount)),
            vector.recipient_is_new,
            false,
        )
        .expect("evaluation");
        let approvers = addresses(&mut people, &vector.approvals);
        let requester = people.address(&vector.requester);
        let progress = rules::approval_progress(
            &e,
            &org.roles,
            &org.members,
            &evaluation.approvals,
            &approvers,
            &requester,
        );
        let complete = progress.satisfied && (!evaluation.seal_required || vector.sealed);
        let name = &vector.name;
        assert_eq!(evaluation.tier, Some(vector.expect.tier), "{name}: tier");
        assert!(
            same_requirements(
                &evaluation.approvals,
                &requirements(&e, &vector.expect.approvals)
            ),
            "{name}: approvals"
        );
        assert_eq!(
            evaluation.objection_window_hours, vector.expect.objection_window_hours,
            "{name}: window"
        );
        assert_eq!(
            evaluation.seal_required, vector.expect.seal_required,
            "{name}: seal"
        );
        assert_eq!(
            progress.counted, vector.expect.counted_count,
            "{name}: counted"
        );
        assert_eq!(complete, vector.expect.complete, "{name}: complete");
    }
}

#[test]
fn governance_vectors() {
    let vectors = load();
    for vector in &vectors.governance {
        let e = Env::default();
        let mut people = People {
            e: e.clone(),
            by_id: BTreeMap::new(),
        };
        let org = org(&vectors, &mut people, &vector.org);
        let evaluation = rules::evaluate_governance(&org.policy).expect("evaluation");
        let approvers = addresses(&mut people, &vector.approvals);
        let requester = people.address(&vector.requester);
        let progress = rules::approval_progress(
            &e,
            &org.roles,
            &org.members,
            &evaluation.approvals,
            &approvers,
            &requester,
        );
        let name = &vector.name;
        assert!(
            same_requirements(
                &evaluation.approvals,
                &requirements(&e, &vector.expect.approvals)
            ),
            "{name}: approvals"
        );
        assert_eq!(
            evaluation.objection_window_hours, vector.expect.objection_window_hours,
            "{name}: window"
        );
        assert_eq!(
            progress.counted, vector.expect.counted_count,
            "{name}: counted"
        );
        assert_eq!(
            progress.satisfied, vector.expect.complete,
            "{name}: complete"
        );
    }
}

#[test]
fn setup_phase_vectors() {
    let vectors = load();
    for vector in &vectors.setup_phase {
        let e = Env::default();
        let mut people = People {
            e: e.clone(),
            by_id: BTreeMap::new(),
        };
        let org = org(&vectors, &mut people, &vector.org);
        let setup = rules::is_setup_phase(&e, &org.roles, &org.members, &org.policy, &org.founder);
        assert_eq!(setup, vector.expect, "{}", vector.name);
    }
}
