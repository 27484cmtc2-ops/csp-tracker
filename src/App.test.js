import { act, fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("./cloudStorage", () => ({
  CloudConflictError: class CloudConflictError extends Error {},
  saveCloudData: jest.fn(),
  loadCloudData: jest.fn(() => new Promise(() => {})),
}));

jest.mock("./feedbackStorage", () => ({
  submitFeedback: jest.fn(),
}));

import App from "./App";
import { loadCloudData, saveCloudData } from "./cloudStorage";
import { DEFAULT_TRADES } from "./data/trackerData";
import { getTrackerStorageKeys } from "./hooks/useTrackerData";

const TEST_USER_ID = "test-user";
const TEST_KEYS = getTrackerStorageKeys(TEST_USER_ID);

beforeEach(() => {
  localStorage.clear();
  loadCloudData.mockImplementation(() => new Promise(() => {}));
  saveCloudData.mockReset();
  saveCloudData.mockResolvedValue({ updatedAt: "version-2" });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function completedHistoryTrades() {
  return [
    {
      id: 300,
      ticker: "SALE",
      status: "sold",
      shares: 100,
      adjustedCostBasis: 1000,
      adjustedCostPerShare: 10,
      wheelChainId: 300,
    },
    {
      id: 301,
      kind: "stock_sale",
      type: "Stock Sale",
      status: "completed",
      ticker: "SALE",
      shares: 100,
      saleDate: "2026-08-01",
      salePricePerShare: 12,
      netProceeds: 1199,
      adjustedCostBasis: 1000,
      pnl: 199,
      parentAssignmentId: 300,
      wheelChainId: 300,
    },
    {
      id: 302,
      kind: "covered_call",
      type: "Covered Call",
      status: "closed",
      ticker: "CALL",
      strike: 15,
      contracts: 1,
      premium: 0.5,
      opened: "2026-07-01",
      closeDate: "2026-08-01",
      closingCost: 20,
      pnl: 30,
      parentAssignmentId: 303,
      wheelChainId: 303,
    },
    {
      id: 303,
      ticker: "ACTIVE",
      status: "assigned",
      shares: 100,
      adjustedCostBasis: 1400,
      adjustedCostPerShare: 14,
      wheelChainId: 303,
    },
    {
      id: 304,
      kind: "covered_call",
      type: "Covered Call",
      status: "open",
      ticker: "ACTIVE",
      strike: 16,
      expiry: "2026-09-18",
      contracts: 1,
      premium: 0.4,
      parentAssignmentId: 303,
      wheelChainId: 303,
    },
    {
      id: 305,
      ticker: "PUT",
      type: "CSP",
      status: "open",
      strike: 10,
      expiry: "2026-09-18",
      contracts: 1,
      premium: 0.2,
    },
  ];
}

function seedCompletedHistory(trades = completedHistoryTrades()) {
  localStorage.setItem(TEST_KEYS.trades, JSON.stringify(trades));
  localStorage.setItem(TEST_KEYS.target, "500");
  return trades;
}

function openPut(id = 10) {
  return {
    id,
    ticker: "PUT",
    type: "CSP",
    status: "open",
    strike: 20,
    expiry: "2026-09-18",
    contracts: 1,
    premium: 1,
    opened: "2026-08-01",
    costToClose: null,
    pnl: null,
    creditTotal: null,
  };
}

function seedTrades(trades) {
  localStorage.setItem(TEST_KEYS.trades, JSON.stringify(trades));
  localStorage.setItem(TEST_KEYS.target, "500");
}

function undoAndExpect(expectedTrades) {
  fireEvent.click(screen.getByRole("button", { name: "UNDO" }));
  expect(JSON.parse(localStorage.getItem(TEST_KEYS.trades))).toEqual(expectedTrades);
  expect(screen.queryByRole("button", { name: "UNDO" })).not.toBeInTheDocument();
}

test("renders the tracker with an empty portfolio by default", () => {
  render(<App userId={TEST_USER_ID} />);

  expect(screen.getByText("LOG NEW TRADE")).toBeInTheDocument();
  expect(screen.getByText(/OPEN POSITIONS/)).toBeInTheDocument();
  expect(screen.getAllByText("No open positions.")).toHaveLength(2);
  expect(screen.getAllByText(/CLOSED POSITIONS/)).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Open add trade form" })).toBeInTheDocument();
  expect(screen.queryByText("CSP TRACKER")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "tracker" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /active wheels/i })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: /closed positions/i })).toHaveAttribute("aria-expanded", "false");
});

