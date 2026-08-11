export default function GuestMigrationDialog({ accountEmpty, guestTradeCount, guestDividendCount, busy, error, completed, onMove, onKeepAccount, onReplace, onCancel, onReturnToGuest, onClearGuest, onKeepGuestCopy }) {
  return <div className="guest-gate-layer" role="dialog" aria-modal="true" aria-labelledby="guest-migration-title">
    <div className="guest-gate-backdrop" />
    <section className="guest-gate-dialog">
      <span className="auth-eyebrow">{completed ? "TRANSFER COMPLETE" : "GUEST PORTFOLIO FOUND"}</span>
      <h2 id="guest-migration-title">{completed ? "Guest data saved to your account" : "Preserve data from this device?"}</h2>
      <p>{completed
        ? "Your trades, target, and dividend holdings are now backed up and available across devices."
        : accountEmpty
          ? "Move the guest trades, target, and dividend holdings into this account."
          : "This account already contains portfolio data. Choose which complete portfolio to keep; Wheel App will not merge them automatically."}</p>
      {!completed && <div className="guest-migration-counts">
        <span><strong>{guestTradeCount}</strong> guest trades</span>
        <span><strong>{guestDividendCount}</strong> guest dividend holdings</span>
      </div>}
      {error && <p className="guest-migration-error" role="alert">{error}</p>}
      <div className="guest-gate-actions">
        {completed ? <>
          <button type="button" className="csp-btn csp-btn-blue" onClick={onClearGuest}>CLEAR GUEST COPY</button>
          <button type="button" className="csp-btn" onClick={onKeepGuestCopy}>KEEP DEVICE COPY</button>
        </> : <>
          {accountEmpty
            ? <button type="button" className="csp-btn csp-btn-blue" disabled={busy} onClick={onMove}>{busy ? "SAVING…" : "MOVE GUEST DATA"}</button>
            : <>
              <button type="button" className="csp-btn csp-btn-blue" disabled={busy} onClick={onKeepAccount}>KEEP ACCOUNT DATA</button>
              <button type="button" className="csp-btn csp-btn-danger" disabled={busy} onClick={onReplace}>{busy ? "SAVING…" : "REPLACE WITH GUEST DATA"}</button>
            </>}
          <button type="button" className="csp-btn" disabled={busy} onClick={onCancel}>CANCEL</button>
          <button type="button" className="csp-btn-sm" disabled={busy} onClick={onReturnToGuest}>RETURN TO GUEST MODE</button>
        </>}
      </div>
    </section>
  </div>;
}
