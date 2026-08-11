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

function canonicalHeader(header) {
  return String(header).trim().toLowerCase();
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
  label: "Wheel App dividend holdings",
  recognizes(headers) {
    const received = headers.map(canonicalHeader);
    return WHEEL_APP_DIVIDEND_HEADERS.every((header) => received.includes(canonicalHeader(header)));
  },
  parse(rows) {
    return rows.map((row, index) => {
      const frequencyInput = cleanCell(row["Frequency"]).toLowerCase();
      const candidate = {
        ticker: cleanCell(row["Ticker"]),
        shares: cleanCell(row["Shares"]),
        dividendPerShare: cleanCell(row["Dividend Per Share"]),
        frequency: FREQUENCY_VALUES[frequencyInput] ?? frequencyInput,
        currency: cleanCell(row["Currency"]).toUpperCase(),
        account: cleanCell(row["Account"]),
        nextPaymentDate: cleanCell(row["Next Payment Date"]),
        notes: cleanCell(row["Notes"]),
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
