import { act, renderHook } from "@testing-library/react";
import useTrackerData, { getTrackerStorageKeys } from "./useTrackerData";
import {
  CloudConflictError,
  loadCloudData,
  saveCloudData,
} from "../cloudStorage";
import { normalizeDividendHoldings } from "../utils/dividends";

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

const TEST_USER_ID = "test-user";
const TEST_KEYS = getTrackerStorageKeys(TEST_USER_ID);

const changedData = {
  trades: [{ id: 1, ticker: "CHANGED", status: "open" }],
  target: 500,
};

const safeDividend = {
  id: "safe-dividend",
  ticker: "ENB",
  shares: 10,
  dividendPerShare: 1,
  frequency: "quarterly",
  currency: "CAD",
  account: "TFSA",
  nextPaymentDate: "2026-09-01",
  notes: "",
};

const cloudData = (data, updatedAt = "version-1") => ({
  ...data,
  updatedAt,
});

const snapshot = (data) => JSON.stringify({
  trades: data.trades,
  target: data.target,
  dividends: normalizeDividendHoldings(data.dividends),
  payloadVersion: 3,
});

function seedLocal(data, metadata = null) {
  localStorage.setItem(TEST_KEYS.trades, JSON.stringify(data.trades));
  localStorage.setItem(TEST_KEYS.target, String(data.target));
  if (data.dividends) {
    localStorage.setItem(TEST_KEYS.dividends, JSON.stringify(data.dividends));
  }
  if (metadata) {
    localStorage.setItem(TEST_KEYS.syncMeta, JSON.stringify(metadata));
  }
}

function createDeviceStorage(data, metadata, keys = TEST_KEYS) {
  const values = new Map([
    [keys.trades, JSON.stringify(data.trades)],
    [keys.target, String(data.target)],
    [keys.dividends, JSON.stringify(data.dividends ?? [])],
    [keys.syncMeta, JSON.stringify(metadata)],
  ]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
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

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  await advanceDebounce();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(result.current.syncStatus).toBe("saved");
  expect(saveCloudData).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(TEST_KEYS.trades))).toEqual(changedData.trades);
});

test("upgrades payloadVersion 2 dividend holdings to version 3 without changing their meaning", async () => {
  loadCloudData.mockResolvedValue(cloudData({
    ...baseData,
    dividends: normalizeDividendHoldings([safeDividend]),
    payloadVersion: 2,
  }, "version-1"));
  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  expect(result.current.dividends[0]).toMatchObject({
    ticker: "ENB",
    dividendBasis: "per_payment",
    dividendPerShare: 1,
    annualDividendPerShare: null,
  });
  act(() => result.current.setTarget(525));
  await advanceDebounce();
  expect(saveCloudData).toHaveBeenCalledWith(
    baseData.trades,
    525,
    expect.objectContaining({
      payloadVersion: 3,
      dividends: [expect.objectContaining({ dividendBasis: "per_payment", dividendPerShare: 1 })],
    })
  );
});

test("loads and persists account-specific dividend holdings locally", async () => {
  const dividends = [{ id: "div-1", ticker: "ENB", shares: 20 }];
  seedLocal({ ...baseData, dividends });
  loadCloudData.mockResolvedValue(cloudData({ ...baseData, dividends }, "version-1"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();

  expect(result.current.dividends).toMatchObject(dividends);
  act(() => result.current.setDividends([...dividends, { id: "div-2", ticker: "RY", shares: 10 }]));
  expect(JSON.parse(localStorage.getItem(TEST_KEYS.dividends))).toHaveLength(2);
  expect(localStorage.getItem(getTrackerStorageKeys("another-user").dividends)).toBeNull();
});

test("guest mode loads and persists trades, target, and dividends without any cloud activity", async () => {
  localStorage.setItem("csp_guest_trades:v1", JSON.stringify([{ id: 9, ticker: "GUEST" }]));
  localStorage.setItem("csp_guest_target:v1", "900");
  localStorage.setItem("csp_guest_dividends:v1", JSON.stringify([{ id: "d1", ticker: "ENB", shares: 2 }]));

  const { result } = renderHook(() => useTrackerData({ mode: "guest" }));
  await flushAsync();

  expect(result.current.syncStatus).toBe("guest");
  expect(result.current.trades).toMatchObject([{ ticker: "GUEST" }]);
  expect(result.current.target).toBe(900);
  expect(result.current.dividends).toMatchObject([{ ticker: "ENB" }]);

  act(() => result.current.setTrades([{ id: 10, ticker: "LOCAL" }]));
  act(() => result.current.setTarget(1200));
  act(() => result.current.setDividends([{ id: "d2", ticker: "RY", shares: 3 }]));
  await advanceDebounce();

  expect(loadCloudData).not.toHaveBeenCalled();
  expect(saveCloudData).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem("csp_guest_trades:v1"))).toMatchObject([{ ticker: "LOCAL" }]);
  expect(localStorage.getItem("csp_guest_target:v1")).toBe("1200");
  expect(JSON.parse(localStorage.getItem("csp_guest_dividends:v1"))).toMatchObject([{ ticker: "RY" }]);
});

