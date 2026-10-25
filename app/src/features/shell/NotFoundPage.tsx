import { Link } from "react-router";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
	return (
		<main className={styles.page}>
			<BrandMark size={40} />
			<h1>This page doesn't exist.</h1>
			<p>Check the address, or go back to your account.</p>
			<Link to="/app" className={buttonClass()}>
				Open ancora
			</Link>
		</main>
	);
}
