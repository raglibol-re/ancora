//! The organization's confidential pot against the real pot, verifier and auditor registry,
//! with a register proof made in ancora's browser stack for this organization's address. Only
//! members' signatures are mocked; the organization authorizes the pot by calling it itself,
//! and the deposit's token pull explicitly, exactly as on the network.

use ancora_pot::{Pot, PotClient};
use ancora_pot_auditors::{PotAuditors, PotAuditorsClient};
use ancora_pot_verifier::PotVerifier;
use soroban_sdk::testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke};
use soroban_sdk::{xdr::ToXdr, Address, Bytes, BytesN, IntoVal, Val, Vec};
use stellar_confidential::storage::{RegisterData, RegisterPayload};

use crate::test::{board_member, club_at, euros, World};
use crate::types::{PotAction, PotCall, Status};

const ORG: &str = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR";
const POT: &str = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const PROOF: &[u8] = include_bytes!("../../test-vectors/confidential/org-register.proof");
const INPUTS: &[u8] = include_bytes!("../../test-vectors/confidential/org-register.inputs.bin");
const WINDOW: u64 = 48 * 3_600;

struct Setup {
    w: World,
    board: [Address; 2],
    pot: PotClient<'static>,
}

fn setup() -> Setup {
    let w = club_at(5_000, Some(ORG));
    w.e.cost_estimate().budget().reset_unlimited();
    let board = [board_member(&w), board_member(&w)];
    let auditors = w.e.register(PotAuditors, ());
    PotAuditorsClient::new(&w.e, &auditors).register_key(&0, &key(&w, 0), &w.founder);
    let verifier = w.e.register(PotVerifier, ());
    let pot = Address::from_str(&w.e, POT);
    w.e.register_at(&pot, Pot, (w.token.clone(), verifier, auditors));
    // From here on every signature is explicit: nothing is authorized by default.
    w.e.set_auths(&[]);
    Setup {
        pot: PotClient::new(&w.e, &pot),
        board,
        w,
    }
}

/// A 64-byte point from the proof's public inputs (0: spending key, 1: viewing key).
fn key(w: &World, index: usize) -> BytesN<64> {
    let bytes: [u8; 64] = INPUTS[index * 64..index * 64 + 64]
        .try_into()
        .unwrap_or([0; 64]);
    BytesN::from_array(&w.e, &bytes)
}

fn register_data(w: &World) -> Bytes {
    RegisterData {
        payload: RegisterPayload {
            y: key(w, 0),
            pvk: key(w, 1),
        },
        proof: Bytes::from_slice(&w.e, PROOF),
    }
    .to_xdr(&w.e)
}

fn call(s: &Setup, action: PotAction) -> PotCall {
    PotCall {
        pot: s.pot.address.clone(),
        action,
        reserved_token: None,
        reserved_amount: 0,
    }
}

fn signed<'a>(org: &'a Address, function: &'a str, args: Vec<Val>) -> MockAuthInvoke<'a> {
    MockAuthInvoke {
        contract: org,
        fn_name: function,
        args,
        sub_invokes: &[],
    }
}

/// `who` proposes `call`; returns the request id.
fn propose(s: &Setup, who: &Address, pot_call: &PotCall) -> u64 {
    let invoke = signed(
        &s.w.org.address,
        "propose_pot",
        (who.clone(), pot_call.clone()).into_val(&s.w.e),
    );
    s.w.org
        .mock_auths(&[MockAuth {
            address: who,
            invoke: &invoke,
        }])
        .propose_pot(who, pot_call)
}

/// The founder proposes; the board approves while it is needed; the window passes.
fn run(s: &Setup, action: PotAction) -> u64 {
    let org = &s.w.org;
    let id = propose(s, &s.w.founder, &call(s, action));
    for approver in &s.board {
        if org.request(&id).status != Status::Pending {
            break;
        }
        let approve = signed(
            &org.address,
            "approve",
            (approver.clone(), id).into_val(&s.w.e),
        );
        org.mock_auths(&[MockAuth {
            address: approver,
            invoke: &approve,
        }])
        .approve(approver, &id);
    }
    if org.request(&id).status == Status::Scheduled {
        s.w.e
            .ledger()
            .set_timestamp(s.w.e.ledger().timestamp() + WINDOW);
        org.execute(&id);
    }
    id
}

