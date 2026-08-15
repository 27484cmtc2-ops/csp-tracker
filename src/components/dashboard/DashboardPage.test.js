import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import DashboardPage from "./DashboardPage";
import { DEFAULT_PROJECTION_SETTINGS } from "../../utils/passiveIncomeProjection";

const asOf = new Date("2026-08-15T12:00:00Z");
const dividends = [
  { id: 1, ticker: "ENB", shares: 100, dividendPerShare: 1, frequency: "quarterly", currency: "CAD", account: "TFSA", nextPaymentDate: "2026-09-01", notes: "" },
];
const trades = [
  { id: 1, ticker: "PLTR", type: "CSP", status: "open", opened: "2026-08-01", premium: 1, contracts: 1, expiry: "2026-09-01" },
];

function StatefulDashboard(props) {
  const [settings, setSettings] = useState(DEFAULT_PROJECTION_SETTINGS);
  return <DashboardPage {...props} settings={settings} onSettingsChange={setSettings} />;
}

test("renders the read-only Dashboard foundation and honest income definitions", () => {
  render(<StatefulDashboard trades={trades} dividends={dividends} usdCad={1} asOf={asOf} onNavigate={jest.fn()} />);
  expect(screen.getByRole("heading", { name: "Investing Dashboard" })).toBeInTheDocument();
  expect(screen.getByText("ESTIMATED MONTHLY PASSIVE INCOME")).toBeInTheDocument();
  expect(screen.getByText(/gross collected premium, not realized P&L/i)).toBeInTheDocument();
  expect(screen.getByText(/no confirmed dividend-payment history/i)).toBeInTheDocument();
  expect(screen.getByText("Set your goal")).toBeInTheDocument();
  expect(screen.getByText("Set a passive-income goal")).toBeInTheDocument();
  expect(screen.getByText("Enter a monthly goal to see Safe, Base and Aggressive projections.")).toBeInTheDocument();
  expect(screen.queryByText("VIEW ACCESSIBLE PROJECTION DATA")).not.toBeInTheDocument();
  expect(document.querySelector(".projection-chart")).not.toBeInTheDocument();
  expect(document.querySelector(".dashboard-summary-grid").children).toHaveLength(3);
  expect(screen.getByText("PLTR")).toBeInTheDocument();
  expect(screen.getAllByText("TFSA").length).toBeGreaterThan(0);
  expect(screen.getAllByText("2026-09-01").length).toBeGreaterThan(0);
});

test("projection controls are session-only and update goal, toggle Wheel income, and recalculate output", () => {
  render(<StatefulDashboard trades={trades} dividends={dividends} usdCad={1} asOf={asOf} onNavigate={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Monthly passive-income goal"), { target: { value: "100" } });
  expect(screen.getByText("42%")).toBeInTheDocument();
  expect(screen.getByLabelText("42% of monthly passive-income goal")).toBeInTheDocument();
  expect(screen.getByText("VIEW ACCESSIBLE PROJECTION DATA")).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText("Include Wheel income"));
  expect(screen.getByText("33%")).toBeInTheDocument();
  expect(screen.getByText("Session only · assumptions are not saved")).toBeInTheDocument();
});

test("keeps detailed scenario assumptions behind an expandable control", () => {
  render(<StatefulDashboard trades={trades} dividends={dividends} usdCad={1} asOf={asOf} onNavigate={jest.fn()} />);
  const assumptions = screen.getByText("EDIT ASSUMPTIONS").closest("details");
  expect(assumptions).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("EDIT ASSUMPTIONS"));
  expect(assumptions).toHaveAttribute("open");
  fireEvent.change(within(assumptions).getByLabelText("Base dividend growth"), { target: { value: "5" } });
  expect(within(assumptions).getByLabelText("Base dividend growth")).toHaveValue(5);
});

test("navigation actions point to the existing dedicated sections", () => {
  const onNavigate = jest.fn();
  render(<DashboardPage trades={trades} dividends={dividends} usdCad={1} asOf={asOf} onNavigate={onNavigate} />);
  fireEvent.click(screen.getByRole("button", { name: "VIEW DIVIDENDS" }));
  fireEvent.click(screen.getByRole("button", { name: "VIEW WHEEL TRACKER" }));
  expect(onNavigate.mock.calls).toEqual([["dividends"], ["tracker"]]);
});

test("accessible projection table exposes scenario and goal values", () => {
  render(<StatefulDashboard trades={trades} dividends={dividends} usdCad={1} asOf={asOf} onNavigate={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Monthly passive-income goal"), { target: { value: "500" } });
  const details = screen.getByText("VIEW ACCESSIBLE PROJECTION DATA").closest("details");
  expect(within(details).getByRole("columnheader", { name: "Safe" })).toBeInTheDocument();
  expect(within(details).getByRole("columnheader", { name: "Base" })).toBeInTheDocument();
  expect(within(details).getByRole("columnheader", { name: "Aggressive" })).toBeInTheDocument();
  expect(within(details).getByRole("columnheader", { name: "Goal" })).toBeInTheDocument();
});
