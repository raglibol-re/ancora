//! Deals between two real ancora organizations. Only members' signatures are mocked; each
//! organization authorizes the deal contract by calling it itself after its own rules were
//! met (and authorizes the deposit's token pull explicitly), exactly as on the network.

use ancora_deal::{DealStatus, Deals, DealsClient as RealDealsClient};
use soroban_sdk::testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke};
use soroban_sdk::{symbol_short, Address, BytesN, IntoVal, String, Symbol, Val, Vec};

use crate::test::{board_member, club, euros, World};
use crate::types::{AssetSpec, DealAction, DealCall, DealTerms, MilestoneTerms, Status};
use crate::{Organization, OrganizationClient};

const WINDOW: u64 = 48 * 3_600;

struct Parties {
    w: World,
    /// Party A (pays): the club from `club()`, with two board members.
    a: OrganizationClient<'static>,
    a_board: [Address; 2],
    /// Party B (delivers): a second club on the same token and registry.
    b: OrganizationClient<'static>,
    b_founder: Address,
    b_board: [Address; 2],
    deals: RealDealsClient<'static>,
}

fn parties() -> Parties {
    let w = club(5_000);
    let a_board = [board_member(&w), board_member(&w)];
    let b_founder = Address::generate(&w.e);
    let b_id = w.e.register(
        Organization,
        (
            &w.registry.address,
            &w.recovery,
            &w.releases.address,
            symbol_short!("EUR"),
            Vec::from_array(
                &w.e,
                [AssetSpec {
                    token: w.token.clone(),
                    currency: symbol_short!("EUR"),
                    vault: None,
                }],
            ),
            &b_founder,
            Symbol::new(&w.e, "treasurer"),
            symbol_short!("club"),
            String::from_str(&w.e, "Atlantic Boats"),
            BytesN::from_array(&w.e, &[2u8; 32]),
        ),
    );
    w.registry.register_org(&b_id, &b_founder);
    let b = OrganizationClient::new(&w.e, &b_id);
    let b_board = [Address::generate(&w.e), Address::generate(&w.e)];
    for member in &b_board {
        b.change_directly(
            &b_founder,
            &crate::types::Change::AddMember(member.clone(), symbol_short!("board")),
        );
    }
    let deals = RealDealsClient::new(&w.e, &w.e.register(Deals, ()));
    // From here on every signature is explicit: nothing is authorized by default.
    w.e.set_auths(&[]);
    Parties {
        a: OrganizationClient::new(&w.e, &w.org.address),
        a_board,
        b,
        b_founder,
        b_board,
        deals,
        w,
    }
}

fn call(p: &Parties, action: DealAction) -> DealCall {
    DealCall {
        deals: p.deals.address.clone(),
        action,
        reserved_token: None,
        reserved_amount: 0,
    }
}

fn terms(p: &Parties) -> DealTerms {
    DealTerms {
        asset: p.w.token.clone(),
        milestones: Vec::from_array(
            &p.w.e,
            [
                MilestoneTerms {
                    label: String::from_str(&p.w.e, "Hull"),
                    amount: euros(600),
                },
                MilestoneTerms {
                    label: String::from_str(&p.w.e, "Rigging"),
                    amount: euros(400),
                },
            ],
        ),
        objection_seconds: 3 * 86_400,
        arbiter: None,
        document_hash: BytesN::from_array(&p.w.e, &[8u8; 32]),
    }
}

/// The same terms in the deal crate's own type, for calling the deal contract directly.
fn as_deal_terms(p: &Parties) -> ancora_deal::DealTerms {
    let t = terms(p);
    let mut milestones = Vec::new(&p.w.e);
    for m in t.milestones.iter() {
        milestones.push_back(ancora_deal::MilestoneTerms {
            label: m.label,
            amount: m.amount,
        });
    }
    ancora_deal::DealTerms {
        asset: t.asset,
        milestones,
        objection_seconds: t.objection_seconds,
        arbiter: t.arbiter,
        document_hash: t.document_hash,
    }
}

