/** stellar.expert (testnet) link for a transaction hash or an account / contract address. */
export function explorerUrl(target: string): string {
	if (/^[GC][A-Z2-7]{55}$/.test(target)) {
		return `https://stellar.expert/explorer/testnet/${target.startsWith("C") ? "contract" : "account"}/${target}`;
	}
	return `https://stellar.expert/explorer/testnet/tx/${target}`;
}
