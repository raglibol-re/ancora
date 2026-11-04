import { useT } from "../../ui/useLanguage.ts";
import page from "./LandingPage.module.css";
import styles from "./LandingSections.module.css";
import { caseStudies, principles } from "./landingContent.ts";

/** Why ancora exists and what it holds itself to. */
export function AboutSection() {
	const t = useT();
	return (
		<section id="about" className={page.section}>
			<p className={styles.eyebrow}>{t("Company")}</p>
			<div className={styles.statements}>
				<div>
					<h2>{t("Our mission")}</h2>
					<p className={styles.statement}>
						{t(
							"Give every organization one shared account where the rules its members agree on are the rules its money follows.",
						)}
					</p>
				</div>
				<div>
					<h2>{t("Our vision")}</h2>
					<p className={styles.statement}>
						{t(
							"A rowing club, a design studio and an aid group run their money with the controls of a large company: without a back office, and without handing it to anyone.",
						)}
					</p>
				</div>
			</div>
			<h3 className={styles.subhead}>{t("What we hold ourselves to")}</h3>
			<div className={page.grid}>
				{principles.map((principle) => (
					<article key={principle.title} className={page.card}>
						<h3>{t(principle.title)}</h3>
						<p>{t(principle.body)}</p>
					</article>
				))}
			</div>
		</section>
	);
}

/** How three kinds of organization would run on ancora; labeled as illustrative, not as customers. */
export function CaseStudiesSection() {
	const t = useT();
	return (
		<section id="cases" className={page.section}>
			<p className={styles.eyebrow}>{t("Use cases")}</p>
			<h2>{t("How organizations run on ancora")}</h2>
			<p className={styles.note}>
				{t(
					"Illustrative scenarios with fictional organizations. ancora is in preview, so these show how the account is designed to work, not results from customers.",
				)}
			</p>
			<div className={styles.cases}>
				{caseStudies.map((study) => (
					<article key={study.name} className={styles.case}>
						<header className={styles.caseHeader}>
							<span className={styles.caseKind}>{t(study.kind)}</span>
							<h3>{study.name}</h3>
							<span className={styles.illustrative}>{t("Illustrative")}</span>
						</header>
						<dl className={styles.caseBody}>
							<dt>{t("The challenge")}</dt>
							<dd>{t(study.challenge)}</dd>
							<dt>{t("With ancora")}</dt>
							<dd>{t(study.approach)}</dd>
							<dt>{t("What changes")}</dt>
							<dd>{t(study.outcome)}</dd>
						</dl>
					</article>
				))}
			</div>
		</section>
	);
}
