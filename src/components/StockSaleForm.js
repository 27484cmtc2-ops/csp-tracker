import { fmt } from "../utils/formatters";
import { calculateStockSale } from "../utils/stockSales";

export default function StockSaleForm({ assignment, value, error, onChange, onSubmit, onClose }) {
  const update = (field) => (event) => {
    onChange({ ...value, [field]: event.target.value });
  };
  const calculations = calculateStockSale(assignment, value);

  return (
    <div className="covered-call-layer" role="dialog" aria-modal="true" aria-labelledby="stock-sale-title">
      <button className="covered-call-backdrop" onClick={onClose} aria-label="Dismiss share sale form" />
      <section className="covered-call-dialog stock-sale-dialog">
        <div className="covered-call-header">
          <div>
            <span className="mobile-eyebrow">COMPLETE STOCK POSITION</span>
            <h2 id="stock-sale-title">Sell shares</h2>
          </div>
          <button className="covered-call-close" onClick={onClose} aria-label="Close share sale form">×</button>
        </div>

        <div className="covered-call-context">
          <div><span>Wheel</span><strong>{assignment.ticker}</strong></div>
          <div><span>Shares</span><strong>{assignment.shares}</strong></div>
          <div><span>Adjusted basis</span><strong>{fmt(assignment.adjustedCostBasis)}</strong></div>
        </div>

        <div className="covered-call-fields">
          <label>
            <span>Sale date</span>
            <input type="date" value={value.saleDate} onChange={update("saleDate")} autoFocus />
          </label>
          <label>
            <span>Sale price per share</span>
            <input type="number" inputMode="decimal" step="any" value={value.salePricePerShare} onChange={update("salePricePerShare")} />
          </label>
          <label>
            <span>Fees</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={value.fees} onChange={update("fees")} />
          </label>
        </div>

        <div className="stock-sale-preview">
          <div><span>Gross proceeds</span><strong>{fmt(calculations.grossProceeds)}</strong></div>
          <div><span>Net proceeds</span><strong>{fmt(calculations.netProceeds)}</strong></div>
          <div><span>Stock P&amp;L</span><strong className={calculations.pnl >= 0 ? "mobile-positive" : "mobile-negative"}>{fmt(calculations.pnl)}</strong></div>
        </div>
        {error && <div className="covered-call-error" role="alert">{error}</div>}

        <div className="covered-call-submit">
          <button className="csp-btn" onClick={onSubmit}>CONFIRM SHARE SALE</button>
          <button className="csp-btn-sm" onClick={onClose}>CANCEL</button>
        </div>
      </section>
    </div>
  );
}

export function StockSaleSummary({ sale, onDelete }) {
  return (
    <article className="stock-sale-summary">
      <div><strong>{sale.ticker}</strong><span>{sale.shares} shares</span></div>
      <p>Sold {sale.saleDate} at {fmt(sale.salePricePerShare)}</p>
      <dl>
        <div><dt>Net proceeds</dt><dd>{fmt(sale.netProceeds)}</dd></div>
        <div><dt>Adjusted basis</dt><dd>{fmt(sale.adjustedCostBasis)}</dd></div>
        <div><dt>Stock P&amp;L</dt><dd className={sale.pnl >= 0 ? "mobile-positive" : "mobile-negative"}>{fmt(sale.pnl)}</dd></div>
      </dl>
      {onDelete && (
        <div className="completed-history-actions">
          <button type="button" className="csp-btn-sm csp-btn-danger" aria-label={`Delete completed share sale for ${sale.ticker}`} onClick={() => onDelete(sale.id)}>DELETE</button>
        </div>
      )}
    </article>
  );
}