test("opens the mobile add-trade sheet with labeled fields", () => {
  render(<App userId={TEST_USER_ID} />);

  fireEvent.click(screen.getByRole("button", { name: "Open add trade form" }));

  expect(screen.getByRole("dialog", { name: "Add trade" })).toBeInTheDocument();
  expect(screen.getByLabelText("Ticker")).toHaveAttribute("type", "text");
  expect(screen.getByLabelText("Short strike")).toHaveAttribute("inputmode", "decimal");
  expect(screen.getByLabelText("Premium per share")).toHaveAttribute("type", "number");
  expect(screen.getByLabelText("Contracts")).toHaveAttribute("inputmode", "numeric");
  expect(screen.getByLabelText("Expiry")).toHaveAttribute("type", "date");
  expect(screen.getByLabelText("Expiry")).toBeRequired();
});

test("blocks a new trade without expiry on desktop and mobile", () => {
  const alert = jest.spyOn(window, "alert").mockImplementation(() => {});
  localStorage.setItem(TEST_KEYS.trades, "[]");
  localStorage.setItem(TEST_KEYS.target, "500");
  render(<App userId={TEST_USER_ID} />);

  fireEvent.change(screen.getByPlaceholderText("TICKER"), { target: { value: "BETA" } });
  fireEvent.change(screen.getByPlaceholderText("SHORT STRIKE"), { target: { value: "10" } });
  fireEvent.change(screen.getByPlaceholderText("PREMIUM"), { target: { value: "0.1" } });
  fireEvent.change(screen.getByPlaceholderText("CONTRACTS"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "+ ADD TRADE" }));

  expect(alert).toHaveBeenLastCalledWith("Choose an expiry date.");
  expect(JSON.parse(localStorage.getItem(TEST_KEYS.trades))).toEqual([]);

  fireEvent.click(screen.getByRole("button", { name: "Open add trade form" }));
  const mobileDialog = screen.getByRole("dialog", { name: "Add trade" });
  fireEvent.click(within(mobileDialog).getByRole("button", { name: "+ ADD TRADE" }));

  expect(alert).toHaveBeenCalledTimes(2);
  expect(JSON.parse(localStorage.getItem(TEST_KEYS.trades))).toEqual([]);
  alert.mockRestore();
});

test("undo restores add, edit, close, assign, and roll put mutations", () => {
  seedTrades([]);
  let view = render(<App userId={TEST_USER_ID} />);
  fireEvent.change(screen.getByPlaceholderText("TICKER"), { target: { value: "ADD" } });
  fireEvent.change(screen.getByPlaceholderText("SHORT STRIKE"), { target: { value: "10" } });
  fireEvent.change(screen.getByPlaceholderText("PREMIUM"), { target: { value: "0.5" } });
  fireEvent.change(screen.getByPlaceholderText("CONTRACTS"), { target: { value: "1" } });
  fireEvent.change(document.querySelector(".desktop-interface input[type='date']"), { target: { value: "2026-10-16" } });
  fireEvent.click(screen.getByRole("button", { name: "+ ADD TRADE" }));
  undoAndExpect([]);
  view.unmount();

  const original = [openPut()];
  seedTrades(original);
  view = render(<App userId={TEST_USER_ID} />);
  fireEvent.click(screen.getAllByRole("button", { name: "EDIT" })[0]);
  fireEvent.change(screen.getAllByPlaceholderText("TICKER")[1], { target: { value: "EDITED" } });
  fireEvent.click(screen.getByRole("button", { name: "SAVE CHANGES" }));
  undoAndExpect(original);
  view.unmount();

  seedTrades(original);
  view = render(<App userId={TEST_USER_ID} />);
  fireEvent.click(screen.getAllByRole("button", { name: "CLOSE" })[0]);
  fireEvent.change(screen.getByPlaceholderText("e.g. 27.00"), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("button", { name: "CONFIRM CLOSE" }));
  undoAndExpect(original);
  view.unmount();

  seedTrades(original);
  view = render(<App userId={TEST_USER_ID} />);
  fireEvent.click(screen.getAllByRole("button", { name: "ASSIGN" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "CONFIRM ASSIGNMENT" }));
  undoAndExpect(original);
  view.unmount();

  seedTrades(original);
  view = render(<App userId={TEST_USER_ID} />);
  fireEvent.click(screen.getAllByRole("button", { name: "ROLL" })[0]);
  fireEvent.change(screen.getByPlaceholderText("NEW PREMIUM"), { target: { value: "1.25" } });
  const rollDates = document.querySelectorAll("input[type='date']");
  fireEvent.change(rollDates[rollDates.length - 1], { target: { value: "2026-11-20" } });
  fireEvent.click(screen.getByRole("button", { name: "CONFIRM ROLL" }));
  undoAndExpect(original);
  view.unmount();
});

