export default function GuestModeControls({ onSignIn, onCreateAccount, compact = false }) {
  return (
    <section className={`guest-mode-status${compact ? " guest-mode-status-compact" : ""}`} aria-label="Guest mode status">
      <div>
        <strong>Guest mode — data is stored only on this device.</strong>
        <span>Create a free account to back up your data and sync across devices.</span>
      </div>
      {!compact && <div className="guest-mode-status-actions">
        <button type="button" className="csp-btn-sm csp-btn-blue" onClick={onCreateAccount}>CREATE ACCOUNT</button>
        <button type="button" className="csp-btn-sm" onClick={onSignIn}>SIGN IN</button>
      </div>}
    </section>
  );
}
