import { RequestError } from "./http.js";

// OpenZeppelin Relayer Channels: channel accounts supply sequence numbers and pay the fees.
// The protocol is one authenticated POST, so a few lines replace the official client
// (which would pull in a second Stellar SDK, axios and more).

export type ChannelsResult = { transactionId: string | null; hash: string | null; status: string };

type ChannelsResponse = {
	success?: boolean;
	data?: Partial<ChannelsResult>;
	error?: string;
};

export async function submitToChannels(
	baseUrl: string,
	apiKey: string,
	params: { func: string; auth: string[] },
): Promise<ChannelsResult> {
	let body: ChannelsResponse;
	try {
		const response = await fetch(baseUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify({ params }),
		});
		body = (await response.json()) as ChannelsResponse;
	} catch {
		throw new RequestError("The fee sponsor is unreachable right now. Try again shortly.", 502);
	}
	if (!body.success || !body.data) {
		throw new RequestError(body.error ?? "The fee sponsor could not submit the transaction.", 502);
	}
	return {
		transactionId: body.data.transactionId ?? null,
		hash: body.data.hash ?? null,
		status: body.data.status ?? "submitted",
	};
}