/// `who` signs exactly one call to `org`.
fn signed<'a>(org: &'a Address, function: &'a str, args: Vec<Val>) -> MockAuthInvoke<'a> {
    MockAuthInvoke {
        contract: org,
        fn_name: function,
        args,
        sub_invokes: &[],
    }
}

/// `requester` proposes the action; each approver approves with their own signature; the
/// objection window passes if there is one; returns the request id.
fn run(
    p: &Parties,
    org: &OrganizationClient<'static>,
    requester: &Address,
    approvers: &[&Address],
    action: DealAction,
) -> u64 {
    let deal_call = call(p, action);
    let propose = signed(
        &org.address,
        "propose_deal",
        (requester.clone(), deal_call.clone()).into_val(&p.w.e),
    );
    let id = org
        .mock_auths(&[MockAuth {
            address: requester,
            invoke: &propose,
        }])
        .propose_deal(requester, &deal_call);
    for approver in approvers {
        let approve = signed(
            &org.address,
            "approve",
            ((*approver).clone(), id).into_val(&p.w.e),
        );
        org.mock_auths(&[MockAuth {
            address: approver,
            invoke: &approve,
        }])
        .approve(approver, &id);
    }
    if org.request(&id).status == Status::Scheduled {
        p.w.e
            .ledger()
            .set_timestamp(p.w.e.ledger().timestamp() + WINDOW);
        org.execute(&id);
    }
    id
}

#[test]
fn a_party_acts_in_a_deal_only_once_its_own_rules_are_met() {
    let p = parties();
    // Nobody can act for the organization directly: it has no signer of its own.
    assert!(p
        .deals
        .try_create(&p.a.address, &p.b.address, &as_deal_terms(&p))
        .is_err());
    // A board member proposes the deal: a change under A's rules (two board members and a
    // 48-hour window). Until they are met, no deal exists.
    let [bo, bea] = &p.a_board;
    let deal_call = call(&p, DealAction::Create(p.b.address.clone(), terms(&p)));
    let propose = signed(
        &p.a.address,
        "propose_deal",
        (bo.clone(), deal_call.clone()).into_val(&p.w.e),
    );
    let request =
        p.a.mock_auths(&[MockAuth {
            address: bo,
            invoke: &propose,
        }])
        .propose_deal(bo, &deal_call);
    assert_eq!(p.a.request(&request).status, Status::Pending);
    assert_eq!(p.deals.deals_of(&p.a.address).len(), 0);
    // One approval isn't enough either.
    let approve = signed(
        &p.a.address,
        "approve",
        (p.w.founder.clone(), request).into_val(&p.w.e),
    );
    p.a.mock_auths(&[MockAuth {
        address: &p.w.founder,
        invoke: &approve,
    }])
    .approve(&p.w.founder, &request);
    assert_eq!(p.deals.deals_of(&p.a.address).len(), 0);
    // With the second approval and the window passed, A's contract creates the deal itself.
    let approve = signed(
        &p.a.address,
        "approve",
        (bea.clone(), request).into_val(&p.w.e),
    );
    p.a.mock_auths(&[MockAuth {
        address: bea,
        invoke: &approve,
    }])
    .approve(bea, &request);
    p.w.e
        .ledger()
        .set_timestamp(p.w.e.ledger().timestamp() + WINDOW);
    p.a.execute(&request);
    assert_eq!(p.a.request(&request).status, Status::Executed);
    let deal = p.deals.deal(&1);
    assert_eq!(deal.status, DealStatus::Draft);
    assert_eq!(deal.party_a, p.a.address);
}

