import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
	return (
		<svg
			width="22"
			height="22"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

export const HomeIcon = () => (
	<Icon>
		<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
	</Icon>
);

export const InboxIcon = () => (
	<Icon>
		<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
		<path d="M3 13h5l1 3h6l1-3h5" />
	</Icon>
);

export const SendIcon = () => (
	<Icon>
		<path d="M12 19V5" />
		<path d="M6 11l6-6 6 6" />
	</Icon>
);

export const ApprovalsIcon = () => (
	<Icon>
		<circle cx="12" cy="12" r="9" />
		<path d="M8 12l3 3 5-6" />
	</Icon>
);

export const RulesIcon = () => (
	<Icon>
		<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
	</Icon>
);

export const SettingsIcon = () => (
	<Icon>
		<circle cx="12" cy="12" r="3" />
		<path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
	</Icon>
);

export const PlusIcon = () => (
	<Icon>
		<path d="M12 5v14M5 12h14" />
	</Icon>
);
