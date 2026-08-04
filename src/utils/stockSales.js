import { getOpenCoveredCallsForAssignment } from "./coveredCalls";

export const EMPTY_STOCK_SALE = {
  saleDate: "",
  salePricePerShare: "",
  fees: "",
};

export function isStockSale(trade) {
  return trade.kind === "stock_sale";
}

export function calculateStockSale(assignment, draft) {
  const shares = Number(assignment.shares) || 0;
  const salePricePerShare = Number(draft.salePricePerShare) || 0;
  const fees = Number(draft.fees) || 0;
  const adjustedCostBasis = Number(assignment.adjustedCostBasis) || 0;
  const grossProceeds = salePricePerShare * shares;
  const netProceeds = grossProceeds - fees;
  return {
    grossProceeds,
    netProceeds,
    pnl: netProceeds - adjustedCostBasis,
  };
}

export function validateStockSale(trades, assignment, draft) {
  if (!assignment || assignment.status !== "assigned") {
    return "The assigned position is no longer active.";
  }
  if (!Number.isFinite(Number(assignment.shares)) || Number(assignment.shares) <= 0) {
    return "The assigned position has no shares to sell.";
  }
  if (getOpenCoveredCallsForAssignment(trades, assignment.id).length > 0) {
    return "Close the call before selling shares.";
  }
  if (!draft.saleDate) return "Choose a sale date.";
  const price = Number(draft.salePricePerShare);
  if (!Number.isFinite(price) || price <= 0) {
    return "Enter a valid sale price per share.";
  }
  const fees = draft.fees === "" ? 0 : Number(draft.fees);
  if (!Number.isFinite(fees) || fees < 0) return "Enter valid fees.";
  return null;
}

export function createStockSale(
  assignment,
  draft,
  { id = Date.now() } = {}
) {
  const calculations = calculateStockSale(assignment, draft);
  return {
    id,
    kind: "stock_sale",
    type: "Stock Sale",
    status: "completed",
    ticker: assignment.ticker,
    shares: Number(assignment.shares),
    assignmentDate: assignment.assignmentDate,
    saleDate: draft.saleDate,
    salePricePerShare: Number(draft.salePricePerShare),
    fees: draft.fees === "" ? 0 : Number(draft.fees),
    ...calculations,
    adjustedCostBasis: Number(assignment.adjustedCostBasis),
    adjustedCostPerShare: Number(assignment.adjustedCostPerShare),
    wheelChainId: assignment.wheelChainId || assignment.id,
    parentAssignmentId: assignment.id,
  };
}

export function completeStockSale(trades, assignment, draft, options) {
  const sale = createStockSale(assignment, draft, options);
  return trades
    .map((trade) =>
      trade.id === assignment.id
        ? {
            ...trade,
            status: "sold",
            soldDate: sale.saleDate,
            stockSaleId: sale.id,
          }
        : trade
    )
    .concat(sale);
}
