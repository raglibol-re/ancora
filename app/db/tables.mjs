// The off-chain tables of db/schema.sql, in an order where every table comes after the ones it
// references (restore inserts in this order).
export const TABLES = [
	"organizations",
	"registry_names",
	"discussion_entries",
	"discussion_reactions",
	"push_subscriptions",
	"images",
];
