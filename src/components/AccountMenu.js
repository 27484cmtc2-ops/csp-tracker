import { useState } from "react";

export default function AccountMenu({ email, onLogOut, error = "", mobile = false, mode = "authenticated", onSignIn, onCreateAccount, onExitGuest }) {
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
        {mode === "guest" ? "GUEST" : "ACCOUNT"}
      </button>
      {open && (
        <div className="account-menu-popover" role="menu" aria-label="Account menu">
          <span className="account-menu-label">{mode === "guest" ? "LOCAL SESSION" : "SIGNED IN AS"}</span>
          <strong className="account-menu-email">{mode === "guest" ? "Guest mode" : email}</strong>
          {mode === "guest" && <span className="account-menu-guest-note">Data is stored only on this device.</span>}
          {error && <span className="account-menu-error" role="alert">{error}</span>}
          {mode === "guest" ? <>
            <button type="button" role="menuitem" onClick={onCreateAccount}>CREATE ACCOUNT</button>
            <button type="button" role="menuitem" onClick={onSignIn}>SIGN IN</button>
            <button type="button" role="menuitem" onClick={onExitGuest}>EXIT GUEST MODE</button>
          </> : <button type="button" role="menuitem" onClick={logOut} disabled={loggingOut}>{loggingOut ? "LOGGING OUT…" : "LOG OUT"}</button>}
        </div>
      )}
    </div>
  );
}
