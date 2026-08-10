import { useCallback, useEffect, useRef, useState } from "react";
import {
  CloudConflictError,
  loadCloudData,
  saveCloudData,
} from "../cloudStorage";
import { normalizeDividendHoldings } from "../utils/dividends";
const UPLOAD_DEBOUNCE_MS = 1000;
export const TRACKER_PAYLOAD_VERSION = 2;

export function getTrackerStorageKeys(userId) {
  if (!userId) throw new Error("An authenticated user ID is required.");
  return {
    trades: `csp_trades:${userId}`,
    target: `csp_target:${userId}`,
    dividends: `csp_dividends:${userId}`,
    syncMeta: `csp_sync_meta:${userId}`,
  };
}

function serializeData(trades, target, dividends) {
  return JSON.stringify({
    trades,
    target,
    dividends,
    payloadVersion: TRACKER_PAYLOAD_VERSION,
  });
}

function loadLocalData(storage, storageKeys) {
  try {
    const savedTrades = storage.getItem(storageKeys.trades);
    const savedTarget = storage.getItem(storageKeys.target);
    const savedDividends = storage.getItem(storageKeys.dividends);
    return {
      trades: savedTrades ? JSON.parse(savedTrades) : [],
      target: savedTarget ? parseFloat(savedTarget) : 500,
      dividends: savedDividends ? normalizeDividendHoldings(JSON.parse(savedDividends)) : [],
      hasLocalData: savedTrades != null || savedTarget != null || savedDividends != null,
    };
  } catch {
    return { trades: [], target: 500, dividends: [], hasLocalData: false };
  }
}

function saveLocalData(trades, target, dividends, storage, storageKeys) {
  try {
    storage.setItem(storageKeys.trades, JSON.stringify(trades));
    storage.setItem(storageKeys.target, String(target));
    storage.setItem(storageKeys.dividends, JSON.stringify(dividends));
  } catch {}
}

function loadSyncMetadata(storage, storageKeys) {
  try {
    const saved = storage.getItem(storageKeys.syncMeta);
    if (!saved) return null;
    const metadata = JSON.parse(saved);
    if (!metadata.syncedSnapshot) return metadata;
    const snapshot = JSON.parse(metadata.syncedSnapshot);
    return {
      ...metadata,
      syncedSnapshot: serializeData(
        snapshot.trades ?? [],
        snapshot.target ?? 500,
        snapshot.dividends ?? []
      ),
    };
  } catch {
    return null;
  }
}

function saveSyncMetadata(cloudVersion, syncedSnapshot, storage, storageKeys) {
  try {
    storage.setItem(
      storageKeys.syncMeta,
      JSON.stringify({ cloudVersion, syncedSnapshot })
    );
  } catch {}
}

function failureStatus() {
  return typeof navigator !== "undefined" && navigator.onLine === false
    ? "offline"
    : "error";
}

