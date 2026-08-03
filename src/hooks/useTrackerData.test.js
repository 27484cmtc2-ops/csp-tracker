import { act, renderHook } from "@testing-library/react";
import useTrackerData from "./useTrackerData";
import {
  CloudConflictError,
  loadCloudData,
  saveCloudData,
} from "../cloudStorage";

jest.mock("../cloudStorage", () => ({
  CloudConflictError: class CloudConflictError extends Error {
    constructor(message = "Cloud data changed on another device.") {
      super(message);
      this.name = "CloudConflictError";
    }
  },
  loadCloudData: jest.fn(),
  saveCloudData: jest.fn(),
}));

const baseData = {
  trades: [{ id: 1, ticker: "BASE", status: "open" }],
  target: 500,
};

const changedData = {
  trades: [{ id: 1, ticker: "CHANGED", status: "open" }],
  target: 500,
};

const cloudData = (data, updatedAt = "version-1") => ({
  ...data,
  updatedAt,
});

const snapshot = (data) => JSON.stringify(data);

function seedLocal(data, metadata = null) {
  localStorage.setItem("csp_trades", JSON.stringify(data.trades));
  localStorage.setItem("csp_target", String(data.target));
  if (metadata) {
    localStorage.setItem("csp_sync_meta", JSON.stringify(metadata));
  }
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advanceDebounce() {
  await act(async () => {
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  loadCloudData.mockReset();
  saveCloudData.mockReset();
  saveCloudData.mockResolvedValue({ updatedAt: "version-2" });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test("downloads cloud data during initialization without uploading it back", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(changedData, "version-2"));

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  await advanceDebounce();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(result.current.syncStatus).toBe("saved");
  expect(saveCloudData).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem("csp_trades"))).toEqual(changedData.trades);
});

test("a new device without persisted local data accepts existing cloud data", async () => {
  loadCloudData.mockResolvedValue(cloudData(changedData, "version-2"));

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(result.current.target).toBe(changedData.target);
  expect(result.current.hasConflict).toBe(false);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("creates cloud data after a successful missing-row initialization", async () => {
  seedLocal(baseData);
  loadCloudData.mockResolvedValue(null);

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  expect(saveCloudData).not.toHaveBeenCalled();

  await advanceDebounce();

  expect(saveCloudData).toHaveBeenCalledWith(
    baseData.trades,
    baseData.target,
    { expectedUpdatedAt: null, force: false }
  );
  expect(result.current.syncStatus).toBe("saved");
});

test("keeps offline local changes and uploads them against the known cloud version", async () => {
  seedLocal(changedData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-1"));

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  await advanceDebounce();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(saveCloudData).toHaveBeenCalledWith(
    changedData.trades,
    changedData.target,
    { expectedUpdatedAt: "version-1", force: false }
  );
});

test("debounces multiple local changes into one latest upload", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData));
  const { result } = renderHook(() => useTrackerData());
  await flushAsync();

  act(() => result.current.setTrades([{ id: 2, ticker: "ONE" }]));
  act(() => {
    jest.advanceTimersByTime(500);
    result.current.setTrades([{ id: 3, ticker: "TWO" }]);
  });
  await advanceDebounce();

  expect(saveCloudData).toHaveBeenCalledTimes(1);
  expect(saveCloudData.mock.calls[0][0]).toEqual([{ id: 3, ticker: "TWO" }]);
});

test("queues a newer change while an upload is in flight", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData));

  let resolveFirstUpload;
  saveCloudData
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirstUpload = resolve; }))
    .mockResolvedValueOnce({ updatedAt: "version-3" });

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  act(() => result.current.setTrades([{ id: 2, ticker: "FIRST" }]));
  await advanceDebounce();

  act(() => result.current.setTrades([{ id: 3, ticker: "SECOND" }]));
  await act(async () => {
    resolveFirstUpload({ updatedAt: "version-2" });
    await Promise.resolve();
    await Promise.resolve();
  });
  await advanceDebounce();

  expect(saveCloudData).toHaveBeenCalledTimes(2);
  expect(saveCloudData.mock.calls[1][0]).toEqual([{ id: 3, ticker: "SECOND" }]);
  expect(saveCloudData.mock.calls[1][2].expectedUpdatedAt).toBe("version-2");
});

test("failed initialization preserves local data and blocks uploads", async () => {
  seedLocal(changedData);
  loadCloudData.mockRejectedValue(new Error("network unavailable"));

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  await advanceDebounce();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(["offline", "error"]).toContain(result.current.syncStatus);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("failed upload preserves local data and reports failure", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData));
  saveCloudData.mockRejectedValue(new Error("upload failed"));

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  act(() => result.current.setTrades(changedData.trades));
  await advanceDebounce();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(["offline", "error"]).toContain(result.current.syncStatus);
  expect(JSON.parse(localStorage.getItem("csp_trades"))).toEqual(changedData.trades);
});

test("detects a two-device conflict and stops automatic uploads", async () => {
  seedLocal(changedData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  const newerCloud = {
    trades: [{ id: 1, ticker: "OTHER DEVICE" }],
    target: 500,
  };
  loadCloudData.mockResolvedValue(cloudData(newerCloud, "version-2"));

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  await advanceDebounce();

  expect(result.current.hasConflict).toBe(true);
  expect(result.current.syncStatus).toBe("conflict");
  expect(result.current.trades).toEqual(changedData.trades);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("an atomic upload conflict preserves local data", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData));
  saveCloudData.mockRejectedValue(new CloudConflictError());

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  act(() => result.current.setTrades(changedData.trades));
  await advanceDebounce();

  expect(result.current.hasConflict).toBe(true);
  expect(result.current.trades).toEqual(changedData.trades);
});