test("opens mobile position actions from the more button", () => {
  localStorage.setItem(TEST_KEYS.trades, JSON.stringify(DEFAULT_TRADES));
  localStorage.setItem(TEST_KEYS.target, "500");
  render(<App userId={TEST_USER_ID} />);

  fireEvent.click(screen.getByRole("button", { name: "More actions for NVDA" }));

  expect(screen.getByRole("dialog", { name: /NVDA/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "EDIT TRADE" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ROLL POSITION" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "RECORD ASSIGNMENT" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "DELETE TRADE" })).toBeInTheDocument();
});

test("opens authenticated beta feedback without exposing tracker data", () => {
  render(<App userId={TEST_USER_ID} />);

  const feedbackButtons = screen.getAllByRole("button", { name: "Feedback" });
  fireEvent.click(feedbackButtons[0]);

  const dialog = screen.getByRole("dialog", { name: "Help improve Wheel App" });
  expect(within(dialog).getByLabelText("Feedback type")).toBeInTheDocument();
  expect(within(dialog).getByLabelText("Message")).toBeRequired();
  expect(within(dialog).getByLabelText("Optional email")).toHaveAttribute("type", "email");
  expect(within(dialog).queryByText("NVDA")).not.toBeInTheDocument();
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
  localStorage.setItem(TEST_KEYS.trades, JSON.stringify([assignment]));
  localStorage.setItem(TEST_KEYS.target, "500");

  render(<App userId={TEST_USER_ID} />);
  fireEvent.click(screen.getAllByRole("button", { name: "SELL CALL" })[0]);

  const dialog = screen.getByRole("dialog", { name: "Sell covered call" });
  expect(screen.getByText("Estimated total premium")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Strike"), { target: { value: "130" } });
  fireEvent.change(screen.getByLabelText("Expiry"), { target: { value: "2026-09-18" } });
  fireEvent.change(screen.getByLabelText("Premium per share"), { target: { value: "1.8" } });
  fireEvent.change(screen.getByLabelText("Contracts"), { target: { value: "1" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "SELL COVERED CALL" }));

  const savedTrades = JSON.parse(localStorage.getItem(TEST_KEYS.trades));
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
  undoAndExpect([assignment]);
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
  localStorage.setItem(TEST_KEYS.trades, JSON.stringify([assignment]));
  localStorage.setItem(TEST_KEYS.target, "500");

  render(<App userId={TEST_USER_ID} />);
  fireEvent.click(screen.getAllByRole("button", { name: "SELL SHARES" })[0]);
  const dialog = screen.getByRole("dialog", { name: "Sell shares" });
  fireEvent.change(screen.getByLabelText("Sale date"), { target: { value: "2026-08-12" } });
  fireEvent.change(screen.getByLabelText("Sale price per share"), { target: { value: "16" } });
  fireEvent.change(screen.getByLabelText("Fees"), { target: { value: "5" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "CONFIRM SHARE SALE" }));

  const savedTrades = JSON.parse(localStorage.getItem(TEST_KEYS.trades));
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
  expect(screen.getByRole("button", { name: /active wheels/i })).toHaveTextContent("(0)");
  expect(screen.getAllByText(/COMPLETED SHARE SALES/).length).toBeGreaterThan(0);
  expect(screen.getByText(/OPEN POSITIONS/)).toHaveTextContent("(0)");
  undoAndExpect([assignment]);
});

test("explains why share sales are blocked when a covered call is open", () => {
  const assignment = {
    id: 220,
    ticker: "PLTR",
    status: "assigned",
    shares: 100,
    assignmentDate: "2026-07-10",
    adjustedCostPerShare: 14,
    adjustedCostBasis: 1400,
    wheelChainId: 120,
  };
  const coveredCall = {
    id: 221,
    kind: "covered_call",
    ticker: "PLTR",
    status: "open",
    strike: 16,
    expiry: "2026-09-18",
    premium: 0.5,
    contracts: 1,
    parentAssignmentId: 220,
    wheelChainId: 120,
  };
  localStorage.setItem(TEST_KEYS.trades, JSON.stringify([assignment, coveredCall]));
  localStorage.setItem(TEST_KEYS.target, "500");

  render(<App userId={TEST_USER_ID} />);

  const blockedButtons = screen.getAllByRole("button", { name: "SELL SHARES" }).filter(
    (button) => button.getAttribute("aria-disabled") === "true"
  );
  expect(blockedButtons.length).toBeGreaterThan(0);
  expect(screen.queryByText("Close the call before selling shares.")).not.toBeInTheDocument();
  fireEvent.click(blockedButtons[0]);
  expect(screen.getByText("Close the call before selling shares.")).toBeInTheDocument();
  expect(screen.getAllByText("Fully covered").length).toBeGreaterThan(0);
  expect(screen.queryByRole("dialog", { name: "Sell shares" })).not.toBeInTheDocument();
});

test("closes a covered call early, restores shares, and keeps it out of closed options", () => {
  const assignment = {
    id: 230,
    ticker: "PLTR",
    status: "assigned",
    shares: 100,
    assignmentDate: "2026-07-10",
    adjustedCostPerShare: 14,
    adjustedCostBasis: 1400,
    wheelChainId: 130,
  };
  const coveredCall = {
    id: 231,
    kind: "covered_call",
    type: "Covered Call",
    ticker: "PLTR",
    status: "open",
    strike: 16,
    opened: "2026-08-01",
    expiry: "2026-09-18",
    premium: 0.5,
    contracts: 1,
    creditTotal: null,
    parentAssignmentId: 230,
    wheelChainId: 130,
  };
  localStorage.setItem(TEST_KEYS.trades, JSON.stringify([assignment, coveredCall]));
  localStorage.setItem(TEST_KEYS.target, "500");

  render(<App userId={TEST_USER_ID} />);
  fireEvent.click(screen.getAllByRole("button", { name: "CLOSE CALL" })[0]);
  const dialog = screen.getByRole("dialog", { name: "Close covered call early" });
  fireEvent.change(screen.getByLabelText("Close date"), { target: { value: "2026-08-20" } });
  fireEvent.change(screen.getByLabelText("Close price per share"), { target: { value: "0.20" } });
  fireEvent.change(screen.getByLabelText("Fees"), { target: { value: "1" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "CONFIRM CLOSE" }));

  const savedTrades = JSON.parse(localStorage.getItem(TEST_KEYS.trades));
  expect(savedTrades.find((trade) => trade.id === assignment.id).status).toBe("assigned");
  expect(savedTrades.find((trade) => trade.id === coveredCall.id)).toMatchObject({
    status: "closed",
    closeDate: "2026-08-20",
    closingCost: 21,
    pnl: 29,
    wheelChainId: 130,
    parentAssignmentId: 230,
  });
  expect(screen.getAllByRole("button", { name: "SELL SHARES" }).every((button) => button.getAttribute("aria-disabled") !== "true")).toBe(true);
  expect(screen.getAllByText(/COVERED CALL HISTORY/).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /closed positions/i })).toHaveTextContent("(0)");
  undoAndExpect([assignment, coveredCall]);
});

test("confirms and deletes only a completed share-sale record", () => {
  seedCompletedHistory();
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);

  render(<App userId={TEST_USER_ID} />);
  fireEvent.click(screen.getAllByRole("button", {
    name: "Delete completed share sale for SALE",
  })[0]);

  expect(confirm).toHaveBeenCalledWith(
    "Delete this completed record? You can undo for 30 seconds."
  );
  const savedTrades = JSON.parse(localStorage.getItem(TEST_KEYS.trades));
  expect(savedTrades.find((trade) => trade.id === 301)).toBeUndefined();
  expect(savedTrades.map((trade) => trade.id)).toEqual([300, 302, 303, 304, 305]);
  undoAndExpect(completedHistoryTrades());
  confirm.mockRestore();
});

test("cancelling completed-history deletion leaves the record intact", () => {
  seedCompletedHistory();
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);

  render(<App userId={TEST_USER_ID} />);
  fireEvent.click(screen.getAllByRole("button", {
    name: "Delete completed covered call for CALL",
  })[0]);

  expect(JSON.parse(localStorage.getItem(TEST_KEYS.trades))).toEqual(
    completedHistoryTrades()
  );
  expect(screen.getAllByRole("button", {
    name: "Delete completed covered call for CALL",
  }).length).toBeGreaterThan(0);
  confirm.mockRestore();
});

