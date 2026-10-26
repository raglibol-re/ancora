import "./styles/fonts.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/reduced-motion.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./router.tsx";

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("index.html is missing the #root element.");
}

createRoot(rootElement).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);
