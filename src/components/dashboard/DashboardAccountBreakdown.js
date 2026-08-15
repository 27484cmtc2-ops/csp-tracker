import { fmtCad } from "../../utils/formatters";

export default function DashboardAccountBreakdown({ accounts }) {
  return (
    <section className="dashboard-summary-card">
      <header><span>DIVIDEND INCOME BY ACCOUNT</span><small>CAD normalized</small></header>
      {accounts.length === 0 ? <p className="dashboard-empty">No dividend income yet.</p> : accounts.map((account) => (
        <div className="dashboard-account-row" key={account.account}>
          <strong>{account.account}</strong><span>{fmtCad(account.monthlyIncome)} <small>/ month</small></span><span>{fmtCad(account.annualIncome)} <small>/ year</small></span>
        </div>
      ))}
      <footer>Wheel trades do not currently contain account information.</footer>
    </section>
  );
}

