import { useState } from "react";
import ActiveWheelCard from "../ActiveWheelCard";
import CloudSyncControls from "../CloudSyncControls";
import { ClosedCoveredCallSummary } from "../CoveredCallForm";
import { StockSaleSummary } from "../StockSaleForm";
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
  onClose,
  onMoreActions,
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
        <button className="mobile-more-action" onClick={() => onMoreActions(trade)} aria-label={`More actions for ${trade.ticker}`}>
          <span aria-hidden="true">•••</span>
          <span>MORE</span>
        </button>
      </div>
    </article>
  );
}

function MobileNewTradeSheet({ value, onChange, onSubmit, onClose }) {
  const update = (field) => (event) => {
    onChange({ ...value, [field]: event.target.value });
  };

  return (
    <div className="mobile-sheet-layer" role="dialog" aria-modal="true" aria-labelledby="mobile-add-trade-title">
      <button className="mobile-sheet-backdrop" onClick={onClose} aria-label="Dismiss add trade form" />
      <section className="mobile-sheet mobile-trade-form-sheet">
        <div className="mobile-sheet-handle" aria-hidden="true" />
        <div className="mobile-sheet-header">
          <div>
            <span className="mobile-eyebrow">NEW POSITION</span>
            <h2 id="mobile-add-trade-title">Add trade</h2>
          </div>
          <button className="mobile-sheet-close" onClick={onClose} aria-label="Close add trade form">×</button>
        </div>

        <div className="mobile-trade-form">
          <label>
            <span>Ticker</span>
            <input type="text" inputMode="text" autoCapitalize="characters" autoComplete="off" value={value.ticker} onChange={update("ticker")} />
          </label>
          <div className="mobile-field-pair">
            <label>
              <span>Short strike</span>
              <input type="number" inputMode="decimal" step="any" value={value.strike} onChange={update("strike")} />
            </label>
            <label>
              <span>Long strike <small>optional</small></span>
              <input type="number" inputMode="decimal" step="any" value={value.longStrike} onChange={update("longStrike")} />
            </label>
          </div>
          <div className="mobile-field-pair">
            <label>
              <span>Premium per share</span>
              <input type="number" inputMode="decimal" step="any" value={value.premium} onChange={update("premium")} />
            </label>
            <label>
              <span>Contracts</span>
              <input type="number" inputMode="numeric" step="1" value={value.contracts} onChange={update("contracts")} />
            </label>
          </div>
          <label>
            <span>Expiry</span>
            <input type="date" value={value.expiry} onChange={update("expiry")} />
          </label>
        </div>

        <div className="mobile-sheet-submit">
          <button onClick={onSubmit}>+ ADD TRADE</button>
        </div>
      </section>
    </div>
  );
}

