import { getCollectedPremium } from "./trades";

export const DIVIDEND_FREQUENCIES = {
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
};

export const EMPTY_DIVIDEND_HOLDING = {
  ticker: "",
  shares: "",
  dividendPerShare: "",
  frequency: "quarterly",
  currency: "CAD",
  account: "",
  nextPaymentDate: "",
  notes: "",
};

export function validateDividendHolding(value) {
  if (!value.ticker?.trim()) return "Ticker is required.";
  if (!Number.isFinite(Number(value.shares)) || Number(value.shares) <= 0) {
    return "Shares must be greater than zero.";
  }
  if (!Number.isFinite(Number(value.dividendPerShare)) || Number(value.dividendPerShare) <= 0) {
    return "Dividend per share must be greater than zero.";
  }
  if (!DIVIDEND_FREQUENCIES[value.frequency]) return "Select a payment frequency.";
  if (!['CAD', 'USD'].includes(value.currency)) return "Select CAD or USD.";
  if (!value.account?.trim()) return "Account is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.nextPaymentDate || "")) {
    return "Next payment date is required.";
  }
  const paymentDate = new Date(`${value.nextPaymentDate}T00:00:00`);
  if (
    Number.isNaN(paymentDate.getTime()) ||
    paymentDate.getFullYear() !== Number(value.nextPaymentDate.slice(0, 4)) ||
    paymentDate.getMonth() + 1 !== Number(value.nextPaymentDate.slice(5, 7)) ||
    paymentDate.getDate() !== Number(value.nextPaymentDate.slice(8, 10))
  ) return "Next payment date is invalid.";
  return "";
}

export function normalizeDividendHoldings(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((holding) => holding && typeof holding === "object").map((holding) => ({
    id: holding.id,
    ticker: String(holding.ticker ?? "").trim().toUpperCase(),
    shares: Number(holding.shares) || 0,
    dividendPerShare: Number(holding.dividendPerShare) || 0,
    frequency: DIVIDEND_FREQUENCIES[holding.frequency] ? holding.frequency : "quarterly",
    currency: holding.currency === "USD" ? "USD" : "CAD",
    account: String(holding.account ?? "").trim(),
    nextPaymentDate: String(holding.nextPaymentDate ?? ""),
    notes: String(holding.notes ?? "").trim(),
  }));
}

export function createDividendHolding(value, id = Date.now()) {
  return {
    id,
    ticker: value.ticker.trim().toUpperCase(),
    shares: Number(value.shares),
    dividendPerShare: Number(value.dividendPerShare),
    frequency: value.frequency,
    currency: value.currency,
    account: value.account.trim(),
    nextPaymentDate: value.nextPaymentDate,
    notes: value.notes?.trim() || "",
  };
}

export function toCad(amount, currency, usdCad) {
  return currency === "USD" ? amount * usdCad : amount;
}

export function getDividendPaymentAmount(holding) {
  return holding.shares * holding.dividendPerShare;
}

export function getAnnualDividendIncome(holding, usdCad) {
  const payments = DIVIDEND_FREQUENCIES[holding.frequency] || 0;
  return toCad(getDividendPaymentAmount(holding) * payments, holding.currency, usdCad);
}

export function getDividendSummary(holdings, usdCad) {
  const annualIncome = holdings.reduce(
    (sum, holding) => sum + getAnnualDividendIncome(holding, usdCad),
    0
  );
  return { annualIncome, averageMonthlyIncome: annualIncome / 12 };
}

export function groupDividendIncome(holdings, field, usdCad) {
  return holdings.reduce((groups, holding) => {
    const key = holding[field] || "Unspecified";
    groups[key] = (groups[key] || 0) + getAnnualDividendIncome(holding, usdCad);
    return groups;
  }, {});
}

function addMonths(date, months) {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
}

function dateString(date) {
  return date.toISOString().split("T")[0];
}

export function getUpcomingDividendPayments(holdings, usdCad, fromDate = new Date(), months = 12) {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const end = addMonths(start, months);

  return holdings.flatMap((holding) => {
    const paymentsPerYear = DIVIDEND_FREQUENCIES[holding.frequency];
    if (!paymentsPerYear) return [];
    const intervalMonths = 12 / paymentsPerYear;
    let paymentDate = new Date(`${holding.nextPaymentDate}T00:00:00`);
    const payments = [];
    while (paymentDate < start) paymentDate = addMonths(paymentDate, intervalMonths);
    while (paymentDate < end) {
      payments.push({
        holdingId: holding.id,
        ticker: holding.ticker,
        account: holding.account,
        date: dateString(paymentDate),
        amountCad: toCad(getDividendPaymentAmount(holding), holding.currency, usdCad),
        originalAmount: getDividendPaymentAmount(holding),
        currency: holding.currency,
      });
      paymentDate = addMonths(paymentDate, intervalMonths);
    }
    return payments;
  }).sort((first, second) => first.date.localeCompare(second.date));
}

export function getCurrentMonthOptionPremium(trades, now = new Date()) {
  const month = now.getMonth();
  const year = now.getFullYear();
  return trades.reduce((sum, trade) => {
    if (!trade.opened || trade.kind === "stock_sale" || trade.status === "assigned" || trade.status === "sold") {
      return sum;
    }
    const isOption = trade.kind === "covered_call" || trade.type === "CSP" || trade.type?.includes("Spread");
    if (!isOption) return sum;
    const opened = new Date(`${trade.opened}T00:00:00`);
    if (opened.getFullYear() !== year || opened.getMonth() !== month) return sum;
    return sum + getCollectedPremium(trade);
  }, 0);
}
