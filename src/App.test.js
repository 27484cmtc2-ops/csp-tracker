import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("./cloudStorage", () => ({
  saveCloudData: jest.fn(),
  loadCloudData: jest.fn(),
}));

import App from "./App";

beforeEach(() => {
  localStorage.clear();
});

test("renders the tracker and its default portfolio data", () => {
  render(<App />);

  expect(screen.getByText("LOG NEW TRADE")).toBeInTheDocument();
  expect(screen.getByText(/OPEN POSITIONS/)).toBeInTheDocument();
  expect(screen.getAllByText(/CLOSED POSITIONS/)).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Open add trade form" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "tracker" })).toBeInTheDocument();
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