#[test]
fn opens_the_pot_deposits_and_merges_under_its_rules() {
    let s = setup();
    let registered = run(&s, PotAction::Register(0, register_data(&s.w)));
    assert_eq!(s.w.org.request(&registered).status, Status::Executed);
    let account = s.pot.confidential_balance(&s.w.org.address);
    assert_eq!(account.spending_public_key, key(&s.w, 0));

    let deposited = run(&s, PotAction::Deposit(euros(100)));
    assert_eq!(s.w.org.request(&deposited).status, Status::Executed);
    assert_eq!(s.w.token_client.balance(&s.pot.address), euros(100));
    assert_eq!(s.w.token_client.balance(&s.w.org.address), euros(4_900));
    assert_eq!(s.w.org.available(&s.w.token), euros(4_900));

    let member = &s.board[0];
    let merge = signed(
        &s.w.org.address,
        "pot_merge",
        (member.clone(), s.pot.address.clone()).into_val(&s.w.e),
    );
    s.w.org
        .mock_auths(&[MockAuth {
            address: member,
            invoke: &merge,
        }])
        .pot_merge(member, &s.pot.address);
    let account = s.pot.confidential_balance(&s.w.org.address);
    assert_eq!(account.receiving_commitment.to_array(), [0u8; 64]);
    assert_ne!(account.spendable_commitment.to_array(), [0u8; 64]);
}

#[test]
fn a_hidden_amount_takes_the_strictest_tier() {
    let s = setup();
    let to = Address::generate(&s.w.e);
    let pot_call = call(&s, PotAction::Transfer(to, Bytes::new(&s.w.e)));
    let request = s.w.org.request(&propose(&s, &s.w.founder, &pot_call));
    let tiers = s.w.org.policy().tiers.len();
    assert_eq!(request.evaluation.tier, Some(tiers - 1));
    assert_eq!(request.status, Status::Pending);
}

#[test]
fn a_refused_proof_is_recorded_and_moves_nothing() {
    let s = setup();
    run(&s, PotAction::Register(0, register_data(&s.w)));
    run(&s, PotAction::Deposit(euros(100)));
    let id = run(&s, PotAction::Withdraw(euros(50), Bytes::new(&s.w.e)));
    let request = s.w.org.request(&id);
    assert_eq!(request.status, Status::Failed);
    assert!(request.failure.unwrap_or(0) >= 2000);
    assert_eq!(s.w.token_client.balance(&s.pot.address), euros(100));
}

#[test]
fn only_the_organization_can_act_on_its_pot_account() {
    let s = setup();
    let data = register_data(&s.w);
    // A member signing for the pot directly doesn't make them the organization.
    let member = &s.board[0];
    let direct = signed(
        &s.pot.address,
        "register",
        (s.w.org.address.clone(), 0u32, data.clone()).into_val(&s.w.e),
    );
    assert!(s
        .pot
        .mock_auths(&[MockAuth {
            address: member,
            invoke: &direct,
        }])
        .try_register(&s.w.org.address, &0, &data)
        .is_err());
    // Someone outside the organization can't propose, and nobody merges without signing.
    let outsider = Address::generate(&s.w.e);
    let pot_call = call(&s, PotAction::Register(0, data));
    let invoke = signed(
        &s.w.org.address,
        "propose_pot",
        (outsider.clone(), pot_call.clone()).into_val(&s.w.e),
    );
    assert!(s
        .w
        .org
        .mock_auths(&[MockAuth {
            address: &outsider,
            invoke: &invoke,
        }])
        .try_propose_pot(&outsider, &pot_call)
        .is_err());
    assert!(s.w.org.try_pot_merge(member, &s.pot.address).is_err());
}
