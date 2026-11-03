import type { DealStep } from "../../domain/deals.ts";
import { t } from "../../ui/i18n.ts";

/** Plain-language name of a deal step, as a request title or a button. */
export function describeDealAction(
	action: DealStep["action"],
	milestoneLabel: (dealId: number, milestone: number) => string,
): string {
	switch (action.type) {
		case "create": {
			const count = action.terms.milestones.length;
			return count === 1
				? t("Propose a deal of 1 milestone")
				: t("Propose a deal of {count} milestones", { count });
		}
		case "accept":
			return t("Accept the terms of deal #{deal}", { deal: action.dealId });
		case "fund":
			return t("Deposit the amount for deal #{deal}", { deal: action.dealId });
		case "requestRelease":
			return t('Ask for the payout of "{milestone}"', {
				milestone: milestoneLabel(action.dealId, action.milestone),
			});
		case "approveRelease":
			return t('Approve the payout of "{milestone}"', {
				milestone: milestoneLabel(action.dealId, action.milestone),
			});
		case "object":
			return t('Object to the payout of "{milestone}"', {
				milestone: milestoneLabel(action.dealId, action.milestone),
			});
		case "cancel":
			return t("Cancel deal #{deal}", { deal: action.dealId });
		case "dispute":
			return t("Ask the arbiter to decide deal #{deal}", { deal: action.dealId });
		case "releaseNow":
			return t('Pay out "{milestone}" now', {
				milestone: milestoneLabel(action.dealId, action.milestone),
			});
	}
}
