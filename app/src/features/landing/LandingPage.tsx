import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { msg } from "../../ui/i18n.ts";
import { LanguageSwitch } from "../../ui/LanguageSwitch.tsx";
import { useLanguage, useT } from "../../ui/useLanguage.ts";
import { InstallHint } from "../install/InstallHint.tsx";
import styles from "./LandingPage.module.css";

const features = [
	{
		title: msg("Your passkey is your account"),
		body: msg(
			"Face ID or a fingerprint creates your own account on Stellar. Its address is your ancora ID: one identity for every organization you belong to, no seed phrase to lose.",
		),
	},
	{
		title: msg("Rules the organization enforces itself"),
		body: msg(
			"Each organization is its own contract. Approval tiers, four-eyes, objection windows and new-recipient checks run on-chain, and the rules are one readable document whose fingerprint the contract stores.",
		),
	},
	{
		title: msg("Several stablecoins, one account"),
		body: msg(
			"EURC, USDC and more side by side, each with its own balance. Rules are written in your home currency; adding a stablecoin is a decision the organization takes together.",
		),
	},
	{
		title: msg("A Reserve, not a savings account"),
		body: msg(
			"Idle money goes into a DeFindex vault on Stellar with one tap and comes back whenever you need it. Earnings are variable and come from Blend lending, not from the stablecoin itself. Not a bank deposit, not insured.",
		),
	},
	{
		title: msg("A security seal for large payments"),
		body: msg(
			"Above a threshold the organization sets, a payment needs an extra seal from an approver. Organizations can require it to be signed with a quantum-safe ML-DSA key that never leaves the approving device; the organization checks it on Stellar before the money moves.",
		),
	},
	{
		title: msg("Private where it matters"),
		body: msg(
			"Payment references, recipients and discussions are stored encrypted, so only your members and the auditors you choose can read them. Amounts stay verifiable on the ledger.",
		),
	},
	{
		title: msg("Work with other organizations"),
		body: msg(
			"Agree milestones with a supplier or partner, deposit up front and release each payment when the work is delivered. Both sides decide under their own approval rules.",
		),
	},
	{
		title: msg("Decide together"),
		body: msg(
			"Reasons for and against, questions and comments on every request, with thumbs up and down. Approvers see what the group thinks before they sign.",
		),
	},
];

const steps = [
	{
		title: msg("Create your passkey"),
		body: msg(
			"Thirty seconds, no app store, no seed phrase. Your pass shows your ancora ID and a QR code others use to invite you.",
		),
	},
	{
		title: msg("Create or join an organization"),
		body: msg(
			"Pick a template (club, company, team), the currency of the rules and the stablecoins you accept. Invite people by their ancora ID.",
		),
	},
	{
		title: msg("Pay, approve, earn"),
		body: msg(
			"Send money from your wallet or any Stellar wallet, approve on the go, keep the rest in the Reserve. Fees are sponsored.",
		),
	},
];

const chips = [
	{ label: msg("€ EURC"), className: styles.chipOne },
	{ label: msg("$ USDC"), className: styles.chipTwo },
	{ label: msg("Rules on-chain"), className: styles.chipThree },
	{ label: msg("⚓ Stellar"), className: styles.chipFour },
];

