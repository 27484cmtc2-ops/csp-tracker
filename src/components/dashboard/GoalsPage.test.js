import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import GoalsPage from "./GoalsPage";
import { DEFAULT_PROJECTION_SETTINGS } from "../../utils/passiveIncomeProjection";

const asOf = new Date("2026-08-15T12:00:00Z");
const dividends = [{ id: 1, ticker: "ENB", shares: 100, dividendPerShare: 1, frequency: "quarterly", currency: "CAD", account: "TFSA", nextPaymentDate: "2026-09-01" }];
const trades = [{ id: 1, ticker: "PLTR", type: "CSP", status: "open", opened: "2026-08-01", premium: 1, contracts: 1, expiry: "2026-09-01" }];

function StatefulGoals() {
  const [settings, setSettings] = useState(DEFAULT_PROJECTION_SETTINGS);
  return <GoalsPage trades={trades} dividends={dividends} usdCad={1} asOf={asOf} settings={settings} onSettingsChange={setSettings} />;
}

test("contains the complete projection workspace and updates immediately", () => {
  render(<StatefulGoals />);
  expect(screen.getByRole("heading", { name: "Goals" })).toBeInTheDocument();
  expect(screen.queryByText("VIEW ACCESSIBLE PROJECTION DATA")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Monthly passive-income goal"), { target: { value: "100" } });
  expect(screen.getByText("42%")).toBeInTheDocument();
  expect(screen.getByLabelText("42% of monthly passive-income goal")).toBeInTheDocument();
  const data = screen.getByText("VIEW ACCESSIBLE PROJECTION DATA").closest("details");
  expect(within(data).getByRole("columnheader", { name: "Safe" })).toBeInTheDocument();
  expect(within(data).getByRole("columnheader", { name: "Base" })).toBeInTheDocument();
  expect(within(data).getByRole("columnheader", { name: "Aggressive" })).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Include Wheel income"));
  expect(screen.getByText("33%")).toBeInTheDocument();
});

test("keeps detailed scenario assumptions collapsed and editable", () => {
  render(<StatefulGoals />);
  const assumptions = screen.getByText("EDIT ASSUMPTIONS").closest("details");
  expect(assumptions).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("EDIT ASSUMPTIONS"));
  expect(assumptions).toHaveAttribute("open");
  fireEvent.change(within(assumptions).getByLabelText("Base dividend growth"), { target: { value: "5" } });
  expect(within(assumptions).getByLabelText("Base dividend growth")).toHaveValue(5);
});

test("uses annual-basis dividend income in goal progress", () => {
  const annualDividends = [{
    id: 2, ticker: "MSTY", shares: 10, dividendBasis: "annual",
    dividendPerShare: null, annualDividendPerShare: 12, frequency: "monthly",
    currency: "CAD", account: "TFSA", nextPaymentDate: "2026-09-01",
  }];
  function AnnualGoals() {
    const [settings, setSettings] = useState(DEFAULT_PROJECTION_SETTINGS);
    return <GoalsPage trades={[]} dividends={annualDividends} usdCad={1} asOf={asOf} settings={settings} onSettingsChange={setSettings} />;
  }
  render(<AnnualGoals />);
  fireEvent.change(screen.getByLabelText("Monthly passive-income goal"), { target: { value: "100" } });
  expect(screen.getByText("10%")).toBeInTheDocument();
});
