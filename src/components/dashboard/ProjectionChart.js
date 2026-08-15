import { fmtCad } from "../../utils/formatters";
import { PROJECTION_SCENARIOS } from "../../utils/passiveIncomeProjection";

const WIDTH = 900;
const HEIGHT = 340;
const PADDING = { top: 24, right: 26, bottom: 42, left: 72 };
const COLORS = { safe: "#7dd3a8", base: "#60a5fa", aggressive: "#c084fc" };
const DASHES = { safe: "3 7", base: "10 5", aggressive: "2 4 10 4" };

function samplePoints(points) {
  const selected = points.filter((point) => point.month % 60 === 0);
  const last = points.at(-1);
  if (last && selected.at(-1)?.month !== last.month) selected.push(last);
  return selected;
}

export default function ProjectionChart({ projection }) {
  const scenarioValues = PROJECTION_SCENARIOS.flatMap(({ id }) => projection.scenarios[id].points.map((point) => point.income));
  const goalValues = projection.goal == null ? [] : projection.scenarios.base.points.map((point) => point.goal || 0);
  const maxValue = Math.max(100, ...scenarioValues, ...goalValues) * 1.08;
  const maxMonth = projection.scenarios.base.points.at(-1)?.month || 1;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const x = (month) => PADDING.left + (month / maxMonth) * plotWidth;
  const y = (value) => PADDING.top + plotHeight - (value / maxValue) * plotHeight;
  const line = (points, field = "income") => points.map((point) => `${x(point.month)},${y(point[field] || 0)}`).join(" ");
  const tablePoints = samplePoints(projection.scenarios.base.points);

  return (
    <div className="projection-chart-wrap">
      <svg className="projection-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const value = maxValue * fraction;
          return (
            <g key={fraction}>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(value)} y2={y(value)} className="projection-grid-line" />
              <text x={PADDING.left - 10} y={y(value) + 4} textAnchor="end" className="projection-axis-label">{fmtCad(value)}</text>
            </g>
          );
        })}
        <line x1={PADDING.left} x2={PADDING.left} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} className="projection-today-line" />
        <text x={PADDING.left} y={HEIGHT - 14} textAnchor="middle" className="projection-today-label">TODAY</text>

        {projection.goal != null && (
          <>
            <polyline points={line(projection.scenarios.base.points, "goal")} className="projection-goal-line" />
            <text x={WIDTH - PADDING.right} y={Math.max(16, y(projection.scenarios.base.points.at(-1).goal) - 8)} textAnchor="end" className="projection-goal-label">🎯 GOAL</text>
          </>
        )}

        {PROJECTION_SCENARIOS.map(({ id }) => (
          <polyline
            key={id}
            points={line(projection.scenarios[id].points)}
            fill="none"
            stroke={COLORS[id]}
            strokeWidth="3"
            strokeDasharray={DASHES[id]}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {projection.scenarios.base.milestones.filter((milestone) => milestone.month != null).map((milestone) => {
          const point = projection.scenarios.base.points[milestone.month];
          return <circle key={milestone.fraction} cx={x(point.month)} cy={y(point.income)} r="5" className="projection-milestone" />;
        })}

        {tablePoints.map((point) => (
          <text key={point.month} x={x(point.month)} y={HEIGHT - 14} textAnchor={point.month === 0 ? "start" : point.month === maxMonth ? "end" : "middle"} className="projection-axis-label">
            {point.month === 0 ? "" : `${Math.round(point.month / 12)}Y`}
          </text>
        ))}
      </svg>

      <details className="projection-data-table">
        <summary>VIEW ACCESSIBLE PROJECTION DATA</summary>
        <div>
          <table>
            <thead><tr><th>Year</th>{PROJECTION_SCENARIOS.map(({ id, label }) => <th key={id}>{label}</th>)}{projection.goal != null && <th>Goal</th>}</tr></thead>
            <tbody>{tablePoints.map((point) => (
              <tr key={point.month}>
                <th>{point.month === 0 ? "Today" : `${Math.round(point.month / 12)} years`}</th>
                {PROJECTION_SCENARIOS.map(({ id }) => <td key={id}>{fmtCad(projection.scenarios[id].points[point.month].income)} / month</td>)}
                {projection.goal != null && <td>{fmtCad(point.goal)} / month</td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

