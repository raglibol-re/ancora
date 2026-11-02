// What the pot's errors (OpenZeppelin's ConfidentialTokenError, and the auditor registry's)
// mean for a member; a failed pot request records 2000 + the code.
export const POT_ERROR_MESSAGES: Readonly<Record<number, string>> = {
	3301: "The pot's auditor key isn't registered. Set the pot up again.",
	3500: "This organization already has a pot account.",
	3501: "The other side has no pot account yet. Ask them to open their confidential pot.",
	3506: "The pot didn't accept the proof: the balance changed since the request was made. Make it again.",
	3507: "The pot couldn't read this request's proof. Make it again.",
};
