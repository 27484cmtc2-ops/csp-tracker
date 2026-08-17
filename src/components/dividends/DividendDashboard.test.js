import { fireEvent, render, screen, within } from "@testing-library/react";
import DividendDashboard from "./DividendDashboard";

function holding(overrides = {}) {
  return {
    id: overrides.id || Math.random(),
    ticker: "ENB",
    shares: 100,
    dividendPerShare: 1,
    frequency: "annual",
    currency: "CAD",
    account: "TFSA",
    nextPaymentDate: "2027-01-01",
    notes: "",
    ...overrides,
  };
}

function renderDashboard(holdings = [], usdCad = 1.4) {
  return render(
    <DividendDashboard
      holdings={holdings}
      usdCad={usdCad}
      onAdd={jest.fn()}
      onEdit={jest.fn()}
      onDelete={jest.fn()}
    />
  );
}

function accountRows(container) {
  return [...container.querySelectorAll(".dividend-account-row")];
}

test("shows one account's existing CAD annual income and annual divided by 12", () => {
  const { container } = renderDashboard([holding({ shares: 120, dividendPerShare: 2 })]);
  const accountSection = screen.getByRole("region", { name: "Income by account" });
  const row = within(accountSection).getByText("TFSA").closest(".dividend-account-row");

  expect(within(row).getByText("$20.00")).toBeInTheDocument();
  expect(within(row).getByText("$240.00")).toBeInTheDocument();
  expect(within(row).getByText("/ month")).toBeInTheDocument();
  expect(within(row).getByText("/ year")).toBeInTheDocument();
  expect(screen.getByText("ANNUAL DIVIDENDS").nextSibling).toHaveTextContent("$240.00");
  expect(accountRows(container)).toHaveLength(1);
});

test("shows income-oriented metrics without changing an annual-basis holding", () => {
  const annualHolding = holding({
    shares: 10,
    dividendBasis: "annual",
    dividendPerShare: null,
    annualDividendPerShare: 12,
    frequency: "quarterly",
  });
  const storedValueBeforeRender = JSON.stringify(annualHolding);

  renderDashboard([annualHolding], 1);

  expect(screen.queryByText("ANNUAL DIVIDEND / SHARE")).not.toBeInTheDocument();
  expect(screen.getByText("NEXT PAYMENT DATE").nextSibling).toHaveTextContent("2027-01-01");
  expect(screen.getByText("EST. NEXT PAYMENT").nextSibling).toHaveTextContent("CAD $30.00");
  expect(screen.getByText("FREQUENCY").nextSibling).toHaveTextContent("Quarterly");
  expect(screen.getByText("MONTHLY CAD").nextSibling).toHaveTextContent("$10.00");
  expect(screen.getByText("ANNUAL CAD").nextSibling).toHaveTextContent("$120.00");
  expect(screen.getByText("ANNUAL DIVIDENDS").nextSibling).toHaveTextContent("$120.00");
  expect(JSON.stringify(annualHolding)).toBe(storedValueBeforeRender);
});

test("keeps account types and custom names separate while converting USD income to CAD", () => {
  const { container } = renderDashboard([
    holding({ id: 1, account: "TFSA", shares: 100, dividendPerShare: 1 }),
    holding({ id: 2, ticker: "KO", account: "RRSP", currency: "USD", shares: 100, dividendPerShare: 1 }),
    holding({ id: 3, ticker: "LEG", account: "Family Trust", shares: 50, dividendPerShare: 1 }),
  ], 1.4);

  const rows = accountRows(container);
  expect(rows.map((row) => row.querySelector("strong").textContent)).toEqual(["RRSP", "TFSA", "Family Trust"]);
  expect(within(rows[0]).getByText("$140.00")).toBeInTheDocument();
  expect(within(rows[0]).getByText("$11.67")).toBeInTheDocument();
  expect(screen.getByText("ANNUAL DIVIDENDS").nextSibling).toHaveTextContent("$290.00");
});

test("sorts account income by annual, monthly, or account name", () => {
  const { container } = renderDashboard([
    holding({ id: 1, account: "Zulu", shares: 120 }),
    holding({ id: 2, account: "Alpha", shares: 240 }),
    holding({ id: 3, account: "Margin", shares: 60 }),
  ]);
  const select = screen.getByRole("combobox", { name: "Sort income by account" });
  const labels = () => accountRows(container).map((row) => row.querySelector("strong").textContent);

  expect(select).toHaveValue("annual");
  expect(labels()).toEqual(["Alpha", "Zulu", "Margin"]);

  fireEvent.change(select, { target: { value: "monthly" } });
  expect(labels()).toEqual(["Alpha", "Zulu", "Margin"]);

  fireEvent.change(select, { target: { value: "name" } });
  expect(labels()).toEqual(["Alpha", "Margin", "Zulu"]);
});

test("shows the existing empty state when there is no account income", () => {
  renderDashboard([]);
  const accountSection = screen.getByRole("region", { name: "Income by account" });

  expect(within(accountSection).getByText("No dividend income yet.")).toBeInTheDocument();
  expect(within(accountSection).getByRole("combobox", { name: "Sort income by account" })).toHaveValue("annual");
});
