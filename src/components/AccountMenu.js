import { useState } from "react";

export default function AccountMenu({ email, onLogOut, error = "", mobile = false }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const logOut = async () => {
    setLoggingOut(true);
    await onLogOut?.();
    setLoggingOut(false);
  };

  return (
    <div className={`account-menu${mobile ? " account-menu-mobile" : ""}`}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ACCOUNT
      </button>
      {open && (
        <div className="account-menu-popover" role="menu" aria-label="Account menu">
          <span className="account-menu-label">SIGNED IN AS</span>
          <strong className="account-menu-email">{email}</strong>
          {error && <span className="account-menu-error" role="alert">{error}</span>}
          <button type="button" role="menuitem" onClick={logOut} disabled={loggingOut}>
            {loggingOut ? "LOGGING OUT…" : "LOG OUT"}
          </button>
        </div>
      )}
    </div>
  );
}
