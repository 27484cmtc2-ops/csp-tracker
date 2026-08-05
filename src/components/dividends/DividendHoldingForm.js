import { DIVIDEND_FREQUENCIES } from "../../utils/dividends";

const FREQUENCY_LABELS = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  annual: "Annual",
};

export default function DividendHoldingForm({ value, error, editing, onChange, onSubmit, onClose }) {
  const update = (field) => (event) => onChange({ ...value, [field]: event.target.value });

  return (
    <div className="dividend-modal-layer" role="dialog" aria-modal="true" aria-labelledby="dividend-form-title">
      <button className="dividend-modal-backdrop" onClick={onClose} aria-label="Close dividend form" />
      <section className="dividend-form-card">
        <header>
          <div>
            <span className="dividend-eyebrow">DIVIDEND HOLDING</span>
            <h2 id="dividend-form-title">{editing ? "Edit holding" : "Add holding"}</h2>
          </div>
          <button className="dividend-form-close" onClick={onClose} aria-label="Close dividend form">×</button>
        </header>

        <div className="dividend-form-grid">
          <label>
            <span>Ticker</span>
            <input type="text" autoCapitalize="characters" value={value.ticker} onChange={update("ticker")} />
          </label>
          <label>
            <span>Number of shares</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={value.shares} onChange={update("shares")} />
          </label>
          <label>
            <span>Dividend amount per share</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={value.dividendPerShare} onChange={update("dividendPerShare")} />
          </label>
          <label>
            <span>Payment frequency</span>
            <select value={value.frequency} onChange={update("frequency")}>
              {Object.keys(DIVIDEND_FREQUENCIES).map((frequency) => (
                <option key={frequency} value={frequency}>{FREQUENCY_LABELS[frequency]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Currency</span>
            <select value={value.currency} onChange={update("currency")}>
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label>
            <span>Account</span>
            <input type="text" value={value.account} onChange={update("account")} placeholder="e.g. TFSA" />
          </label>
          <label>
            <span>Next payment date</span>
            <input type="date" value={value.nextPaymentDate} onChange={update("nextPaymentDate")} />
          </label>
          <label className="dividend-notes-field">
            <span>Notes <small>optional</small></span>
            <textarea value={value.notes} onChange={update("notes")} rows="3" />
          </label>
        </div>

        {error && <div className="dividend-form-error" role="alert">{error}</div>}
        <footer>
          <button className="csp-btn" onClick={onSubmit}>{editing ? "SAVE HOLDING" : "ADD HOLDING"}</button>
          <button className="csp-btn-sm" onClick={onClose}>CANCEL</button>
        </footer>
      </section>
    </div>
  );
}
