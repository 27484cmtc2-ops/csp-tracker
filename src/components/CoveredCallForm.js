import { fmt } from "../utils/formatters";
import {
  calculateCoveredCallClose,
  getEstimatedCoveredCallPremium,
} from "../utils/coveredCalls";

export default function CoveredCallForm({
  assignment,
  value,
  availableContracts,
  error,
  onChange,
  onSubmit,
  onClose,
}) {
  const update = (field) => (event) => {
    onChange({ ...value, [field]: event.target.value });
  };

  return (
    <div className="covered-call-layer" role="dialog" aria-modal="true" aria-labelledby="covered-call-title">
      <button className="covered-call-backdrop" onClick={onClose} aria-label="Dismiss covered call form" />
      <section className="covered-call-dialog">
        <div className="covered-call-header">
          <div>
            <span className="mobile-eyebrow">CONTINUE WHEEL</span>
            <h2 id="covered-call-title">Sell covered call</h2>
          </div>
          <button className="covered-call-close" onClick={onClose} aria-label="Close covered call form">×</button>
        </div>

        <div className="covered-call-context">
          <div><span>Wheel</span><strong>{assignment.ticker}</strong></div>
          <div><span>Shares available</span><strong>{availableContracts * 100}</strong></div>
          <div><span>Contracts available</span><strong>{availableContracts}</strong></div>
        </div>

        <div className="covered-call-fields">
          <label>
            <span>Strike</span>
            <input type="number" inputMode="decimal" step="any" value={value.strike} onChange={update("strike")} autoFocus />
          </label>
          <label>
            <span>Expiry</span>
            <input type="date" value={value.expiry} onChange={update("expiry")} />
          </label>
          <label>
            <span>Premium per share</span>
            <input type="number" inputMode="decimal" step="any" value={value.premium} onChange={update("premium")} />
          </label>
          <label>
            <span>Contracts</span>
            <input type="number" inputMode="numeric" min="1" max={availableContracts} step="1" value={value.contracts} onChange={update("contracts")} />
          </label>
        </div>

        <div className="covered-call-preview">
          <span>Estimated total premium</span>
          <strong>{fmt(getEstimatedCoveredCallPremium(value))}</strong>
        </div>
        {error && <div className="covered-call-error" role="alert">{error}</div>}

        <div className="covered-call-submit">
          <button className="csp-btn" onClick={onSubmit}>SELL COVERED CALL</button>
          <button className="csp-btn-sm" onClick={onClose}>CANCEL</button>
        </div>
      </section>
    </div>
  );
}

export function CoveredCallSummary({ call, onCloseEarly }) {
  const premium = call.creditTotal ?? call.premium * call.contracts * 100;
  return (
    <div className="covered-call-summary">
      <span className="covered-call-primary">${call.strike} · {call.expiry}</span>
      <span className="covered-call-secondary">{call.contracts}× · {fmt(premium)}</span>
      {onCloseEarly && <button className="csp-btn-sm covered-call-close-action" onClick={() => onCloseEarly(call)}>CLOSE CALL</button>}
    </div>
  );
}

export function CloseCoveredCallForm({ call, value, error, onChange, onSubmit, onClose }) {
  const update = (field) => (event) => {
    onChange({ ...value, [field]: event.target.value });
  };
  const calculations = calculateCoveredCallClose(call, value);
  const collected = call.creditTotal ?? call.premium * call.contracts * 100;

  return (
    <div className="covered-call-layer" role="dialog" aria-modal="true" aria-labelledby="close-covered-call-title">
      <button className="covered-call-backdrop" onClick={onClose} aria-label="Dismiss covered call close form" />
      <section className="covered-call-dialog">
        <div className="covered-call-header">
          <div>
            <span className="mobile-eyebrow">COVERED CALL MANAGEMENT</span>
            <h2 id="close-covered-call-title">Close covered call early</h2>
          </div>
          <button className="covered-call-close" onClick={onClose} aria-label="Close covered call close form">×</button>
        </div>
        <div className="covered-call-context">
          <div><span>Wheel</span><strong>{call.ticker}</strong></div>
          <div><span>Strike</span><strong>{fmt(call.strike)}</strong></div>
          <div><span>Collected</span><strong>{fmt(collected)}</strong></div>
        </div>
        <div className="covered-call-fields">
          <label>
            <span>Close date</span>
            <input type="date" value={value.closeDate} onChange={update("closeDate")} autoFocus />
          </label>
          <label>
            <span>Close price per share</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={value.closePricePerShare} onChange={update("closePricePerShare")} />
          </label>
          <label>
            <span>Fees</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={value.fees} onChange={update("fees")} />
          </label>
        </div>
        <div className="stock-sale-preview">
          <div><span>Total closing cost</span><strong>{fmt(calculations.closingCost)}</strong></div>
          <div><span>Covered-call P&amp;L</span><strong className={calculations.pnl >= 0 ? "mobile-positive" : "mobile-negative"}>{fmt(calculations.pnl)}</strong></div>
        </div>
        {error && <div className="covered-call-error" role="alert">{error}</div>}
        <div className="covered-call-submit">
          <button className="csp-btn" onClick={onSubmit}>CONFIRM CLOSE</button>
          <button className="csp-btn-sm" onClick={onClose}>CANCEL</button>
        </div>
      </section>
    </div>
  );
}

export function ClosedCoveredCallSummary({ call }) {
  const collected = call.creditTotal ?? call.premium * call.contracts * 100;
  return (
    <article className="stock-sale-summary">
      <div><strong>{call.ticker} · ${call.strike}</strong><span>{call.contracts} contract{call.contracts === 1 ? "" : "s"}</span></div>
      <p>Opened {call.opened} · Closed {call.closeDate}</p>
      <dl>
        <div><dt>Collected</dt><dd>{fmt(collected)}</dd></div>
        <div><dt>Closing cost</dt><dd>{fmt(call.closingCost)}</dd></div>
        <div><dt>Call P&amp;L</dt><dd className={(call.pnl ?? 0) >= 0 ? "mobile-positive" : "mobile-negative"}>{fmt(call.pnl)}</dd></div>
      </dl>
    </article>
  );
}
