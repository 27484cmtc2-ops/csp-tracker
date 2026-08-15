import { useState } from "react";
import { supabase } from "./supabaseClient";
import "./Auth.css";

export default function PasswordRecovery({ onUpdated }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updatePassword = async () => {
    setError("");
    if (password.length < 6) {
      setError("Use at least 6 characters for your new password.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await onUpdated?.();
    } catch {
      setError("We couldn't update your password. Please request a new reset link and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="recovery-title">
        <header className="auth-header">
          <span className="auth-eyebrow">{"// ACCOUNT RECOVERY"}</span>
          <h1 id="recovery-title">Set new password</h1>
          <p>Choose a new password for your Investing Dashboard account.</p>
        </header>
        <div className="auth-form">
          <label className="auth-field">
            <span>New password</span>
            <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="auth-field">
            <span>Confirm new password</span>
            <input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          {error && <div className="auth-reset-error" role="alert">{error}</div>}
          <button className="auth-primary-action" onClick={updatePassword} disabled={loading}>
            {loading ? "UPDATING…" : "UPDATE PASSWORD"}
          </button>
        </div>
      </section>
    </main>
  );
}
