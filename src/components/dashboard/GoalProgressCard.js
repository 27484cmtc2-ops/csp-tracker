import { fmtCad } from "../../utils/formatters";

export default function GoalProgressCard({ income, goal, goalProgress }) {
  const goalIsSet = goal != null;
  const progress = Math.min(100, Math.max(0, goalProgress));
  const remaining = goalIsSet ? Math.max(0, goal - income.estimatedMonthlyIncome) : null;

  return (
    <section className={`dashboard-kpi-card dashboard-goal-kpi goals-progress-card${goalIsSet ? "" : " dashboard-kpi-unset"}`} aria-label="Goal progress">
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
    </section>
  );
}
