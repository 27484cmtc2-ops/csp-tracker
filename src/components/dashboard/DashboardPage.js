import { useMemo } from "react";
import {
  getDashboardIncomeSummary,
  getDashboardOpenWheelPositions,
  getDashboardRecentActivity,
  getDashboardUpcomingPayments,
} from "../../utils/dashboard";
import { DEFAULT_PROJECTION_SETTINGS, projectPassiveIncome } from "../../utils/passiveIncomeProjection";
import DashboardKpiGrid from "./DashboardKpiGrid";
import DashboardUpcomingPayments from "./DashboardUpcomingPayments";
import DashboardOpenWheels from "./DashboardOpenWheels";
import DashboardGoalSummary from "./DashboardGoalSummary";
import DashboardRecentActivity from "./DashboardRecentActivity";

export default function DashboardPage({ trades, dividends, usdCad, onNavigate, asOf = new Date(), settings = DEFAULT_PROJECTION_SETTINGS }) {
  const income = useMemo(() => getDashboardIncomeSummary({
    trades,
    holdings: dividends,
    usdCad,
    includeWheelIncome: settings.includeWheelIncome,
    asOf,
  }), [asOf, dividends, settings.includeWheelIncome, trades, usdCad]);
  const projection = useMemo(() => projectPassiveIncome({
    currentMonthlyDividends: income.averageMonthlyDividendIncome,
    currentMonthlyWheelIncome: income.trailingWheelPremium / 12,
    settings,
    startDate: asOf,
  }), [asOf, income.averageMonthlyDividendIncome, income.trailingWheelPremium, settings]);
  const payments = useMemo(() => getDashboardUpcomingPayments(dividends, usdCad, asOf), [asOf, dividends, usdCad]);
  const positions = useMemo(() => getDashboardOpenWheelPositions(trades, asOf), [asOf, trades]);
  const activities = useMemo(() => getDashboardRecentActivity(trades), [trades]);

  return (
    <main className="dashboard-page">
      <header className="dashboard-page-heading">
        <div><span className="dashboard-eyebrow">PERSONAL INVESTING OVERVIEW</span><h1>Investing Dashboard</h1><p>A read-only view of projected income, dividend holdings, and active Wheel positions.</p></div>
      </header>
      <DashboardKpiGrid income={income} />
      <DashboardGoalSummary income={income} goal={projection.goal} goalProgress={projection.goalProgress} onViewGoals={() => onNavigate("goals")} />
      <p className="dashboard-income-disclaimer">Estimated average monthly income. Option premium represents gross collected premium, not realized P&amp;L.</p>
      <div className="dashboard-summary-grid">
        <DashboardUpcomingPayments payments={payments} onViewDividends={() => onNavigate("dividends")} />
        <DashboardOpenWheels positions={positions} onViewTracker={() => onNavigate("tracker")} />
        <DashboardRecentActivity activities={activities} />
      </div>
    </main>
  );
}
