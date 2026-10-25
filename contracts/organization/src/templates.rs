//! The three starting templates, identical to app/src/domain/rules/templates.ts. Both are
//! checked against contracts/test-vectors/approval-rules.json.

use soroban_sdk::{symbol_short, Env, Symbol, Vec};

use crate::types::{Budget, Policy, Requirement, Tier, CENT};

pub struct Template {
    pub roles: Vec<Symbol>,
    pub policy: Policy,
}

fn req(role: Symbol, count: u32) -> Requirement {
    Requirement { role, count }
}

fn tier(e: &Env, up_to_cents: Option<i128>, approvals: &[Requirement], hours: u32) -> Tier {
    Tier {
        up_to: up_to_cents,
        approvals: Vec::from_slice(e, approvals),
        objection_window_hours: hours,
    }
}

const fn euros(whole: i128) -> i128 {
    whole * 100
}

/// Template with amounts in cents (the unit of the shared vectors), or `None` if unknown.
pub fn template_in_cents(e: &Env, id: &Symbol) -> Option<Template> {
    let club = symbol_short!("club");
    let company = symbol_short!("company");
    let team = symbol_short!("team");
    if *id == club {
        let board = symbol_short!("board");
        return Some(Template {
            roles: Vec::from_array(
                e,
                [
                    Symbol::new(e, "treasurer"),
                    board.clone(),
                    symbol_short!("member"),
                ],
            ),
            policy: Policy {
                tiers: Vec::from_array(
                    e,
                    [
                        tier(e, Some(euros(200)), &[], 0),
                        tier(e, Some(euros(2_000)), &[req(board.clone(), 1)], 0),
                        tier(e, None, &[req(board, 2)], 48),
                    ],
                ),
                seal_threshold: euros(10_000),
                new_recipient_approvals: Vec::new(e),
                budgets: Vec::new(e),
            },
        });
    }
    if *id == company {
        let director = Symbol::new(e, "director");
        return Some(Template {
            roles: Vec::from_array(
                e,
                [
                    director.clone(),
                    symbol_short!("finance"),
                    Symbol::new(e, "employee"),
                ],
            ),
            policy: Policy {
                tiers: Vec::from_array(
                    e,
                    [
                        tier(e, Some(euros(1_000)), &[], 0),
                        tier(e, Some(euros(20_000)), &[req(director.clone(), 1)], 0),
                        tier(e, None, &[req(director.clone(), 2)], 0),
                    ],
                ),
                seal_threshold: euros(50_000),
                new_recipient_approvals: Vec::from_array(e, [req(director, 1)]),
                budgets: Vec::new(e),
            },
        });
    }
    if *id == team {
        let lead = symbol_short!("lead");
        let member = symbol_short!("member");
        return Some(Template {
            roles: Vec::from_array(e, [lead.clone(), member.clone()]),
            policy: Policy {
                tiers: Vec::from_array(
                    e,
                    [
                        tier(e, Some(euros(100)), &[], 0),
                        tier(e, Some(euros(1_000)), &[req(lead.clone(), 1)], 0),
                        tier(e, None, &[req(member, 2), req(lead, 1)], 0),
                    ],
                ),
                seal_threshold: euros(5_000),
                new_recipient_approvals: Vec::new(e),
                budgets: Vec::new(e),
            },
        });
    }
    None
}

/// Template with amounts scaled to token minor units for on-chain use.
pub fn template(e: &Env, id: &Symbol) -> Option<Template> {
    let in_cents = template_in_cents(e, id)?;
    Some(Template {
        roles: in_cents.roles,
        policy: scale_policy(e, &in_cents.policy, CENT),
    })
}

pub fn scale_policy(e: &Env, policy: &Policy, factor: i128) -> Policy {
    let mut tiers = Vec::new(e);
    for t in policy.tiers.iter() {
        tiers.push_back(Tier {
            up_to: t.up_to.map(|v| v * factor),
            approvals: t.approvals.clone(),
            objection_window_hours: t.objection_window_hours,
        });
    }
    let mut budgets = Vec::new(e);
    for b in policy.budgets.iter() {
        budgets.push_back(Budget {
            amount: b.amount * factor,
            ..b
        });
    }
    Policy {
        tiers,
        seal_threshold: policy.seal_threshold * factor,
        new_recipient_approvals: policy.new_recipient_approvals.clone(),
        budgets,
    }
}
