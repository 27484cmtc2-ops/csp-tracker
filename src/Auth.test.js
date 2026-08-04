import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

import Auth from "./Auth";
import { supabase } from "./supabaseClient";

beforeEach(() => {
  supabase.auth.resetPasswordForEmail.mockReset();
  supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
});

function openResetDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Forgot Password?" }));
  return screen.getByRole("dialog", { name: "Reset password" });
}

test("presents Wheel App with clear sign-in, account, and forgot-password actions", () => {
  render(<Auth />);

  expect(screen.getByRole("heading", { name: "Wheel App" })).toBeInTheDocument();
  expect(screen.getByText("Track your wheel strategy from cash-secured puts to covered calls.")).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  expect(screen.getByRole("button", { name: "Forgot Password?" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "SIGN IN" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "CREATE AN ACCOUNT" })).toBeInTheDocument();
});

test("opens and closes the password-reset dialog", () => {
  render(<Auth />);
  const dialog = openResetDialog();
  expect(dialog).toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole("button", { name: "CANCEL" }));

  expect(screen.queryByRole("dialog", { name: "Reset password" })).not.toBeInTheDocument();
});

test("validates an empty reset email before calling Supabase", () => {
  render(<Auth />);
  const dialog = openResetDialog();

  fireEvent.click(within(dialog).getByRole("button", { name: "SEND RESET INSTRUCTIONS" }));

  expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter your email address.");
  expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
});

test("submits a password reset request with the current app origin", async () => {
  render(<Auth />);
  const dialog = openResetDialog();
  fireEvent.change(within(dialog).getByLabelText("Email"), {
    target: { value: "trader@example.com" },
  });

  fireEvent.click(within(dialog).getByRole("button", { name: "SEND RESET INSTRUCTIONS" }));

  await waitFor(() => expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
    "trader@example.com",
    { redirectTo: `${window.location.origin}/` }
  ));
});

test("renders the neutral success message after an accepted reset request", async () => {
  render(<Auth />);
  const dialog = openResetDialog();
  fireEvent.change(within(dialog).getByLabelText("Email"), {
    target: { value: "unknown@example.com" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "SEND RESET INSTRUCTIONS" }));

  expect(await within(dialog).findByRole("status")).toHaveTextContent(
    "If an account exists for this email, we've sent password reset instructions."
  );
});

test("handles a failed reset request with a friendly generic message", async () => {
  supabase.auth.resetPasswordForEmail.mockResolvedValue({
    error: new Error("Provider response: user not found"),
  });
  render(<Auth />);
  const dialog = openResetDialog();
  fireEvent.change(within(dialog).getByLabelText("Email"), {
    target: { value: "missing@example.com" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "SEND RESET INSTRUCTIONS" }));

  const alert = await within(dialog).findByRole("alert");
  expect(alert).toHaveTextContent(
    "We couldn't send reset instructions. Check your connection and try again."
  );
  expect(alert).not.toHaveTextContent("user not found");
  expect(alert).not.toHaveTextContent("missing@example.com");
});

test("does not reveal whether the submitted email belongs to an account", async () => {
  render(<Auth />);
  const dialog = openResetDialog();
  fireEvent.change(within(dialog).getByLabelText("Email"), {
    target: { value: "not-registered@example.com" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "SEND RESET INSTRUCTIONS" }));

  const status = await within(dialog).findByRole("status");
  expect(status).toHaveTextContent("If an account exists for this email");
  expect(status).not.toHaveTextContent("not-registered@example.com");
});
