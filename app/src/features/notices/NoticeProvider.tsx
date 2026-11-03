import { type ReactNode, useCallback, useState } from "react";
import { useT } from "../../ui/useLanguage.ts";
import { type Notice, NoticeContext } from "./NoticeContext.ts";
import styles from "./NoticeProvider.module.css";

type ShownNotice = Notice & { id: number };

const VISIBLE_MS = 6_000;
let nextId = 0;

export function NoticeProvider({ children }: { children: ReactNode }) {
	const t = useT();
	const [notices, setNotices] = useState<ShownNotice[]>([]);

	const notify = useCallback((notice: Notice) => {
		const id = ++nextId;
		setNotices((current) => [...current, { ...notice, id }]);
		setTimeout(() => setNotices((current) => current.filter((n) => n.id !== id)), VISIBLE_MS);
	}, []);

	return (
		<NoticeContext.Provider value={notify}>
			{children}
			<div className={styles.stack} aria-live="polite">
				{notices.map((notice) => (
					<p
						key={notice.id}
						className={`${styles.notice} ${styles[notice.tone]}`}
						role={notice.tone === "error" ? "alert" : "status"}
					>
						{t(notice.text)}
					</p>
				))}
			</div>
		</NoticeContext.Provider>
	);
}
