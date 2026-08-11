import { normalizeDividendHoldings } from "./utils/dividends";

export const GUEST_STORAGE_KEYS = {
  trades: "csp_guest_trades:v1",
  target: "csp_guest_target:v1",
  dividends: "csp_guest_dividends:v1",
  metadata: "csp_guest_metadata:v1",
  mode: "csp_guest_mode:v1",
};

export const DEFAULT_TRACKER_TARGET = 500;

export function normalizePortfolioSnapshot(value) {
  return {
    trades: Array.isArray(value?.trades) ? value.trades : [],
    target: Number.isFinite(Number(value?.target)) ? Number(value.target) : DEFAULT_TRACKER_TARGET,
    dividends: normalizeDividendHoldings(value?.dividends),
  };
}

export function readGuestPortfolio(storage = localStorage) {
  const parseCollection = (key) => {
    try { return JSON.parse(storage.getItem(key) || "[]"); } catch { return []; }
  };
  return normalizePortfolioSnapshot({
    trades: parseCollection(GUEST_STORAGE_KEYS.trades),
    target: storage.getItem(GUEST_STORAGE_KEYS.target) ?? DEFAULT_TRACKER_TARGET,
    dividends: parseCollection(GUEST_STORAGE_KEYS.dividends),
  });
}

export function hasMeaningfulPortfolio(portfolio) {
  const normalized = normalizePortfolioSnapshot(portfolio);
  return normalized.trades.length > 0
    || normalized.dividends.length > 0
    || normalized.target !== DEFAULT_TRACKER_TARGET;
}

export function getPortfolioSnapshotHash(portfolio) {
  const source = JSON.stringify(normalizePortfolioSnapshot(portfolio));
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function readGuestMetadata(storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(GUEST_STORAGE_KEYS.metadata) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function hasMigratedGuestSnapshot(userId, snapshotHash, storage = localStorage) {
  const receipts = readGuestMetadata(storage).migrationReceipts;
  return Array.isArray(receipts)
    && receipts.some((receipt) => receipt.userId === userId && receipt.snapshotHash === snapshotHash);
}

export function markGuestSnapshotMigrated(userId, snapshotHash, storage = localStorage) {
  const metadata = readGuestMetadata(storage);
  const receipts = Array.isArray(metadata.migrationReceipts) ? metadata.migrationReceipts : [];
  const nextReceipts = receipts.some((receipt) => receipt.userId === userId && receipt.snapshotHash === snapshotHash)
    ? receipts
    : [...receipts, { userId, snapshotHash, migratedAt: new Date().toISOString() }];
  storage.setItem(GUEST_STORAGE_KEYS.metadata, JSON.stringify({
    ...metadata,
    schemaVersion: 1,
    migrationReceipts: nextReceipts,
  }));
}

export function clearGuestPortfolio(storage = localStorage) {
  storage.removeItem(GUEST_STORAGE_KEYS.trades);
  storage.removeItem(GUEST_STORAGE_KEYS.target);
  storage.removeItem(GUEST_STORAGE_KEYS.dividends);
  storage.removeItem(GUEST_STORAGE_KEYS.metadata);
}

export function setGuestModeEnabled(enabled, storage = localStorage) {
  if (enabled) storage.setItem(GUEST_STORAGE_KEYS.mode, "true");
  else storage.removeItem(GUEST_STORAGE_KEYS.mode);
}

export function isGuestModeEnabled(storage = localStorage) {
  return storage.getItem(GUEST_STORAGE_KEYS.mode) === "true";
}
