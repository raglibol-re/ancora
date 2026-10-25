import { Link } from "react-router";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { InstallHint } from "../install/InstallHint.tsx";
import styles from "./LandingPage.module.css";

const pillars = [
	{
		title: "No seed phrase",
		body: "Sign in and approve with Face ID or your fingerprint. Lose a phone, not the account.",
	},
	{
		title: "Your rules, enforced",
		body: "Who approves what, from which amount, with objection windows. The account itself checks every payment.",
	},
	{
		title: "Idle money in the Reserve",
		body: "Move what you don't need today into the Reserve. Earnings are variable and shown daily.",
	},
];

export function LandingPage() {
	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<BrandMark />
				<Link to="/app" className={buttonClass("secondary")}>
					Open app
				</Link>
			</header>

			<main className={styles.main}>
				<section className={styles.hero}>
					<h1>The finance account for your organization.</h1>
					<p className={styles.lead}>
						For clubs, companies, NGOs and teams. It feels like a modern banking app; your rules are
						enforced by the account itself, running on Stellar.
					</p>
					<div className={styles.actions}>
						<Link to="/app" className={buttonClass()}>
							Open ancora
						</Link>
						<InstallHint />
					</div>
				</section>

				<section className={styles.pillars} aria-label="What ancora does">
					{pillars.map((pillar) => (
						<article key={pillar.title} className={styles.pillar}>
							<h2>{pillar.title}</h2>
							<p>{pillar.body}</p>
						</article>
					))}
				</section>
			</main>

			<footer className={styles.footer}>
				ancora is not a bank. Balances are not deposit-insured. This demo runs on the Stellar
				testnet.
			</footer>
		</div>
	);
}
