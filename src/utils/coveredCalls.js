export const EMPTY_COVERED_CALL = {
  strike: "",
  expiry: "",
  premium: "",
  contracts: "1",
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
