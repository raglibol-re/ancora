import { useState } from "react";
import { Link } from "react-router";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { InstallHint } from "../install/InstallHint.tsx";
import styles from "./LandingPage.module.css";

const features = [
	{
		title: "Your passkey is your account",
		body: "Face ID or a fingerprint creates your own account on Stellar. Its address is your ancora ID: one identity for every organization you belong to, no seed phrase to lose.",
		status: "Real on testnet",
	},
	{
		title: "Rules the organization enforces itself",
		body: "Each organization is its own contract. Approval tiers, four-eyes, objection windows and new-recipient checks run on-chain, and the rules are one readable document whose fingerprint the contract stores.",
		status: "Real on testnet",
	},
	{
		title: "Several stablecoins, one account",
		body: "EURC, USDC and more side by side, each with its own balance. Rules are written in your home currency; adding a stablecoin is a decision the organization takes together.",
		status: "Real on testnet",
	},
	{
		title: "A Reserve, not a savings account",
		body: "Idle money goes into a DeFindex vault on Stellar with one tap and comes back whenever you need it. Earnings are variable and come from Blend lending, not from the stablecoin itself. Not a bank deposit, not insured.",
		status: "Real on testnet (BlendUSDC)",
	},
	{
		title: "Quantum-safe security seal",
		body: "Large payments need an extra seal. ancora's ML-DSA verifier already runs on Stellar, ready for the day today's signatures can be forged.",
		status: "Verifier on testnet",
	},
	{
		title: "Decide together",
		body: "Reasons for and against, questions and comments on every request, with thumbs up and down. Approvers see what the group thinks before they sign.",
		status: "Real",
	},
];

const steps = [
	{
		title: "Create your passkey",
		body: "Thirty seconds, no app store, no seed phrase. Your pass shows your ancora ID and a QR code others use to invite you.",
	},
	{
		title: "Create or join an organization",
		body: "Pick a template (club, company, team), the currency of the rules and the stablecoins you accept. Invite people by their ancora ID.",
	},
	{
		title: "Pay, approve, earn",
		body: "Send money from your wallet or any Stellar wallet, approve on the go, keep the rest in the Reserve. Fees are sponsored.",
	},
];

const chips = [
	{ label: "€ EURC", className: styles.chipOne },
	{ label: "$ USDC", className: styles.chipTwo },
	{ label: "Quantum-safe", className: styles.chipThree },
	{ label: "⚓ Stellar", className: styles.chipFour },
];

/** Prefers-reduced-motion decides once per visit whether the globe spins and the text rises in. */
function prefersMotion(): boolean {
	return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LandingPage() {
	const [motion] = useState(prefersMotion);
	const [videoReady, setVideoReady] = useState(false);

	return (
		<div className={`${styles.page} ${motion ? styles.animated : ""}`}>
			<section className={styles.hero}>
				<div className={styles.plate} aria-hidden="true">
					<img className={styles.still} src="/landing/globe.jpg" alt="" />
					{motion && (
						<video
							className={`${styles.video} ${videoReady ? styles.videoReady : ""}`}
							src="/landing/globe.mp4"
							muted
							loop
							playsInline
							autoPlay
							preload="auto"
							onCanPlay={() => setVideoReady(true)}
						/>
					)}
					<div className={styles.veil} />
				</div>

				<header className={styles.nav}>
					<Link to="/" className={styles.brand}>
						<BrandMark size={36} />
					</Link>
					<nav className={styles.navLinks} aria-label="Sections">
						<a href="#features">Features</a>
						<a href="#how">How it works</a>
						<a href="#security">Security</a>
						<a href="https://github.com/raglibol-re/ancora" target="_blank" rel="noreferrer">
							Roadmap (GitHub)
						</a>
					</nav>
					<div className={styles.navActions}>
						<Link to="/app" className={[styles.pillOutline, styles.navSignIn].join(" ")}>
							Sign in
						</Link>
						<Link to="/app" className={styles.pillSolid}>
							Get started
						</Link>
					</div>
				</header>

				<div className={styles.center}>
					<p className={styles.badge}>
						<span className={styles.badgeDot} />
						Programmable business account on Stellar
					</p>
					<h1 className={styles.headline}>
						<span className={styles.line}>The business account</span>
						<span className={styles.line}>your organization controls.</span>
					</h1>
					<p className={styles.lead}>
						For clubs, companies, NGOs and teams. One passkey per person, one account per
						organization, rules the account enforces itself.
					</p>
					<div className={styles.ctas}>
						<Link to="/app" className={styles.pillSolid}>
							Get started →
						</Link>
						<a href="#how" className={styles.pillOutline}>
							How it works
						</a>
					</div>
				</div>

				{chips.map((chip) => (
					<span key={chip.label} className={`${styles.chip} ${chip.className}`} aria-hidden="true">
						{chip.label}
					</span>
				))}

				<a href="#features" className={styles.scrollHint} aria-label="Scroll to features">
					<span className={styles.mouse} />
					<span>See how it works</span>
				</a>
			</section>

			<main className={styles.main}>
				<section id="features" className={styles.section}>
					<h2>Everything an organization needs from its account</h2>
					<div className={styles.grid}>
						{features.map((feature) => (
							<article key={feature.title} className={styles.card}>
								<span className={styles.status}>{feature.status}</span>
								<h3>{feature.title}</h3>
								<p>{feature.body}</p>
							</article>
						))}
					</div>
				</section>

				<section id="how" className={styles.section}>
					<h2>How it works</h2>
					<ol className={styles.steps}>
						{steps.map((step, index) => (
							<li key={step.title} className={styles.step}>
								<span className={styles.stepNumber}>{index + 1}</span>
								<h3>{step.title}</h3>
								<p>{step.body}</p>
							</li>
						))}
					</ol>
					<div className={styles.ctas}>
						<Link to="/app" className={styles.pillSolid}>
							Get started
						</Link>
						<InstallHint />
					</div>
				</section>

				<section id="security" className={styles.section}>
					<h2>Built on what Stellar already has</h2>
					<div className={styles.grid}>
						<article className={styles.card}>
							<h3>OpenZeppelin smart accounts</h3>
							<p>
								Your passkey signs through an audited smart account; the private key never leaves
								your device. ancora's operator sponsors fees and holds no role anywhere.
							</p>
						</article>
						<article className={styles.card}>
							<h3>Verifiable rules</h3>
							<p>
								Approval rules are a canonical document. The organization contract stores its
								SHA-256, so anyone can check that what you read is what it enforces.
							</p>
						</article>
						<article className={styles.card}>
							<h3>Non-custodial, labeled honestly</h3>
							<p>
								Nobody but the organization controls its money. Everything simulated is labeled as
								such; this demo runs on the Stellar testnet with test money.
							</p>
						</article>
					</div>
				</section>
			</main>

			<footer className={styles.footer}>
				<BrandMark size={28} />
				<p>
					ancora is not a bank. Balances are not deposit-insured. Built for HackMeridian 2026 on the
					Stellar testnet.
				</p>
			</footer>
		</div>
	);
}
