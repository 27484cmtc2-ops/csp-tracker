export default function NewTradeForm({ value, onChange, onSubmit }) {
  const update = (field) => (event) => {
    onChange({ ...value, [field]: event.target.value });
  };

  return (
    <div className="csp-panel" style={{ padding: 14, marginBottom: 14 }}>
      <div className="section-label" style={{ marginBottom: 10 }}>LOG NEW TRADE</div>
      <div className="csp-form-grid" style={{ marginBottom: 7 }}>
        <input className="csp-input" placeholder="TICKER" value={value.ticker} onChange={update("ticker")} />
        <input className="csp-input" placeholder="SHORT STRIKE" value={value.strike} onChange={update("strike")} />
        <input className="csp-input" placeholder="LONG STRIKE (opt)" value={value.longStrike} onChange={update("longStrike")} />
      </div>
      <div className="csp-form-grid" style={{ marginBottom: 10 }}>
        <input className="csp-input" placeholder="PREMIUM" value={value.premium} onChange={update("premium")} />
        <input className="csp-input" placeholder="CONTRACTS" value={value.contracts} onChange={update("contracts")} />
        <input className="csp-input" type="date" value={value.expiry} onChange={update("expiry")} required />
      </div>
      <button className="csp-btn" onClick={onSubmit}>+ ADD TRADE</button>
    </div>
  );
}
