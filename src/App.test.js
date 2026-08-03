import { render, screen } from "@testing-library/react";

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
  expect(screen.getByRole("button", { name: /add trade/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "tracker" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /assigned shares/i })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: /closed positions/i })).toHaveAttribute("aria-expanded", "false");
});