test("completed history exposes delete without showing reopen controls", () => {
  seedCompletedHistory();

  render(<App userId={TEST_USER_ID} />);
  fireEvent.click(screen.getByRole("button", { name: /closed positions/i }));
  fireEvent.click(screen.getByRole("button", { name: /covered call history/i }));

  expect(screen.queryByRole("button", { name: /reopen/i })).not.toBeInTheDocument();
  expect(screen.getAllByText("DEL").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", {
    name: "Delete completed covered call for CALL",
  }).length).toBeGreaterThan(0);
});

test("a deleted covered-call history record stays deleted after refresh", () => {
  seedCompletedHistory();
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);

  const firstRender = render(<App userId={TEST_USER_ID} />);
  fireEvent.click(screen.getAllByRole("button", {
    name: "Delete completed covered call for CALL",
  })[0]);
  firstRender.unmount();

  render(<App userId={TEST_USER_ID} />);
  expect(screen.queryByRole("button", {
    name: "Delete completed covered call for CALL",
  })).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", {
    name: "Delete completed share sale for SALE",
  }).length).toBeGreaterThan(0);
  expect(JSON.parse(localStorage.getItem(TEST_KEYS.trades)).map((trade) => trade.id))
    .toEqual([300, 301, 303, 304, 305]);
  confirm.mockRestore();
});

