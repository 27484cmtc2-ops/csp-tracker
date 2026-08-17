import { parseCsvMatrixText, parseCsvText } from "../csv/parseCsv";
import {
  createDividendImportRows,
  createImportedDividendHoldings,
  getDividendImportSummary,
  reviewDividendImportRows,
} from "./dividendImport";
import {
  normalizeDividendImportHeader,
  WHEEL_APP_DIVIDEND_HEADERS,
} from "./wheelAppAdapter";
import { inspectSnowballHeaders, snowballDividendAdapter } from "./snowballAdapter";

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

test("accepts exact canonical headers", () => {
  const rows = createDividendImportRows(csv(["ENB,10,1,Monthly,CAD,TFSA,2026-09-01,Income"]), []);
  expect(rows[0].candidate).toMatchObject({ ticker: "ENB", dividendPerShare: "1", nextPaymentDate: "2026-09-01" });
});

test("accepts a BOM-prefixed first header and CRLF line endings", () => {
  const parsed = parseCsvText(`\uFEFF${WHEEL_APP_DIVIDEND_HEADERS.join(",")}\r\nENB,10,1,Monthly,CAD,TFSA,2026-09-01,Income\r\n`);
  const rows = createDividendImportRows(parsed, []);
  expect(parsed.headers[0]).toBe("Ticker");
  expect(rows[0].candidate.ticker).toBe("ENB");
});

test("accepts capitalization differences and uses the matched source keys", () => {
  const headers = WHEEL_APP_DIVIDEND_HEADERS.map((header) => header.toUpperCase());
  const rows = createDividendImportRows(csv(["ENB,10,1,Monthly,CAD,TFSA,2026-09-01,Income"], headers), []);
  expect(rows[0].candidate).toMatchObject({ ticker: "ENB", account: "TFSA", notes: "Income" });
});

test("accepts leading, trailing and repeated internal header spaces", () => {
  const headers = [
    " Ticker ", " Shares ", " Dividend   Per   Share ", " Frequency ",
    " Currency ", " Account ", " Next   Payment   Date ", " Notes ",
  ];
  const rows = createDividendImportRows(csv(["ENB,10,1,Monthly,CAD,TFSA,2026-09-01,Income"], headers), []);
  expect(rows[0].candidate.dividendPerShare).toBe("1");
});

test.each([
  ["Dividend / Share", "Next Payment Date"],
  ["Dividend/Share", "Next Payment"],
  ["Dividend-Per-Share", "Next-Payment-Date"],
])("accepts unambiguous punctuation variants %s and %s", (dividendHeader, dateHeader) => {
  const headers = ["Ticker", "Shares", dividendHeader, "Frequency", "Currency", "Account", dateHeader, "Notes"];
  const rows = createDividendImportRows(csv(["ENB,10,1,Monthly,CAD,TFSA,2026-09-01,Income"], headers), []);
  expect(rows[0].candidate).toMatchObject({ dividendPerShare: "1", nextPaymentDate: "2026-09-01" });
});

test("accepts extra unknown and empty columns without importing them", () => {
  const headers = [...WHEEL_APP_DIVIDEND_HEADERS, "Broker ID", ""];
  const rows = createDividendImportRows(csv(["ENB,10,1,Monthly,CAD,TFSA,2026-09-01,Income,ABC,"] , headers), []);
  expect(rows[0].candidate).toEqual({
    ticker: "ENB", shares: "10", dividendPerShare: "1", frequency: "monthly",
    currency: "CAD", account: "TFSA", nextPaymentDate: "2026-09-01", notes: "Income",
  });
});

test("reports exactly which required headers are missing", () => {
  const headers = WHEEL_APP_DIVIDEND_HEADERS.filter((header) => !["Dividend Per Share", "Next Payment Date"].includes(header));
  expect(() => createDividendImportRows(csv(["ENB,10,Monthly,CAD,TFSA,Income"], headers), []))
    .toThrow("Could not recognize required columns: Dividend Per Share, Next Payment Date.");
});

