import { fmtCad } from "../../utils/formatters";

export default function DashboardGoalSummary({ income, goal, goalProgress, onViewGoals }) {
  const goalIsSet = goal != null;
  const progress = Math.min(100, Math.max(0, goalProgress));

  return (
    <section className="dashboard-goal-summary-card" aria-label="Passive income goal summary">
      <div className="dashboard-goal-summary-copy">
        <span aria-hidden="true">🎯</span>
        <div>
          <small>PASSIVE INCOME GOAL</small>
          {goalIsSet ? (
            <><strong>{fmtCad(income.estimatedMonthlyIncome)} <i>/ {fmtCad(goal)} monthly</i></strong><p>{progress.toFixed(0)}% complete</p></>
          ) : (
            <><strong>No monthly goal set</strong><p>Set a target and explore your long-term projection.</p></>
          )}
        </div>
      </div>
      {goalIsSet && <div className="dashboard-goal-summary-meter" aria-label={`${progress.toFixed(0)}% of monthly passive-income goal`}><span style={{ width: `${progress}%` }} /></div>}
      <button onClick={onViewGoals}>VIEW GOALS <span aria-hidden="true">→</span></button>
    </section>
  );
}
