import { useState } from "react";
import { fmt, fmtShort } from "../../utils/formatters";
import {
  annualizedReturn,
  daysColor,
  daysLabel,
  daysUntil,
  getDisplayedOpenPremium,
} from "../../utils/trades";

function MobilePortfolioSummary({
  realized,
  openPremium,
  winRate,
  winningTrades,
  closedTradeCount,
}) {
  return (
    <section className="mobile-summary" aria-label="Portfolio summary">
      <div className="mobile-summary-primary">
        <span className="mobile-eyebrow">REALIZED P&amp;L</span>
        <strong className={realized >= 0 ? "mobile-positive" : "mobile-negative"}>
          {fmtShort(realized)}
        </strong>
      </div>
      <div className="mobile-summary-secondary">
        <div>
          <span className="mobile-eyebrow">OPEN PREMIUM</span>
          <strong>{fmtShort(openPremium)}</strong>
        </div>
        <div>
          <span className="mobile-eyebrow">WIN RATE</span>
          <strong className="mobile-accent">{winRate.toFixed(0)}%</strong>
          <small>{winningTrades}/{closedTradeCount} profitable</small>
        </div>
      </div>
    </section>
  );
}

function MobileOpenPositionCard({
  trade,
  onEdit,
  onRoll,
  onAssign,
  onClose,
  onDelete,
}) {
  const days = daysUntil(trade.expiry);
  const annualized = annualizedReturn(trade);
  const collected = getDisplayedOpenPremium(trade);
  const isSpread = trade.type?.includes("Spread");

  return (
    <article className="mobile-position-card">
      <div className="mobile-position-header">
        <div>
          <div className="mobile-position-title">
            {trade.ticker}
            <span>{isSpread ? "PUT SPREAD" : "CSP"}</span>
          </div>
          <div className="mobile-position-subtitle">
            ${trade.strike}{trade.longStrike ? ` / ${trade.longStrike}` : ""} · {trade.expiry || "No expiry"}
          </div>
        </div>
        <span className="mobile-days-pill" style={{ color: daysColor(days), borderColor: daysColor(days) }}>
          {daysLabel(days)}
        </span>
      </div>

      <div className="mobile-position-metrics">
        <div>
          <span>COLLECTED</span>
          <strong>{fmt(collected)}</strong>
        </div>
        <div>
          <span>ANNUALIZED</span>
          <strong>{annualized != null ? `${annualized.toFixed(0)}%` : "—"}</strong>
        </div>
        <div>
          <span>CONTRACTS</span>
          <strong>{trade.contracts}×</strong>
        </div>
      </div>

      <div className="mobile-position-actions">
        <button className="mobile-primary-action" onClick={() => onClose(trade)}>CLOSE POSITION</button>
        <button onClick={() => onEdit(trade)}>EDIT</button>
        <button className="mobile-roll-action" onClick={() => onRoll(trade)}>ROLL</button>
        <button className="mobile-assign-action" onClick={() => onAssign(trade)}>ASSIGN</button>
        <button className="mobile-delete-action" onClick={() => onDelete(trade.id)}>DELETE</button>
      </div>
    </article>
  );
}

function MobileAssignedCard({ trade }) {
  return (
    <article className="mobile-history-card">
      <div className="mobile-history-title">
        <strong className="mobile-assigned">{trade.ticker}</strong>
        <strong>{trade.shares} shares</strong>
      </div>
      <div className="mobile-detail-row"><span>Assigned</span><strong>{trade.assignmentDate}</strong></div>
      <div className="mobile-detail-row"><span>Strike</span><strong>{fmt(trade.strike)}</strong></div>
      <div className="mobile-detail-row"><span>Basis / share</span><strong className="mobile-assigned">{fmt(trade.adjustedCostPerShare)}</strong></div>
      <div className="mobile-detail-row"><span>Total basis</span><strong>{fmt(trade.adjustedCostBasis)}</strong></div>
    </article>
  );
}

function MobileClosedCard({ trade, onReopen, onDelete }) {
  const collected = trade.creditTotal ?? trade.premium * trade.contracts * 100;
  return (
    <article className="mobile-history-card">
      <div className="mobile-history-title">
        <strong>{trade.ticker}</strong>
        <strong className={(trade.pnl ?? 0) >= 0 ? "mobile-positive" : "mobile-negative"}>
          {trade.pnl != null ? fmt(trade.pnl) : "—"}
        </strong>
      </div>
      <div className="mobile-position-subtitle">${trade.strike} strike · {trade.expiry}</div>
      <div className="mobile-detail-row"><span>Collected</span><strong>{fmt(collected)}</strong></div>
      <div className="mobile-detail-row"><span>Cost to close</span><strong>{trade.costToClose != null ? fmt(trade.costToClose) : "—"}</strong></div>
      <div className="mobile-history-actions">
        <button onClick={() => onReopen(trade.id)}>REOPEN</button>
        <button className="mobile-delete-action" onClick={() => onDelete(trade.id)}>DELETE</button>
      </div>
    </article>
  );
}

