/**
 * smart-account-kit derives the WebAuthn user id from this name plus a timestamp and a random
 * number, and WebAuthn caps the id at 64 bytes. 24 bytes of name leaves room for the rest, so
 * creation never fails on a long or accented organization name. The device shows this as the
 * passkey's name, so the organization name is the useful choice.
 */
const MAX_BYTES = 24;

export function passkeyUserName(orgName: string): string {
	const encoder = new TextEncoder();
	let name = orgName.trim() || "ancora";
	while (encoder.encode(name).length > MAX_BYTES) name = name.slice(0, -1);
	return name;
}
