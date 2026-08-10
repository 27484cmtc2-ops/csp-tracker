import { bsPut } from "../utils/calculations";

export default function ScreenerPage({ tickers, target, targetUSD, onSelectTicker }) {
  return (
    <div className="csp-panel">
      <div className="panel-heading">
        30 DTE CANDIDATES — PREMIUM TO HIT CA${Math.round(target).toLocaleString()}/mo
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 440 }}>
          <thead><tr>
            {["TICKER", "PRICE", "IV%", "CONTRACTS", "COLLATERAL", "RETURN%"].map((heading) => (
              <th key={heading} className="table-heading" style={{ padding: "9px 14px" }}>{heading}</th>
            ))}
          </tr></thead>
          <tbody>
            {tickers.map((ticker) => {
              const strike = Math.round(ticker.price * 0.95);
              const premium = bsPut(ticker.price, strike, 30 / 365, 0.05, ticker.iv / 100);
              const contracts = premium > 0 ? Math.ceil(targetUSD / (premium * 100)) : null;
              const collateral = contracts ? strike * 100 * contracts : 0;
              const annualReturn = collateral > 0
                ? ((premium * 100 * contracts) / collateral * 100).toFixed(2)
                : "—";
              return (
                <tr
                  key={ticker.ticker}
                  className="row-hover"
                  style={{ borderBottom: "1px solid #151f2b", cursor: "pointer" }}
                  onClick={() => onSelectTicker(ticker)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectTicker(ticker);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td style={{ padding: "9px 14px", color: "#5aa9ff", fontWeight: 600, textAlign: "right" }}>{ticker.ticker}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: "#d7e0ea" }}>${ticker.price}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: ticker.iv > 50 ? "#f59e0b" : ticker.iv > 30 ? "#a0d8a0" : "#9aa8b8" }}>{ticker.iv}%</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: "#d7e0ea" }}>{contracts ? `${contracts}×` : "—"}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: "#a6b3c2" }}>{collateral > 0 ? `$${Math.round(collateral).toLocaleString()}` : "—"}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: "#5aa9ff" }}>{annualReturn}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="panel-note">Click a ticker to explore strikes.</div>
    </div>
  );
}
