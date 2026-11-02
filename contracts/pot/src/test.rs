extern crate std;

use ancora_pot_auditors::{PotAuditors, PotAuditorsClient};
use ancora_pot_verifier::PotVerifier;
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token::StellarAssetClient,
    xdr::ToXdr,
    Address, Bytes, BytesN, Env, IntoVal,
};
use stellar_confidential::storage::{RegisterData, RegisterPayload};

use crate::{Pot, PotClient};

// A real register proof (test-vectors/confidential) made for this pot address and this account.
const POT: &str = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const ACCOUNT: &str = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const PROOF: &[u8] = include_bytes!("../../test-vectors/confidential/register.proof");
const INPUTS: &[u8] = include_bytes!("../../test-vectors/confidential/register.inputs.bin");

struct World<'a> {
    e: Env,
    pot: PotClient<'a>,
    asset: StellarAssetClient<'a>,
    account: Address,
}

fn world<'a>() -> World<'a> {
    let e = Env::default();
    e.cost_estimate().budget().reset_unlimited();
    let issuer = Address::generate(&e);
    let asset = e.register_stellar_asset_contract_v2(issuer).address();
    let verifier = e.register(PotVerifier, ());
    let auditors = e.register(PotAuditors, ());
    // Auditor number 0: any point on the curve will do here, so the test reuses the spending key.
    let key: [u8; 64] = INPUTS[0..64].try_into().unwrap_or([0; 64]);
    PotAuditorsClient::new(&e, &auditors)
        .mock_all_auths()
        .register_key(&0, &BytesN::from_array(&e, &key), &Address::generate(&e));
    let pot = Address::from_str(&e, POT);
    e.register_at(&pot, Pot, (asset.clone(), verifier, auditors));
    World {
        pot: PotClient::new(&e, &pot),
        asset: StellarAssetClient::new(&e, &asset),
        account: Address::from_str(&e, ACCOUNT),
        e,
    }
}

fn register_data(e: &Env) -> Bytes {
    let y: [u8; 64] = INPUTS[0..64].try_into().unwrap_or([0; 64]);
    let pvk: [u8; 64] = INPUTS[64..128].try_into().unwrap_or([0; 64]);
    RegisterData {
        payload: RegisterPayload {
            y: BytesN::from_array(e, &y),
            pvk: BytesN::from_array(e, &pvk),
        },
        proof: Bytes::from_slice(e, PROOF),
    }
    .to_xdr(e)
}

#[test]
fn registers_with_a_real_proof_and_takes_deposits() {
    let w = world();
    w.e.mock_all_auths();
    w.pot.register(&w.account, &0, &register_data(&w.e));
    let account = w.pot.confidential_balance(&w.account);
    assert_eq!(account.spending_public_key.to_array()[..], INPUTS[0..64]);
    assert_eq!(w.pot.asset(), w.asset.address);

    let payer = Address::generate(&w.e);
    w.asset.mint(&payer, &500);
    w.pot.deposit(&payer, &w.account, &500);
    // A deposit is public: it lands as 500·G in the receiving balance, blinding 0.
    let after = w.pot.confidential_balance(&w.account);
    assert_ne!(after.receiving_commitment.to_array(), [0u8; 64]);
    assert_eq!(w.asset.balance(&w.pot.address), 500);
}

#[test]
fn refuses_a_proof_made_for_another_account() {
    let w = world();
    w.e.mock_all_auths();
    let someone_else = Address::generate(&w.e);
    assert!(w
        .pot
        .try_register(&someone_else, &0, &register_data(&w.e))
        .is_err());
}

#[test]
fn registering_needs_the_accounts_own_auth() {
    let w = world();
    let data = register_data(&w.e);
    assert!(w.pot.try_register(&w.account, &0, &data).is_err());
    let intruder = Address::generate(&w.e);
    let invoke = MockAuthInvoke {
        contract: &w.pot.address,
        fn_name: "register",
        args: (w.account.clone(), 0u32, data.clone()).into_val(&w.e),
        sub_invokes: &[],
    };
    assert!(w
        .pot
        .mock_auths(&[MockAuth {
            address: &intruder,
            invoke: &invoke
        }])
        .try_register(&w.account, &0, &data)
        .is_err());
}
