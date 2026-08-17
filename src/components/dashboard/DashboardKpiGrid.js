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

export default function DashboardKpiGrid({ income }) {
  return (
    <section className="dashboard-kpi-grid dashboard-income-kpi-grid" aria-label="Income summary">
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
    </section>
  );
}

export { DashboardKpiCard };
