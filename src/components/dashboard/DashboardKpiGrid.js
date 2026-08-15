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
  const goalIsSet = goal != null;
  const progress = Math.min(100, Math.max(0, goalProgress));
  const remaining = goalIsSet ? Math.max(0, goal - income.estimatedMonthlyIncome) : null;

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
      <article className={`dashboard-kpi-card dashboard-goal-kpi${goalIsSet ? "" : " dashboard-kpi-unset"}`}>
        <span className="dashboard-kpi-label"><i aria-hidden="true">🎯</i>GOAL PROGRESS</span>
        {goalIsSet ? (
          <>
            <div className="dashboard-goal-gauge" aria-label={`${progress.toFixed(0)}% of monthly passive-income goal`}>
              <div><span style={{ width: `${progress}%` }} /></div>
              <strong>{progress.toFixed(0)}%</strong>
            </div>
            <div className="dashboard-goal-values">
              <span><small>CURRENT</small>{fmtCad(income.estimatedMonthlyIncome)}</span>
              <span><small>TARGET</small>{fmtCad(goal)}</span>
              <span><small>REMAINING</small>{fmtCad(remaining)}</span>
            </div>
          </>
        ) : (
          <><strong>Set your goal</strong><small>Choose a monthly passive-income goal below</small></>
        )}
      </article>
    </section>
  );
}

export { DashboardKpiCard };
