import { fireEvent, render, screen } from "@testing-library/react";
import DashboardPage from "./DashboardPage";
import { DEFAULT_PROJECTION_SETTINGS } from "../../utils/passiveIncomeProjection";

const asOf = new Date("2026-08-15T12:00:00Z");
const dividends = [
  { id: 1, ticker: "ENB", shares: 100, dividendPerShare: 1, frequency: "quarterly", currency: "CAD", account: "TFSA", nextPaymentDate: "2026-09-01", notes: "" },
];
const trades = [
  { id: 1, ticker: "PLTR", type: "CSP", status: "open", opened: "2026-08-01", premium: 1, contracts: 1, expiry: "2026-09-01" },
];

test("renders a lightweight daily overview without projection controls", () => {
  render(<DashboardPage trades={trades} dividends={dividends} usdCad={1} asOf={asOf} onNavigate={jest.fn()} settings={DEFAULT_PROJECTION_SETTINGS} />);
  expect(screen.getByRole("heading", { name: "Investing Dashboard" })).toBeInTheDocument();
  expect(screen.getByText("ESTIMATED MONTHLY PASSIVE INCOME")).toBeInTheDocument();
  expect(screen.getByText(/gross collected premium, not realized P&L/i)).toBeInTheDocument();
  expect(screen.getByText("No monthly goal set")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /view goals/i })).toBeInTheDocument();
  expect(screen.getByText("RECENT INVESTING ACTIVITY")).toBeInTheDocument();
  expect(screen.queryByText("VIEW ACCESSIBLE PROJECTION DATA")).not.toBeInTheDocument();
  expect(document.querySelector(".projection-chart")).not.toBeInTheDocument();
  expect(document.querySelector(".dashboard-summary-grid").children).toHaveLength(3);
  expect(screen.getAllByText("PLTR")).toHaveLength(2);
  expect(screen.getAllByText("TFSA").length).toBeGreaterThan(0);
  expect(screen.getAllByText("2026-09-01").length).toBeGreaterThan(0);
});

test("navigation actions point to the existing dedicated sections", () => {
  const onNavigate = jest.fn();
  render(<DashboardPage trades={trades} dividends={dividends} usdCad={1} asOf={asOf} onNavigate={onNavigate} />);
  fireEvent.click(screen.getByRole("button", { name: /view goals/i }));
  fireEvent.click(screen.getByRole("button", { name: "VIEW DIVIDENDS" }));
  fireEvent.click(screen.getByRole("button", { name: "VIEW WHEEL TRACKER" }));
  expect(onNavigate.mock.calls).toEqual([["goals"], ["dividends"], ["tracker"]]);
});