test("rejects truly unrelated CSV headers without accepting ambiguous guesses", () => {
  expect(() => createDividendImportRows(csv(["2026-09-01,Deposit,10"], ["Date", "Description", "Amount"]), []))
    .toThrow("Could not recognize required columns: Ticker, Shares, Dividend Per Share, Frequency, Currency, Account, Next Payment Date, Notes.");
});

test("rejects duplicate and semantically ambiguous headers", () => {
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  const exactDuplicate = parseCsvText(`${WHEEL_APP_DIVIDEND_HEADERS.join(",")},Ticker\nENB,10,1,Monthly,CAD,TFSA,2026-09-01,Income,ENB`);
  expect(() => createDividendImportRows(exactDuplicate, [])).toThrow("Duplicate CSV headers are not supported: Ticker.");
  warning.mockRestore();

  const ambiguousHeaders = [...WHEEL_APP_DIVIDEND_HEADERS, "Dividend / Share"];
  expect(() => createDividendImportRows(csv(["ENB,10,1,Monthly,CAD,TFSA,2026-09-01,Income,1"], ambiguousHeaders), []))
    .toThrow("Ambiguous CSV columns: Dividend Per Share.");
});

test("normalizes harmless header formatting predictably", () => {
  expect(normalizeDividendImportHeader("\uFEFF  Dividend  /  Share  ")).toBe("dividend share");
  expect(normalizeDividendImportHeader("NEXT-PAYMENT_DATE")).toBe("next payment date");
});

