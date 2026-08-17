import {
  getDashboardAccountBreakdown,
  getDashboardIncomeSummary,
  getDashboardOpenWheelPositions,
  getDashboardRecentActivity,
  getDashboardUpcomingPayments,
  getTrailingTwelveMonthWheelPremium,
} from "./dashboard";

const asOf = new Date("2026-08-15T12:00:00Z");
const holdings = [
  { id: 1, ticker: "ENB", shares: 100, dividendPerShare: 1, frequency: "quarterly", currency: "CAD", account: "TFSA", nextPaymentDate: "2026-09-01" },
  { id: 2, ticker: "KO", shares: 10, dividendPerShare: 1, frequency: "monthly", currency: "USD", account: "RRSP", nextPaymentDate: "2026-08-20" },
];
const trades = [
  { id: 1, ticker: "A", type: "CSP", status: "closed", opened: "2026-01-10", premium: 1, contracts: 1 },
  { id: 2, ticker: "B", type: "10/9 Spread", status: "open", opened: "2026-07-10", premium: 0.5, contracts: 2, expiry: "2026-09-10" },
  { id: 3, ticker: "C", kind: "covered_call", type: "Covered Call", status: "open", opened: "2026-08-01", premium: 0.25, contracts: 1, expiry: "2026-09-20" },
  { id: 4, ticker: "OLD", type: "CSP", status: "closed", opened: "2025-07-01", premium: 9, contracts: 1 },
  { id: 5, ticker: "SALE", kind: "stock_sale", status: "completed", opened: "2026-08-01", premium: 20, contracts: 1 },
  { id: 6, ticker: "ASSIGNED", type: "CSP", status: "assigned", opened: "2026-05-01", premium: 0.4, contracts: 1 },
  { id: 7, ticker: "ROLL", type: "CSP", status: "open", opened: "2026-06-01", premium: 1, contracts: 1, creditTotal: 80, rollNet: -20, rolledFromId: 1 },
];

test("calculates trailing-12-month Wheel premium without stock sales or old records", () => {
  expect(getTrailingTwelveMonthWheelPremium(trades, asOf)).toBe(345);
});

test("summarizes the five most recent dated portfolio activities", () => {
  const activity = getDashboardRecentActivity([
    { id: 1, ticker: "PUT", type: "CSP", status: "open", opened: "2026-08-01" },
    { id: 2, ticker: "CALL", kind: "covered_call", status: "closed", opened: "2026-08-02", closeDate: "2026-08-12" },
    { id: 3, ticker: "SALE", kind: "stock_sale", status: "completed", saleDate: "2026-08-15" },
    { id: 4, ticker: "ASSIGN", type: "CSP", status: "assigned", assignmentDate: "2026-08-10" },
    { id: 5, ticker: "ROLL", type: "CSP", status: "open", opened: "2026-08-11", rolledFromId: 1 },
    { id: 6, ticker: "OLD", type: "CSP", status: "open", opened: "2026-07-01" },
  ]);
  expect(activity).toHaveLength(5);
  expect(activity[0]).toEqual({ id: 3, ticker: "SALE", date: "2026-08-15", label: "Shares sold" });
  expect(activity.map((item) => item.label)).toEqual([
    "Shares sold",
    "Covered call closed",
    "Position rolled",
    "Shares assigned",
    "Put opened",
  ]);
});

test("combines monthly dividends with TTM Wheel premium only when enabled", () => {
  const withWheel = getDashboardIncomeSummary({ trades, holdings, usdCad: 2, includeWheelIncome: true, asOf });
  expect(withWheel.annualDividendIncome).toBe(640);
  expect(withWheel.averageMonthlyDividendIncome).toBeCloseTo(53.3333);
  expect(withWheel.averageMonthlyWheelIncome).toBeCloseTo(28.75);
  expect(withWheel.annualProjectedIncome).toBeCloseTo(985);

  const withoutWheel = getDashboardIncomeSummary({ trades, holdings, usdCad: 2, includeWheelIncome: false, asOf });
  expect(withoutWheel.averageMonthlyWheelIncome).toBe(0);
  expect(withoutWheel.annualProjectedIncome).toBe(640);
});

test("uses annual-basis dividends consistently in Dashboard income", () => {
  const annualHolding = [{
    id: 9, ticker: "MSTY", shares: 10, dividendBasis: "annual",
    dividendPerShare: null, annualDividendPerShare: 12, frequency: "monthly",
    currency: "CAD", account: "TFSA", nextPaymentDate: "2026-09-01",
  }];
  const summary = getDashboardIncomeSummary({
    trades: [], holdings: annualHolding, usdCad: 1, includeWheelIncome: false, asOf,
  });
  expect(summary).toMatchObject({
    annualDividendIncome: 120,
    averageMonthlyDividendIncome: 10,
    estimatedMonthlyIncome: 10,
    annualProjectedIncome: 120,
  });
});

test("summarizes account income, four upcoming payments, and open Wheel positions", () => {
  expect(getDashboardAccountBreakdown(holdings, 2)).toEqual([
    { account: "RRSP", annualIncome: 240, monthlyIncome: 20 },
    { account: "TFSA", annualIncome: 400, monthlyIncome: 400 / 12 },
  ].sort((a, b) => b.annualIncome - a.annualIncome));
  expect(getDashboardUpcomingPayments(holdings, 2, asOf)).toHaveLength(4);
  expect(getDashboardUpcomingPayments(holdings, 2, asOf)[0]).toEqual(expect.objectContaining({ ticker: "KO", amountCad: 20 }));
  expect(getDashboardOpenWheelPositions(trades, asOf)).toEqual(expect.arrayContaining([
    expect.objectContaining({ ticker: "B", type: "Spread", status: "Open" }),
    expect.objectContaining({ ticker: "C", type: "Covered call", status: "Open" }),
    expect.objectContaining({ ticker: "ASSIGNED", type: "Assigned shares", status: "Assigned" }),
  ]));
});
