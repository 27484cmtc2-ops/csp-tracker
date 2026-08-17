import { fireEvent, render, screen } from "@testing-library/react";
import DividendHoldingForm from "./DividendHoldingForm";
import { DIVIDEND_ACCOUNT_OPTIONS } from "../../utils/dividends";

const holding = (account = "") => ({
  ticker: "ENB",
  shares: "10",
  dividendPerShare: "1",
  annualDividendPerShare: "",
  dividendBasis: "per_payment",
  frequency: "quarterly",
  currency: "CAD",
  account,
  nextPaymentDate: "2026-09-01",
  notes: "",
});

function renderForm(account = "") {
  const onChange = jest.fn();
  render(
    <DividendHoldingForm
      value={holding(account)}
      error=""
      editing={false}
      onChange={onChange}
      onSubmit={jest.fn()}
      onClose={jest.fn()}
    />
  );
  return onChange;
}

test.each(DIVIDEND_ACCOUNT_OPTIONS)("selects the predefined %s account", (account) => {
  const onChange = renderForm();
  fireEvent.change(screen.getByLabelText("Account"), { target: { value: account } });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ account }));
});

test("Other accepts a custom account name", () => {
  const onChange = renderForm();
  fireEvent.change(screen.getByLabelText("Account"), { target: { value: "Other" } });
  fireEvent.change(screen.getByLabelText("Custom account name"), {
    target: { value: "Family Trust" },
  });
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ account: "Family Trust" })
  );
});

test("an existing custom account remains intact and is shown as Other", () => {
  renderForm("Family Trust");
  expect(screen.getByLabelText("Account")).toHaveValue("Other");
  expect(screen.getByLabelText("Custom account name")).toHaveValue("Family Trust");
});

test("supports entering an annual dividend per share basis", () => {
  const onChange = renderForm();
  fireEvent.change(screen.getByLabelText("Dividend amount basis"), { target: { value: "annual" } });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
    dividendBasis: "annual",
    dividendPerShare: "",
  }));
});
