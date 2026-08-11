import {
  GUEST_STORAGE_KEYS,
  clearGuestPortfolio,
  getPortfolioSnapshotHash,
  hasMeaningfulPortfolio,
  hasMigratedGuestSnapshot,
  markGuestSnapshotMigrated,
  readGuestPortfolio,
} from "./guestStorage";

beforeEach(() => localStorage.clear());

test("guest keys are fixed, versioned, and independent from account keys", () => {
  expect(GUEST_STORAGE_KEYS).toEqual({
    trades: "csp_guest_trades:v1",
    target: "csp_guest_target:v1",
    dividends: "csp_guest_dividends:v1",
    metadata: "csp_guest_metadata:v1",
    mode: "csp_guest_mode:v1",
  });
});

test("reads the exact guest portfolio and tolerates one damaged collection", () => {
  localStorage.setItem(GUEST_STORAGE_KEYS.trades, "not-json");
  localStorage.setItem(GUEST_STORAGE_KEYS.target, "750");
  localStorage.setItem(GUEST_STORAGE_KEYS.dividends, JSON.stringify([{ id: "d1", ticker: "ENB" }]));
  expect(readGuestPortfolio()).toMatchObject({ trades: [], target: 750, dividends: [{ id: "d1", ticker: "ENB" }] });
});

test("migration receipts are scoped to both user and exact guest snapshot", () => {
  const portfolio = { trades: [{ id: 1 }], target: 500, dividends: [] };
  const hash = getPortfolioSnapshotHash(portfolio);
  expect(hasMigratedGuestSnapshot("a", hash)).toBe(false);
  markGuestSnapshotMigrated("a", hash);
  expect(hasMigratedGuestSnapshot("a", hash)).toBe(true);
  expect(hasMigratedGuestSnapshot("b", hash)).toBe(false);
  expect(hasMigratedGuestSnapshot("a", getPortfolioSnapshotHash({ ...portfolio, target: 600 }))).toBe(false);
});

test("clearing guest data does not touch authenticated account caches", () => {
  localStorage.setItem(GUEST_STORAGE_KEYS.trades, "[]");
  localStorage.setItem("csp_trades:user-a", "account-data");
  clearGuestPortfolio();
  expect(localStorage.getItem(GUEST_STORAGE_KEYS.trades)).toBeNull();
  expect(localStorage.getItem("csp_trades:user-a")).toBe("account-data");
  expect(hasMeaningfulPortfolio(readGuestPortfolio())).toBe(false);
});