function MobileTradeActionSheet({ trade, onEdit, onRoll, onAssign, onDelete, onClose }) {
  const perform = (callback) => {
    callback();
    onClose();
  };

  return (
    <div className="mobile-sheet-layer" role="dialog" aria-modal="true" aria-labelledby="mobile-actions-title">
      <button className="mobile-sheet-backdrop" onClick={onClose} aria-label="Dismiss trade actions" />
      <section className="mobile-sheet mobile-action-sheet">
        <div className="mobile-sheet-handle" aria-hidden="true" />
        <div className="mobile-action-heading">
          <span className="mobile-eyebrow">POSITION ACTIONS</span>
          <h2 id="mobile-actions-title">{trade.ticker} <small>${trade.strike}</small></h2>
        </div>
        <div className="mobile-action-list">
          <button onClick={() => perform(() => onEdit(trade))}>EDIT TRADE</button>
          <button className="mobile-roll-action" onClick={() => perform(() => onRoll(trade))}>ROLL POSITION</button>
          <button className="mobile-assign-action" onClick={() => perform(() => onAssign(trade))}>RECORD ASSIGNMENT</button>
          <button className="mobile-delete-action" onClick={() => perform(() => onDelete(trade.id))}>DELETE TRADE</button>
          <button onClick={onClose}>CANCEL</button>
        </div>
      </section>
    </div>
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
  realized,
  openPremium,
  winRate,
  winningTrades,
  closedTrades,
  assignedTrades,
  coveredCalls,
  closedCoveredCalls,
  stockSales,
  sortedOpenTrades,
  sortBy,
  sortDir,
  onSort,
  newTrade,
  onNewTradeChange,
  onAddTrade,
  onEdit,
  onRoll,
  onAssign,
  onClose,
  onReopen,
  onDelete,
  onSellCoveredCall,
  onCloseCoveredCall,
  onSellShares,
  syncStatus,
  hasConflict,
  onSyncNow,
  onUseCloud,
  onKeepLocal,
  onFeedback,
}) {
  const [assignedOpen, setAssignedOpen] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);
  const [stockSalesOpen, setStockSalesOpen] = useState(false);
  const [coveredCallHistoryOpen, setCoveredCallHistoryOpen] = useState(false);
  const [addTradeOpen, setAddTradeOpen] = useState(false);
  const [actionTrade, setActionTrade] = useState(null);

  return (
    <div className="mobile-shell">
      <main className="mobile-main">
          <MobilePortfolioSummary
            realized={realized}
            openPremium={openPremium}
            winRate={winRate}
            winningTrades={winningTrades}
            closedTradeCount={closedTrades.length}
          />
          <CloudSyncControls
            status={syncStatus}
            hasConflict={hasConflict}
            onSyncNow={onSyncNow}
            onUseCloud={onUseCloud}
            onKeepLocal={onKeepLocal}
            onFeedback={onFeedback}
            compact
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
                onClose={onClose}
                onMoreActions={setActionTrade}
              />
            ))}
          </section>

          <CollapsibleSection title="ACTIVE WHEELS" count={assignedTrades.length} open={assignedOpen} onToggle={() => setAssignedOpen((value) => !value)}>
            {assignedTrades.length === 0
              ? <div className="mobile-empty-state">No assigned shares.</div>
              : assignedTrades.map((trade) => (
                <ActiveWheelCard
                  key={trade.id}
                  trade={trade}
                  trades={[...assignedTrades, ...coveredCalls]}
                  coveredCalls={coveredCalls.filter((call) => call.parentAssignmentId === trade.id)}
                  onSellCall={onSellCoveredCall}
                  onSellShares={onSellShares}
                  onCloseCall={onCloseCoveredCall}
                />
              ))}
          </CollapsibleSection>

          <CollapsibleSection title="COMPLETED SHARE SALES" count={stockSales.length} open={stockSalesOpen} onToggle={() => setStockSalesOpen((value) => !value)}>
            {stockSales.length === 0
              ? <div className="mobile-empty-state">No completed share sales.</div>
              : stockSales.map((sale) => <StockSaleSummary key={sale.id} sale={sale} />)}
          </CollapsibleSection>

          <CollapsibleSection title="COVERED CALL HISTORY" count={closedCoveredCalls.length} open={coveredCallHistoryOpen} onToggle={() => setCoveredCallHistoryOpen((value) => !value)}>
            {closedCoveredCalls.length === 0
              ? <div className="mobile-empty-state">No closed covered calls.</div>
              : closedCoveredCalls.map((call) => <ClosedCoveredCallSummary key={call.id} call={call} />)}
          </CollapsibleSection>

          <CollapsibleSection title="CLOSED POSITIONS" count={closedTrades.length} open={closedOpen} onToggle={() => setClosedOpen((value) => !value)}>
            {closedTrades.length === 0
              ? <div className="mobile-empty-state">No closed positions.</div>
              : closedTrades.map((trade) => <MobileClosedCard key={trade.id} trade={trade} onReopen={onReopen} onDelete={onDelete} />)}
          </CollapsibleSection>

          <button className="mobile-add-trade-button" onClick={() => setAddTradeOpen(true)} aria-label="Open add trade form">
            <span aria-hidden="true">+</span> ADD TRADE
          </button>
      </main>

      {addTradeOpen && (
        <MobileNewTradeSheet
          value={newTrade}
          onChange={onNewTradeChange}
          onSubmit={onAddTrade}
          onClose={() => setAddTradeOpen(false)}
        />
      )}

      {actionTrade && (
        <MobileTradeActionSheet
          trade={actionTrade}
          onEdit={onEdit}
          onRoll={onRoll}
          onAssign={onAssign}
          onDelete={onDelete}
          onClose={() => setActionTrade(null)}
        />
      )}
    </div>
  );
}
