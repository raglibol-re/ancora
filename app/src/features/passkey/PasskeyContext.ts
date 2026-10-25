import { createContext, useContext } from "react";

export type SignaturePrompt = {
	/** What is being signed, in plain words ("Approve €450.00 to Lisbon Boat Supplies"). */
	title: string;
	/** "passkey" for everyday signatures, "seal" for the quantum-safe security seal. */
	kind: "passkey" | "seal";
};

export type ConfirmSignature = (prompt: SignaturePrompt) => Promise<boolean>;

export const PasskeyContext = createContext<ConfirmSignature | null>(null);

export function useConfirmSignature(): ConfirmSignature {
	const confirm = useContext(PasskeyContext);
	if (!confirm) throw new Error("useConfirmSignature must be used inside <PasskeyProvider>.");
	return confirm;
}
