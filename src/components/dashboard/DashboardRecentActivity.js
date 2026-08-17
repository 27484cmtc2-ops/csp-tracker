export default function DashboardRecentActivity({ activities }) {
  return (
    <section className="dashboard-summary-card">
      <header><span>RECENT INVESTING ACTIVITY</span><small>Latest 5</small></header>
      {activities.length === 0 ? <p className="dashboard-empty">No investing activity yet.</p> : activities.map((activity) => (
        <div className="dashboard-activity-row" key={activity.id}>
          <time>{activity.date}</time>
          <strong>{activity.ticker}</strong>
          <span>{activity.label}</span>
        </div>
      ))}
    </section>
  );
}