test("guest mode registers no cloud resume or reconnect listeners", async () => {
  const documentSpy = jest.spyOn(document, "addEventListener");
  const windowSpy = jest.spyOn(window, "addEventListener");
  renderHook(() => useTrackerData({ mode: "guest" }));
  await flushAsync();

  expect(documentSpy).not.toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  expect(windowSpy).not.toHaveBeenCalledWith("focus", expect.any(Function));
  expect(windowSpy).not.toHaveBeenCalledWith("pageshow", expect.any(Function));
  expect(windowSpy).not.toHaveBeenCalledWith("online", expect.any(Function));
  documentSpy.mockRestore();
  windowSpy.mockRestore();
});

test("replacePortfolio applies guest migration as one complete local snapshot", async () => {
  loadCloudData.mockResolvedValue(null);
  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  const guestPortfolio = {
    trades: [{ id: 44, ticker: "MOVED" }],
    target: 1400,
    dividends: [{ id: "d44", ticker: "BCE", shares: 4 }],
  };
  act(() => result.current.replacePortfolio(guestPortfolio));
  expect(result.current.trades).toEqual(guestPortfolio.trades);
  expect(result.current.target).toBe(1400);
  expect(result.current.dividends).toMatchObject(guestPortfolio.dividends);
  expect(JSON.parse(localStorage.getItem(TEST_KEYS.trades))).toEqual(guestPortfolio.trades);
  expect(localStorage.getItem(TEST_KEYS.target)).toBe("1400");
  expect(JSON.parse(localStorage.getItem(TEST_KEYS.dividends))).toMatchObject(guestPortfolio.dividends);
  await advanceDebounce();
  expect(saveCloudData).toHaveBeenCalledTimes(1);
  expect(saveCloudData).toHaveBeenCalledWith(guestPortfolio.trades, 1400, expect.objectContaining({
    dividends: expect.arrayContaining([expect.objectContaining({ ticker: "BCE" })]),
    payloadVersion: 3,
  }));
});

