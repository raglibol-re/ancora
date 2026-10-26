import { Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { resolveTokenReference } from "./tokenInspect.ts";

// Circle's testnet EURC, as listed in scripts/setup-testnet.sh and app/.env.testnet.
const EURC_ISSUER = "GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO";
const EURC_CONTRACT = "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ";

describe("resolveTokenReference", () => {
	it("maps a classic CODE:ISSUER to its Stellar Asset Contract on the given network", () => {
		expect(resolveTokenReference(`EURC:${EURC_ISSUER}`, Networks.TESTNET)).toBe(EURC_CONTRACT);
		// Codes are case-sensitive on Stellar, so only whitespace is forgiven.
		expect(resolveTokenReference(` EURC:${EURC_ISSUER} `, Networks.TESTNET)).toBe(EURC_CONTRACT);
	});

	it("passes a contract address through and rejects anything else", () => {
		expect(resolveTokenReference(EURC_CONTRACT, Networks.TESTNET)).toBe(EURC_CONTRACT);
		expect(resolveTokenReference("USDC", Networks.TESTNET)).toBeNull();
		expect(resolveTokenReference("USDC:not-an-issuer", Networks.TESTNET)).toBeNull();
		expect(
			resolveTokenReference(
				"GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO",
				Networks.TESTNET,
			),
		).toBeNull();
	});
});
