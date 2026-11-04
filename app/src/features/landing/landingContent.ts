import { msg } from "../../ui/i18n.ts";

// The landing page's copy, kept apart from its layout. Translated with t() where it is shown.

export const features = [
	{
		title: msg("Your passkey is your account"),
		body: msg(
			"Face ID or a fingerprint creates your own account on Stellar. Its address is your ancora ID: one identity for every organization you belong to, no seed phrase to lose.",
		),
	},
	{
		title: msg("Rules the organization enforces itself"),
		body: msg(
			"Each organization is its own contract. Approval tiers, four-eyes, objection windows and new-recipient checks run on-chain, and the rules are one readable document whose fingerprint the contract stores.",
		),
	},
	{
		title: msg("Several stablecoins, one account"),
		body: msg(
			"EURC, USDC and more side by side, each with its own balance. Rules are written in your home currency; adding a stablecoin is a decision the organization takes together.",
		),
	},
	{
		title: msg("A Reserve, not a savings account"),
		body: msg(
			"Idle money goes into a DeFindex vault on Stellar with one tap and comes back whenever you need it. Earnings are variable and come from Blend lending, not from the stablecoin itself. Not a bank deposit, not insured.",
		),
	},
	{
		title: msg("A security seal for large payments"),
		body: msg(
			"Above a threshold the organization sets, a payment needs an extra seal from an approver. Organizations can require it to be signed with a quantum-safe ML-DSA key that never leaves the approving device; the organization checks it on Stellar before the money moves.",
		),
	},
	{
		title: msg("Private where it matters"),
		body: msg(
			"Payment references, recipients and discussions are stored encrypted, so only your members and the auditors you choose can read them. Amounts stay verifiable on the ledger.",
		),
	},
	{
		title: msg("Work with other organizations"),
		body: msg(
			"Agree milestones with a supplier or partner, deposit up front and release each payment when the work is delivered. Both sides decide under their own approval rules.",
		),
	},
	{
		title: msg("Decide together"),
		body: msg(
			"Reasons for and against, questions and comments on every request, with thumbs up and down. Approvers see what the group thinks before they sign.",
		),
	},
];

export const steps = [
	{
		title: msg("Create your passkey"),
		body: msg(
			"Thirty seconds, no app store, no seed phrase. Your pass shows your ancora ID and a QR code others use to invite you.",
		),
	},
	{
		title: msg("Create or join an organization"),
		body: msg(
			"Pick a template (club, company, team), the currency of the rules and the stablecoins you accept. Invite people by their ancora ID.",
		),
	},
	{
		title: msg("Pay, approve, earn"),
		body: msg(
			"Send money from your wallet or any Stellar wallet, approve on the go, keep the rest in the Reserve. Fees are sponsored.",
		),
	},
];

export const principles = [
	{
		title: msg("Non-custodial"),
		body: msg("We never hold an organization's money or a key to it. The organization does."),
	},
	{
		title: msg("Rules you can read"),
		body: msg(
			"Every rule is written in plain language, and anyone can check it is the one the account enforces.",
		),
	},
	{
		title: msg("Honest about money"),
		body: msg(
			"ancora is not a bank. We say what is insured (nothing), what earnings depend on, and what is still a preview.",
		),
	},
	{
		title: msg("Open by default"),
		body: msg(
			"The code is open source under Apache-2.0, so any organization or reviewer can see how it works.",
		),
	},
];

// Illustrative scenarios with fictional organizations (the first two are also the app's sample
// data), not customer results: the page labels them as such.
export const caseStudies = [
	{
		kind: msg("Sports club"),
		name: "Tejo Rowing Club",
		challenge: msg(
			"The treasurer pays from a personal card and the board approves in a group chat. When the treasurer is away, nothing gets paid, and members can't see where their fees go.",
		),
		approach: msg(
			"Payments above €500 need two board members. The boathouse shop has a small weekly allowance, equipment has its own budget, and members see the reasons for and against each larger request.",
		),
		outcome: msg(
			"No single person holds the club's money, routine buys don't wait for the board, and the yearly report comes from the ledger.",
		),
	},
	{
		kind: msg("Company"),
		name: "Maré Labs Lda",
		challenge: msg(
			"A twelve-person design studio pays freelancers in several countries. The founders sign off on every invoice, and new bank details arrive by email.",
		),
		approach: msg(
			"Small invoices go out on a team lead's approval, larger ones need a director, and a new recipient waits out an objection window. Supplier work runs as a deal paid milestone by milestone; idle cash sits in the Reserve.",
		),
		outcome: msg(
			"Founders approve only what matters, a forged invoice can't be paid in a hurry, and suppliers are paid the moment their work is accepted.",
		),
	},
	{
		kind: msg("NGO"),
		name: "Rio Aberto Aid",
		challenge: msg(
			"Field teams need to spend quickly, while donors want proof that each grant is used as agreed. The reports are pieced together from receipts months later.",
		),
		approach: msg(
			"Each field coordinator has a spending limit, each programme a hard budget. Payment details are encrypted, and the donor's auditor gets read access to exactly what they review.",
		),
		outcome: msg(
			"Money moves fast within limits the board set, and donors check the spending themselves instead of waiting for a report.",
		),
	},
];

export const milestones = [
	{
		status: msg("Live on testnet"),
		live: true,
		title: msg("Preview"),
		body: msg(
			"Every feature works on the Stellar test network with test money. Eight end-to-end flows run against the live site every night.",
		),
	},
	{
		status: msg("Next"),
		live: false,
		title: msg("Proven on testnet"),
		body: msg(
			"Reproducible, attested releases, monitoring with alerts, and full account history beyond the network's one-week window.",
		),
	},
	{
		status: msg("Planned"),
		live: false,
		title: msg("Privacy and keys"),
		body: msg(
			"The confidential pot leaves preview, approval tiers work for hidden amounts, and succession sends reminders before anyone can claim.",
		),
	},
	{
		status: msg("Planned"),
		live: false,
		title: msg("Ready for mainnet"),
		body: msg(
			"An external security review of every contract, a licensed partner for euro bank transfers, and the first pilot organizations with real money.",
		),
	},
];

export const faqs = [
	{
		question: msg("Can my organization use ancora today?"),
		answer: msg(
			"You can try every feature now on the Stellar test network. Its money is test money with no value. Real money comes with mainnet, after the external security review.",
		),
	},
	{
		question: msg("Is ancora a bank?"),
		answer: msg(
			"No. ancora is software for an account your organization controls on Stellar. Balances are not deposit-insured. Bank transfers and business verification are handled by licensed payment partners.",
		),
	},
	{
		question: msg("Who can move our money?"),
		answer: msg(
			"Only your organization, under its own rules. ancora holds no key to any organization's account, and the operator that pays network fees has no role in it.",
		),
	},
	{
		question: msg("What does it cost?"),
		answer: msg(
			"Nothing during the preview, and network fees are sponsored. Pricing will be published before the mainnet launch.",
		),
	},
	{
		question: msg("How do we join the pilot?"),
		answer: msg(
			"Tell us about your organization on GitHub. We are looking for clubs, NGOs and small companies that want to run real payments under their own rules once mainnet opens.",
		),
	},
];

export const REPOSITORY = "https://github.com/raglibol-re/ancora";
export const ROADMAP = `${REPOSITORY}/blob/main/docs/ROADMAP.md`;
export const PILOT_REQUEST = `${REPOSITORY}/issues/new?title=${encodeURIComponent("Pilot request: ")}`;
