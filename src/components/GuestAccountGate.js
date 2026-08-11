export default function GuestAccountGate({ onClose, onSignIn, onCreateAccount }) {
  return <div className="guest-gate-layer" role="dialog" aria-modal="true" aria-labelledby="guest-gate-title">
    <button type="button" className="guest-gate-backdrop" aria-label="Close" onClick={onClose} />
    <section className="guest-gate-dialog">
      <span className="auth-eyebrow">ACCOUNT REQUIRED</span>
      <h2 id="guest-gate-title">Import needs a free account</h2>
      <p>CSV import requires a free account so imported holdings can be backed up and synchronized.</p>
      <div className="guest-gate-actions">
        <button type="button" className="csp-btn csp-btn-blue" onClick={onCreateAccount}>CREATE ACCOUNT</button>
        <button type="button" className="csp-btn" onClick={onSignIn}>SIGN IN</button>
        <button type="button" className="csp-btn-sm" onClick={onClose}>NOT NOW</button>
      </div>
    </section>
  </div>;
}
