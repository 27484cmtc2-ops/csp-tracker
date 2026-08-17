import { useMemo } from "react";
import { getDashboardIncomeSummary } from "../../utils/dashboard";
import { DEFAULT_PROJECTION_SETTINGS, projectPassiveIncome } from "../../utils/passiveIncomeProjection";
import GoalProgressCard from "./GoalProgressCard";
import PassiveIncomeProjectionCard from "./PassiveIncomeProjectionCard";

export default function GoalsPage({ trades, dividends, usdCad, asOf = new Date(), settings = DEFAULT_PROJECTION_SETTINGS, onSettingsChange = () => {} }) {
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

  return (
    <main className="dashboard-page goals-page">
      <header className="dashboard-page-heading">
        <div><span className="dashboard-eyebrow">PASSIVE INCOME PLANNING</span><h1>Goals</h1><p>Model your path to a monthly passive-income target using editable planning assumptions.</p></div>
      </header>
      <GoalProgressCard income={income} goal={projection.goal} goalProgress={projection.goalProgress} />
      <PassiveIncomeProjectionCard projection={projection} settings={settings} onSettingsChange={onSettingsChange} />
    </main>
  );
}