test("treats a version-one cloud payload as having no dividends without an upload loop", async () => {
  loadCloudData.mockResolvedValue({ ...baseData, updatedAt: "legacy-version", payloadVersion: 1 });

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  await advanceDebounce();

  expect(result.current.dividends).toEqual([]);
  expect(result.current.syncStatus).toBe("saved");
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("migrates legacy sync metadata so it does not create a false dividend conflict", async () => {
  const legacySnapshot = JSON.stringify({ trades: baseData.trades, target: baseData.target });
  seedLocal(baseData, { cloudVersion: "version-1", syncedSnapshot: legacySnapshot });
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-1"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();

  expect(result.current.hasConflict).toBe(false);
  expect(result.current.syncStatus).toBe("saved");
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("debounces dividend changes and uploads the complete versioned payload", async () => {
  seedLocal(baseData, { cloudVersion: "version-1", syncedSnapshot: snapshot(baseData) });
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-1"));
  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();

  const first = [{ id: "div-1", ticker: "ENB" }];
  const latest = [...first, { id: "div-2", ticker: "RY" }];
  act(() => result.current.setDividends(first));
  act(() => {
    jest.advanceTimersByTime(500);
    result.current.setDividends(latest);
  });
  await advanceDebounce();

  expect(saveCloudData).toHaveBeenCalledTimes(1);
  expect(saveCloudData).toHaveBeenCalledWith(baseData.trades, baseData.target, {
    dividends: latest,
    payloadVersion: 3,
    expectedUpdatedAt: "version-1",
    force: false,
  });
});

test("a second device downloads the exact newer dividend collection on resume", async () => {
  const dividend = { id: "div-1", ticker: "ENB", shares: 25 };
  const normalizedDividend = normalizeDividendHoldings([dividend])[0];
  seedLocal(baseData, { cloudVersion: "version-1", syncedSnapshot: snapshot(baseData) });
  loadCloudData
    .mockResolvedValueOnce(cloudData(baseData, "version-1"))
    .mockResolvedValueOnce(cloudData({ ...baseData, dividends: [dividend] }, "version-2"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => window.dispatchEvent(new Event("focus")));
  await flushAsync();

  expect(result.current.dividends).toEqual([normalizedDividend]);
  expect(JSON.parse(localStorage.getItem(TEST_KEYS.dividends))).toEqual([normalizedDividend]);
  expect(result.current.hasConflict).toBe(false);
});

test("a new device without persisted local data accepts existing cloud data", async () => {
  loadCloudData.mockResolvedValue(cloudData(changedData, "version-2"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(result.current.target).toBe(changedData.target);
  expect(result.current.hasConflict).toBe(false);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("a brand-new account starts with zero trades and creates an empty cloud row", async () => {
  const newUserId = "brand-new-user";
  loadCloudData.mockResolvedValue(null);

  const { result } = renderHook(() => useTrackerData({ userId: newUserId }));
  await flushAsync();

  expect(result.current.trades).toEqual([]);
  expect(result.current.target).toBe(500);
  expect(saveCloudData).not.toHaveBeenCalled();

  await advanceDebounce();

  expect(saveCloudData).toHaveBeenCalledWith([], 500, {
    dividends: [],
    payloadVersion: 3,
    expectedUpdatedAt: null,
    force: false,
  });
});

test("an existing account keeps its cloud data instead of legacy browser data", async () => {
  localStorage.setItem("csp_trades", JSON.stringify(changedData.trades));
  localStorage.setItem("csp_target", "999");
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-existing"));

  const { result } = renderHook(() =>
    useTrackerData({ userId: "existing-user" })
  );
  await flushAsync();

  expect(result.current.trades).toEqual(baseData.trades);
  expect(result.current.target).toBe(baseData.target);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("switching accounts on one device does not leak trades", async () => {
  const accountA = { trades: [{ id: "a", ticker: "ACCOUNT A" }], target: 500 };
  const accountB = { trades: [{ id: "b", ticker: "ACCOUNT B" }], target: 700 };
  const accountAKeys = getTrackerStorageKeys("account-a");
  const accountBKeys = getTrackerStorageKeys("account-b");
  localStorage.setItem(accountAKeys.trades, JSON.stringify(accountA.trades));
  localStorage.setItem(accountAKeys.target, String(accountA.target));
  localStorage.setItem(accountBKeys.trades, JSON.stringify(accountB.trades));
  localStorage.setItem(accountBKeys.target, String(accountB.target));
  loadCloudData
    .mockResolvedValueOnce(cloudData(accountA, "version-a"))
    .mockResolvedValueOnce(cloudData(accountB, "version-b"));

  const firstAccount = renderHook(() =>
    useTrackerData({ userId: "account-a" })
  );
  await flushAsync();
  expect(firstAccount.result.current.trades).toEqual(accountA.trades);
  firstAccount.unmount();

  const secondAccount = renderHook(() =>
    useTrackerData({ userId: "account-b" })
  );
  await flushAsync();
  expect(secondAccount.result.current.trades).toEqual(accountB.trades);
  expect(secondAccount.result.current.trades).not.toEqual(accountA.trades);
});

test("missing cloud data never falls back to legacy sample trades", async () => {
  localStorage.setItem("csp_trades", JSON.stringify([
    { id: 1, ticker: "SAMPLE", status: "open" },
  ]));
  localStorage.setItem("csp_target", "900");
  loadCloudData.mockResolvedValue(null);

  const { result } = renderHook(() =>
    useTrackerData({ userId: "empty-cloud-user" })
  );
  await flushAsync();
  await advanceDebounce();

  expect(result.current.trades).toEqual([]);
  expect(result.current.target).toBe(500);
  expect(saveCloudData).toHaveBeenCalledWith([], 500, {
    dividends: [],
    payloadVersion: 3,
    expectedUpdatedAt: null,
    force: false,
  });
});

test("creates cloud data after a successful missing-row initialization", async () => {
  seedLocal(baseData);
  loadCloudData.mockResolvedValue(null);

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  expect(saveCloudData).not.toHaveBeenCalled();

  await advanceDebounce();

  expect(saveCloudData).toHaveBeenCalledWith(
    baseData.trades,
    baseData.target,
    { dividends: [], payloadVersion: 3, expectedUpdatedAt: null, force: false }
  );
  expect(result.current.syncStatus).toBe("saved");
});

test("keeps offline local changes and uploads them against the known cloud version", async () => {
  seedLocal(changedData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-1"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  await advanceDebounce();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(saveCloudData).toHaveBeenCalledWith(
    changedData.trades,
    changedData.target,
    { dividends: [], payloadVersion: 3, expectedUpdatedAt: "version-1", force: false }
  );
});

test("debounces multiple local changes into one latest upload", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData));
  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
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

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
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

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  await advanceDebounce();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(["offline", "error"]).toContain(result.current.syncStatus);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("mobile retries failed initialization, uploads its local trade, and desktop downloads it on resume", async () => {
  const metadata = {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  };
  const mobileData = {
    trades: [...baseData.trades, { id: 22, ticker: "MOBILE ADD", status: "open" }],
    target: baseData.target,
  };
  const mobileStorage = createDeviceStorage(baseData, metadata);
  const desktopStorage = createDeviceStorage(baseData, metadata);
  let cloudRow = cloudData(baseData, "version-1");

  loadCloudData
    .mockRejectedValueOnce(new Error("mobile startup offline"))
    .mockImplementation(() => Promise.resolve(cloudRow));
  saveCloudData.mockImplementation(async (trades, target, options) => {
    expect(options).toEqual({
      dividends: [], payloadVersion: 3, expectedUpdatedAt: "version-1", force: false,
    });
    cloudRow = cloudData({ trades, target }, "version-2");
    return { updatedAt: cloudRow.updatedAt };
  });

  const mobile = renderHook(() =>
    useTrackerData({ userId: TEST_USER_ID, storage: mobileStorage })
  );
  await flushAsync();
  expect(mobile.result.current.syncStatus).toBe("error");

  act(() => mobile.result.current.setTrades(mobileData.trades));
  expect(JSON.parse(mobileStorage.getItem(TEST_KEYS.trades))).toEqual(mobileData.trades);

  const desktop = renderHook(() =>
    useTrackerData({ userId: TEST_USER_ID, storage: desktopStorage })
  );
  await flushAsync();
  expect(desktop.result.current.trades).toEqual(baseData.trades);

  act(() => window.dispatchEvent(new Event("focus")));
  await flushAsync();
  await advanceDebounce();

  expect(saveCloudData).toHaveBeenCalledTimes(1);
  expect(cloudRow.trades).toEqual(mobileData.trades);
  expect(cloudRow.updatedAt).toBe("version-2");

  mobile.unmount();
  act(() => window.dispatchEvent(new Event("pageshow")));
  await flushAsync();

  expect(desktop.result.current.trades).toEqual(mobileData.trades);
  expect(desktop.result.current.hasConflict).toBe(false);
  expect(JSON.parse(desktopStorage.getItem(TEST_KEYS.trades))).toEqual(mobileData.trades);
});

test("repeated resume events deduplicate initialization retries and the resulting upload", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  let resolveRetry;
  loadCloudData
    .mockRejectedValueOnce(new Error("startup offline"))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveRetry = resolve; }));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => result.current.setTrades(changedData.trades));
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });

  act(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
  });

  expect(loadCloudData).toHaveBeenCalledTimes(2);
  await act(async () => {
    resolveRetry(cloudData(baseData, "version-1"));
    await Promise.resolve();
    await Promise.resolve();
  });
  await advanceDebounce();

  expect(loadCloudData).toHaveBeenCalledTimes(2);
  expect(saveCloudData).toHaveBeenCalledTimes(1);
  expect(saveCloudData).toHaveBeenCalledWith(changedData.trades, changedData.target, {
    dividends: [],
    payloadVersion: 3,
    expectedUpdatedAt: "version-1",
    force: false,
  });
});

test("a successful retry downloads cloud-only changes", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData
    .mockRejectedValueOnce(new Error("startup offline"))
    .mockResolvedValueOnce(cloudData(changedData, "version-2"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => window.dispatchEvent(new Event("pageshow")));
  await flushAsync();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(result.current.hasConflict).toBe(false);
  expect(result.current.syncStatus).toBe("saved");
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("a successful retry preserves local data when both local and cloud changed", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  const otherDeviceData = {
    trades: [{ id: 44, ticker: "OTHER DEVICE", status: "open" }],
    target: 700,
  };
  loadCloudData
    .mockRejectedValueOnce(new Error("startup offline"))
    .mockResolvedValueOnce(cloudData(otherDeviceData, "version-2"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => result.current.setTrades(changedData.trades));
  act(() => window.dispatchEvent(new Event("focus")));
  await flushAsync();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(result.current.hasConflict).toBe(true);
  expect(result.current.syncStatus).toBe("conflict");
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("failed upload preserves local data and reports failure", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData));
  saveCloudData.mockRejectedValue(new Error("upload failed"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => result.current.setTrades(changedData.trades));
  await advanceDebounce();

  expect(result.current.trades).toEqual(changedData.trades);
  expect(["offline", "error"]).toContain(result.current.syncStatus);
  expect(JSON.parse(localStorage.getItem(TEST_KEYS.trades))).toEqual(changedData.trades);
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

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
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

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
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

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
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

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  await act(async () => result.current.keepLocalData());

  expect(saveCloudData).toHaveBeenCalledWith(
    changedData.trades,
    changedData.target,
    { dividends: [], payloadVersion: 3, expectedUpdatedAt: "version-2", force: true }
  );
  expect(result.current.hasConflict).toBe(false);
});

test("cleanup cancels pending uploads and ignores initialization responses", async () => {
  seedLocal(baseData);
  let resolveInitialization;
  loadCloudData.mockImplementation(
    () => new Promise((resolve) => { resolveInitialization = resolve; })
  );

  const { unmount } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
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

  const { result, unmount } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => result.current.setTrades(changedData.trades));
  unmount();
  await act(async () => {
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
  });

  expect(saveCloudData).not.toHaveBeenCalled();
});

test("a dividend saved locally survives an immediate refresh before autosync", async () => {
  const dividend = { id: "div-refresh", ticker: "ENB", shares: 12 };
  const metadata = { cloudVersion: "version-1", syncedSnapshot: snapshot(baseData) };
  const deviceStorage = createDeviceStorage(baseData, metadata);
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-1"));

  const firstLoad = renderHook(() =>
    useTrackerData({ userId: TEST_USER_ID, storage: deviceStorage })
  );
  await flushAsync();
  act(() => firstLoad.result.current.setDividends([dividend]));
  expect(JSON.parse(deviceStorage.getItem(TEST_KEYS.dividends))).toEqual([dividend]);
  firstLoad.unmount();

  const refreshed = renderHook(() =>
    useTrackerData({ userId: TEST_USER_ID, storage: deviceStorage })
  );
  await flushAsync();

  expect(refreshed.result.current.dividends).toMatchObject([dividend]);
});

test("rapid dividend add edit and delete changes persist only the final collection", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-1"));
  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();

  act(() => result.current.setDividends([{ id: "one", ticker: "ENB", shares: 10 }]));
  act(() => {
    jest.advanceTimersByTime(300);
    result.current.setDividends([{ id: "one", ticker: "ENB", shares: 20 }]);
  });
  act(() => {
    jest.advanceTimersByTime(300);
    result.current.setDividends([{ id: "final", ticker: "RY", shares: 30 }]);
  });
  await advanceDebounce();

  expect(saveCloudData).toHaveBeenCalledTimes(1);
  expect(saveCloudData.mock.calls[0][2].dividends).toEqual([
    { id: "final", ticker: "RY", shares: 30 },
  ]);
  expect(JSON.parse(localStorage.getItem(TEST_KEYS.dividends))).toEqual([
    { id: "final", ticker: "RY", shares: 30 },
  ]);
});

test("switching accounts does not leak dividend holdings", async () => {
  const accountADividends = [{ id: "a-div", ticker: "ENB", shares: 10 }];
  const accountBDividends = [{ id: "b-div", ticker: "RY", shares: 20 }];
  const accountAStorage = createDeviceStorage(
    { ...baseData, dividends: accountADividends },
    { cloudVersion: "version-a", syncedSnapshot: snapshot({ ...baseData, dividends: accountADividends }) },
    getTrackerStorageKeys("account-a")
  );
  const accountBStorage = createDeviceStorage(
    { ...baseData, dividends: accountBDividends },
    { cloudVersion: "version-b", syncedSnapshot: snapshot({ ...baseData, dividends: accountBDividends }) },
    getTrackerStorageKeys("account-b")
  );
  loadCloudData
    .mockResolvedValueOnce(cloudData({ ...baseData, dividends: accountADividends }, "version-a"))
    .mockResolvedValueOnce(cloudData({ ...baseData, dividends: accountBDividends }, "version-b"));

  const accountA = renderHook(() =>
    useTrackerData({ userId: "account-a", storage: accountAStorage })
  );
  await flushAsync();
  expect(accountA.result.current.dividends).toMatchObject(accountADividends);
  accountA.unmount();

  const accountB = renderHook(() =>
    useTrackerData({ userId: "account-b", storage: accountBStorage })
  );
  await flushAsync();
  expect(accountB.result.current.dividends).toMatchObject(accountBDividends);
  expect(accountB.result.current.dividends).not.toMatchObject(accountADividends);
});

test("a failed offline dividend upload retries on resume after connectivity returns", async () => {
  const dividend = normalizeDividendHoldings([{ ...safeDividend, id: "offline-div", ticker: "BCE", shares: 40 }])[0];
  let cloudRow = cloudData(baseData, "version-1");
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockImplementation(() => Promise.resolve(cloudRow));
  saveCloudData
    .mockRejectedValueOnce(new Error("offline"))
    .mockImplementationOnce(async (trades, target, options) => {
      cloudRow = cloudData({ trades, target, dividends: options.dividends }, "version-2");
      return { updatedAt: cloudRow.updatedAt };
    });

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => result.current.setDividends([dividend]));
  await advanceDebounce();
  expect(result.current.syncStatus).toBe("error");
  expect(saveCloudData).toHaveBeenCalledTimes(1);

  act(() => window.dispatchEvent(new Event("online")));
  await flushAsync();
  await advanceDebounce();

  expect(saveCloudData).toHaveBeenCalledTimes(2);
  expect(saveCloudData.mock.calls[1][2].dividends).toEqual([dividend]);
  expect(result.current.syncStatus).toBe("saved");

  act(() => window.dispatchEvent(new Event("focus")));
  await flushAsync();
  expect(saveCloudData).toHaveBeenCalledTimes(2);
  expect(result.current.syncStatus).toBe("saved");
});

test("a failed offline trade upload has the same resume retry requirement", async () => {
  const offlineTrades = [...baseData.trades, { id: "offline-trade", ticker: "BCE" }];
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-1"));
  saveCloudData
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ updatedAt: "version-2" });

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => result.current.setTrades(offlineTrades));
  await advanceDebounce();
  expect(saveCloudData).toHaveBeenCalledTimes(1);

  act(() => window.dispatchEvent(new Event("focus")));
  await flushAsync();
  await advanceDebounce();

  expect(saveCloudData).toHaveBeenCalledTimes(2);
  expect(saveCloudData.mock.calls[1][0]).toEqual(offlineTrades);
});