test("rejects missing required headers", () => {
  expect(() => createDividendImportRows(csv(["ENB,10"], ["Ticker", "Shares"]), []))
    .toThrow("Could not recognize required columns:");
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

describe("Snowball Analytics adapter", () => {
  const snowballCsv = (headers, values) => parseCsvMatrixText(`${headers.join(",")}\n${values.join(",")}`);

  test("detects Snowball holdings headers", () => {
    expect(snowballDividendAdapter.recognizes(["Holding", "Shares", "Capital gain", "Total profit"])).toBe(true);
    expect(snowballDividendAdapter.recognizes(["Symbol name", "Market value"])).toBe(false);
    expect(inspectSnowballHeaders(["Holding", "Shares"]).missing).toEqual([]);
  });

  test("maps supported columns, preserves currency, and ignores analytics fields", () => {
    const parsed = snowballCsv(
      ["Holding", "Shares", "Dividend per share", "Frequency", "Currency", "Next payment date", "Next payment", "Holding name", "Category", "Capital gain", "Weighting"],
      ["ENB", "100", "0.9425", "Quarterly", "CAD", "2026-09-01", "94.25", "Enbridge", "Energy", "1234", "5%"]
    );
    const rows = createDividendImportRows(parsed, [], snowballDividendAdapter.id);
    expect(rows[0].candidate).toEqual({
      ticker: "ENB", shares: "100", dividendPerShare: "0.9425", frequency: "quarterly",
      currency: "CAD", account: "Unknown", nextPaymentDate: "2026-09-01", notes: "Enbridge · Energy",
    });
    expect(rows[0].estimatedPaymentAmount).toBe("94.25");
    expect(rows[0]).not.toHaveProperty("capitalGain");
  });

  test("maps the exact headers and date format used by a Snowball Holdings export", () => {
    const parsed = snowballCsv(
      ["Holding", "Holdings' name", "Note", "Shares", "Currency", "Dividends per share", "Date of the next payment", "Next payment", "Capital gain", "Capital gain", "Total profit", "Total profit", "Category"],
      ["MSTY", "Yieldmax MSTR Option Income Strategy ETF", "Income", "29.2486", "USD", "10.8316", "Fri Aug 07 2026 00:00:00 GMT-0700 (Pacific Daylight Time)", "6.09248338", "-2444", "-86", "-1334", "-21", "Funds"]
    );
    const importedRow = createDividendImportRows(parsed, [], snowballDividendAdapter.id)[0];
    expect(importedRow.candidate).toMatchObject({
      ticker: "MSTY",
      shares: "29.2486",
      dividendPerShare: "10.8316",
      currency: "USD",
      account: "Unknown",
      nextPaymentDate: "2026-08-07",
      notes: "Yieldmax MSTR Option Income Strategy ETF · Funds · Income",
    });
    expect(importedRow.estimatedPaymentAmount).toBe("6.09248338");
    expect(importedRow.status).toBe("needs_review");
  });

  test.each(["CAD", "USD"])("preserves %s without conversion", (currency) => {
    const parsed = snowballCsv(
      ["Holding", "Shares", "Dividend per share", "Frequency", "Currency", "Next payment date"],
      ["SCHD", "10", "0.25", "Quarterly", currency, "2026-09-01"]
    );
    expect(createDividendImportRows(parsed, [], snowballDividendAdapter.id)[0].candidate.currency).toBe(currency);
  });

  test("handles duplicate Snowball headers positionally and ignores unrelated duplicates", () => {
    const parsed = snowballCsv(
      ["Holding", "Shares", "Dividend per share", "Frequency", "Currency", "Next payment date", "Total profit", "Total profit"],
      ["ENB", "10", "1", "Monthly", "CAD", "2026-09-01", "10", "20"]
    );
    const rows = createDividendImportRows(parsed, [], snowballDividendAdapter.id);
    expect(rows[0].candidate.ticker).toBe("ENB");
    expect(rows[0].status).toBe("ready");
  });

  test("flags conflicting values in duplicate mapped Snowball columns", () => {
    const parsed = snowballCsv(
      ["Holding", "Holding", "Shares", "Dividend per share", "Frequency", "Currency", "Next payment date"],
      ["ENB", "RY", "10", "1", "Monthly", "CAD", "2026-09-01"]
    );
    const rows = createDividendImportRows(parsed, [], snowballDividendAdapter.id);
    expect(rows[0].status).toBe("unsupported");
    expect(rows[0].issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "conflicting_duplicate_values" })]));
  });

  test("leaves missing account and frequency in an explicit review state", () => {
    const parsed = snowballCsv(
      ["Holding", "Shares", "Dividend per share", "Currency", "Next payment date"],
      ["ENB", "10", "1", "CAD", "2026-09-01"]
    );
    const rowUnderReview = createDividendImportRows(parsed, [], snowballDividendAdapter.id)[0];
    expect(rowUnderReview.candidate).toMatchObject({ account: "Unknown", frequency: "" });
    expect(rowUnderReview.status).toBe("needs_review");
  });

  test("uses the existing duplicate detection against current holdings", () => {
    const parsed = snowballCsv(
      ["Holding", "Shares", "Dividend per share", "Frequency", "Currency", "Next payment date"],
      ["ENB", "10", "1", "Monthly", "CAD", "2026-09-01"]
    );
    const existing = [{ id: 5, ticker: "ENB", shares: 10, dividendPerShare: 1, frequency: "monthly", currency: "CAD", account: "Unknown", nextPaymentDate: "2026-09-01" }];
    const rows = createDividendImportRows(parsed, existing, snowballDividendAdapter.id);
    expect(rows[0].status).toBe("duplicate");
    expect(rows[0].duplicates[0]).toMatchObject({ kind: "exact", source: "existing" });
  });

  test("confirmed Snowball rows become ordinary normalized dividend holdings", () => {
    const parsed = snowballCsv(
      ["Holding", "Shares", "Dividend per share", "Frequency", "Currency", "Next payment date", "Next payment"],
      [" enb ", "10", "1", "Monthly", "CAD", "2026-09-01", "10"]
    );
    const rows = createDividendImportRows(parsed, [], snowballDividendAdapter.id);
    const imported = createImportedDividendHoldings(rows, [], 50);
    expect(imported).toEqual([{
      id: 50, ticker: "ENB", shares: 10, dividendPerShare: 1, frequency: "monthly",
      currency: "CAD", account: "Unknown", nextPaymentDate: "2026-09-01", notes: "",
    }]);
    expect(imported[0]).not.toHaveProperty("estimatedPaymentAmount");
  });

  test("does not loosen duplicate-header rejection for the Investing Dashboard adapter", () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    const parsed = parseCsvText(`${WHEEL_APP_DIVIDEND_HEADERS.join(",")},Ticker\nENB,10,1,Monthly,CAD,TFSA,2026-09-01,,ENB`);
    expect(() => createDividendImportRows(parsed, [])).toThrow("Duplicate CSV headers are not supported");
    warning.mockRestore();
  });
});