/** Prefers-reduced-motion decides once per visit whether the globe spins and the text rises in. */
function prefersMotion(): boolean {
	return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LandingPage() {
	const t = useT();
	const [motion] = useState(prefersMotion);
	const [videoReady, setVideoReady] = useState(false);
	const language = useLanguage();
	// Set again in the new language after a switch.
	useEffect(() => {
		document.documentElement.lang = language;
		document.title = t("ancora: the business account your organization controls");
	}, [language, t]);

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
					<nav className={styles.navLinks} aria-label={t("Sections")}>
						<a href="#features">{t("Features")}</a>
						<a href="#how">{t("How it works")}</a>
						<a href="#security">{t("Security")}</a>
						<a href="https://github.com/raglibol-re/ancora" target="_blank" rel="noreferrer">
							{t("Open source")}
						</a>
					</nav>
					<div className={styles.navActions}>
						<div className={styles.language}>
							<LanguageSwitch />
						</div>
						<Link to="/app" className={[styles.pillOutline, styles.navSignIn].join(" ")}>
							{t("Sign in")}
						</Link>
						<Link to="/app" className={styles.pillSolid}>
							{t("Get started")}
						</Link>
					</div>
				</header>

				<div className={styles.center}>
					<p className={styles.badge}>
						<span className={styles.badgeDot} />
						{t("Programmable business account on Stellar")}
					</p>
					<h1 className={styles.headline}>
						<span className={styles.line}>{t("The business account")}</span>
						<span className={styles.line}>{t("your organization controls.")}</span>
					</h1>
					<p className={styles.lead}>
						{t(
							"For clubs, companies, NGOs and teams. One passkey per person, one account per organization, rules the account enforces itself.",
						)}
					</p>
					<div className={styles.ctas}>
						<Link to="/app" className={styles.pillSolid}>
							{t("Get started →")}
						</Link>
						<a href="#how" className={styles.pillOutline}>
							{t("How it works")}
						</a>
					</div>
				</div>

				{chips.map((chip) => (
					<span key={chip.label} className={`${styles.chip} ${chip.className}`} aria-hidden="true">
						{t(chip.label)}
					</span>
				))}

				<a href="#features" className={styles.scrollHint} aria-label={t("Scroll to features")}>
					<span className={styles.mouse} />
					<span>{t("See how it works")}</span>
				</a>
			</section>

			<main className={styles.main}>
				<section id="features" className={styles.section}>
					<h2>{t("Everything an organization needs from its account")}</h2>
					<div className={styles.grid}>
						{features.map((feature) => (
							<article key={feature.title} className={styles.card}>
								<h3>{t(feature.title)}</h3>
								<p>{t(feature.body)}</p>
							</article>
						))}
					</div>
				</section>

				<section id="how" className={styles.section}>
					<h2>{t("How it works")}</h2>
					<ol className={styles.steps}>
						{steps.map((step, index) => (
							<li key={step.title} className={styles.step}>
								<span className={styles.stepNumber}>{index + 1}</span>
								<h3>{t(step.title)}</h3>
								<p>{t(step.body)}</p>
							</li>
						))}
					</ol>
					<div className={styles.ctas}>
						<Link to="/app" className={styles.pillSolid}>
							{t("Get started")}
						</Link>
						<InstallHint />
					</div>
				</section>

				<section id="security" className={styles.section}>
					<h2>{t("Built on what Stellar already has")}</h2>
					<div className={styles.grid}>
						<article className={styles.card}>
							<h3>{t("OpenZeppelin smart accounts")}</h3>
							<p>
								{t(
									"Your passkey signs through an audited smart account; the private key never leaves your device. ancora's operator sponsors fees and holds no role anywhere.",
								)}
							</p>
						</article>
						<article className={styles.card}>
							<h3>{t("Verifiable rules")}</h3>
							<p>
								{t(
									"Approval rules are a canonical document. The organization contract stores its SHA-256, so anyone can check that what you read is what it enforces.",
								)}
							</p>
						</article>
						<article className={styles.card}>
							<h3>{t("Non-custodial by design")}</h3>
							<p>
								{t(
									"Nobody but the organization controls its money: ancora holds no key to any account. ancora runs on the Stellar test network today; mainnet follows an external security review.",
								)}
							</p>
						</article>
					</div>
				</section>
			</main>

			<footer className={styles.footer}>
				<div className={styles.footerBrand}>
					<BrandMark size={28} />
					<p>{t("The business account your organization controls.")}</p>
				</div>
				<nav className={styles.footerLinks} aria-label={t("Footer")}>
					<div>
						<h3>{t("Product")}</h3>
						<a href="#features">{t("Features")}</a>
						<a href="#how">{t("How it works")}</a>
						<a href="#security">{t("Security")}</a>
					</div>
					<div>
						<h3>{t("Company")}</h3>
						<a href="https://github.com/raglibol-re/ancora" target="_blank" rel="noreferrer">
							{t("Open source")}
						</a>
						<a
							href="https://github.com/raglibol-re/ancora/blob/main/docs/ROADMAP.md"
							target="_blank"
							rel="noreferrer"
						>
							{t("Roadmap")}
						</a>
						<Link to="/app">{t("Sign in")}</Link>
					</div>
				</nav>
				<p className={styles.legal}>
					{t(
						"© 2026 ancora. ancora is not a bank; balances are not deposit-insured. Currently on the Stellar test network with test money. Licensed payment partners handle bank transfers.",
					)}
				</p>
			</footer>
		</div>
	);
}
