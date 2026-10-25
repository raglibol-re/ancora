import { createContext, useContext } from "react";

export type Notice = {
	tone: "success" | "error" | "info";
	text: string;
};

export const NoticeContext = createContext<((notice: Notice) => void) | null>(null);

/** Shows a short message; errors say what happened and how to fix it. */
export function useNotify(): (notice: Notice) => void {
	const notify = useContext(NoticeContext);
	if (!notify) throw new Error("useNotify must be used inside <NoticeProvider>.");
	return notify;
}
