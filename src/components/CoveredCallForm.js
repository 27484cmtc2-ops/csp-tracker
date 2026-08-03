import { fmt } from "../utils/formatters";
import { getEstimatedCoveredCallPremium } from "../utils/coveredCalls";

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

export function CoveredCallSummary({ call }) {
  const premium = call.creditTotal ?? call.premium * call.contracts * 100;
  return (
    <div className="covered-call-summary">
      <span className="covered-call-badge">COVERED CALL</span>
      <strong>${call.strike} · {call.expiry}</strong>
      <span>{call.contracts} contract{call.contracts === 1 ? "" : "s"} · {fmt(premium)} collected</span>
    </div>
  );
}
