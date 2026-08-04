export const EMPTY_COVERED_CALL = {
  strike: "",
  expiry: "",
  premium: "",
  contracts: "1",
};

export const EMPTY_COVERED_CALL_CLOSE = {
  closeDate: "",
  closePricePerShare: "",
  fees: "",
};

export function isCoveredCall(trade) {
  return trade.kind === "covered_call";
}

export function getOpenCoveredCallsForAssignment(trades, assignmentId) {
  return trades.filter(
    (trade) =>
      isCoveredCall(trade) &&
      trade.status === "open" &&
      trade.parentAssignmentId === assignmentId
  );
}

export function getAvailableCoveredCallContracts(trades, assignment) {
  const shareCapacity = Math.floor((Number(assignment.shares) || 0) / 100);
  const coveredContracts = getOpenCoveredCallsForAssignment(
    trades,
    assignment.id
  ).reduce((sum, trade) => sum + (Number(trade.contracts) || 0), 0);
  return Math.max(0, shareCapacity - coveredContracts);
}

export function validateCoveredCall(draft, availableContracts) {
  const strike = Number(draft.strike);
  const premium = Number(draft.premium);
  const contracts = Number(draft.contracts);

  if (!Number.isFinite(strike) || strike <= 0) return "Enter a valid strike.";
  if (!draft.expiry) return "Choose an expiry date.";
  if (!Number.isFinite(premium) || premium <= 0) {
    return "Enter a valid premium per share.";
  }
  if (!Number.isInteger(contracts) || contracts <= 0) {
    return "Enter a whole number of contracts.";
  }
  if (contracts > availableContracts) {
    return `Only ${availableContracts} covered call contract${availableContracts === 1 ? " is" : "s are"} available.`;
  }
  return null;
}

export function createCoveredCall(
  assignment,
  draft,
  { id = Date.now(), opened = new Date().toISOString().split("T")[0] } = {}
) {
  const contracts = Number(draft.contracts);
  return {
    id,
    kind: "covered_call",
    ticker: assignment.ticker,
    strike: Number(draft.strike),
    longStrike: null,
    expiry: draft.expiry,
    premium: Number(draft.premium),
    contracts,
    status: "open",
    opened,
    type: "Covered Call",
    wheelChainId: assignment.wheelChainId || assignment.id,
    parentAssignmentId: assignment.id,
    creditTotal: null,
    costToClose: null,
    pnl: null,
  };
}

export function getEstimatedCoveredCallPremium(draft) {
  const premium = Number(draft.premium);
  const contracts = Number(draft.contracts);
  if (!Number.isFinite(premium) || !Number.isFinite(contracts)) return 0;
  return premium * contracts * 100;
}

export function calculateCoveredCallClose(call, draft) {
  const closePricePerShare = Number(draft.closePricePerShare) || 0;
  const fees = draft.fees === "" ? 0 : Number(draft.fees) || 0;
  const collectedPremium =
    call.creditTotal ?? Number(call.premium) * Number(call.contracts) * 100;
  const closingCost =
    closePricePerShare * Number(call.contracts) * 100 + fees;
  return {
    collectedPremium,
    closingCost,
    pnl: collectedPremium - closingCost,
  };
}

export function validateCoveredCallClose(trades, call, draft) {
  if (!call || !isCoveredCall(call) || call.status !== "open") {
    return "The covered call is no longer open.";
  }
  const assignment = trades.find(
    (trade) => trade.id === call.parentAssignmentId && trade.status === "assigned"
  );
  if (!assignment) return "The linked assignment is no longer active.";
  if (!draft.closeDate) return "Choose a close date.";
  const price = Number(draft.closePricePerShare);
  if (!Number.isFinite(price) || price < 0) {
    return "Enter a valid close price per share.";
  }
  const fees = draft.fees === "" ? 0 : Number(draft.fees);
  if (!Number.isFinite(fees) || fees < 0) return "Enter valid fees.";
  if (!Number.isInteger(Number(call.contracts)) || Number(call.contracts) <= 0) {
    return "The covered call has an invalid contract count.";
  }
  return null;
}

export function closeCoveredCall(trades, call, draft) {
  const calculations = calculateCoveredCallClose(call, draft);
  return trades.map((trade) =>
    trade.id === call.id
      ? {
          ...trade,
          status: "closed",
          closeDate: draft.closeDate,
          closePricePerShare: Number(draft.closePricePerShare),
          closeFees: draft.fees === "" ? 0 : Number(draft.fees),
          closingCost: calculations.closingCost,
          costToClose: calculations.closingCost,
          pnl: calculations.pnl,
        }
      : trade
  );
}
