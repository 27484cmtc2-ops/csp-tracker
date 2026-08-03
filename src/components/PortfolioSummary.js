import { fmtShort } from "../utils/formatters";

export default function PortfolioSummary({
  realized,
  openPremium,
  winRate,
  winningTrades,
  closedTradeCount,
}) {
  return (
    <div className="csp-panel" style={{ padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <div>
          <div className="summary-label">REALIZED P&amp;L</div>
          <div style={{ fontSize: 18, color: realized >= 0 ? "#6fdc8c" : "#ff7b7b", fontWeight: 600 }}>
            {fmtShort(realized)}
          </div>
        </div>
        <div>
          <div className="summary-label">OPEN PREMIUM</div>
          <div style={{ fontSize: 18, color: "#9db6ce", fontWeight: 600 }}>
            {fmtShort(openPremium)}
          </div>
        </div>
        <div>
          <div className="summary-label">WIN RATE</div>
          <div style={{ fontSize: 18, color: "#5aa9ff", fontWeight: 600 }}>
            {winRate.toFixed(0)}%
          </div>
          <div style={{ fontSize: 9, color: "#71839a", marginTop: 3 }}>
            {winningTrades}/{closedTradeCount} profitable
          </div>
        </div>
      </div>
    </div>
  );
}
