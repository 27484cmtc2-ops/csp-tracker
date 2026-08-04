import { useState } from "react";
import { fmt } from "../utils/formatters";
import { getAvailableCoveredCallContracts } from "../utils/coveredCalls";
import { CoveredCallSummary } from "./CoveredCallForm";

export default function ActiveWheelCard({
  trade,
  trades,
  coveredCalls,
  onSellCall,
  onSellShares,
  onCloseCall,
}) {
  const [showShareSaleHelper, setShowShareSaleHelper] = useState(false);
  const hasOpenCall = coveredCalls.length > 0;
  const availableContracts = getAvailableCoveredCallContracts(trades, trade);

  const handleSellShares = () => {
    if (hasOpenCall) {
      setShowShareSaleHelper(true);
      return;
    }
    onSellShares(trade);
  };

  return (
    <article className="active-wheel-card">
      <header className="active-wheel-header">
        <strong>{trade.ticker}</strong>
        <div className="active-wheel-position">
          <span>{trade.shares} shares</span>
          {availableContracts === 0 && <span className="active-wheel-status">Fully covered</span>}
        </div>
      </header>

      <dl className="active-wheel-basis">
        <div>
          <dt>Basis / share</dt>
          <dd>{fmt(trade.adjustedCostPerShare)}</dd>
        </div>
        <div>
          <dt>Total basis</dt>
          <dd>{fmt(trade.adjustedCostBasis)}</dd>
        </div>
      </dl>

      {coveredCalls.map((call) => (
        <CoveredCallSummary key={call.id} call={call} onCloseEarly={onCloseCall} />
      ))}

      <div className="active-wheel-actions">
        {availableContracts > 0 && (
          <button className="csp-btn-sm active-wheel-action" onClick={() => onSellCall(trade)}>SELL CALL</button>
        )}
        <button
          className="csp-btn-sm active-wheel-action"
          onClick={handleSellShares}
          aria-disabled={hasOpenCall}
          aria-describedby={showShareSaleHelper ? `share-sale-blocked-${trade.id}` : undefined}
        >
          SELL SHARES
        </button>
      </div>

      {showShareSaleHelper && (
        <div id={`share-sale-blocked-${trade.id}`} className="active-wheel-helper" role="status">
          Close the call before selling shares.
        </div>
      )}
    </article>
  );
}
