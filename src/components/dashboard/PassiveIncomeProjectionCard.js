import { fmtCad } from "../../utils/formatters";
import { PROJECTION_SCENARIOS } from "../../utils/passiveIncomeProjection";
import ProjectionChart from "./ProjectionChart";
import ProjectionControls from "./ProjectionControls";

function formatGoalDate(value) {
  if (!value) return "Not reached in projection";
  return new Intl.DateTimeFormat("en-CA", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00Z`));
}

export default function PassiveIncomeProjectionCard({ projection, settings, onSettingsChange }) {
  return (
    <section className="dashboard-projection-card">
      <header className="dashboard-section-heading">
        <div><span className="dashboard-eyebrow">PASSIVE INCOME PLANNING</span><h2>Projection preview</h2></div>
        <p>{settings.displayMode === "today" ? "Values shown in today’s purchasing power." : "Nominal values with an inflation-adjusted goal path."}</p>
      </header>
      {projection.goal == null && <div className="dashboard-goal-empty"><span aria-hidden="true">🎯</span><div><strong>Set a passive-income goal</strong><p>Enter a monthly goal below to calculate progress, milestones, and estimated goal dates.</p></div></div>}
      <div className="projection-legend" aria-label="Projection scenarios">
        {PROJECTION_SCENARIOS.map(({ id, label, accent }) => <span key={id} className={`projection-legend-${id}`}><i aria-hidden="true">{accent}</i>{label}</span>)}
        {projection.goal != null && <span className="projection-legend-goal"><i aria-hidden="true">🎯</i>Goal</span>}
      </div>
      <ProjectionChart projection={projection} />
      <div className="projection-goal-dates" aria-label="Estimated goal dates">
        {PROJECTION_SCENARIOS.map(({ id, label, accent }) => (
          <div key={id}><span><i aria-hidden="true">{accent}</i>{label}</span><strong>{projection.goal == null ? "Set a goal" : formatGoalDate(projection.scenarios[id].goalDate)}</strong></div>
        ))}
      </div>
      {projection.goal != null && (
        <div className="projection-milestone-summary" aria-label="Base scenario milestone estimates">
          {projection.scenarios.base.milestones.map((milestone, index) => (
            <div key={milestone.fraction}>
              <span aria-hidden="true">{["🌱", "🌿", "🏁", "🌳"][index]}</span>
              <strong>{fmtCad(milestone.amount)} / month</strong>
              <small>{formatGoalDate(milestone.date)}</small>
            </div>
          ))}
        </div>
      )}
      <p className="projection-data-honesty">Dividend income is estimated from current holdings. The app does not have confirmed dividend-payment history, so no historical dividend line is shown. Wheel income uses trailing-12-month gross collected premium.</p>
      {projection.goal != null && <p className="projection-progress-copy"><span aria-hidden="true">🌱</span> Current estimate: {fmtCad(projection.currentMonthlyIncome)} per month · {projection.goalProgress.toFixed(0)}% of goal</p>}
      <ProjectionControls settings={settings} onChange={onSettingsChange} />
    </section>
  );
}
