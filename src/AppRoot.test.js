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

jest.mock("./Auth", () => ({ onContinueAsGuest, guestDataAvailable }) => <main>
  <h1>Login screen</h1>
  <span>{guestDataAvailable ? "Guest data available" : "No guest data"}</span>
  <button onClick={onContinueAsGuest}>Continue as Guest</button>
</main>);
jest.mock("./PasswordRecovery", () => ({ onUpdated }) => (
  <main><h1>Set new password</h1><button onClick={onUpdated}>Finish recovery</button></main>
));
jest.mock("./App", () => ({ userId, userEmail, onLogOut, mode, onExitGuest, guestMigration, onGuestMigrationSaved }) => {
  const key = mode === "guest" ? "csp_guest_trades:v1" : `csp_trades:${userId}`;
  const trades = JSON.parse(globalThis.localStorage.getItem(key) || "[]");
  return (
    <main>
      <span>{mode === "guest" ? "Guest application" : userEmail}</span>
      <span>{trades.map((trade) => trade.ticker).join(",") || "No trades"}</span>
      {guestMigration && <><span>Migration offered</span><button onClick={() => onGuestMigrationSaved(guestMigration.snapshotHash)}>Complete Migration</button></>}
      {mode === "guest" ? <button onClick={onExitGuest}>Exit Guest</button> : <button onClick={onLogOut}>Log Out</button>}
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

test("a password recovery session shows the update screen and returns to login", async () => {
  render(<AppRoot />);
  await screen.findByText("a@example.com");

  act(() => mockAuthChangeHandler("PASSWORD_RECOVERY", accountA));
  expect(await screen.findByRole("heading", { name: "Set new password" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Finish recovery" }));

  expect(await screen.findByRole("heading", { name: "Login screen" })).toBeInTheDocument();
});

test("signed-out users can enter guest mode and reopen it after refresh", async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  localStorage.setItem("csp_guest_trades:v1", JSON.stringify([{ ticker: "GUEST" }]));
  const first = render(<AppRoot />);
  fireEvent.click(await screen.findByRole("button", { name: "Continue as Guest" }));
  expect(await screen.findByText("Guest application")).toBeInTheDocument();
  expect(screen.getByText("GUEST")).toBeInTheDocument();
  first.unmount();

  render(<AppRoot />);
  expect(await screen.findByText("Guest application")).toBeInTheDocument();
  expect(screen.getByText("GUEST")).toBeInTheDocument();
});

test("exiting guest mode returns to auth without deleting guest data", async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  localStorage.setItem("csp_guest_trades:v1", JSON.stringify([{ ticker: "SAFE" }]));
  localStorage.setItem("csp_guest_mode:v1", "true");
  render(<AppRoot />);
  fireEvent.click(await screen.findByRole("button", { name: "Exit Guest" }));
  expect(await screen.findByRole("heading", { name: "Login screen" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("csp_guest_trades:v1"))).toEqual([{ ticker: "SAFE" }]);
});

test("an authenticated session takes precedence over a saved guest-mode marker", async () => {
  localStorage.setItem("csp_guest_mode:v1", "true");
  render(<AppRoot />);
  expect(await screen.findByText("a@example.com")).toBeInTheDocument();
  expect(screen.queryByText("Guest application")).not.toBeInTheDocument();
});

test("logging out never enters guest mode automatically", async () => {
  localStorage.setItem("csp_guest_trades:v1", JSON.stringify([{ ticker: "GUEST" }]));
  render(<AppRoot />);
  fireEvent.click(await screen.findByRole("button", { name: "Log Out" }));
  expect(await screen.findByRole("heading", { name: "Login screen" })).toBeInTheDocument();
  expect(screen.queryByText("Guest application")).not.toBeInTheDocument();
});

test("guest migration is offered once per account and exact migrated snapshot", async () => {
  localStorage.setItem("csp_guest_trades:v1", JSON.stringify([{ ticker: "MOVE-ME" }]));
  render(<AppRoot />);
  expect(await screen.findByText("Migration offered")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Complete Migration" }));
  fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
  await screen.findByRole("heading", { name: "Login screen" });
  act(() => mockAuthChangeHandler("SIGNED_IN", accountA));
  await screen.findByText("a@example.com");
  expect(screen.queryByText("Migration offered")).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("csp_guest_trades:v1"))).toEqual([{ ticker: "MOVE-ME" }]);
});
