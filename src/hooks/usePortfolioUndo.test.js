import { act, renderHook } from "@testing-library/react";
import usePortfolioUndo, { UNDO_TIMEOUT_MS } from "./usePortfolioUndo";

afterEach(() => {
  jest.useRealTimers();
});

test("restores an exact snapshot once and ignores a second undo", () => {
  const original = [{ id: 1, ticker: "ONE", status: "open" }];
  const changed = [{ id: 2, ticker: "TWO", status: "open" }];
  const setTrades = jest.fn();
  const { result } = renderHook(() => usePortfolioUndo({
    userId: "account-a",
    trades: original,
    setTrades,
  }));

  act(() => result.current.commitTrades(changed, "Trade changed."));
  expect(setTrades).toHaveBeenLastCalledWith(changed);
  act(() => result.current.undo());
  expect(setTrades).toHaveBeenLastCalledWith(original);
  expect(result.current.undoEntry).toBeNull();

  act(() => result.current.undo());
  expect(setTrades).toHaveBeenCalledTimes(2);
});

test("a new mutation replaces the previous snapshot", () => {
  const first = [{ id: 1 }];
  const second = [{ id: 2 }];
  const third = [{ id: 3 }];
  const setTrades = jest.fn();
  const { result, rerender } = renderHook(
    ({ trades }) => usePortfolioUndo({ userId: "account-a", trades, setTrades }),
    { initialProps: { trades: first } }
  );

  act(() => result.current.commitTrades(second, "First action."));
  rerender({ trades: second });
  act(() => result.current.commitTrades(third, "Second action."));
  act(() => result.current.undo());

  expect(setTrades).toHaveBeenLastCalledWith(second);
});

test("timeout and unmount clear the in-memory undo opportunity", () => {
  jest.useFakeTimers();
  const setTrades = jest.fn();
  const { result, unmount } = renderHook(() => usePortfolioUndo({
    userId: "account-a",
    trades: [{ id: 1 }],
    setTrades,
  }));

  act(() => result.current.commitTrades([{ id: 2 }], "Changed."));
  expect(result.current.undoEntry).not.toBeNull();
  act(() => jest.advanceTimersByTime(UNDO_TIMEOUT_MS));
  expect(result.current.undoEntry).toBeNull();

  act(() => result.current.commitTrades([{ id: 3 }], "Changed again."));
  unmount();
  act(() => jest.advanceTimersByTime(UNDO_TIMEOUT_MS));
  expect(setTrades).toHaveBeenCalledTimes(2);
});

test("never restores a snapshot after the account changes", () => {
  const setTrades = jest.fn();
  const { result, rerender } = renderHook(
    ({ userId }) => usePortfolioUndo({ userId, trades: [{ id: userId }], setTrades }),
    { initialProps: { userId: "account-a" } }
  );

  act(() => result.current.commitTrades([{ id: "changed" }], "Changed."));
  rerender({ userId: "account-b" });
  act(() => result.current.undo());

  expect(setTrades).toHaveBeenCalledTimes(1);
});

test("reports a failed restore without retrying it", () => {
  let calls = 0;
  const setTrades = jest.fn(() => {
    calls += 1;
    if (calls === 2) throw new Error("restore failed");
  });
  const { result } = renderHook(() => usePortfolioUndo({
    userId: "account-a",
    trades: [{ id: 1 }],
    setTrades,
  }));

  act(() => result.current.commitTrades([{ id: 2 }], "Changed."));
  act(() => result.current.undo());

  expect(result.current.undoError).toBe("Undo failed. Your current portfolio was not changed.");
  act(() => result.current.undo());
  expect(setTrades).toHaveBeenCalledTimes(2);
});
