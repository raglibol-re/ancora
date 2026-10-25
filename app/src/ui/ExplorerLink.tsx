import type { ReactNode } from "react";
import styles from "./ExplorerLink.module.css";
import { explorerUrl } from "./explorerUrl.ts";

type ExplorerLinkProps = {
	/** A transaction hash, or an account / contract address (G… / C…). */
	target: string;
	children?: ReactNode;
};

/** Opens a transaction, account or contract on stellar.expert (testnet). */
export function ExplorerLink({ target, children }: ExplorerLinkProps) {
	return (
		<a className={styles.link} href={explorerUrl(target)} target="_blank" rel="noreferrer">
			{children ?? "View on Stellar"}
		</a>
	);
}