test("undo restores deleted covered-call history exactly", () => {
  const original = seedCompletedHistory();
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);

  render(<App userId={TEST_USER_ID} />);
  fireEvent.click(screen.getAllByRole("button", {
    name: "Delete completed covered call for CALL",
  })[0]);
  undoAndExpect(original);

  confirm.mockRestore();
});

test("undo expires after 30 seconds and is cleared by remount or account switch", () => {
  jest.useFakeTimers();
  seedTrades([]);
  let view = render(<App userId={TEST_USER_ID} />);
  fireEvent.change(screen.getByPlaceholderText("TICKER"), { target: { value: "ADD" } });
  fireEvent.change(screen.getByPlaceholderText("SHORT STRIKE"), { target: { value: "10" } });
  fireEvent.change(screen.getByPlaceholderText("PREMIUM"), { target: { value: "0.5" } });
  fireEvent.change(screen.getByPlaceholderText("CONTRACTS"), { target: { value: "1" } });
  fireEvent.change(document.querySelector(".desktop-interface input[type='date']"), { target: { value: "2026-10-16" } });
  fireEvent.click(screen.getByRole("button", { name: "+ ADD TRADE" }));
  expect(screen.getByRole("button", { name: "UNDO" })).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(30000));
  expect(screen.queryByRole("button", { name: "UNDO" })).not.toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText("TICKER"), { target: { value: "NEXT" } });
  fireEvent.change(screen.getByPlaceholderText("SHORT STRIKE"), { target: { value: "11" } });
  fireEvent.change(screen.getByPlaceholderText("PREMIUM"), { target: { value: "0.6" } });
  fireEvent.change(screen.getByPlaceholderText("CONTRACTS"), { target: { value: "1" } });
  fireEvent.change(document.querySelector(".desktop-interface input[type='date']"), { target: { value: "2026-11-20" } });
  fireEvent.click(screen.getByRole("button", { name: "+ ADD TRADE" }));
  expect(screen.getByRole("button", { name: "UNDO" })).toBeInTheDocument();
  view.unmount();
  view = render(<App userId={TEST_USER_ID} />);
  expect(screen.queryByRole("button", { name: "UNDO" })).not.toBeInTheDocument();
  view.unmount();

  const otherUser = "other-user";
  localStorage.setItem(getTrackerStorageKeys(otherUser).trades, JSON.stringify([]));
  render(<App userId={otherUser} />);
  expect(screen.queryByRole("button", { name: "UNDO" })).not.toBeInTheDocument();
});

test("deleting completed history is uploaded through cloud synchronization", async () => {
  jest.useFakeTimers();
  const trades = seedCompletedHistory();
  localStorage.setItem(TEST_KEYS.syncMeta, JSON.stringify({
    cloudVersion: "version-1",
    syncedSnapshot: JSON.stringify({ trades, target: 500 }),
  }));
  loadCloudData.mockResolvedValue({ trades, target: 500, updatedAt: "version-1" });
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);

  render(<App userId={TEST_USER_ID} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  fireEvent.click(screen.getAllByRole("button", {
    name: "Delete completed share sale for SALE",
  })[0]);
  await act(async () => {
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(saveCloudData).toHaveBeenCalledTimes(1);
  expect(saveCloudData.mock.calls[0][0].map((trade) => trade.id))
    .toEqual([300, 302, 303, 304, 305]);
  expect(saveCloudData.mock.calls[0][2]).toEqual({
    expectedUpdatedAt: "version-1",
    force: false,
  });

  fireEvent.click(screen.getByRole("button", { name: "UNDO" }));
  await act(async () => {
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(saveCloudData).toHaveBeenCalledTimes(2);
  expect(saveCloudData.mock.calls[1][0]).toEqual(trades);
  confirm.mockRestore();
  jest.useRealTimers();
});
