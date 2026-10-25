import type { ActivityEntry, OrgAccount, Person, Workspace } from "../../domain/account.ts";
import type { AssetOption } from "../../domain/dataSource.ts";
import { dollars, euros } from "../../domain/money.ts";
import type { Member, RoleId, TemplateId } from "../../domain/rules/model.ts";
import { evaluatePayment } from "../../domain/rules/policy.ts";
import type { PaymentRequest } from "../../domain/rules/requests.ts";
import { templates } from "../../domain/rules/templates.ts";

// Fictional organizations and people for the labeled sample mode. Times are relative to `now`
// so the demo always looks current.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const SAMPLE_DEFAULT_PERSON = "ines";

/** The stablecoins sample organizations can accept; labels only, nothing is on Stellar. */
export const SAMPLE_ASSETS: readonly AssetOption[] = [
	{ token: "eurc", symbol: "EURC", currency: "EUR", vault: "sample-vault", label: "EURC (EUR)" },
	{ token: "usdc", symbol: "USDC", currency: "USD", vault: "sample-vault", label: "USDC (USD)" },
];
const EURC = "eurc";
const USDC = "usdc";

/** Fictional people, shared with the testnet adapter as its directory of invitable people. */
export const samplePeople: readonly Person[] = [
	{ id: "ines", name: "Inês Duarte" },
	{ id: "tomas", name: "Tomás Ferreira" },
	{ id: "marta", name: "Marta Silva" },
	{ id: "joao", name: "João Pereira" },
	{ id: "sofia", name: "Sofia Costa" },
	{ id: "rui", name: "Rui Almeida" },
	{ id: "ana", name: "Ana Rocha" },
	{ id: "lea", name: "Lea Martins" },
	{ id: "noah", name: "Noah Becker" },
];

function account(
	id: string,
	name: string,
	templateId: TemplateId,
	members: [string, RoleId][],
	rest: Omit<OrgAccount, "org" | "onchain">,
): OrgAccount {
	const template = templates[templateId];
	const memberList: Member[] = members.map(([personId, roleId]) => ({ personId, roleId }));
	return {
		org: {
			id,
			name,
			templateId,
			roles: template.roles,
			members: memberList,
			policy: template.policy,
			founderId: members[0]?.[0] ?? "",
			baseCurrency: "EUR",
			assets: SAMPLE_ASSETS.map(({ token, symbol, currency, vault }) => ({
				token,
				symbol,
				currency,
				vault,
			})),
		},
		onchain: null,
		...rest,
	};
}

type SeedPayment = Pick<
	PaymentRequest,
	"id" | "requesterId" | "createdAt" | "amount" | "recipientId" | "recipientIsNew" | "note"
> &
	Partial<Pick<PaymentRequest, "approvals" | "status" | "executeAfter">>;

function payment(templateId: TemplateId, fields: SeedPayment): PaymentRequest {
	return {
		kind: "payment",
		token: EURC,
		currency: "EUR",
		evaluation: evaluatePayment(templates[templateId].policy, fields),
		approvals: [],
		status: "pending",
		executeAfter: null,
		sealedBy: null,
		declinedBy: null,
		failure: null,
		executionRef: null,
		...fields,
	};
}

const entry = (e: ActivityEntry) => e;

