import { fmtCad } from "../../utils/formatters";
import {
  getAnnualDividendIncome,
  getCurrentMonthOptionPremium,
  getDividendPaymentAmount,
  getDividendSummary,
  getUpcomingDividendPayments,
  groupDividendIncome,
} from "../../utils/dividends";

const FREQUENCY_LABELS = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  annual: "Annual",
};

function IncomeBreakdown({ title, groups }) {
  const entries = Object.entries(groups).sort((first, second) => second[1] - first[1]);
  return (
    <section className="csp-panel dividend-breakdown">
      <header>{title}</header>
      {entries.length === 0 ? <p>No dividend income yet.</p> : entries.map(([label, amount]) => (
        <div key={label}><span>{label}</span><strong>{fmtCad(amount)} <small>/ year</small></strong></div>
      ))}
    </section>
  );
}

export default function DividendDashboard({ holdings, trades, usdCad, onAdd, onEdit, onDelete }) {
  const summary = getDividendSummary(holdings, usdCad);
  const currentMonthOptionPremiumCad = getCurrentMonthOptionPremium(trades) * usdCad;
  const upcoming = getUpcomingDividendPayments(holdings, usdCad).slice(0, 8);
  const byAccount = groupDividendIncome(holdings, "account", usdCad);
  const byTicker = groupDividendIncome(holdings, "ticker", usdCad);

  return (
    <div className="dividend-dashboard">
      <div className="dividend-page-heading">
        <div>
          <span className="dividend-eyebrow">INCOME PORTFOLIO</span>
          <h1>Dividend Tracker</h1>
          <p>Estimated income converted to CAD using the app’s current USD/CAD rate.</p>
        </div>
        <button className="csp-btn dividend-add-button" onClick={onAdd}>+ ADD HOLDING</button>
      </div>

      <section className="dividend-summary-grid" aria-label="Dividend income summary">
        <div><span>ANNUAL DIVIDENDS</span><strong>{fmtCad(summary.annualIncome)}</strong></div>
        <div><span>AVERAGE MONTHLY</span><strong>{fmtCad(summary.averageMonthlyIncome)}</strong></div>
        <div><span>OPTION PREMIUM THIS MONTH</span><strong>{fmtCad(currentMonthOptionPremiumCad)}</strong></div>
      </section>

      <section className="csp-panel dividend-holdings-panel">
        <header>HOLDINGS <span>({holdings.length})</span></header>
        {holdings.length === 0 ? (
          <div className="dividend-empty-state">
            <strong>No dividend holdings yet.</strong>
            <p>Add a holding to estimate annual and monthly income.</p>
          </div>
        ) : (
          <div className="dividend-holding-list">
            {holdings.map((holding) => (
              <article key={holding.id} className="dividend-holding-row">
                <div className="dividend-holding-title">
                  <strong>{holding.ticker}</strong>
                  <span>{holding.account} · {holding.currency}</span>
                </div>
                <div><span>SHARES</span><strong>{holding.shares}</strong></div>
                <div><span>DIVIDEND / SHARE</span><strong>{holding.currency} ${holding.dividendPerShare.toFixed(4)}</strong></div>
                <div><span>FREQUENCY</span><strong>{FREQUENCY_LABELS[holding.frequency]}</strong></div>
                <div><span>NEXT PAYMENT</span><strong>{holding.nextPaymentDate}</strong></div>
                <div><span>PAYMENT</span><strong>{holding.currency} ${getDividendPaymentAmount(holding).toFixed(2)}</strong></div>
                <div><span>ANNUAL CAD</span><strong className="dividend-positive">{fmtCad(getAnnualDividendIncome(holding, usdCad))}</strong></div>
                <div className="dividend-row-actions">
                  <button className="csp-btn-sm csp-btn-blue" onClick={() => onEdit(holding)}>EDIT</button>
                  <button className="csp-btn-sm csp-btn-danger" onClick={() => onDelete(holding.id)}>DELETE</button>
                </div>
                {holding.notes && <p className="dividend-holding-notes">{holding.notes}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="csp-panel dividend-upcoming-panel">
        <header>UPCOMING PAYMENTS <span>12-month projection</span></header>
        {upcoming.length === 0 ? <p>No upcoming payments.</p> : upcoming.map((payment) => (
          <div key={`${payment.holdingId}-${payment.date}`}>
            <time>{payment.date}</time>
            <strong>{payment.ticker}</strong>
            <span>{payment.account}</span>
            <b>{fmtCad(payment.amountCad)}</b>
          </div>
        ))}
      </section>

      <div className="dividend-breakdown-grid">
        <IncomeBreakdown title="INCOME BY ACCOUNT" groups={byAccount} />
        <IncomeBreakdown title="INCOME BY TICKER" groups={byTicker} />
      </div>
    </div>
  );
}