test("repeated focus and online events retry one failed upload without duplicates", async () => {
  const dividend = { id: "dedup-div", ticker: "TD", shares: 15 };
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  let resolveCheck;
  loadCloudData
    .mockResolvedValueOnce(cloudData(baseData, "version-1"))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveCheck = resolve; }))
    .mockResolvedValue(cloudData(baseData, "version-1"));
  saveCloudData
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ updatedAt: "version-2" });

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => result.current.setDividends([dividend]));
  await advanceDebounce();
  expect(saveCloudData).toHaveBeenCalledTimes(1);

  act(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("pageshow"));
  });
  expect(loadCloudData).toHaveBeenCalledTimes(2);
  await act(async () => {
    resolveCheck(cloudData(baseData, "version-1"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  await advanceDebounce();

  expect(saveCloudData).toHaveBeenCalledTimes(2);
  expect(saveCloudData.mock.calls[1][2].dividends).toEqual([dividend]);
  expect(result.current.syncStatus).toBe("saved");
});

test("checks for newer cloud data when the app becomes visible again", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData
    .mockResolvedValueOnce(cloudData(baseData, "version-1"))
    .mockResolvedValueOnce(cloudData(changedData, "version-2"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
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

test("Device B stops instead of applying changed cloud data when version metadata matches", async () => {
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

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();

  act(() => window.dispatchEvent(new Event("pageshow")));
  expect(result.current.syncStatus).toBe("syncing");

  await act(async () => {
    resolveResumeCheck(cloudData(deviceAData, "version-2"));
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(result.current.trades).toEqual(baseData.trades);
  expect(result.current.target).toBe(baseData.target);
  expect(result.current.syncStatus).toBe("invariant_error");
  expect(result.current.hasConflict).toBe(true);
  expect(result.current.syncConflict).toEqual(expect.objectContaining({
    type: "version_invariant",
    localSnapshot: snapshot(baseData),
    remoteSnapshot: snapshot(deviceAData),
  }));
  expect(JSON.parse(localStorage.getItem(TEST_KEYS.trades))).toEqual(baseData.trades);
  expect(localStorage.getItem(TEST_KEYS.target)).toBe(String(baseData.target));
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("a suspended mobile check is followed by a fresh check after an independent web device uploads", async () => {
  const metadata = {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  };
  const deviceAData = {
    trades: [{ id: 10, ticker: "WEB UPDATE", status: "open" }],
    target: 925,
  };
  const mobileStorage = createDeviceStorage(baseData, metadata);
  const webStorage = createDeviceStorage(deviceAData, metadata);
  let cloudRow = cloudData(baseData, "version-1");
  let resolveSuspendedCheck;
  let loadCount = 0;

  loadCloudData.mockImplementation(() => {
    loadCount += 1;
    if (loadCount === 2) {
      return new Promise((resolve) => { resolveSuspendedCheck = resolve; });
    }
    return Promise.resolve(cloudRow);
  });
  saveCloudData.mockImplementation(async (trades, target) => {
    cloudRow = cloudData({ trades, target }, "version-2");
    return { updatedAt: cloudRow.updatedAt };
  });

  const mobile = renderHook(() => useTrackerData({ userId: TEST_USER_ID, storage: mobileStorage }));
  await flushAsync();
  act(() => window.dispatchEvent(new Event("focus")));
  expect(mobile.result.current.syncStatus).toBe("syncing");

  const web = renderHook(() => useTrackerData({ userId: TEST_USER_ID, storage: webStorage }));
  await flushAsync();
  await advanceDebounce();
  expect(cloudRow.trades).toEqual(deviceAData.trades);
  expect(cloudRow.target).toBe(deviceAData.target);
  web.unmount();

  act(() => window.dispatchEvent(new Event("pageshow")));
  await act(async () => {
    resolveSuspendedCheck(cloudData(baseData, "version-1"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(loadCloudData).toHaveBeenCalledTimes(4);
  expect(mobile.result.current.trades).toEqual(deviceAData.trades);
  expect(mobile.result.current.target).toBe(deviceAData.target);
  expect(mobile.result.current.hasConflict).toBe(false);
  expect(JSON.parse(mobileStorage.getItem(TEST_KEYS.trades))).toEqual(deviceAData.trades);
  expect(mobileStorage.getItem(TEST_KEYS.target)).toBe(String(deviceAData.target));
});

test("leaves local state unchanged when a focus check finds the same cloud version", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-1"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => window.dispatchEvent(new Event("focus")));
  await flushAsync();

  expect(loadCloudData).toHaveBeenCalledTimes(2);
  expect(result.current.trades).toEqual(baseData.trades);
  expect(result.current.hasConflict).toBe(false);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("same cloud version and same normalized payload initializes as saved", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-1"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();

  expect(result.current.syncStatus).toBe("saved");
  expect(result.current.hasConflict).toBe(false);
  expect(result.current.syncConflict).toBeNull();
  expect(saveCloudData).not.toHaveBeenCalled();
});

test.each([
  ["trades", { ...baseData, trades: [{ id: 7, ticker: "REMOTE" }] }],
  ["target", { ...baseData, target: 975 }],
  ["dividends", { ...baseData, dividends: [{ ...safeDividend, id: "remote-dividend" }] }],
  ["dividends becoming empty", { ...baseData, dividends: [] }],
])("same updated_at with different %s stops startup synchronization", async (_field, remoteData) => {
  const localData = _field === "dividends becoming empty"
    ? { ...baseData, dividends: [{ ...safeDividend, id: "preserved", ticker: "RY" }] }
    : baseData;
  seedLocal(localData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(localData),
  });
  loadCloudData.mockResolvedValue(cloudData(remoteData, "version-1"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  await advanceDebounce();

  expect(result.current.syncStatus).toBe("invariant_error");
  expect(result.current.hasConflict).toBe(true);
  expect(result.current.syncConflict).toEqual(expect.objectContaining({
    type: "version_invariant",
    cloudVersion: "version-1",
    localSnapshot: snapshot(localData),
    remoteSnapshot: snapshot(remoteData),
  }));
  expect(result.current.trades).toEqual(localData.trades);
  expect(result.current.target).toBe(localData.target);
  expect(result.current.dividends).toMatchObject(localData.dividends ?? []);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("same updated_at with a changed payload stops resume synchronization", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData
    .mockResolvedValueOnce(cloudData(baseData, "version-1"))
    .mockResolvedValueOnce(cloudData({ ...baseData, target: 800 }, "version-1"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => window.dispatchEvent(new Event("focus")));
  await flushAsync();

  expect(result.current.syncStatus).toBe("invariant_error");
  expect(result.current.hasConflict).toBe(true);
  expect(result.current.target).toBe(baseData.target);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("intentional deletion of all dividends downloads normally with a new updated_at", async () => {
  const localData = { ...baseData, dividends: [{ ...safeDividend, id: "delete-me" }] };
  const remoteData = { ...baseData, dividends: [] };
  seedLocal(localData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(localData),
  });
  loadCloudData.mockResolvedValue(cloudData(remoteData, "version-2"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();

  expect(result.current.dividends).toEqual([]);
  expect(result.current.syncStatus).toBe("saved");
  expect(result.current.hasConflict).toBe(false);
  expect(saveCloudData).not.toHaveBeenCalled();
});

test("an upload response that does not advance updated_at stops synchronization", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData.mockResolvedValue(cloudData(baseData, "version-1"));
  saveCloudData.mockResolvedValue({ updatedAt: "version-1" });

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => result.current.setTarget(650));
  await advanceDebounce();

  expect(result.current.target).toBe(650);
  expect(result.current.syncStatus).toBe("invariant_error");
  expect(result.current.hasConflict).toBe(true);
  expect(result.current.syncConflict.type).toBe("version_invariant");
});

test("preserves dirty local data when a pageshow check finds newer cloud data", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData
    .mockResolvedValueOnce(cloudData(baseData, "version-1"))
    .mockResolvedValueOnce(cloudData({ ...baseData, target: 700 }, "version-2"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
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
    .mockImplementationOnce(() => new Promise((resolve) => { resolveCheck = resolve; }))
    .mockResolvedValue(cloudData(baseData, "version-1"));

  renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  act(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
  });

  expect(loadCloudData).toHaveBeenCalledTimes(2);
  await act(async () => {
    resolveCheck(cloudData(baseData, "version-1"));
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(loadCloudData).toHaveBeenCalledTimes(3);
});

test("a failed resume check preserves local data and reports failure", async () => {
  seedLocal(baseData, {
    cloudVersion: "version-1",
    syncedSnapshot: snapshot(baseData),
  });
  loadCloudData
    .mockResolvedValueOnce(cloudData(baseData, "version-1"))
    .mockRejectedValueOnce(new Error("network unavailable"));

  const { result } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
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

  const { unmount } = renderHook(() => useTrackerData({ userId: TEST_USER_ID }));
  await flushAsync();
  unmount();
  window.dispatchEvent(new Event("focus"));
  window.dispatchEvent(new Event("online"));
  window.dispatchEvent(new Event("pageshow"));
  document.dispatchEvent(new Event("visibilitychange"));
  await flushAsync();

  expect(loadCloudData).toHaveBeenCalledTimes(1);
});
