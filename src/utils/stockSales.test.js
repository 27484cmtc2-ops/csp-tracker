import {
  calculateStockSale,
  completeStockSale,
  createStockSale,
  validateStockSale,
} from "./stockSales";

const assignment = {
  id: 200,
  ticker: "PLTR",
  status: "assigned",
  shares: 100,
  assignmentDate: "2026-07-15",
  adjustedCostBasis: 11995,
  adjustedCostPerShare: 119.95,
  wheelChainId: 100,
};

const validDraft = {
  saleDate: "2026-08-10",
  salePricePerShare: "128",
  fees: "5",
};

test.each([
  [{ ...validDraft, saleDate: "" }, "sale date"],
  [{ ...validDraft, salePricePerShare: "0" }, "sale price per share"],
  [{ ...validDraft, fees: "-1" }, "valid fees"],
])("rejects invalid full-lot sale input", (draft, expectedMessage) => {
  expect(validateStockSale([assignment], assignment, draft)).toContain(expectedMessage);
});

test("blocks a share sale while any linked covered call is open", () => {
  const trades = [
    assignment,
    {
      id: 201,
      kind: "covered_call",
      status: "open",
      parentAssignmentId: assignment.id,
      contracts: 1,
    },
  ];

  expect(validateStockSale(trades, assignment, validDraft)).toBe(
    "Close the call before selling shares."
  );
});

test("calculates gross proceeds, net proceeds, and stock P&L", () => {
  expect(calculateStockSale(assignment, validDraft)).toEqual({
    grossProceeds: 12800,
    netProceeds: 12795,
    pnl: 800,
  });
});

test("creates a linked sale with assignment-controlled values and assignment date", () => {
  const sale = createStockSale(
    assignment,
    { ...validDraft, ticker: "EDITED", shares: 1, wheelChainId: 999 },
    { id: 300 }
  );

  expect(sale).toMatchObject({
    id: 300,
    kind: "stock_sale",
    status: "completed",
    ticker: "PLTR",
    shares: 100,
    assignmentDate: "2026-07-15",
    wheelChainId: 100,
    parentAssignmentId: 200,
    grossProceeds: 12800,
    netProceeds: 12795,
    pnl: 800,
  });
});

test("atomically marks the assignment sold and appends its completed sale", () => {
  const originalTrades = [assignment, { id: 1, ticker: "OTHER", status: "open" }];
  const result = completeStockSale(originalTrades, assignment, validDraft, { id: 300 });

  expect(originalTrades[0].status).toBe("assigned");
  expect(result).toHaveLength(3);
  expect(result.find((trade) => trade.id === assignment.id)).toMatchObject({
    status: "sold",
    soldDate: "2026-08-10",
    stockSaleId: 300,
  });
  expect(result.find((trade) => trade.id === 300)).toMatchObject({
    kind: "stock_sale",
    parentAssignmentId: assignment.id,
  });
});
