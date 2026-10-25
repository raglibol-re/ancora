import type { Org, PersonId, Requirement, RoleId } from "./model.ts";

/** 0 is the highest rank. Unknown roles rank below everything. */
export function rankOf(org: Org, roleId: RoleId): number {
	const index = org.roles.findIndex((role) => role.id === roleId);
	return index === -1 ? Number.POSITIVE_INFINITY : index;
}

export function memberRank(org: Org, personId: PersonId): number | undefined {
	const member = org.members.find((m) => m.personId === personId);
	return member ? rankOf(org, member.roleId) : undefined;
}

export type SlotProgress = {
	roleId: RoleId;
	required: number;
	approvedBy: PersonId[];
};

export type ApprovalProgress = {
	slots: SlotProgress[];
	satisfied: boolean;
	/** Approvals that count; ignores the requester, non-members, duplicates and surplus approvals. */
	counted: PersonId[];
};

/**
 * Assigns approvers to required slots. A person fills a slot for their own role or any lower role,
 * and counts at most once. The requester never counts (four-eyes).
 *
 * Greedy is optimal here: slots are filled from the most to the least demanding, and any approver
 * who qualifies for a slot also qualifies for every less demanding one.
 */
export function approvalProgress(
	org: Org,
	requirements: readonly Requirement[],
	approverIds: readonly PersonId[],
	requesterId: PersonId,
): ApprovalProgress {
	const pool = [...new Set(approverIds)]
		.filter((id) => id !== requesterId)
		.flatMap((id) => {
			const rank = memberRank(org, id);
			return rank === undefined ? [] : [{ id, rank }];
		})
		.sort((a, b) => a.rank - b.rank);

	const ordered = [...requirements].sort((a, b) => rankOf(org, a.roleId) - rankOf(org, b.roleId));
	let next = 0;
	const slots = ordered.map(({ roleId, count }) => {
		const approvedBy: PersonId[] = [];
		const slotRank = rankOf(org, roleId);
		while (approvedBy.length < count) {
			const candidate = pool[next];
			if (!candidate || candidate.rank > slotRank) break;
			approvedBy.push(candidate.id);
			next += 1;
		}
		return { roleId, required: count, approvedBy };
	});

	return {
		slots,
		satisfied: slots.every((slot) => slot.approvedBy.length === slot.required),
		counted: slots.flatMap((slot) => slot.approvedBy),
	};
}

/** Holds a role that could fill at least one of the requirements (or any member if none). */
export function isEligibleApprover(
	org: Org,
	requirements: readonly Requirement[],
	personId: PersonId,
): boolean {
	const rank = memberRank(org, personId);
	if (rank === undefined) return false;
	return requirements.length === 0 || requirements.some((r) => rank <= rankOf(org, r.roleId));
}

/** True if adding this person's approval fills one more slot. */
export function approvalWouldCount(
	org: Org,
	requirements: readonly Requirement[],
	approverIds: readonly PersonId[],
	requesterId: PersonId,
	personId: PersonId,
): boolean {
	const before = approvalProgress(org, requirements, approverIds, requesterId).counted.length;
	const after = approvalProgress(org, requirements, [...approverIds, personId], requesterId);
	return after.counted.length > before;
}

/** Whether the members (minus those excluded) could ever satisfy the requirements. */
export function canBeSatisfied(
	org: Org,
	requirements: readonly Requirement[],
	excluded: readonly PersonId[] = [],
): boolean {
	const everyone = org.members.map((m) => m.personId).filter((id) => !excluded.includes(id));
	// No real requester is involved, so pass an id no member has.
	return approvalProgress(org, requirements, everyone, "").satisfied;
}
