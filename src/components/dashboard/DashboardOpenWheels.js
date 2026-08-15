import { fmtCad } from "../../utils/formatters";

export default function DashboardOpenWheels({ positions, onViewTracker }) {
  return (
    <section className="dashboard-summary-card dashboard-open-wheels">
      <header><span>OPEN WHEEL POSITIONS</span><button onClick={onViewTracker}>VIEW WHEEL TRACKER</button></header>
      {positions.length === 0 ? <p className="dashboard-empty">No open Wheel positions.</p> : positions.slice(0, 6).map((position) => (
        <div className="dashboard-wheel-row" key={position.id}>
          <strong>{position.ticker}</strong>
          <span>{position.type}</span>
          <span>{position.expiry || "No option expiry"}{position.daysRemaining == null ? "" : ` · ${position.daysRemaining}d`}</span>
          <b>{position.collectedPremium ? `${fmtCad(position.collectedPremium)} collected` : position.status}</b>
        </div>
      ))}
      {positions.length > 6 && <footer>{positions.length - 6} more position{positions.length - 6 === 1 ? "" : "s"} in Wheel Tracker.</footer>}
    </section>
  );
}

