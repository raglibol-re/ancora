import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { CHANNEL_COUNT, channelKeypair } from "./channels.js";

const operator = Keypair.random();

describe("channelKeypair", () => {
	it("gives every function instance the same channels for the same operator", () => {
		expect(channelKeypair(operator, 3).publicKey()).toBe(channelKeypair(operator, 3).publicKey());
	});

	it("gives each index its own account, none of them the operator", () => {
		const keys = Array.from({ length: CHANNEL_COUNT }, (_, i) => channelKeypair(operator, i));
		const addresses = new Set(keys.map((key) => key.publicKey()));
		expect(addresses.size).toBe(CHANNEL_COUNT);
		expect(addresses.has(operator.publicKey())).toBe(false);
	});

	it("gives another operator other channels", () => {
		expect(channelKeypair(Keypair.random(), 0).publicKey()).not.toBe(
			channelKeypair(operator, 0).publicKey(),
		);
	});
});
