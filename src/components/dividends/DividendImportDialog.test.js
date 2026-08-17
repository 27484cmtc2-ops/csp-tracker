import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import DividendImportDialog from "./DividendImportDialog";

const header = "Ticker,Shares,Dividend Per Share,Frequency,Currency,Account,Next Payment Date,Notes";
const csvFile = (content, name = "holdings.csv") => ({
  name,
  size: content.length,
  text: async () => content,
});

function upload(content) {
  fireEvent.change(screen.getByLabelText("CSV file"), {
    target: { files: [csvFile(content)] },
  });
}

test("shows the client-side privacy notice and downloadable template", () => {
  render(<DividendImportDialog holdings={[]} onConfirm={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByText("Your CSV is processed on this device. The original file is not uploaded.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "DOWNLOAD EXAMPLE TEMPLATE" })).toHaveAttribute("download", "investing-dashboard-dividend-template.csv");
});

test("parses, edits, excludes and confirms ready rows once", async () => {
  const onConfirm = jest.fn();
  render(<DividendImportDialog holdings={[]} onConfirm={onConfirm} onClose={jest.fn()} />);
  upload(`${header}\nENB,10,1,Monthly,CAD,TFSA,2026-09-01,Income\nRY,5,2,Annual,USD,RRSP,2026-10-01,`);

  expect(await screen.findByText("2 ready")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Shares row 2"), { target: { value: "12" } });
  fireEvent.click(screen.getByLabelText("Include row 3"));
  expect(screen.getByText("1 excluded")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "IMPORT 1 HOLDING" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onConfirm.mock.calls[0][0]).toEqual(expect.arrayContaining([
    expect.objectContaining({ included: true, candidate: expect.objectContaining({ ticker: "ENB", shares: "12" }) }),
    expect.objectContaining({ included: false, candidate: expect.objectContaining({ ticker: "RY" }) }),
  ]));
});

test("blocks invalid rows until corrected", async () => {
  render(<DividendImportDialog holdings={[]} onConfirm={jest.fn()} onClose={jest.fn()} />);
  upload(`${header}\nENB,0,1,Monthly,CAD,TFSA,2026-09-01,`);
  expect(await screen.findByText("Needs Review")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /IMPORT 1 HOLDING/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Shares row 2"), { target: { value: "10" } });
  expect(screen.getByText("Ready")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /IMPORT 1 HOLDING/ })).toBeEnabled();
});

test("requires an explicit duplicate decision on re-import", async () => {
  const existing = [{
    id: 1, ticker: "ENB", shares: 10, dividendPerShare: 1, frequency: "monthly",
    currency: "CAD", account: "TFSA", nextPaymentDate: "2026-09-01", notes: "",
  }];
  render(<DividendImportDialog holdings={existing} onConfirm={jest.fn()} onClose={jest.fn()} />);
  upload(`${header}\nENB,10,1,Monthly,CAD,TFSA,2026-09-01,`);
  expect(await screen.findByText("Duplicate")).toBeInTheDocument();
  const importButton = screen.getByRole("button", { name: /IMPORT 1 HOLDING/ });
  expect(importButton).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Add separately" }));
  expect(importButton).toBeEnabled();
});

test("cancellation and parsing failure cause zero writes", async () => {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  render(<DividendImportDialog holdings={[]} onConfirm={onConfirm} onClose={onClose} />);
  upload("Ticker,Shares\nENB,10");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not recognize required columns: Dividend Per Share, Frequency, Currency, Account, Next Payment Date, Notes."
  );
  fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});

test("unmounting clears temporary preview state for an account switch", async () => {
  const view = render(<DividendImportDialog key="account-a" holdings={[]} onConfirm={jest.fn()} onClose={jest.fn()} />);
  upload(`${header}\nENB,10,1,Monthly,CAD,TFSA,2026-09-01,`);
  expect(await screen.findByText("Review holdings")).toBeInTheDocument();
  view.rerender(<DividendImportDialog key="account-b" holdings={[]} onConfirm={jest.fn()} onClose={jest.fn()} />);
  expect(screen.queryByText("Review holdings")).not.toBeInTheDocument();
  expect(within(screen.getByRole("dialog")).getByLabelText("CSV file")).toBeInTheDocument();
});

test("selects Snowball format, previews mapped rows, and confirms only on request", async () => {
  const onConfirm = jest.fn();
  render(<DividendImportDialog holdings={[]} onConfirm={onConfirm} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Import format"), { target: { value: "snowball_analytics_holdings" } });
  upload("Holding,Shares,Dividend per share,Frequency,Currency,Next payment date,Next payment,Holding name,Capital gain,Total profit,Total profit\nENB,10,1,Monthly,CAD,2026-09-01,10,Enbridge,100,200,300");

  expect(await screen.findByText("Review holdings")).toBeInTheDocument();
  expect(screen.getByLabelText("Ticker row 2")).toHaveValue("ENB");
  expect(screen.getByLabelText("Account row 2")).toHaveValue("Unknown");
  expect(screen.getByLabelText("Notes row 2")).toHaveValue("Enbridge");
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "IMPORT 1 HOLDING" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onConfirm.mock.calls[0][0][0].candidate).toMatchObject({ ticker: "ENB", currency: "CAD", account: "Unknown" });
});

test("Snowball cancel remains non-destructive", async () => {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  render(<DividendImportDialog holdings={[]} onConfirm={onConfirm} onClose={onClose} />);
  fireEvent.change(screen.getByLabelText("Import format"), { target: { value: "snowball_analytics_holdings" } });
  upload("Holding,Shares,Dividend per share,Frequency,Currency,Next payment date\nENB,10,1,Monthly,CAD,2026-09-01");
  expect(await screen.findByText("Review holdings")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});

test("Snowball rows missing frequency stay in review until edited", async () => {
  render(<DividendImportDialog holdings={[]} onConfirm={jest.fn()} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Import format"), { target: { value: "snowball_analytics_holdings" } });
  upload("Holding,Shares,Dividend per share,Currency,Next payment date\nENB,10,1,CAD,2026-09-01");
  expect(await screen.findByText("Needs Review")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /IMPORT 1 HOLDING/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Frequency row 2"), { target: { value: "monthly" } });
  expect(screen.getByText("Ready")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /IMPORT 1 HOLDING/ })).toBeEnabled();
});

test("Snowball annualized dividend values use the annual basis without a manual conversion", async () => {
  render(<DividendImportDialog holdings={[]} onConfirm={jest.fn()} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Import format"), { target: { value: "snowball_analytics_holdings" } });
  upload("Holding,Shares,Dividends per share,Frequency,Currency,Next payment date,Next payment,Annual dividend,Dividend amount,Dividend yield,Portfolio income\nMSTY,10,9.4068,Monthly,USD,2026-09-01,1.809,99,88,77,66");
  expect(await screen.findByText("Ready")).toBeInTheDocument();
  expect(screen.getByLabelText("Annual dividend per share row 2")).toHaveValue(9.4068);
  expect(screen.getByRole("button", { name: /IMPORT 1 HOLDING/ })).toBeEnabled();
});
