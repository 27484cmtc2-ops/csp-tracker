import { fmtCad } from "../../utils/formatters";

function DashboardKpiCard({ accent, label, value, detail, className = "" }) {
  return (
    <article className={`dashboard-kpi-card ${className}`}>
      <span className="dashboard-kpi-label"><i aria-hidden="true">{accent}</i>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export default function DashboardKpiGrid({ income, goal, goalProgress }) {
  return (
    <section className="dashboard-kpi-grid" aria-label="Investing summary">
      <DashboardKpiCard
        accent="💰"
        label="ESTIMATED MONTHLY PASSIVE INCOME"
        value={fmtCad(income.estimatedMonthlyIncome)}
        detail="Projected dividends plus average gross Wheel premium"
      />
      <DashboardKpiCard
        label="ANNUAL PROJECTED PASSIVE INCOME"
        value={fmtCad(income.annualProjectedIncome)}
        detail="Monthly estimate × 12"
      />
      <DashboardKpiCard
        accent="🌿"
        label="DIVIDEND INCOME"
        value={`${fmtCad(income.averageMonthlyDividendIncome)} / mo`}
        detail={`${fmtCad(income.annualDividendIncome)} projected annually`}
      />
      <DashboardKpiCard
        accent="🎯"
        label="GOAL PROGRESS"
        value={goal == null ? "Set your goal" : `${goalProgress.toFixed(0)}%`}
        detail={goal == null ? "Choose a monthly passive-income goal below" : `${fmtCad(income.estimatedMonthlyIncome)} of ${fmtCad(goal)} monthly`}
        className={goal == null ? "dashboard-kpi-unset" : ""}
      />
    </section>
  );
}

export { DashboardKpiCard };