function CollapsibleSection({ title, count, open, onToggle, children }) {
  return (
    <section className="mobile-collapsible">
      <button className="mobile-section-toggle" onClick={onToggle} aria-expanded={open}>
        <span>{title} <small>({count})</small></span>
        <span>{open ? "HIDE −" : "SHOW +"}</span>
      </button>
      {open && <div className="mobile-section-content">{children}</div>}
    </section>
  );
}

export default function MobileTrackerShell({
  tab,
  onTabChange,
  realized,
  openPremium,
  winRate,
  winningTrades,
  closedTrades,
  assignedTrades,
  sortedOpenTrades,
  sortBy,
  sortDir,
  onSort,
  onEdit,
  onRoll,
  onAssign,
  onClose,
  onReopen,
  onDelete,
}) {
  const [assignedOpen, setAssignedOpen] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);

  return (
    <div className="mobile-shell">
      <header className="mobile-app-header">
        <div className="mobile-brand">CSP TRACKER</div>
        <nav className="mobile-nav" aria-label="Primary">
          {["tracker", "screener", "strikes"].map((item) => (
            <button key={item} className={tab === item ? "active" : ""} onClick={() => onTabChange(item)}>
              {item}
            </button>
          ))}
        </nav>
      </header>

      {tab === "tracker" ? (
        <main className="mobile-main">
          <MobilePortfolioSummary
            realized={realized}
            openPremium={openPremium}
            winRate={winRate}
            winningTrades={winningTrades}
            closedTradeCount={closedTrades.length}
          />

          <section className="mobile-open-section">
            <div className="mobile-section-heading">
              <div>
                <span className="mobile-eyebrow">POSITIONS</span>
                <h1>Open <small>({sortedOpenTrades.length})</small></h1>
              </div>
              <div className="mobile-sort-wrap">
                <label className="mobile-sort-control">
                  <span>SORT</span>
                  <select value={sortBy} onChange={(event) => onSort(event.target.value)}>
                    <option value="expiry">Expiry</option>
                    <option value="strike">Strike</option>
                    <option value="premium">Premium</option>
                    <option value="annualized">Annualized</option>
                    <option value="ticker">Ticker</option>
                  </select>
                </label>
                <button className="mobile-sort-direction" onClick={() => onSort(sortBy)} aria-label={`Sort ${sortDir === "asc" ? "descending" : "ascending"}`}>
                  {sortDir === "asc" ? "↑" : "↓"}
                </button>
              </div>
            </div>

            {sortedOpenTrades.length === 0 ? (
              <div className="mobile-empty-state">No open positions.</div>
            ) : sortedOpenTrades.map((trade) => (
              <MobileOpenPositionCard
                key={trade.id}
                trade={trade}
                onEdit={onEdit}
                onRoll={onRoll}
                onAssign={onAssign}
                onClose={onClose}
                onDelete={onDelete}
              />
            ))}
          </section>

          <CollapsibleSection title="ASSIGNED SHARES" count={assignedTrades.length} open={assignedOpen} onToggle={() => setAssignedOpen((value) => !value)}>
            {assignedTrades.length === 0
              ? <div className="mobile-empty-state">No assigned shares.</div>
              : assignedTrades.map((trade) => <MobileAssignedCard key={trade.id} trade={trade} />)}
          </CollapsibleSection>

          <CollapsibleSection title="CLOSED POSITIONS" count={closedTrades.length} open={closedOpen} onToggle={() => setClosedOpen((value) => !value)}>
            {closedTrades.length === 0
              ? <div className="mobile-empty-state">No closed positions.</div>
              : closedTrades.map((trade) => <MobileClosedCard key={trade.id} trade={trade} onReopen={onReopen} onDelete={onDelete} />)}
          </CollapsibleSection>
        </main>
      ) : (
        <main className="mobile-deferred-view">
          <span className="mobile-eyebrow">{tab.toUpperCase()}</span>
          <p>Mobile {tab} view is scheduled for a later phase.</p>
        </main>
      )}
    </div>
  );
}
