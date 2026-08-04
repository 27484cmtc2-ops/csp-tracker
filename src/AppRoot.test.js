import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockGetSession = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChange = jest.fn();
let mockAuthChangeHandler;

jest.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      signOut: (...args) => mockSignOut(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
    },
  },
}));

jest.mock("./Auth", () => () => <main><h1>Login screen</h1></main>);
jest.mock("./App", () => ({ userId, userEmail, onLogOut }) => {
  const trades = JSON.parse(globalThis.localStorage.getItem(`csp_trades:${userId}`) || "[]");
  return (
    <main>
      <span>{userEmail}</span>
      <span>{trades.map((trade) => trade.ticker).join(",") || "No trades"}</span>
      <button onClick={onLogOut}>Log Out</button>
    </main>
  );
});

import AppRoot from "./AppRoot";

const accountA = { user: { id: "account-a", email: "a@example.com" } };
const accountB = { user: { id: "account-b", email: "b@example.com" } };

beforeEach(() => {
  localStorage.clear();
  mockAuthChangeHandler = undefined;
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: accountA } });
  mockSignOut.mockReset();
  mockSignOut.mockResolvedValue({ error: null });
  mockOnAuthStateChange.mockReset();
  mockOnAuthStateChange.mockImplementation((handler) => {
    mockAuthChangeHandler = handler;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
});

test("successful logout returns to the login screen", async () => {
  render(<AppRoot />);
  expect(await screen.findByText("a@example.com")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  expect(await screen.findByRole("heading", { name: "Login screen" })).toBeInTheDocument();
});

test("signing back into the same account restores that account's cached data", async () => {
  localStorage.setItem("csp_trades:account-a", JSON.stringify([{ ticker: "ONLY-A" }]));
  render(<AppRoot />);
  expect(await screen.findByText("ONLY-A")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
  await screen.findByRole("heading", { name: "Login screen" });

  act(() => mockAuthChangeHandler("SIGNED_IN", accountA));

  expect(await screen.findByText("ONLY-A")).toBeInTheDocument();
  expect(screen.getByText("a@example.com")).toBeInTheDocument();
});

test("signing into a different account never displays the previous user's trades", async () => {
  localStorage.setItem("csp_trades:account-a", JSON.stringify([{ ticker: "ONLY-A" }]));
  localStorage.setItem("csp_trades:account-b", JSON.stringify([{ ticker: "ONLY-B" }]));
  render(<AppRoot />);
  expect(await screen.findByText("ONLY-A")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
  await screen.findByRole("heading", { name: "Login screen" });

  act(() => mockAuthChangeHandler("SIGNED_IN", accountB));

  expect(await screen.findByText("ONLY-B")).toBeInTheDocument();
  expect(screen.queryByText("ONLY-A")).not.toBeInTheDocument();
  expect(screen.getByText("b@example.com")).toBeInTheDocument();
});
