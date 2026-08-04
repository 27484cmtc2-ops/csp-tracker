import {
  calculateCoveredCallClose,
  closeCoveredCall,
  createCoveredCall,
  getAvailableCoveredCallContracts,
  validateCoveredCall,
  validateCoveredCallClose,
} from "./coveredCalls";

const assignment = {
  id: 20,
  ticker: "PLTR",
  status: "assigned",
  shares: 300,
  wheelChainId: 10,
};

test("available capacity subtracts every open call linked to the assignment", () => {
  const trades = [
    assignment,
    { id: 21, kind: "covered_call", status: "open", parentAssignmentId: 20, contracts: 1 },
    { id: 22, kind: "covered_call", status: "open", parentAssignmentId: 20, contracts: 1 },
    { id: 23, kind: "covered_call", status: "closed", parentAssignmentId: 20, contracts: 4 },
    { id: 24, kind: "covered_call", status: "open", parentAssignmentId: 99, contracts: 2 },
  ];

  expect(getAvailableCoveredCallContracts(trades, assignment)).toBe(1);
});

test.each([
  [{ strike: "", expiry: "2026-09-18", premium: "1.8", contracts: "1" }, "valid strike"],
  [{ strike: "130", expiry: "", premium: "1.8", contracts: "1" }, "expiry"],
  [{ strike: "130", expiry: "2026-09-18", premium: "0", contracts: "1" }, "premium per share"],
  [{ strike: "130", expiry: "2026-09-18", premium: "1.8", contracts: "1.5" }, "whole number"],
  [{ strike: "130", expiry: "2026-09-18", premium: "1.8", contracts: "2" }, "1 covered call contract"],
])("rejects invalid covered-call input", (draft, expectedMessage) => {
  expect(validateCoveredCall(draft, 1)).toContain(expectedMessage);
});

test("covered-call ownership and wheel linkage always come from the assignment", () => {
  const call = createCoveredCall(
    assignment,
    {
      ticker: "EDITED",
      wheelChainId: 999,
      parentAssignmentId: 999,
      strike: "130",
      expiry: "2026-09-18",
      premium: "1.80",
      contracts: "1",
    },
    { id: 30, opened: "2026-08-03" }
  );

  expect(call).toMatchObject({
    id: 30,
    kind: "covered_call",
    ticker: "PLTR",
    wheelChainId: 10,
    parentAssignmentId: 20,
    strike: 130,
    premium: 1.8,
    contracts: 1,
    status: "open",
  });
});

test("calculates early-close cost and covered-call P&L", () => {
  const call = {
    kind: "covered_call",
    status: "open",
    premium: 1.8,
    contracts: 2,
  };
  expect(calculateCoveredCallClose(call, { closePricePerShare: "0.65", fees: "2" })).toEqual({
    collectedPremium: 360,
    closingCost: 132,
    pnl: 228,
  });
});

test.each([
  [{ closeDate: "", closePricePerShare: "0.5", fees: "0" }, "close date"],
  [{ closeDate: "2026-08-20", closePricePerShare: "-1", fees: "0" }, "close price per share"],
  [{ closeDate: "2026-08-20", closePricePerShare: "0.5", fees: "-1" }, "valid fees"],
])("rejects invalid covered-call close input", (draft, expectedMessage) => {
  const call = {
    id: 40,
    kind: "covered_call",
    status: "open",
    contracts: 1,
    parentAssignmentId: assignment.id,
  };
  expect(validateCoveredCallClose([assignment, call], call, draft)).toContain(expectedMessage);
});

test("closing a call preserves linkage and immediately restores assignment capacity", () => {
  const call = {
    id: 40,
    kind: "covered_call",
    ticker: "PLTR",
    status: "open",
    premium: 1.8,
    contracts: 1,
    wheelChainId: 10,
    parentAssignmentId: assignment.id,
  };
  const other = { id: 99, ticker: "OTHER", status: "open" };
  const result = closeCoveredCall(
    [assignment, call, other],
    call,
    { closeDate: "2026-08-20", closePricePerShare: "0.65", fees: "1" }
  );
  const closedCall = result.find((trade) => trade.id === call.id);

  expect(closedCall).toMatchObject({
    status: "closed",
    closeDate: "2026-08-20",
    closePricePerShare: 0.65,
    closeFees: 1,
    closingCost: 66,
    pnl: 114,
    wheelChainId: 10,
    parentAssignmentId: assignment.id,
  });
  expect(result.find((trade) => trade.id === other.id)).toEqual(other);
  expect(getAvailableCoveredCallContracts(result, assignment)).toBe(3);
});
