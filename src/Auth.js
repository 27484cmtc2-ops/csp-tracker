import { useState } from "react";
import { supabase } from "./supabaseClient";
import "./Auth.css";

export default function Auth({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
          <span className="auth-eyebrow">{"// WHEEL STRATEGY TRACKER"}</span>
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
        </div>

        {message && <div className="auth-message" role="status">{message}</div>}
      </section>
    </main>
  );
}
