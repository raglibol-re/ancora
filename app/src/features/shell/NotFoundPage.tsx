import { Link } from "react-router";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { useT } from "../../ui/useLanguage.ts";
import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
	const t = useT();
	return (
		<main className={styles.page}>
			<BrandMark size={40} />
			<h1>{t("This page doesn't exist.")}</h1>
			<p>{t("Check the address, or go back to your account.")}</p>
			<Link to="/app" className={buttonClass()}>
				{t("Open ancora")}
			</Link>
		</main>
	);
}
