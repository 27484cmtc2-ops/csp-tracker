import {
  DIVIDEND_FREQUENCIES,
  createDividendHolding,
  getAnnualDividendIncome,
  getDividendSummary,
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
  expect(validateDividendHolding(holding({ frequency: "unsupported" }))).toBe("Select a payment frequency.");
  expect(validateDividendHolding(holding({ frequency: "weekly" }))).toBe("");
  expect(validateDividendHolding(holding({ frequency: "semi_monthly" }))).toBe("");
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
    annualDividendPerShare: null,
    dividendBasis: "per_payment",
    frequency: "quarterly",
    currency: "USD",
    account: "",
    nextPaymentDate: "",
    notes: "",
  }]);
});

test("preserves custom legacy account names during normalization", () => {
  expect(normalizeDividendHoldings([
    holding({ account: "Family Trust" }),
  ])[0].account).toBe("Family Trust");
});

test("normalizes a dividend holding for storage", () => {
  expect(createDividendHolding({
    ...holding(), ticker: " enb ", shares: "25", dividendPerShare: "0.75", notes: " DRIP ",
  }, 99)).toEqual({
    ...holding(), id: 99, shares: 25, dividendPerShare: 0.75,
    annualDividendPerShare: null, dividendBasis: "per_payment", notes: "DRIP",
  });
});

test.each([
  ["weekly", 52, 12 / 52],
  ["semi_monthly", 24, 12 / 24],
  ["monthly", 12, 1],
  ["quarterly", 4, 3],
  ["annual", 1, 12],
])("normalizes a $12 annual dividend for %s payments", (frequency, paymentsPerYear, expectedPaymentPerShare) => {
  const annualHolding = holding({
    shares: 10,
    dividendBasis: "annual",
    dividendPerShare: null,
    annualDividendPerShare: 12,
    frequency,
  });
  expect(getAnnualDividendIncome(annualHolding, 1)).toBe(120);
  const projected = getUpcomingDividendPayments(
    [annualHolding], 1, new Date("2026-01-01T12:00:00"), 1
  );
  if (projected.length) expect(projected[0].originalAmount).toBeCloseTo(expectedPaymentPerShare * 10);
  expect(DIVIDEND_FREQUENCIES[frequency]).toBe(paymentsPerYear);
});

test("normalizes payloadVersion 2-style holdings as per-payment without changing income", () => {
  const [normalized] = normalizeDividendHoldings([holding({ dividendPerShare: 0.5, frequency: "quarterly" })]);
  expect(normalized).toMatchObject({
    dividendBasis: "per_payment",
    dividendPerShare: 0.5,
    annualDividendPerShare: null,
  });
  expect(getAnnualDividendIncome(normalized, 1)).toBe(200);
});

test.each([
  ["weekly", 5200],
  ["semi_monthly", 2400],
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

test("projects weekly payments seven calendar days apart", () => {
  const payments = getUpcomingDividendPayments(
    [holding({ frequency: "weekly", nextPaymentDate: "2026-01-28" })],
    CAD,
    new Date("2026-01-28T12:00:00"),
    1
  );
  expect(payments.map((payment) => payment.date)).toEqual([
    "2026-01-28", "2026-02-04", "2026-02-11", "2026-02-18", "2026-02-25",
  ]);
});

test("projects semi-monthly payments from two safe monthly anchors", () => {
  const payments = getUpcomingDividendPayments(
    [holding({ frequency: "semi_monthly", nextPaymentDate: "2026-01-31" })],
    CAD,
    new Date("2026-01-01T12:00:00"),
    3
  );
  expect(payments.map((payment) => payment.date)).toEqual([
    "2026-01-31", "2026-02-15", "2026-02-28", "2026-03-15", "2026-03-31",
  ]);
});
