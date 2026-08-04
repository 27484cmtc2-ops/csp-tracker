import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("./supabaseClient", () => ({
  supabase: { auth: { updateUser: jest.fn() } },
}));

import PasswordRecovery from "./PasswordRecovery";
import { supabase } from "./supabaseClient";

beforeEach(() => {
  supabase.auth.updateUser.mockReset();
  supabase.auth.updateUser.mockResolvedValue({ error: null });
});

test("updates a recovered account password and returns to sign in", async () => {
  const onUpdated = jest.fn().mockResolvedValue();
  render(<PasswordRecovery onUpdated={onUpdated} />);
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "new-password-123" },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: "new-password-123" },
  });

  fireEvent.click(screen.getByRole("button", { name: "UPDATE PASSWORD" }));

  await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalledWith({
    password: "new-password-123",
  }));
  expect(onUpdated).toHaveBeenCalledTimes(1);
});

test("rejects mismatched recovered passwords", () => {
  render(<PasswordRecovery />);
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "new-password-123" },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: "different-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "UPDATE PASSWORD" }));

  expect(screen.getByRole("alert")).toHaveTextContent("The passwords do not match.");
  expect(supabase.auth.updateUser).not.toHaveBeenCalled();
});
