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

export const FingerprintIcon = () => (
	<Icon>
		<path d="M12 11v3a8 8 0 0 1-2 5" />
		<path d="M8.5 8.5A5 5 0 0 1 17 12v2a12 12 0 0 1-1 5" />
		<path d="M5 15a14 14 0 0 0 .5-3 6.5 6.5 0 0 1 11-4.7" />
		<path d="M3.5 10a9 9 0 0 1 15.5-4" />
	</Icon>
);

export const SealIcon = () => (
	<Icon>
		<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
		<path d="M12 8l1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2z" />
	</Icon>
);

export const ReserveIcon = () => (
	<Icon>
		<ellipse cx="12" cy="6" rx="7" ry="3" />
		<path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
		<path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
	</Icon>
);

export const ClockIcon = () => (
	<Icon>
		<circle cx="12" cy="12" r="9" />
		<path d="M12 7v5l3 2" />
	</Icon>
);

export const ChevronDownIcon = () => (
	<Icon>
		<path d="M6 9l6 6 6-6" />
	</Icon>
);

export const MenuIcon = () => (
	<Icon>
		<path d="M4 7h16M4 12h16M4 17h16" />
	</Icon>
);

export const CloseIcon = () => (
	<Icon>
		<path d="M6 6l12 12M18 6L6 18" />
	</Icon>
);

export const OrganizationIcon = () => (
	<Icon>
		<path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
		<path d="M14 9h5a1 1 0 0 1 1 1v11" />
		<path d="M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1M2 21h20" />
	</Icon>
);

export const CompassIcon = () => (
	<Icon>
		<circle cx="12" cy="12" r="9" />
		<path d="M15.5 8.5l-2 5-5 2 2-5z" />
	</Icon>
);

export const SignalIcon = () => (
	<Icon>
		<path d="M3 12h4l2-6 4 12 2-6h6" />
	</Icon>
);

export const ReceiveIcon = () => (
	<Icon>
		<path d="M12 5v14" />
		<path d="M6 13l6 6 6-6" />
	</Icon>
);
