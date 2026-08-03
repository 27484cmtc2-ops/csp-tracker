import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("./cloudStorage", () => ({
  CloudConflictError: class CloudConflictError extends Error {},
  saveCloudData: jest.fn(),
  loadCloudData: jest.fn(() => new Promise(() => {})),
}));

import App from "./App";
import { loadCloudData } from "./cloudStorage";

beforeEach(() => {
  localStorage.clear();
  loadCloudData.mockImplementation(() => new Promise(() => {}));
});

test("renders the tracker and its default portfolio data", () => {
  render(<App />);

  expect(screen.getByText("LOG NEW TRADE")).toBeInTheDocument();
  expect(screen.getByText(/OPEN POSITIONS/)).toBeInTheDocument();
  expect(screen.getAllByText(/CLOSED POSITIONS/)).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Open add trade form" })).toBeInTheDocument();
  expect(screen.queryByText("CSP TRACKER")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "tracker" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /assigned shares/i })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: /closed positions/i })).toHaveAttribute("aria-expanded", "false");
});

test("opens the mobile add-trade sheet with labeled fields", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "Open add trade form" }));

  expect(screen.getByRole("dialog", { name: "Add trade" })).toBeInTheDocument();
  expect(screen.getByLabelText("Ticker")).toHaveAttribute("type", "text");
  expect(screen.getByLabelText("Short strike")).toHaveAttribute("inputmode", "decimal");
  expect(screen.getByLabelText("Premium per share")).toHaveAttribute("type", "number");
  expect(screen.getByLabelText("Contracts")).toHaveAttribute("inputmode", "numeric");
  expect(screen.getByLabelText("Expiry")).toHaveAttribute("type", "date");
});

test("opens mobile position actions from the more button", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "More actions for NVDA" }));

  expect(screen.getByRole("dialog", { name: /NVDA/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "EDIT TRADE" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ROLL POSITION" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "RECORD ASSIGNMENT" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "DELETE TRADE" })).toBeInTheDocument();
});

test("persists a covered call with assignment-controlled wheel linkage", () => {
  const assignment = {
    id: 200,
    ticker: "PLTR",
    strike: 120,
    premium: 2,
    contracts: 1,
    status: "assigned",
    shares: 100,
    assignmentDate: "2026-08-01",
    adjustedCostPerShare: 118,
    adjustedCostBasis: 11800,
    wheelChainId: 100,
  };
  localStorage.setItem("csp_trades", JSON.stringify([assignment]));
  localStorage.setItem("csp_target", "500");

  render(<App />);
  fireEvent.click(screen.getAllByRole("button", { name: "SELL COVERED CALL" })[0]);

  const dialog = screen.getByRole("dialog", { name: "Sell covered call" });
  expect(screen.getByText("Estimated total premium")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Strike"), { target: { value: "130" } });
  fireEvent.change(screen.getByLabelText("Expiry"), { target: { value: "2026-09-18" } });
  fireEvent.change(screen.getByLabelText("Premium per share"), { target: { value: "1.8" } });
  fireEvent.change(screen.getByLabelText("Contracts"), { target: { value: "1" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "SELL COVERED CALL" }));

  const savedTrades = JSON.parse(localStorage.getItem("csp_trades"));
  expect(savedTrades).toHaveLength(2);
  expect(savedTrades[1]).toMatchObject({
    kind: "covered_call",
    ticker: "PLTR",
    wheelChainId: 100,
    parentAssignmentId: 200,
    strike: 130,
    premium: 1.8,
    contracts: 1,
    status: "open",
  });
  expect(screen.getByText(/OPEN POSITIONS/)).toHaveTextContent("(0)");
});

test("persists a full-lot stock sale and removes the assignment from active positions", () => {
  const assignment = {
    id: 210,
    ticker: "SOFI",
    strike: 15,
    premium: 1,
    contracts: 1,
    status: "assigned",
    shares: 100,
    assignmentDate: "2026-07-10",
    adjustedCostPerShare: 14,
    adjustedCostBasis: 1400,
    wheelChainId: 110,
  };
  localStorage.setItem("csp_trades", JSON.stringify([assignment]));
  localStorage.setItem("csp_target", "500");

  render(<App />);
  fireEvent.click(screen.getAllByRole("button", { name: "SELL SHARES" })[0]);
  const dialog = screen.getByRole("dialog", { name: "Sell shares" });
  fireEvent.change(screen.getByLabelText("Sale date"), { target: { value: "2026-08-12" } });
  fireEvent.change(screen.getByLabelText("Sale price per share"), { target: { value: "16" } });
  fireEvent.change(screen.getByLabelText("Fees"), { target: { value: "5" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "CONFIRM SHARE SALE" }));

  const savedTrades = JSON.parse(localStorage.getItem("csp_trades"));
  const savedAssignment = savedTrades.find((trade) => trade.id === 210);
  const sale = savedTrades.find((trade) => trade.kind === "stock_sale");
  expect(savedAssignment).toMatchObject({
    status: "sold",
    soldDate: "2026-08-12",
    stockSaleId: sale.id,
  });
  expect(sale).toMatchObject({
    ticker: "SOFI",
    shares: 100,
    assignmentDate: "2026-07-10",
    wheelChainId: 110,
    parentAssignmentId: 210,
    grossProceeds: 1600,
    netProceeds: 1595,
    pnl: 195,
  });
  expect(screen.getByRole("button", { name: /assigned shares/i })).toHaveTextContent("(0)");
  expect(screen.getAllByText(/COMPLETED SHARE SALES/).length).toBeGreaterThan(0);
  expect(screen.getByText(/OPEN POSITIONS/)).toHaveTextContent("(0)");
});
