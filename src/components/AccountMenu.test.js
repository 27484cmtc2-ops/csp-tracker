import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccountMenu from "./AccountMenu";

test("shows the signed-in email and runs logout from the account menu", async () => {
  const onLogOut = jest.fn().mockResolvedValue();
  render(<AccountMenu email="trader@example.com" onLogOut={onLogOut} />);

  fireEvent.click(screen.getByRole("button", { name: "ACCOUNT" }));
  expect(screen.getByText("trader@example.com")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "LOG OUT" }));

  await waitFor(() => expect(onLogOut).toHaveBeenCalledTimes(1));
});
