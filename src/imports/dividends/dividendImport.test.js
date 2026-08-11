import { parseCsvText } from "../csv/parseCsv";
import {
  createDividendImportRows,
  createImportedDividendHoldings,
  getDividendImportSummary,
  reviewDividendImportRows,
} from "./dividendImport";
import { WHEEL_APP_DIVIDEND_HEADERS } from "./wheelAppAdapter";

const csv = (rows, headers = WHEEL_APP_DIVIDEND_HEADERS) =>
  parseCsvText(`${headers.join(",")}\n${rows.join("\n")}`);

const row = (overrides = {}) => ({
  importRowId: "one",
  sourceRowNumber: 2,
  included: true,
  duplicateDecision: null,
  issues: [],
  candidate: {
    ticker: "ENB",
    shares: "10",
    dividendPerShare: "1",
    frequency: "quarterly",
    currency: "CAD",
    account: "TFSA",
    nextPaymentDate: "2026-09-01",
    notes: "",
    ...overrides,
  },
});

test.each([
  ["Weekly", "weekly"],
  ["Semi-monthly", "semi_monthly"],
  ["Monthly", "monthly"],
  ["Quarterly", "quarterly"],
  ["Semi-annual", "semi_annual"],
  ["Annual", "annual"],
])("maps the %s frequency", (input, expected) => {
  const rows = createDividendImportRows(csv([`ENB,10,1,${input},CAD,TFSA,2026-09-01,`]), []);
  expect(rows[0].candidate.frequency).toBe(expected);
  expect(rows[0].status).toBe("ready");
});

test.each(["CAD", "USD"])("maps %s holdings and custom accounts", (currency) => {
  const rows = createDividendImportRows(csv([`RY,5,1,Annual,${currency},Family Trust,2026-10-01,Legacy`]), []);
  expect(rows[0].candidate).toMatchObject({ currency, account: "Family Trust", notes: "Legacy" });
});

test("rejects missing or unrecognized headers", () => {
  expect(() => createDividendImportRows(csv(["ENB,10"], ["Ticker", "Shares"]), []))
    .toThrow("does not match");
});

test("marks invalid and formula-like values for review without evaluating them", () => {
  const rows = createDividendImportRows(csv(["=CMD(),0,1,Unknown,EUR,,bad-date,"]), []);
  expect(rows[0].status).toBe("unsupported");
  expect(rows[0].candidate.ticker).toBe("=CMD()");
  expect(rows[0].issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "formula_like_value" })]));
});

test("detects existing and within-file duplicates conservatively", () => {
  const existing = [{ id: 7, ...row().candidate, shares: 10, dividendPerShare: 1 }];
  const reviewed = reviewDividendImportRows([row(), { ...row(), importRowId: "two" }], existing);
  expect(reviewed[0].status).toBe("duplicate");
  expect(reviewed[0].duplicates).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: "existing", kind: "exact" }),
    expect.objectContaining({ source: "file", kind: "exact" }),
  ]));
  expect(getDividendImportSummary(reviewed).canConfirm).toBe(false);
});

test("requires duplicate acknowledgement and supports skip or separate-add only", () => {
  let reviewed = reviewDividendImportRows([row()], [{ id: 7, ...row().candidate }]);
  reviewed = reviewDividendImportRows([{ ...reviewed[0], included: false, duplicateDecision: "skip" }], [{ id: 7, ...row().candidate }]);
  expect(reviewed[0].status).toBe("excluded");
  expect(getDividendImportSummary(reviewed).canConfirm).toBe(false);

  reviewed = reviewDividendImportRows([{ ...reviewed[0], included: true, duplicateDecision: "add" }], [{ id: 7, ...row().candidate }]);
  expect(getDividendImportSummary(reviewed).canConfirm).toBe(true);
});

test("creates normalized holdings while preserving the existing collection", () => {
  const existing = [{ id: 10, ticker: "BCE" }];
  const imported = createImportedDividendHoldings([row({ ticker: " enb ", shares: "12" })], existing, 10);
  expect(imported).toEqual([expect.objectContaining({ id: 11, ticker: "ENB", shares: 12 })]);
  expect(existing).toEqual([{ id: 10, ticker: "BCE" }]);
});
