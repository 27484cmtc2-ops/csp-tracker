import { fireEvent, render, screen } from "@testing-library/react";
import CloudSyncControls from "./CloudSyncControls";

test("shows a blocking explanation and no overwrite choices for a version invariant failure", () => {
  const onSyncNow = jest.fn();
  const onUseCloud = jest.fn();
  const onKeepLocal = jest.fn();
  render(
    <CloudSyncControls
      status="invariant_error"
      hasConflict
      onSyncNow={onSyncNow}
      onUseCloud={onUseCloud}
      onKeepLocal={onKeepLocal}
    />
  );

  expect(screen.getByRole("status")).toHaveTextContent("Sync stopped: cloud version mismatch");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Synchronization was stopped because cloud data changed without its version changing."
  );
  expect(screen.getByRole("button", { name: "Sync now" })).toBeDisabled();
  expect(screen.queryByRole("group", { name: "Resolve cloud conflict" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
  expect(onSyncNow).not.toHaveBeenCalled();
  expect(onUseCloud).not.toHaveBeenCalled();
  expect(onKeepLocal).not.toHaveBeenCalled();
});
