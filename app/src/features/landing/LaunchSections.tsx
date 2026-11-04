import { Link } from "react-router";
import { useT } from "../../ui/useLanguage.ts";
import page from "./LandingPage.module.css";
import styles from "./LandingSections.module.css";
import { faqs, milestones, PILOT_REQUEST, ROADMAP } from "./landingContent.ts";

/** Where ancora stands today and what has to happen before real money. */
export function LaunchPathSection() {
	const t = useT();
	return (
		<section id="launch" className={page.section}>
			<p className={styles.eyebrow}>{t("Roadmap")}</p>
			<h2>{t("The path to launch")}</h2>
			<ol className={styles.timeline}>
				{milestones.map((milestone) => (
					<li
						key={milestone.title}
						className={`${styles.milestone} ${milestone.live ? styles.milestoneLive : ""}`}
					>
						<span className={styles.status}>{t(milestone.status)}</span>
						<h3>{t(milestone.title)}</h3>
						<p>{t(milestone.body)}</p>
					</li>
				))}
			</ol>
			<a className={styles.textLink} href={ROADMAP} target="_blank" rel="noreferrer">
				{t("Read the full roadmap →")}
			</a>
		</section>
	);
}

/** The invitation to pilot organizations, with the preview as the way to try it now. */
export function PilotSection() {
	const t = useT();
	return (
		<section id="pilot" className={`${page.section} ${styles.pilot}`}>
			<h2>{t("Become a pilot organization")}</h2>
			<p>
				{t(
					"We are preparing the first mainnet pilots with clubs, NGOs and small companies. Pilots shape the product, get help moving their rules over, and are first to use real money once the security review is done.",
				)}
			</p>
			<div className={page.ctas}>
				<a className={page.pillSolid} href={PILOT_REQUEST} target="_blank" rel="noreferrer">
					{t("Apply for the pilot")}
				</a>
				<Link to="/app" className={page.pillOutline}>
					{t("Try the preview")}
				</Link>
			</div>
		</section>
	);
}

export function FaqSection() {
	const t = useT();
	return (
		<section id="faq" className={page.section}>
			<h2>{t("Questions")}</h2>
			<div className={styles.faq}>
				{faqs.map((faq) => (
					<details key={faq.question} className={styles.faqItem}>
						<summary>{t(faq.question)}</summary>
						<p>{t(faq.answer)}</p>
					</details>
				))}
			</div>
		</section>
	);
}
