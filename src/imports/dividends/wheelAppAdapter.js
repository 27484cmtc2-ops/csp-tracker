import { DIVIDEND_FREQUENCIES } from "../../utils/dividends";

export const WHEEL_APP_DIVIDEND_HEADERS = [
  "Ticker",
  "Shares",
  "Dividend Per Share",
  "Frequency",
  "Currency",
  "Account",
  "Next Payment Date",
  "Notes",
];

export const WHEEL_APP_DIVIDEND_TEMPLATE = `${WHEEL_APP_DIVIDEND_HEADERS.join(",")}\nENB,100,0.9425,Quarterly,CAD,TFSA,2026-09-01,Core income holding\n`;

const FREQUENCY_VALUES = {
  weekly: "weekly",
  "semi-monthly": "semi_monthly",
  semi_monthly: "semi_monthly",
  monthly: "monthly",
  quarterly: "quarterly",
  "semi-annual": "semi_annual",
  semi_annual: "semi_annual",
  annual: "annual",
};

const HEADER_FIELDS = {
  ticker: { label: "Ticker", aliases: ["ticker"] },
  shares: { label: "Shares", aliases: ["shares"] },
  dividendPerShare: {
    label: "Dividend Per Share",
    aliases: ["dividend per share", "dividend share"],
  },
  frequency: { label: "Frequency", aliases: ["frequency"] },
  currency: { label: "Currency", aliases: ["currency"] },
  account: { label: "Account", aliases: ["account"] },
  nextPaymentDate: {
    label: "Next Payment Date",
    aliases: ["next payment date", "next payment"],
  },
  notes: { label: "Notes", aliases: ["notes"] },
};

export function normalizeDividendImportHeader(header) {
  return String(header ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[/_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inspectDividendImportHeaders(headers) {
  const fieldMap = {};
  const ambiguous = [];

  Object.entries(HEADER_FIELDS).forEach(([field, definition]) => {
    const matches = headers.filter((header) =>
      definition.aliases.includes(normalizeDividendImportHeader(header))
    );
    if (matches.length === 1) fieldMap[field] = matches[0];
    if (matches.length > 1) ambiguous.push(definition.label);
  });

  const missing = Object.entries(HEADER_FIELDS)
    .filter(([field]) => !fieldMap[field] && !ambiguous.includes(HEADER_FIELDS[field].label))
    .map(([, definition]) => definition.label);

  return { fieldMap, missing, ambiguous };
}

function cleanCell(value) {
  return String(value ?? "").trim();
}

function formulaIssue(value, field) {
  return /^[=+@]/.test(value)
    ? [{ field, code: "formula_like_value", message: `${field} cannot contain a spreadsheet formula.` }]
    : [];
}

export const wheelAppDividendAdapter = {
  id: "wheel_app_dividend_holdings",
  label: "Investing Dashboard dividend holdings",
  recognizes(headers) {
    const inspection = inspectDividendImportHeaders(headers);
    return inspection.missing.length === 0 && inspection.ambiguous.length === 0;
  },
  inspectHeaders: inspectDividendImportHeaders,
  parse(rows, fieldMap) {
    return rows.map((row, index) => {
      const value = (field) => cleanCell(row[fieldMap[field]]);
      const frequencyInput = value("frequency").toLowerCase();
      const candidate = {
        ticker: value("ticker"),
        shares: value("shares"),
        dividendPerShare: value("dividendPerShare"),
        frequency: FREQUENCY_VALUES[frequencyInput] ?? frequencyInput,
        currency: value("currency").toUpperCase(),
        account: value("account"),
        nextPaymentDate: value("nextPaymentDate"),
        notes: value("notes"),
      };
      const issues = Object.entries(candidate).flatMap(([field, value]) =>
        formulaIssue(String(value), field)
      );
      if (candidate.frequency && !DIVIDEND_FREQUENCIES[candidate.frequency]) {
        issues.push({ field: "frequency", code: "unsupported_frequency", message: "Choose a supported payment frequency." });
      }
      return {
        importRowId: `wheel-app-${index + 1}`,
        sourceRowNumber: index + 2,
        candidate,
        issues,
        included: true,
        duplicateDecision: null,
      };
    });
  },
};
