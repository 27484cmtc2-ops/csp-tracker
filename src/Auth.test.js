import { render, screen } from "@testing-library/react";

jest.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
    },
  },
}));

import Auth from "./Auth";

test("presents Wheel App with clear sign-in and account actions", () => {
  render(<Auth />);

  expect(screen.getByRole("heading", { name: "Wheel App" })).toBeInTheDocument();
  expect(screen.getByText("Track your wheel strategy from cash-secured puts to covered calls.")).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  expect(screen.getByRole("button", { name: "SIGN IN" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "CREATE AN ACCOUNT" })).toBeInTheDocument();
});
