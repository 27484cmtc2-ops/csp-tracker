import { fmt } from "../utils/formatters";

export default function StrikesPage({ tickers, selectedTicker, target, targetUSD, strikes, onSelectTicker }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {tickers.map((ticker) => (
          <button key={ticker.ticker} className={`tab-btn${selectedTicker.ticker === ticker.ticker ? " active" : ""}`} onClick={() => onSelectTicker(ticker)} style={{ padding: "5px 12px", fontSize: 9 }}>
            {ticker.ticker}
          </button>
        ))}
      </div>
      <div className="csp-panel">
        <div className="strikes-heading">
          <span style={{ fontSize: 9, color: "#7f8ea3", letterSpacing: ".1em" }}>{selectedTicker.ticker} · ${selectedTicker.price} · IV {selectedTicker.iv}% · 30 DTE</span>
          <span style={{ fontSize: 9, color: "#607086" }}>target CA${Math.round(target).toLocaleString()}/mo</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead><tr>
              {["STRIKE", "OTM%", "PREMIUM", "DELTA", "CONTRACTS", "COLLATERAL", "TOTAL"].map((heading) => (
                <th key={heading} className="table-heading">{heading}</th>
              ))}
            </tr></thead>
            <tbody>
              {strikes.map((strike, index) => (
                <tr key={index} className="strike-row" style={{ borderBottom: "1px solid #151f2b", background: index === 1 ? "#0a1a0a" : "transparent" }}>
                  <td className="numeric-cell" style={{ color: "#5aa9ff", fontWeight: 600 }}>${strike.strike}</td>
                  <td className="numeric-cell" style={{ color: "#9aa8b8" }}>{strike.otmPct}%</td>
                  <td className="numeric-cell">{fmt(strike.premium)}</td>
                  <td className="numeric-cell" style={{ color: strike.delta > 0.3 ? "#f59e0b" : "#6a9a6a" }}>{strike.delta.toFixed(2)}</td>
                  <td className="numeric-cell" style={{ color: "#9db6ce" }}>{strike.contracts ? `${strike.contracts}×` : "—"}</td>
                  <td className="numeric-cell" style={{ color: "#9aa8b8" }}>{strike.collateral ? `$${Math.round(strike.collateral).toLocaleString()}` : "—"}</td>
                  <td className="numeric-cell" style={{ color: strike.premiumTotal >= targetUSD ? "#5aa9ff" : "#d7e0ea", fontWeight: strike.premiumTotal >= targetUSD ? 600 : 400 }}>
                    {fmt(strike.premiumTotal)}{strike.premiumTotal >= targetUSD ? " ✓" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-note">Row 2 = 5% OTM sweet spot · ✓ meets target · Δ&gt;0.30 = higher assignment risk</div>
      </div>
    </div>
  );
}
