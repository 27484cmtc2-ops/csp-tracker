import {
  createDividendHolding,
  getAnnualDividendIncome,
  getDividendSummary,
  getEstimatedMonthlyInvestmentIncome,
  getUpcomingDividendPayments,
  groupDividendIncome,
  normalizeDividendHoldings,
  validateDividendHolding,
} from "./dividends";

const CAD = 1.4;
const holding = (overrides = {}) => ({
  id: 1,
  ticker: "ENB",
  shares: 100,
  dividendPerShare: 1,
  frequency: "quarterly",
  currency: "CAD",
  account: "TFSA",
  nextPaymentDate: "2026-09-15",
  notes: "",
  ...overrides,
});

test("validates required dividend fields and numeric values", () => {
  expect(validateDividendHolding({})).toBe("Ticker is required.");
  expect(validateDividendHolding(holding({ shares: 0 }))).toBe("Shares must be greater than zero.");
  expect(validateDividendHolding(holding({ dividendPerShare: -1 }))).toBe("Dividend per share must be greater than zero.");
  expect(validateDividendHolding(holding({ frequency: "weekly" }))).toBe("Select a payment frequency.");
  expect(validateDividendHolding(holding({ currency: "EUR" }))).toBe("Select CAD or USD.");
  expect(validateDividendHolding(holding({ account: "" }))).toBe("Account is required.");
  expect(validateDividendHolding(holding({ nextPaymentDate: "" }))).toBe("Next payment date is required.");
  expect(validateDividendHolding(holding({ nextPaymentDate: "2026-02-30" }))).toBe("Next payment date is invalid.");
  expect(validateDividendHolding(holding())).toBe("");
});

test("normalizes legacy or malformed dividend collections safely", () => {
  expect(normalizeDividendHoldings(null)).toEqual([]);
  expect(normalizeDividendHoldings([null, {
    id: 3,
    ticker: " enb ",
    shares: "12",
    dividendPerShare: "0.5",
    frequency: "unsupported",
    currency: "USD",
  }])).toEqual([{
    id: 3,
    ticker: "ENB",
    shares: 12,
    dividendPerShare: 0.5,
    frequency: "quarterly",
    currency: "USD",
    account: "",
    nextPaymentDate: "",
    notes: "",
  }]);
});

test("normalizes a dividend holding for storage", () => {
  expect(createDividendHolding({
    ...holding(), ticker: " enb ", shares: "25", dividendPerShare: "0.75", notes: " DRIP ",
  }, 99)).toEqual({
    ...holding(), id: 99, shares: 25, dividendPerShare: 0.75, notes: "DRIP",
  });
});

test.each([
  ["monthly", 1200],
  ["quarterly", 400],
  ["semi_annual", 200],
  ["annual", 100],
])("calculates %s annual income", (frequency, expected) => {
  expect(getAnnualDividendIncome(holding({ frequency }), CAD)).toBe(expected);
});

test("converts USD dividends to CAD and calculates monthly averages", () => {
  const holdings = [holding(), holding({ id: 2, currency: "USD", shares: 10 })];
  expect(getDividendSummary(holdings, CAD)).toEqual({ annualIncome: 456, averageMonthlyIncome: 38 });
});

test("groups annual dividend income by account and ticker", () => {
  const holdings = [
    holding(),
    holding({ id: 2, ticker: "BCE", shares: 50 }),
    holding({ id: 3, account: "RRSP", currency: "USD", shares: 10 }),
  ];
  expect(groupDividendIncome(holdings, "account", CAD)).toEqual({ TFSA: 600, RRSP: 56 });
  expect(groupDividendIncome(holdings, "ticker", CAD)).toEqual({ ENB: 456, BCE: 200 });
});

test("projects upcoming payments from the next payment date", () => {
  const payments = getUpcomingDividendPayments(
    [holding({ frequency: "quarterly", nextPaymentDate: "2026-01-31" })],
    CAD,
    new Date("2026-01-01T12:00:00"),
    12
  );
  expect(payments.map((payment) => payment.date)).toEqual([
    "2026-01-31", "2026-04-30", "2026-07-30", "2026-10-30",
  ]);
  expect(payments[0].amountCad).toBe(100);
});

test("combines average dividends with current-month option premiums in CAD", () => {
  const trades = [
    { id: 1, type: "CSP", status: "open", opened: "2026-08-02", premium: 1, contracts: 1 },
    { id: 2, type: "10/9 Spread", status: "closed", opened: "2026-08-03", premium: 0.5, contracts: 2 },
    { id: 3, kind: "covered_call", status: "open", opened: "2026-08-04", premium: 0.25, contracts: 1 },
    { id: 4, kind: "stock_sale", status: "completed", opened: "2026-08-04", premium: 99, contracts: 1 },
    { id: 5, type: "CSP", status: "open", opened: "2026-07-31", premium: 10, contracts: 1 },
  ];
  expect(getEstimatedMonthlyInvestmentIncome(
    [holding({ frequency: "annual", shares: 12 })], trades, CAD, new Date("2026-08-05")
  )).toEqual({
    averageMonthlyDividendIncome: 1,
    currentMonthOptionPremiumCad: 315,
    estimatedMonthlyInvestmentIncome: 316,
  });
});
