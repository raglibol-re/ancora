import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { msg } from "../../ui/i18n.ts";
import { LanguageSwitch } from "../../ui/LanguageSwitch.tsx";
import { useLanguage, useT } from "../../ui/useLanguage.ts";
import { InstallHint } from "../install/InstallHint.tsx";
import { AboutSection, CaseStudiesSection } from "./CompanySections.tsx";
import styles from "./LandingPage.module.css";
import sections from "./LandingSections.module.css";
import { FaqSection, LaunchPathSection, PilotSection } from "./LaunchSections.tsx";
import { features, REPOSITORY, steps } from "./landingContent.ts";

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

				<p className={sections.previewBar}>
					<span className={sections.previewTag}>{t("Preview")}</span>
					<span>
						{t(
							"ancora runs on the Stellar test network with test money while we prepare for launch.",
						)}
					</span>
					<a href="#launch">{t("Path to launch")}</a>
				</p>

				<header className={styles.nav}>
					<Link to="/" className={styles.brand}>
						<BrandMark size={36} />
					</Link>
					<nav className={styles.navLinks} aria-label={t("Sections")}>
						<a href="#features">{t("Product")}</a>
						<a href="#cases">{t("Use cases")}</a>
						<a href="#about">{t("Company")}</a>
						<a href="#launch">{t("Roadmap")}</a>
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

				<CaseStudiesSection />

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

				<AboutSection />
				<LaunchPathSection />
				<PilotSection />
				<FaqSection />
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
						<a href="#cases">{t("Use cases")}</a>
					</div>
					<div>
						<h3>{t("Company")}</h3>
						<a href="#about">{t("Mission and vision")}</a>
						<a href="#launch">{t("Roadmap")}</a>
						<a href="#pilot">{t("Pilot program")}</a>
						<a href="#faq">{t("Questions")}</a>
						<a href={REPOSITORY} target="_blank" rel="noreferrer">
							{t("Open source")}
						</a>
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
