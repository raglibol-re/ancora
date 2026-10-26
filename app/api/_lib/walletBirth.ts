import { hash, rpc, StrKey, xdr } from "@stellar/stellar-sdk";

// A smart account's "birth": the successful transaction whose CreateContractV2 operation made
// the contract, and the Wasm it was born with. The passkey kit verifies that transaction itself;
// this only finds it, by reading the ledger the wallet first appeared in.

export type WalletBirth = {
	transactionHash: string;
	ledger: number;
	wasmHash: string;
};

const PAGE = 200;

/** The creation of `contractId` in the ledgers just before and at `seenLedger`, if any. */
export async function findWalletBirth(
	server: rpc.Server,
	networkPassphrase: string,
	contractId: string,
	seenLedger: number,
): Promise<WalletBirth | null> {
	let request: rpc.Api.GetTransactionsRequest = {
		startLedger: Math.max(1, seenLedger - 2),
		pagination: { limit: PAGE },
	};
	for (let page = 0; page < 5; page++) {
		const response = await server.getTransactions(request);
		for (const transaction of response.transactions) {
			if (transaction.ledger > seenLedger) return null;
			if (transaction.status !== rpc.Api.GetTransactionStatus.SUCCESS) continue;
			const wasmHash = creationWasm(transaction.envelopeXdr, networkPassphrase, contractId);
			if (wasmHash) {
				return { transactionHash: transaction.txHash, ledger: transaction.ledger, wasmHash };
			}
		}
		if (response.transactions.length < PAGE) return null;
		request = { pagination: { cursor: response.cursor, limit: PAGE } };
	}
	return null;
}

/** The Wasm hash of the CreateContractV2 operation in `envelope` that made `contractId`. */
function creationWasm(
	envelope: xdr.TransactionEnvelope,
	networkPassphrase: string,
	contractId: string,
): string | null {
	for (const operation of operationsOf(envelope)) {
		const body = operation.body();
		if (body.switch().name !== "invokeHostFunction") continue;
		const fn = body.invokeHostFunctionOp().hostFunction();
		if (fn.switch().name !== "hostFunctionTypeCreateContractV2") continue;
		const create = fn.createContractV2();
		if (createdContractId(create, networkPassphrase) !== contractId) continue;
		const executable = create.executable();
		if (executable.switch().name !== "contractExecutableWasm") continue;
		return executable.wasmHash().toString("hex");
	}
	return null;
}

function operationsOf(envelope: xdr.TransactionEnvelope): xdr.Operation[] {
	switch (envelope.switch().name) {
		case "envelopeTypeTxV0":
			return envelope.v0().tx().operations();
		case "envelopeTypeTx":
			return envelope.v1().tx().operations();
		case "envelopeTypeTxFeeBump":
			return envelope.feeBump().tx().innerTx().v1().tx().operations();
		default:
			return [];
	}
}

/** The address a CreateContractV2 operation produces (address-based preimages only). */
function createdContractId(
	create: xdr.CreateContractArgsV2,
	networkPassphrase: string,
): string | null {
	const preimage = create.contractIdPreimage();
	if (preimage.switch().name !== "contractIdPreimageFromAddress") return null;
	const envelope = xdr.HashIdPreimage.envelopeTypeContractId(
		new xdr.HashIdPreimageContractId({
			networkId: hash(Buffer.from(networkPassphrase, "utf8")),
			contractIdPreimage: preimage,
		}),
	);
	return StrKey.encodeContract(hash(envelope.toXDR()));
}
