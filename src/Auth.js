import { useState } from "react";
import { supabase } from "./supabaseClient";
import "./Auth.css";

export default function Auth({ onSignedIn, onContinueAsGuest, guestDataAvailable = false }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const openPasswordReset = () => {
    setResetEmail(email);
    setResetMessage("");
    setResetError("");
    setResetOpen(true);
  };

  const closePasswordReset = () => {
    if (resetLoading) return;
    setResetOpen(false);
  };

  const requestPasswordReset = async () => {
    const normalizedEmail = resetEmail.trim();
    setResetMessage("");
    setResetError("");
    if (!normalizedEmail) {
      setResetError("Enter your email address.");
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo: `${window.location.origin}/` }
      );
      if (error) throw error;
      setResetMessage(
        "If an account exists for this email, we've sent password reset instructions."
      );
    } catch {
      setResetError(
        "We couldn't send reset instructions. Check your connection and try again."
      );
    } finally {
      setResetLoading(false);
    }
  };

  const signUp = async () => {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.session) {
      onSignedIn?.(data.session);
      return;
    }

    setMessage("Check your email to confirm your account.");
  };

  const signIn = async () => {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    onSignedIn?.(data.session);
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <header className="auth-header">
          <span className="auth-eyebrow">WHEEL STRATEGY TRACKER</span>
          <h1 id="auth-title">Wheel App</h1>
          <p>Track your wheel strategy from cash-secured puts to covered calls.</p>
        </header>

        <div className="auth-form">
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="trader@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <button type="button" className="auth-forgot-action" onClick={openPasswordReset}>
            Forgot Password?
          </button>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button className="auth-primary-action" onClick={signIn} disabled={loading}>
            SIGN IN
          </button>

          <button className="auth-secondary-action" onClick={signUp} disabled={loading}>
            CREATE AN ACCOUNT
          </button>
          <div className="auth-guest-divider"><span>OR</span></div>
          <button className="auth-guest-action" type="button" onClick={onContinueAsGuest} disabled={loading}>
            {guestDataAvailable ? "RETURN TO GUEST MODE" : "CONTINUE AS GUEST"}
          </button>
          <p className="auth-guest-note">Guest data stays only on this browser and is not backed up to the cloud.</p>
        </div>

        {message && <div className="auth-message" role="status">{message}</div>}
      </section>

      {resetOpen && (
        <div className="auth-reset-layer">
          <button type="button" className="auth-reset-backdrop" aria-label="Close password reset" onClick={closePasswordReset} />
          <section className="auth-reset-sheet" role="dialog" aria-modal="true" aria-labelledby="reset-title">
            <div className="auth-reset-handle" aria-hidden="true" />
            <header>
              <span className="auth-eyebrow">ACCOUNT RECOVERY</span>
              <h2 id="reset-title">Reset password</h2>
              <p>Enter your email and we'll send reset instructions if an account exists.</p>
            </header>

            {!resetMessage ? (
              <>
                <label className="auth-field">
                  <span>Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                  />
                </label>
                {resetError && <div className="auth-reset-error" role="alert">{resetError}</div>}
                <div className="auth-reset-actions">
                  <button type="button" className="auth-primary-action" onClick={requestPasswordReset} disabled={resetLoading}>
                    {resetLoading ? "SENDING…" : "SEND RESET INSTRUCTIONS"}
                  </button>
                  <button type="button" className="auth-secondary-action" onClick={closePasswordReset} disabled={resetLoading}>
                    CANCEL
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="auth-reset-success" role="status">{resetMessage}</div>
                <button type="button" className="auth-primary-action" onClick={closePasswordReset}>DONE</button>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