#[test]
fn two_organizations_settle_a_deal_under_their_own_rules() {
    let p = parties();
    let [bo, bea] = &p.a_board;
    let [b1, b2] = &p.b_board;
    let founder = p.w.founder.clone();
    let create = DealAction::Create(p.b.address.clone(), terms(&p));
    run(&p, &p.a, bo, &[&founder, bea], create);
    run(&p, &p.b, b1, &[&p.b_founder, b2], DealAction::Accept(1));
    assert_eq!(p.deals.deal(&1).status, DealStatus::Accepted);

    // Depositing 1,000 is a payment in A's second tier: one board member besides the requester.
    let before = p.w.token_client.balance(&p.a.address);
    let fund = run(&p, &p.a, bo, &[bea], DealAction::Fund(1));
    assert_eq!(p.a.request(&fund).status, Status::Executed);
    assert_eq!(p.deals.deal(&1).status, DealStatus::Funded);
    assert_eq!(
        p.w.token_client.balance(&p.a.address),
        before - euros(1_000)
    );
    assert_eq!(p.a.available(&p.w.token), before - euros(1_000));

    run(
        &p,
        &p.b,
        b1,
        &[&p.b_founder, b2],
        DealAction::RequestRelease(1, 0),
    );
    run(&p, &p.a, bo, &[bea], DealAction::ApproveRelease(1, 0));
    assert_eq!(p.w.token_client.balance(&p.b.address), euros(600));
    assert_eq!(p.deals.deal(&1).status, DealStatus::Active);
}

#[test]
fn a_pending_deposit_holds_the_money_back_and_a_decline_frees_it() {
    let p = parties();
    let [bo, bea] = &p.a_board;
    let [b1, b2] = &p.b_board;
    let founder = p.w.founder.clone();
    run(
        &p,
        &p.a,
        bo,
        &[&founder, bea],
        DealAction::Create(p.b.address.clone(), terms(&p)),
    );
    run(&p, &p.b, b1, &[&p.b_founder, b2], DealAction::Accept(1));
    let before = p.a.available(&p.w.token);
    let fund = run(&p, &p.a, bo, &[], DealAction::Fund(1));
    assert_eq!(p.a.request(&fund).status, Status::Pending);
    assert_eq!(p.a.available(&p.w.token), before - euros(1_000));
    let decline = signed(
        &p.a.address,
        "decline",
        (bea.clone(), fund).into_val(&p.w.e),
    );
    p.a.mock_auths(&[MockAuth {
        address: bea,
        invoke: &decline,
    }])
    .decline(bea, &fund);
    assert_eq!(p.a.available(&p.w.token), before);
    assert_eq!(p.deals.deal(&1).status, DealStatus::Accepted);
}

#[test]
fn a_refused_deal_step_marks_the_request_failed_with_the_deals_reason() {
    let p = parties();
    let [b1, b2] = &p.b_board;
    // B tries to accept a deal that doesn't exist: deal error 1 (not found) is recorded.
    let id = run(&p, &p.b, b1, &[&p.b_founder, b2], DealAction::Accept(9));
    let request = p.b.request(&id);
    assert_eq!(request.status, Status::Failed);
    assert_eq!(request.failure, Some(1_001));
}

#[test]
fn a_direct_deposit_during_setup_leaves_nothing_held_back() {
    let w = club(5_000);
    let deals = RealDealsClient::new(&w.e, &w.e.register(Deals, ()));
    let party_b = Address::generate(&w.e);
    let direct = |action: DealAction| {
        w.org.deal_directly(
            &w.founder,
            &DealCall {
                deals: deals.address.clone(),
                action,
                reserved_token: None,
                reserved_amount: 0,
            },
        );
    };
    let terms = DealTerms {
        asset: w.token.clone(),
        milestones: Vec::from_array(
            &w.e,
            [MilestoneTerms {
                label: String::from_str(&w.e, "Hull"),
                amount: euros(600),
            }],
        ),
        objection_seconds: 86_400,
        arbiter: None,
        document_hash: BytesN::from_array(&w.e, &[8u8; 32]),
    };
    direct(DealAction::Create(party_b, terms));
    let id = deals.deals_of(&w.org.address).get_unchecked(0).id;
    deals.accept(&id);
    direct(DealAction::Fund(id));
    assert_eq!(w.token_client.balance(&w.org.address), euros(4_400));
    // What is available is exactly what the account holds: nothing stays held back.
    assert_eq!(w.org.available(&w.token), euros(4_400));
}
