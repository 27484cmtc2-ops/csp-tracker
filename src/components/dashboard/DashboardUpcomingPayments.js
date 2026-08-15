import { fmtCad } from "../../utils/formatters";

export default function DashboardUpcomingPayments({ payments, onViewDividends }) {
  return (
    <section className="dashboard-summary-card">
      <header><span>PROJECTED UPCOMING DIVIDENDS</span><button onClick={onViewDividends}>VIEW DIVIDENDS</button></header>
      {payments.length === 0 ? <p className="dashboard-empty">No projected payments yet.</p> : payments.map((payment) => (
        <div className="dashboard-payment-row" key={`${payment.holdingId}-${payment.date}`}>
          <time>{payment.date}</time><strong>{payment.ticker}</strong><span>{payment.account}</span><b>{fmtCad(payment.amountCad)}</b>
        </div>
      ))}
      <footer>Projected from current holding details; not confirmed payment history.</footer>
    </section>
  );
}

