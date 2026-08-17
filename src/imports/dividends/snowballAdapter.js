import { DIVIDEND_FREQUENCIES } from "../../utils/dividends";
import { normalizeDividendImportHeader } from "./wheelAppAdapter";

const FREQUENCY_VALUES = {
  weekly: "weekly",
  "semi monthly": "semi_monthly",
  semimonthly: "semi_monthly",
  monthly: "monthly",
  quarterly: "quarterly",
  "semi annual": "semi_annual",
  semiannual: "semi_annual",
  annual: "annual",
};

const FIELD_DEFINITIONS = {
  ticker: { label: "Holding", aliases: ["holding", "ticker", "symbol"], required: true },
  shares: { label: "Shares", aliases: ["shares", "quantity"], required: true },
  dividendPerShare: {
    label: "Dividend per share",
    aliases: ["dividend per share", "dividends per share", "dividend share", "distribution per share", "distribution share"],
  },
  frequency: { label: "Frequency", aliases: ["frequency", "dividend frequency", "payment frequency"] },
  currency: { label: "Currency", aliases: ["currency"] },
  nextPaymentDate: { label: "Next payment date", aliases: ["next payment date", "date of the next payment"] },
  estimatedPaymentAmount: { label: "Next payment", aliases: ["next payment"] },
  holdingName: { label: "Holding name", aliases: ["holding name", "holdings name", "holding name category", "name"] },
  category: { label: "Category", aliases: ["holding category", "category"] },
  sourceNotes: { label: "Note", aliases: ["note", "notes"] },
};

const cleanCell = (value) => String(value ?? "").trim();

function formulaIssue(value, field) {
  return /^[=+@]/.test(value)
    ? [{ field, code: "formula_like_value", message: `${field} cannot contain a spreadsheet formula.` }]
    : [];
}

export function inspectSnowballHeaders(headers) {
  const fieldMap = {};
  Object.entries(FIELD_DEFINITIONS).forEach(([field, definition]) => {
    const indexes = headers.flatMap((header, index) =>
      definition.aliases.includes(normalizeDividendImportHeader(header)) ? [index] : []
    );
    if (indexes.length) fieldMap[field] = indexes;
  });
  const missing = Object.entries(FIELD_DEFINITIONS)
    .filter(([field, definition]) => definition.required && !fieldMap[field])
    .map(([, definition]) => definition.label);
  return { fieldMap, missing, ambiguous: [] };
}

function readMappedValue(row, indexes = []) {
  const values = indexes.map((index) => cleanCell(row[index])).filter(Boolean);
  const distinct = [...new Set(values)];
  return { value: distinct[0] ?? "", conflict: distinct.length > 1 };
}

function normalizeSnowballDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})(?:\s|$)/);
  if (!match) return value;
  const months = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const month = months[match[1]];
  return month ? `${match[3]}-${month}-${match[2].padStart(2, "0")}` : value;
}

export const snowballDividendAdapter = {
  id: "snowball_analytics_holdings",
  label: "Snowball Analytics Holdings Export",
  positional: true,
  recognizes(headers) {
    return inspectSnowballHeaders(headers).missing.length === 0;
  },
  inspectHeaders: inspectSnowballHeaders,
  parse(rows, fieldMap) {
    return rows.map((row, index) => {
      const mapped = Object.fromEntries(Object.keys(FIELD_DEFINITIONS).map((field) => [
        field,
        readMappedValue(row, fieldMap[field]),
      ]));
      const frequencyInput = mapped.frequency.value.toLowerCase();
      const notes = [mapped.holdingName.value, mapped.category.value, mapped.sourceNotes.value].filter(Boolean).join(" · ");
      const candidate = {
        ticker: mapped.ticker.value,
        shares: mapped.shares.value,
        dividendPerShare: mapped.dividendPerShare.value,
        frequency: FREQUENCY_VALUES[normalizeDividendImportHeader(frequencyInput)] ?? frequencyInput,
        currency: mapped.currency.value.toUpperCase(),
        account: "Unknown",
        nextPaymentDate: normalizeSnowballDate(mapped.nextPaymentDate.value),
        notes,
      };
      const issues = Object.entries(mapped).flatMap(([field, result]) =>
        result.conflict
          ? [{ field, code: "conflicting_duplicate_values", message: `Conflicting values were found in duplicate ${FIELD_DEFINITIONS[field].label} columns.` }]
          : formulaIssue(result.value, field)
      );
      if (candidate.frequency && !DIVIDEND_FREQUENCIES[candidate.frequency]) {
        issues.push({ field: "frequency", code: "unsupported_frequency", message: "Choose a supported payment frequency." });
      }
      return {
        importRowId: `snowball-${index + 1}`,
        sourceRowNumber: index + 2,
        candidate,
        estimatedPaymentAmount: mapped.estimatedPaymentAmount.value,
        issues,
        included: true,
        duplicateDecision: null,
      };
    });
  },
};
