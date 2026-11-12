// Which data source visitors get when they haven't chosen one themselves: a setting of the
// deployment (DEFAULT_DATA_SOURCE), sample data unless it says testnet. It used to be a file in
// Vercel Blob that every visit read; see docs/DECISIONS.md (2026-11-12).

export type SiteMode = "sample" | "testnet";

export function siteMode(value: string | undefined = process.env.DEFAULT_DATA_SOURCE): SiteMode {
	return value === "testnet" ? "testnet" : "sample";
}
