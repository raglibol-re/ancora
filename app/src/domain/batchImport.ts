import { parseAmountInput } from "./money.ts";
import { err, ok, type Result } from "./result.ts";
import { MAX_BATCH_LINES } from "./rules/requests.ts";

/** One line of a batch as the form holds it: what was typed or imported, checked on submit. */
export type BatchLineInput = { to: string; amount: string; note: string };

type SavedPayee = { name: string; account: string };

/**
 * Reads a spreadsheet export into batch lines: recipient, amount, reference (optional), one
 * payment per row. Spreadsheets in Europe write semicolons and decimal commas, elsewhere commas,
 * so the separator is whichever of semicolon, tab or comma the first row uses. A first row whose
 * amount isn't an amount is a header and skipped. A recipient may be a saved payee's name.
 */
export function parseBatchCsv(
	text: string,
	payees: readonly SavedPayee[],
): Result<BatchLineInput[], string> {
	const rows = text
		.replace(/^﻿/, "")
		.split(/\r?\n/)
		.filter((row) => row.trim() !== "");
	const first = rows[0];
	if (first === undefined) return err("The file is empty.");
	const separator = detectSeparator(first);
	const records = rows.map((row) => splitRow(row, separator));
	const hasHeader = parseAmountInput(records[0]?.[1] ?? "") === null;
	const body = hasHeader ? records.slice(1) : records;
	if (body.length === 0) return err("The file has a header but no payments.");
	if (body.length > MAX_BATCH_LINES) {
		return err(`A batch holds up to ${MAX_BATCH_LINES} payments; the file has ${body.length}.`);
	}

	const lines: BatchLineInput[] = [];
	for (const [index, record] of body.entries()) {
		const row = index + (hasHeader ? 2 : 1);
		const [recipient = "", amount = "", note = ""] = record;
		if (!recipient || !amount) {
			return err(`Row ${row} needs a recipient and an amount.`);
		}
		const cents = parseAmountInput(amount);
		if (cents === null || cents <= 0) {
			return err(`Row ${row}: "${amount}" isn't an amount above zero.`);
		}
		lines.push({ to: resolveRecipient(recipient, payees), amount, note });
	}
	return ok(lines);
}

/** Semicolon or tab when the first row has one (they never appear in amounts), else comma. */
function detectSeparator(row: string): string {
	if (row.includes(";")) return ";";
	if (row.includes("\t")) return "\t";
	return ",";
}

/** Splits one row, honouring double quotes ("Smith, Jane"; "" for a quote inside). */
function splitRow(row: string, separator: string): string[] {
	const fields: string[] = [];
	let field = "";
	let quoted = false;
	for (let i = 0; i < row.length; i++) {
		const char = row[i];
		if (quoted) {
			if (char === '"' && row[i + 1] === '"') {
				field += '"';
				i++;
			} else if (char === '"') {
				quoted = false;
			} else {
				field += char;
			}
		} else if (char === '"') {
			quoted = true;
		} else if (char === separator) {
			fields.push(field.trim());
			field = "";
		} else {
			field += char;
		}
	}
	fields.push(field.trim());
	return fields;
}

/** A saved payee's name (any case) becomes their account; anything else stays as written. */
function resolveRecipient(recipient: string, payees: readonly SavedPayee[]): string {
	const wanted = recipient.toLowerCase();
	return payees.find((payee) => payee.name.toLowerCase() === wanted)?.account ?? recipient;
}
