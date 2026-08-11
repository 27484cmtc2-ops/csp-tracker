import { createDividendHolding, validateDividendHolding } from "../../utils/dividends";
import { wheelAppDividendAdapter } from "./wheelAppAdapter";

export const DIVIDEND_IMPORT_ADAPTERS = [wheelAppDividendAdapter];

export function createDividendImportRows(parsedCsv, existingHoldings, adapterId = wheelAppDividendAdapter.id) {
  if (parsedCsv.errors.length) throw new Error(parsedCsv.errors[0].message);
  const adapter = DIVIDEND_IMPORT_ADAPTERS.find((item) => item.id === adapterId);
  if (!adapter) throw new Error("Select a supported import format.");
  if (!adapter.recognizes(parsedCsv.headers)) {
    throw new Error("This CSV does not match the Wheel App dividend template headers.");
  }
  if (parsedCsv.rows.length === 0) throw new Error("The CSV does not contain any holdings.");
  return reviewDividendImportRows(adapter.parse(parsedCsv.rows), existingHoldings);
}

function comparable(value) {
  return String(value ?? "").trim().toUpperCase();
}

function exactHoldingMatch(first, second) {
  return comparable(first.ticker) === comparable(second.ticker)
    && comparable(first.account) === comparable(second.account)
    && comparable(first.currency) === comparable(second.currency)
    && Number(first.shares) === Number(second.shares)
    && Number(first.dividendPerShare) === Number(second.dividendPerShare)
    && first.frequency === second.frequency
    && first.nextPaymentDate === second.nextPaymentDate;
}

function likelyHoldingMatch(first, second) {
  return comparable(first.ticker) !== ""
    && comparable(first.ticker) === comparable(second.ticker)
    && comparable(first.account) === comparable(second.account)
    && comparable(first.currency) === comparable(second.currency);
}

export function findDividendDuplicates(candidate, existingHoldings, importRows, rowId) {
  const matches = [];
  existingHoldings.forEach((holding) => {
    if (exactHoldingMatch(candidate, holding)) {
      matches.push({ kind: "exact", source: "existing", holdingId: holding.id });
    } else if (likelyHoldingMatch(candidate, holding)) {
      matches.push({ kind: "likely", source: "existing", holdingId: holding.id });
    }
  });
  importRows.forEach((row) => {
    if (row.importRowId === rowId) return;
    if (exactHoldingMatch(candidate, row.candidate)) {
      matches.push({ kind: "exact", source: "file", holdingId: row.importRowId });
    } else if (likelyHoldingMatch(candidate, row.candidate)) {
      matches.push({ kind: "likely", source: "file", holdingId: row.importRowId });
    }
  });
  return matches;
}

export function reviewDividendImportRows(rows, existingHoldings) {
  return rows.map((row) => {
    const validationError = validateDividendHolding(row.candidate);
    const duplicates = findDividendDuplicates(row.candidate, existingHoldings, rows, row.importRowId);
    const formulaIssues = Object.entries(row.candidate).flatMap(([field, value]) =>
      /^[=+@]/.test(String(value ?? "").trim())
        ? [{ field, code: "formula_like_value", message: `${field} cannot contain a spreadsheet formula.` }]
        : []
    );
    const issues = [
      ...row.issues.filter((issue) => issue.code !== "formula_like_value" && issue.field !== "frequency"),
      ...(row.candidate.frequency && !["weekly", "semi_monthly", "monthly", "quarterly", "semi_annual", "annual"].includes(row.candidate.frequency)
        ? [{ field: "frequency", code: "unsupported_frequency", message: "Choose a supported payment frequency." }]
        : []),
      ...formulaIssues,
    ];
    const hasUnsupportedValue = issues.length > 0;
    let status = "ready";
    if (!row.included && (duplicates.length === 0 || row.duplicateDecision !== null)) status = "excluded";
    else if (hasUnsupportedValue) status = "unsupported";
    else if (validationError) status = "needs_review";
    else if (duplicates.length > 0) status = "duplicate";
    else if (!row.included) status = "excluded";

    return { ...row, issues, validationError, duplicates, status };
  });
}

export function getDividendImportSummary(rows) {
  const counts = { ready: 0, needs_review: 0, duplicate: 0, unsupported: 0, excluded: 0 };
  rows.forEach((row) => { counts[row.status] += 1; });
  const unresolved = rows.some((row) =>
    (row.included && ["needs_review", "unsupported"].includes(row.status))
    || (row.duplicates.length > 0 && row.duplicateDecision == null)
  );
  return {
    ...counts,
    included: rows.filter((row) => row.included).length,
    canConfirm: rows.some((row) => row.included) && !unresolved,
  };
}

export function createImportedDividendHoldings(rows, existingHoldings, startingId = Date.now()) {
  const included = rows.filter((row) => row.included);
  included.forEach((row) => {
    const error = validateDividendHolding(row.candidate);
    if (error || row.issues.length) throw new Error(error || "Resolve unsupported values before importing.");
  });
  const usedIds = new Set(existingHoldings.map((holding) => holding.id));
  let nextId = startingId;
  return included.map((row) => {
    while (usedIds.has(nextId)) nextId += 1;
    const holding = createDividendHolding(row.candidate, nextId);
    usedIds.add(nextId);
    nextId += 1;
    return holding;
  });
}
