import { getCollectedPremium } from "./trades";
import { isCoveredCall } from "./coveredCalls";
import { isStockSale } from "./stockSales";
import {
  getDividendSummary,
  getUpcomingDividendPayments,
  groupDividendIncome,
} from "./dividends";

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function subtractYear(date) {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() - 1);
  return result;
}

function isWheelOption(trade) {
  if (!trade || isStockSale(trade)) return false;
  return isCoveredCall(trade) || trade.type === "CSP" || trade.type?.includes("Spread");
}

export function getTrailingTwelveMonthWheelPremium(trades, asOf = new Date()) {
  const end = new Date(asOf);
  end.setUTCHours(23, 59, 59, 999);
  const start = subtractYear(end);
  start.setUTCHours(0, 0, 0, 0);
  return trades.reduce((total, trade) => {
    if (!isWheelOption(trade)) return total;
    const opened = parseDate(trade.opened);
    if (!opened || opened < start || opened > end) return total;
    return total + getCollectedPremium(trade);
  }, 0);
}

export function getDashboardIncomeSummary({ trades, holdings, usdCad, includeWheelIncome, asOf = new Date() }) {
  const dividends = getDividendSummary(holdings, usdCad);
  const trailingWheelPremium = getTrailingTwelveMonthWheelPremium(trades, asOf);
  const averageMonthlyWheelIncome = includeWheelIncome ? trailingWheelPremium / 12 : 0;
  const estimatedMonthlyIncome = dividends.averageMonthlyIncome + averageMonthlyWheelIncome;
  return {
    annualDividendIncome: dividends.annualIncome,
    averageMonthlyDividendIncome: dividends.averageMonthlyIncome,
    trailingWheelPremium,
    averageMonthlyWheelIncome,
    estimatedMonthlyIncome,
    annualProjectedIncome: estimatedMonthlyIncome * 12,
  };
}

export function getDashboardAccountBreakdown(holdings, usdCad) {
  return Object.entries(groupDividendIncome(holdings, "account", usdCad))
    .map(([account, annualIncome]) => ({
      account,
      annualIncome,
      monthlyIncome: annualIncome / 12,
    }))
    .sort((first, second) => second.annualIncome - first.annualIncome);
}

export function getDashboardUpcomingPayments(holdings, usdCad, asOf = new Date(), limit = 4) {
  return getUpcomingDividendPayments(holdings, usdCad, asOf).slice(0, limit);
}

function positionType(trade) {
  if (trade.status === "assigned") return "Assigned shares";
  if (isCoveredCall(trade)) return "Covered call";
  if (trade.type?.includes("Spread")) return "Spread";
  return trade.type || "CSP";
}

export function getDashboardOpenWheelPositions(trades, asOf = new Date()) {
  const today = new Date(asOf);
  today.setUTCHours(0, 0, 0, 0);
  return trades
    .filter((trade) => !isStockSale(trade) && (trade.status === "open" || trade.status === "assigned"))
    .map((trade) => {
      const expiry = parseDate(trade.expiry);
      return {
        id: trade.id,
        ticker: trade.ticker,
        type: positionType(trade),
        expiry: trade.expiry || "",
        daysRemaining: expiry ? Math.round((expiry - today) / 86400000) : null,
        collectedPremium: isWheelOption(trade) ? getCollectedPremium(trade) : 0,
        status: trade.status === "assigned" ? "Assigned" : "Open",
      };
    })
    .sort((first, second) => {
      if (first.daysRemaining == null) return 1;
      if (second.daysRemaining == null) return -1;
      return first.daysRemaining - second.daysRemaining;
    });
}

function recentActivityDetails(trade) {
  if (isStockSale(trade)) return { date: trade.saleDate, label: "Shares sold" };
  if (isCoveredCall(trade)) {
    return trade.status === "closed"
      ? { date: trade.closeDate || trade.closedDate, label: "Covered call closed" }
      : { date: trade.opened, label: "Covered call sold" };
  }
  if (trade.status === "assigned") return { date: trade.assignmentDate, label: "Shares assigned" };
  if (trade.status === "sold") return { date: trade.soldDate, label: "Assignment completed" };
  if (trade.status === "closed") return { date: trade.closedDate, label: trade.type?.includes("Spread") ? "Spread closed" : "Put closed" };
  if (trade.rolledFromId) return { date: trade.opened, label: "Position rolled" };
  return { date: trade.opened, label: trade.type?.includes("Spread") ? "Spread opened" : "Put opened" };
}

export function getDashboardRecentActivity(trades, limit = 5) {
  return trades
    .map((trade) => ({ id: trade.id, ticker: trade.ticker, ...recentActivityDetails(trade) }))
    .filter((activity) => parseDate(activity.date))
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, limit);
}
