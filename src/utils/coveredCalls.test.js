import {
  createCoveredCall,
  getAvailableCoveredCallContracts,
  validateCoveredCall,
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