export default function useTrackerData({ userId, storage = localStorage } = {}) {
  const [storageKeys] = useState(() => getTrackerStorageKeys(userId));
  const [initialData] = useState(() => loadLocalData(storage, storageKeys));
  const [trades, setTradesRaw] = useState(initialData.trades);
  const [target, setTargetRaw] = useState(initialData.target);
  const [dividends, setDividendsRaw] = useState(initialData.dividends);
  const [syncStatus, setSyncStatus] = useState("initializing");
  const [syncReady, setSyncReady] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);

  const mountedRef = useRef(false);
  const initializedRef = useRef(false);
  const conflictRef = useRef(false);
  const applyingCloudRef = useRef(false);
  const cloudVersionRef = useRef(null);
  const lastSyncedSnapshotRef = useRef(null);
  const latestDataRef = useRef(initialData);
  const hadLocalDataRef = useRef(initialData.hasLocalData);
  const uploadInFlightRef = useRef(false);
  const queuedUploadRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const initializationRunRef = useRef(0);
  const initializationInFlightRef = useRef(false);
  const versionCheckInFlightRef = useRef(false);
  const versionCheckPendingRef = useRef(false);
  const checkCloudVersionRef = useRef(null);

  latestDataRef.current = { trades, target, dividends };

  const markConflict = useCallback(() => {
    conflictRef.current = true;
    setHasConflict(true);
    setSyncStatus("conflict");
  }, []);

  const markSynchronized = useCallback((version, snapshot) => {
    cloudVersionRef.current = version;
    lastSyncedSnapshotRef.current = snapshot;
    saveSyncMetadata(version, snapshot, storage, storageKeys);
  }, [storage, storageKeys]);

  const applyCloudData = useCallback((cloudData) => {
    const cloudDividends = cloudData.dividends ?? [];
    const snapshot = serializeData(cloudData.trades, cloudData.target, cloudDividends);
    applyingCloudRef.current = true;
    markSynchronized(cloudData.updatedAt, snapshot);
    latestDataRef.current = {
      trades: cloudData.trades,
      target: cloudData.target,
      dividends: cloudDividends,
    };
    setTradesRaw(cloudData.trades);
    setTargetRaw(cloudData.target);
    setDividendsRaw(cloudDividends);
    saveLocalData(cloudData.trades, cloudData.target, cloudDividends, storage, storageKeys);
    applyingCloudRef.current = false;
  }, [markSynchronized, storage, storageKeys]);

  const performUploadRef = useRef(null);
  const scheduleUploadRef = useRef(null);

  const scheduleUpload = useCallback((delay = UPLOAD_DEBOUNCE_MS) => {
    if (
      !mountedRef.current ||
      !initializedRef.current ||
      conflictRef.current ||
      applyingCloudRef.current
    ) return;

    clearTimeout(debounceTimerRef.current);
    setSyncStatus("syncing");
    debounceTimerRef.current = setTimeout(() => {
      if (mountedRef.current) performUploadRef.current?.();
    }, delay);
  }, []);
  scheduleUploadRef.current = scheduleUpload;

  const performUpload = useCallback(async ({ force = false } = {}) => {
    if (
      !mountedRef.current ||
      (!initializedRef.current && !force) ||
      (conflictRef.current && !force)
    ) return;

    if (versionCheckInFlightRef.current && !force) {
      queuedUploadRef.current = true;
      return;
    }

    if (uploadInFlightRef.current) {
      queuedUploadRef.current = true;
      return;
    }

    const dataToUpload = latestDataRef.current;
    const uploadedSnapshot = serializeData(
      dataToUpload.trades,
      dataToUpload.target,
      dataToUpload.dividends
    );

    if (!force && uploadedSnapshot === lastSyncedSnapshotRef.current) {
      setSyncStatus("saved");
      return;
    }

    uploadInFlightRef.current = true;
    queuedUploadRef.current = false;
    setSyncStatus("syncing");

    try {
      const result = await saveCloudData(
        dataToUpload.trades,
        dataToUpload.target,
        {
          dividends: dataToUpload.dividends,
          payloadVersion: TRACKER_PAYLOAD_VERSION,
          expectedUpdatedAt: cloudVersionRef.current,
          force,
        }
      );

      if (!mountedRef.current) return;
      markSynchronized(result.updatedAt, uploadedSnapshot);
      conflictRef.current = false;
      setHasConflict(false);

      const latestSnapshot = serializeData(
        latestDataRef.current.trades,
        latestDataRef.current.target,
        latestDataRef.current.dividends
      );
      if (queuedUploadRef.current || latestSnapshot !== uploadedSnapshot) {
        scheduleUploadRef.current?.();
      } else {
        setSyncStatus("saved");
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof CloudConflictError || error?.name === "CloudConflictError") {
        markConflict();
      } else {
        setSyncStatus(failureStatus());
      }
    } finally {
      uploadInFlightRef.current = false;
      if (versionCheckPendingRef.current && mountedRef.current) {
        versionCheckPendingRef.current = false;
        checkCloudVersionRef.current?.();
      }
    }
  }, [markConflict, markSynchronized]);
  performUploadRef.current = performUpload;

  const initializeSync = useCallback(async () => {
    if (initializationInFlightRef.current) return;
    initializationInFlightRef.current = true;
    const run = ++initializationRunRef.current;
    initializedRef.current = false;
    setSyncReady(false);
    setSyncStatus("initializing");

    try {
      const cloudData = await loadCloudData();
      if (!mountedRef.current || run !== initializationRunRef.current) return;

      const localData = latestDataRef.current;
      const localSnapshot = serializeData(localData.trades, localData.target, localData.dividends);
      const metadata = loadSyncMetadata(storage, storageKeys);

      if (!cloudData) {
        cloudVersionRef.current = null;
        lastSyncedSnapshotRef.current = null;
        conflictRef.current = false;
        setHasConflict(false);
        initializedRef.current = true;
        setSyncReady(true);
        if (localSnapshot === lastSyncedSnapshotRef.current) {
          setSyncStatus("saved");
        } else {
          scheduleUploadRef.current?.();
        }
        return;
      }

      const cloudSnapshot = serializeData(cloudData.trades, cloudData.target, cloudData.dividends ?? []);
      if (!metadata) {
        if (hadLocalDataRef.current && localSnapshot !== cloudSnapshot) {
          cloudVersionRef.current = cloudData.updatedAt;
          initializedRef.current = true;
          setSyncReady(true);
          markConflict();
          return;
        }
        applyCloudData(cloudData);
      } else {
        const localChanged = localSnapshot !== metadata.syncedSnapshot;
        const cloudChanged = cloudData.updatedAt !== metadata.cloudVersion;

        if (localChanged && cloudChanged) {
          cloudVersionRef.current = cloudData.updatedAt;
          initializedRef.current = true;
          setSyncReady(true);
          markConflict();
          return;
        }

        if (cloudChanged && !localChanged) {
          applyCloudData(cloudData);
        } else {
          cloudVersionRef.current = cloudData.updatedAt;
          lastSyncedSnapshotRef.current = metadata.syncedSnapshot;
        }
      }

      conflictRef.current = false;
      setHasConflict(false);
      initializedRef.current = true;
      setSyncReady(true);

      const currentSnapshot = serializeData(
        latestDataRef.current.trades,
        latestDataRef.current.target,
        latestDataRef.current.dividends
      );
      if (currentSnapshot === lastSyncedSnapshotRef.current) {
        setSyncStatus("saved");
      } else {
        scheduleUploadRef.current?.();
      }
    } catch {
      if (!mountedRef.current || run !== initializationRunRef.current) return;
      initializedRef.current = false;
      setSyncReady(false);
      setSyncStatus(failureStatus());
    } finally {
      if (run === initializationRunRef.current) {
        initializationInFlightRef.current = false;
      }
    }
  }, [applyCloudData, markConflict, storage, storageKeys]);

  const checkCloudVersion = useCallback(async () => {
    if (
      !mountedRef.current ||
      !initializedRef.current ||
      conflictRef.current
    ) return;
    if (versionCheckInFlightRef.current) {
      versionCheckPendingRef.current = true;
      return;
    }
    if (uploadInFlightRef.current) {
      versionCheckPendingRef.current = true;
      return;
    }

    versionCheckInFlightRef.current = true;
    setSyncStatus("syncing");
    try {
      const cloudData = await loadCloudData();
      if (!mountedRef.current || !initializedRef.current) return;
      if (!cloudData) {
        setSyncStatus("error");
        return;
      }

      const cloudSnapshot = serializeData(cloudData.trades, cloudData.target, cloudData.dividends ?? []);
      const localSnapshot = serializeData(
        latestDataRef.current.trades,
        latestDataRef.current.target,
        latestDataRef.current.dividends
      );
      const versionUnchanged = cloudData.updatedAt === cloudVersionRef.current;
      const payloadUnchanged = cloudSnapshot === lastSyncedSnapshotRef.current;
      if (versionUnchanged && payloadUnchanged) {
        if (localSnapshot === lastSyncedSnapshotRef.current) {
          setSyncStatus("saved");
        } else {
          scheduleUploadRef.current?.();
        }
        return;
      }

      if (localSnapshot !== lastSyncedSnapshotRef.current) {
        clearTimeout(debounceTimerRef.current);
        cloudVersionRef.current = cloudData.updatedAt;
        markConflict();
        return;
      }

      applyCloudData(cloudData);
      setSyncStatus("saved");
    } catch {
      if (mountedRef.current) setSyncStatus(failureStatus());
    } finally {
      versionCheckInFlightRef.current = false;
      const shouldCheckAgain = versionCheckPendingRef.current;
      versionCheckPendingRef.current = false;
      const latestSnapshot = serializeData(
        latestDataRef.current.trades,
        latestDataRef.current.target,
        latestDataRef.current.dividends
      );
      if (
        queuedUploadRef.current &&
        mountedRef.current &&
        !conflictRef.current &&
        latestSnapshot !== lastSyncedSnapshotRef.current
      ) {
        scheduleUploadRef.current?.();
      } else if (latestSnapshot === lastSyncedSnapshotRef.current) {
        queuedUploadRef.current = false;
      }
      if (
        shouldCheckAgain &&
        mountedRef.current &&
        initializedRef.current &&
        !conflictRef.current
      ) {
        checkCloudVersionRef.current?.();
      }
    }
  }, [applyCloudData, markConflict]);
  checkCloudVersionRef.current = checkCloudVersion;

  useEffect(() => {
    mountedRef.current = true;
    initializeSync();
    return () => {
      mountedRef.current = false;
      initializationRunRef.current += 1;
      clearTimeout(debounceTimerRef.current);
    };
  }, [initializeSync]);

  useEffect(() => {
    const resumeSync = () => {
      if (initializedRef.current) checkCloudVersion();
      else initializeSync();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") resumeSync();
    };
    const handleResume = () => resumeSync();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleResume);
    window.addEventListener("pageshow", handleResume);
    window.addEventListener("online", handleResume);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("pageshow", handleResume);
      window.removeEventListener("online", handleResume);
    };
  }, [checkCloudVersion, initializeSync]);

  useEffect(() => {
    if (
      !syncReady ||
      hasConflict ||
      applyingCloudRef.current ||
      !initializedRef.current
    ) return;

    const snapshot = serializeData(trades, target, dividends);
    if (snapshot !== lastSyncedSnapshotRef.current) {
      if (uploadInFlightRef.current) queuedUploadRef.current = true;
      else scheduleUpload();
    }
  }, [trades, target, dividends, syncReady, hasConflict, scheduleUpload]);

  const setTrades = useCallback((nextTrades) => {
    setTradesRaw(nextTrades);
    latestDataRef.current = {
      trades: nextTrades,
      target: latestDataRef.current.target,
      dividends: latestDataRef.current.dividends,
    };
    saveLocalData(nextTrades, latestDataRef.current.target, latestDataRef.current.dividends, storage, storageKeys);
  }, [storage, storageKeys]);

  const setDividends = useCallback((nextDividends) => {
    setDividendsRaw(nextDividends);
    latestDataRef.current = {
      trades: latestDataRef.current.trades,
      target: latestDataRef.current.target,
      dividends: nextDividends,
    };
    saveLocalData(latestDataRef.current.trades, latestDataRef.current.target, nextDividends, storage, storageKeys);
  }, [storage, storageKeys]);

  const syncNow = useCallback(() => {
    clearTimeout(debounceTimerRef.current);
    if (!initializedRef.current) return initializeSync();
    if (conflictRef.current) return;
    const snapshot = serializeData(
      latestDataRef.current.trades,
      latestDataRef.current.target,
      latestDataRef.current.dividends
    );
    if (snapshot !== lastSyncedSnapshotRef.current) {
      return performUploadRef.current?.();
    }
    return initializeSync();
  }, [initializeSync]);

  const useCloudData = useCallback(async () => {
    clearTimeout(debounceTimerRef.current);
    setSyncStatus("syncing");
    try {
      const cloudData = await loadCloudData();
      if (!mountedRef.current) return;
      if (!cloudData) {
        setSyncStatus("error");
        return;
      }
      applyCloudData(cloudData);
      conflictRef.current = false;
      setHasConflict(false);
      initializedRef.current = true;
      setSyncReady(true);
      setSyncStatus("saved");
    } catch {
      if (mountedRef.current) setSyncStatus(failureStatus());
    }
  }, [applyCloudData]);

  const keepLocalData = useCallback(async () => {
    clearTimeout(debounceTimerRef.current);
    initializedRef.current = true;
    setSyncReady(true);
    await performUploadRef.current?.({ force: true });
  }, []);

  return {
    trades,
    target,
    dividends,
    setTrades,
    setDividends,
    syncStatus,
    hasConflict,
    syncNow,
    useCloudData,
    keepLocalData,
  };
}