test("manual conflict resolution can use cloud data", async () => {
  seedLocal(changedData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  const newerCloud = {
    trades: [{ id: 1, ticker: "CLOUD WINS" }],
    target: 600,
  };
  loadCloudData
    .mockResolvedValueOnce(cloudData(newerCloud, "version-2"))
    .mockResolvedValueOnce(cloudData(newerCloud, "version-2"));

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  await act(async () => result.current.useCloudData());

  expect(result.current.hasConflict).toBe(false);
  expect(result.current.trades).toEqual(newerCloud.trades);
  expect(result.current.target).toBe(600);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("manual conflict resolution can explicitly keep local data", async () => {
  seedLocal(changedData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-2"));

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  await act(async () => result.current.keepLocalData());

  expect(saveCloudData).toHaveBeenCalledWith(
    changedData.trades,
    changedData.target,
    { expectedUpdatedAt: "version-2", force: true }
  );
  expect(result.current.hasConflict).toBe(false);
});

test("cleanup cancels pending uploads and ignores initialization responses", async () => {
  seedLocal(baseData);
  let resolveInitialization;
  loadCloudData.mockImplementation(
    () => new Promise((resolve) => { resolveInitialization = resolve; })
  );

  const { unmount } = renderHook(() => useTrackerData());
  unmount();
  await act(async () => {
    resolveInitialization(null);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
  });

  expect(saveCloudData).not.toHaveBeenCalled();
});

test("cleanup cancels a debounced local upload", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData));

  const { result, unmount } = renderHook(() => useTrackerData());
  await flushAsync();
  act(() => result.current.setTrades(changedData.trades));
  unmount();
  await act(async () => {
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
  });

  expect(saveCloudData).not.toHaveBeenCalled();
});

test("checks for newer cloud data when the app becomes visible again", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData
    .mockResolvedValueOnce(cloudData(baseData, "version-1"))
    .mockResolvedValueOnce(cloudData(changedData, "version-2"));

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  act(() => {
    window.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await flushAsync();

  expect(loadCloudData).toHaveBeenCalledTimes(2);
  expect(result.current.trades).toEqual(changedData.trades);
  expect(result.current.syncStatus).toBe("saved");
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("Device B applies Device A's uploaded data on resume even when version metadata matches", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-2",
    syncedSnapshot: snapshot(baseData),
  });
  const deviceAData = {
    trades: [{ id: 9, ticker: "FROM DEVICE A", status: "open" }],
    target: 850,
  };
  let resolveResumeCheck;
  loadCloudData
    .mockResolvedValueOnce(cloudData(baseData, "version-2"))
    .mockImplementationOnce(
      () => new Promise((resolve) => { resolveResumeCheck = resolve; })
    );

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();

  act(() => window.dispatchEvent(new Event("pageshow")));
  expect(result.current.syncStatus).toBe("syncing");

  await act(async () => {
    resolveResumeCheck(cloudData(deviceAData, "version-2"));
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(result.current.trades).toEqual(deviceAData.trades);
  expect(result.current.target).toBe(deviceAData.target);
  expect(result.current.syncStatus).toBe("saved");
  expect(result.current.hasConflict).toBe(false);
  expect(JSON.parse(localStorage.getItem("csp_trades"))).toEqual(deviceAData.trades);
  expect(localStorage.getItem("csp_target")).toBe(String(deviceAData.target));
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("leaves local state unchanged when a focus check finds the same cloud version", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-1"));

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  act(() => window.dispatchEvent(new Event("focus")));
  await flushAsync();

  expect(loadCloudData).toHaveBeenCalledTimes(2);
  expect(result.current.trades).toEqual(baseData.trades);
  expect(result.current.hasConflict).toBe(false);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("preserves dirty local data when a pageshow check finds newer cloud data", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData
    .mockResolvedValueOnce(cloudData(baseData, "version-1"))
    .mockResolvedValueOnce(cloudData({ ...baseData, target: 700 }, "version-2"));

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  act(() => result.current.setTrades(changedData.trades));
  act(() => window.dispatchEvent(new Event("pageshow")));
  await flushAsync();
  await advanceDebounce();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(result.current.hasConflict).toBe(true);
  expect(result.current.syncStatus).toBe("conflict");
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("coalesces simultaneous resume events into one cloud check", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  let resolveCheck;
  loadCloudData
    .mockResolvedValueOnce(cloudData(baseData, "version-1"))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveCheck = resolve; }));

  renderHook(() => useTrackerData());
  await flushAsync();
  act(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
  });

  expect(loadCloudData).toHaveBeenCalledTimes(2);
  await act(async () => {
    resolveCheck(cloudData(baseData, "version-1"));
    await Promise.resolve();
  });
});

test("a failed resume check preserves local data and reports failure", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData
    .mockResolvedValueOnce(cloudData(baseData, "version-1"))
    .mockRejectedValueOnce(new Error("network unavailable"));

  const { result } = renderHook(() => useTrackerData());
  await flushAsync();
  act(() => window.dispatchEvent(new Event("focus")));
  await flushAsync();

  expect(result.current.trades).toEqual(baseData.trades);
  expect(["offline", "error"]).toContain(result.current.syncStatus);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("removes all resume listeners during cleanup", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-1"));

  const { unmount } = renderHook(() => useTrackerData());
  await flushAsync();
  unmount();
  window.dispatchEvent(new Event("focus"));
  window.dispatchEvent(new Event("pageshow"));
  document.dispatchEvent(new Event("visibilitychange"));
  await flushAsync();

  expect(loadCloudData).toHaveBeenCalledTimes(1);
});
