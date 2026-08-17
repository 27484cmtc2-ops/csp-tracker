import { useState } from "react";
import { fmtCad } from "../../utils/formatters";
import {
  getAnnualDividendIncome,
  getDividendPaymentAmount,
  getDividendSummary,
  getUpcomingDividendPayments,
  groupDividendIncome,
} from "../../utils/dividends";

const FREQUENCY_LABELS = {
  weekly: "Weekly",
  semi_monthly: "Semi-monthly",
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

const ACCOUNT_SORT_OPTIONS = {
  annual: "Annual income, highest to lowest",
  monthly: "Monthly income, highest to lowest",
  name: "Account name, A–Z",
};

function AccountIncomeBreakdown({ groups }) {
  const [sortBy, setSortBy] = useState("annual");
  const entries = Object.entries(groups).sort((first, second) => {
    if (sortBy === "name") return first[0].localeCompare(second[0], undefined, { sensitivity: "base" });
    return second[1] - first[1];
  });

  return (
    <section className="csp-panel dividend-breakdown dividend-account-breakdown" aria-label="Income by account">
      <header>
        <span>INCOME BY ACCOUNT</span>
        <label>
          <span>SORT</span>
          <select aria-label="Sort income by account" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            {Object.entries(ACCOUNT_SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </header>
      {entries.length === 0 ? <p>No dividend income yet.</p> : (
        <div className="dividend-account-table">
          <div className="dividend-account-columns" aria-hidden="true">
            <span>ACCOUNT</span><span>MONTHLY</span><span>ANNUAL</span>
          </div>
          {entries.map(([label, annualIncome]) => (
            <div className="dividend-account-row" key={label}>
              <strong>{label}</strong>
              <span><b>{fmtCad(annualIncome / 12)}</b><small>/ month</small></span>
              <span><b>{fmtCad(annualIncome)}</b><small>/ year</small></span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const UPCOMING_PREVIEW_COUNT = 4;

export default function DividendDashboard({ holdings, usdCad, onAdd, onEdit, onDelete }) {
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const summary = getDividendSummary(holdings, usdCad);
  const upcoming = getUpcomingDividendPayments(holdings, usdCad);
  const visibleUpcoming = showFullSchedule ? upcoming : upcoming.slice(0, UPCOMING_PREVIEW_COUNT);
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
        <div className="dividend-heading-actions">
          <button className="csp-btn dividend-add-button" onClick={onAdd}>+ ADD HOLDING</button>
        </div>
      </div>

      <section className="dividend-summary-grid" aria-label="Dividend income summary">
        <div><span>ANNUAL DIVIDENDS</span><strong>{fmtCad(summary.annualIncome)}</strong></div>
        <div><span>AVERAGE MONTHLY</span><strong>{fmtCad(summary.averageMonthlyIncome)}</strong></div>
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
            {holdings.map((holding) => {
              const annualIncomeCad = getAnnualDividendIncome(holding, usdCad);
              return (
              <article key={holding.id} className="dividend-holding-row">
                <div className="dividend-holding-title">
                  <strong>{holding.ticker}</strong>
                  <span>{holding.account} · {holding.currency}</span>
                </div>
                <div><span>SHARES</span><strong>{holding.shares}</strong></div>
                <div><span>NEXT PAYMENT DATE</span><strong>{holding.nextPaymentDate}</strong></div>
                <div><span>EST. NEXT PAYMENT</span><strong>{holding.currency} ${getDividendPaymentAmount(holding).toFixed(2)}</strong></div>
                <div><span>FREQUENCY</span><strong>{FREQUENCY_LABELS[holding.frequency]}</strong></div>
                <div><span>MONTHLY CAD</span><strong className="dividend-positive">{fmtCad(annualIncomeCad / 12)}</strong></div>
                <div><span>ANNUAL CAD</span><strong className="dividend-positive">{fmtCad(annualIncomeCad)}</strong></div>
                <div className="dividend-row-actions">
                  <button className="csp-btn-sm csp-btn-blue" onClick={() => onEdit(holding)}>EDIT</button>
                  <button className="csp-btn-sm csp-btn-danger" onClick={() => onDelete(holding.id)}>DELETE</button>
                </div>
                {holding.notes && <p className="dividend-holding-notes">{holding.notes}</p>}
              </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="csp-panel dividend-upcoming-panel">
        <header>UPCOMING PAYMENTS <span>12-month projection</span></header>
        {upcoming.length === 0 ? <p>No upcoming payments.</p> : visibleUpcoming.map((payment) => (
          <div key={`${payment.holdingId}-${payment.date}`}>
            <time>{payment.date}</time>
            <strong>{payment.ticker}</strong>
            <span>{payment.account}</span>
            <b>{fmtCad(payment.amountCad)}</b>
          </div>
        ))}
        {upcoming.length > UPCOMING_PREVIEW_COUNT && (
          <button
            className="dividend-schedule-toggle"
            onClick={() => setShowFullSchedule((current) => !current)}
            aria-expanded={showFullSchedule}
          >
            {showFullSchedule ? "SHOW LESS" : "VIEW FULL SCHEDULE"}
          </button>
        )}
      </section>

      <div className="dividend-breakdown-grid">
        <AccountIncomeBreakdown groups={byAccount} />
        <IncomeBreakdown title="INCOME BY TICKER" groups={byTicker} />
      </div>
    </div>
  );
}
