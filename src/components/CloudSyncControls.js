import { useState } from "react";

const STATUS_LABELS = {
  initializing: "Syncing…",
  syncing: "Syncing…",
  saved: "Saved to cloud",
  offline: "Offline/local only",
  error: "Sync failed",
  conflict: "Cloud changed on another device",
  invariant_error: "Sync stopped: cloud version mismatch",
};

export default function CloudSyncControls({
  status,
  hasConflict,
  onSyncNow,
  onUseCloud,
  onKeepLocal,
  compact = false,
}) {
  const [showConflictChoices, setShowConflictChoices] = useState(false);
  const busy = status === "initializing" || status === "syncing";
  const invariantViolation = status === "invariant_error";

  const syncNow = () => {
    if (hasConflict) {
      setShowConflictChoices(true);
      return;
    }
    onSyncNow();
  };

  const keepLocal = () => {
    const confirmed = window.confirm(
      "Overwrite the newer cloud data with this device's local data?"
    );
    if (!confirmed) return;
    setShowConflictChoices(false);
    onKeepLocal();
  };

  return (
    <div className={`sync-control${compact ? " sync-control-compact" : ""}`}>
      <div className="sync-control-row">
        <span className={`sync-status sync-status-${status}`} role="status" aria-live="polite">
          <span className="sync-status-dot" aria-hidden="true" />
          {STATUS_LABELS[status] ?? "Sync failed"}
        </span>
        <div className="sync-control-buttons">
          <button className="sync-now-button" onClick={syncNow} disabled={busy || invariantViolation}>Sync now</button>
        </div>
      </div>

      {invariantViolation && (
        <p className="sync-invariant-message" role="alert">
          Synchronization was stopped because cloud data changed without its version changing. Your local data has not been overwritten.
        </p>
      )}

      {showConflictChoices && !invariantViolation && (
        <div className="sync-conflict-actions" role="group" aria-label="Resolve cloud conflict">
          <button onClick={() => { setShowConflictChoices(false); onUseCloud(); }}>
            Use cloud data
          </button>
          <button className="sync-keep-local" onClick={keepLocal}>
            Keep this device's data
          </button>
          <button onClick={() => setShowConflictChoices(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