export function seedWorkspace(now: number): Workspace {
	const club = account(
		"tejo-rowing",
		"Tejo Rowing Club",
		"club",
		[
			["ines", "treasurer"],
			["tomas", "board"],
			["marta", "board"],
			["joao", "member"],
		],
		{
			balances: [
				{ token: EURC, balance: euros(12_480), reserve: euros(20_000) },
				{ token: USDC, balance: dollars(1_250), reserve: 0 },
			],
			reserveRateBps: 410,
			accountNumber: {
				iban: "PT50 0000 0000 0000 0000 1234 5",
				bic: "SMPLPTPL",
				holder: "Tejo Rowing Club",
			},
			logoUrl: null,
			payees: [
				{
					id: "boat-supplies",
					name: "Lisbon Boat Supplies",
					account: "PT50 0000 0000 0000 0000 7788 1",
				},
				{
					id: "regatta-assoc",
					name: "Regatta Association",
					account: "PT50 0000 0000 0000 0000 4410 9",
				},
			],
			requests: [
				payment("club", {
					id: "req-oars",
					requesterId: "joao",
					createdAt: now - 3 * HOUR,
					amount: euros(450),
					recipientId: "boat-supplies",
					recipientIsNew: false,
					note: "Two pairs of sculling oars",
				}),
				payment("club", {
					id: "req-regatta",
					requesterId: "ines",
					createdAt: now - 20 * HOUR,
					amount: euros(3_200),
					recipientId: "regatta-assoc",
					recipientIsNew: false,
					note: "Spring regatta entry fees",
					approvals: [
						{ personId: "tomas", at: now - 19 * HOUR },
						{ personId: "marta", at: now - 18 * HOUR },
					],
					status: "scheduled",
					executeAfter: now + 30 * HOUR,
				}),
			],
			activity: [
				entry({
					id: "a1",
					at: now - 2 * DAY,
					actorId: null,
					kind: "deposit",
					token: EURC,
					amount: euros(2_400),
					from: "Membership fees (SEPA)",
					txHash: null,
				}),
				entry({
					id: "a2",
					at: now - 4 * DAY,
					actorId: "ines",
					kind: "payment-out",
					token: EURC,
					amount: euros(180),
					payeeId: "boat-supplies",
					txHash: null,
				}),
				entry({
					id: "a3",
					at: now - 6 * DAY,
					actorId: "ines",
					kind: "reserve-in",
					token: EURC,
					amount: euros(5_000),
				}),
				entry({
					id: "a4",
					at: now - 1 * DAY,
					actorId: null,
					kind: "earnings",
					token: EURC,
					amount: 224,
				}),
			],
		},
	);

	const company = account(
		"mare-labs",
		"Maré Labs Lda",
		"company",
		[
			["sofia", "director"],
			["ines", "director"],
			["rui", "finance"],
			["ana", "employee"],
		],
		{
			balances: [
				{ token: EURC, balance: euros(84_200), reserve: euros(150_000) },
				{ token: USDC, balance: dollars(18_300), reserve: 0 },
			],
			reserveRateBps: 410,
			accountNumber: {
				iban: "PT50 0000 0000 0000 0000 5566 2",
				bic: "SMPLPTPL",
				holder: "Maré Labs Lda",
			},
			logoUrl: null,
			payees: [
				{ id: "cloud-co", name: "Nimbus Cloud Hosting", account: "IE00 0000 0000 0000 0000 21" },
				{ id: "studio-luz", name: "Studio Luz Design", account: "PT50 0000 0000 0000 0000 3302 7" },
			],
			requests: [
				payment("company", {
					id: "req-hosting",
					requesterId: "rui",
					createdAt: now - 1 * HOUR,
					amount: euros(12_500),
					recipientId: "cloud-co",
					recipientIsNew: true,
					note: "Annual hosting contract",
				}),
				payment("company", {
					id: "req-design",
					requesterId: "rui",
					createdAt: now - 5 * HOUR,
					amount: euros(60_000),
					recipientId: "studio-luz",
					recipientIsNew: false,
					note: "Brand and product design, phase 2",
					approvals: [{ personId: "sofia", at: now - 4 * HOUR }],
				}),
			],
			activity: [
				entry({
					id: "b1",
					at: now - 1 * DAY,
					actorId: null,
					kind: "deposit",
					token: EURC,
					amount: euros(42_000),
					from: "Client invoice 2026-031 (SEPA)",
					txHash: null,
				}),
				entry({
					id: "b2",
					at: now - 3 * DAY,
					actorId: "rui",
					kind: "payment-out",
					token: EURC,
					amount: euros(8_400),
					payeeId: "studio-luz",
					txHash: null,
				}),
				entry({
					id: "b3",
					at: now - 1 * DAY,
					actorId: null,
					kind: "earnings",
					token: EURC,
					amount: 1_685,
				}),
			],
		},
	);

	const team = account(
		"meridian-team",
		"Meridian Hack Team",
		"team",
		[
			["lea", "lead"],
			["ines", "member"],
			["noah", "member"],
		],
		{
			balances: [
				{ token: EURC, balance: euros(1_850), reserve: 0 },
				{ token: USDC, balance: 0, reserve: 0 },
			],
			reserveRateBps: 410,
			accountNumber: null,
			logoUrl: null,
			payees: [
				{ id: "hw-shop", name: "Byte Hardware", account: "PT50 0000 0000 0000 0000 9081 4" },
			],
			requests: [
				payment("team", {
					id: "req-hardware",
					requesterId: "noah",
					createdAt: now - 2 * HOUR,
					amount: euros(600),
					recipientId: "hw-shop",
					recipientIsNew: false,
					note: "Demo hardware",
				}),
			],
			activity: [
				entry({
					id: "c1",
					at: now - 3 * DAY,
					actorId: null,
					kind: "deposit",
					token: EURC,
					amount: euros(2_000),
					from: "Sponsor grant",
					txHash: null,
				}),
				entry({
					id: "c2",
					at: now - 2 * DAY,
					actorId: "noah",
					kind: "payment-out",
					token: EURC,
					amount: euros(150),
					payeeId: "hw-shop",
					txHash: null,
				}),
			],
		},
	);

	return { people: samplePeople, accounts: [club, company, team] };
}
