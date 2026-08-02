import { useState } from "react";
import { supabase } from "./supabaseClient";

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
    <div
      style={{
        minHeight: "100vh",
        background: "#080c10",
        color: "#c8d8c0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'IBM Plex Mono','Courier New',monospace",
        padding: 20,
      }}
    >
      <div
        style={{
          width: 340,
          background: "#0d1117",
          border: "1px solid #1a2e1a",
          borderRadius: 6,
          padding: 24,
        }}
      >
        <div
          style={{
            color: "#7aff7a",
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          CSP TRACKER LOGIN
        </div>

        <input
          type="email"
          placeholder="EMAIL"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={{
            width: "100%",
            marginBottom: 10,
            padding: 10,
            background: "#080c10",
            border: "1px solid #2a4a2a",
            color: "#c8d8c0",
          }}
        />

        <input
          type="password"
          placeholder="PASSWORD"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={{
            width: "100%",
            marginBottom: 14,
            padding: 10,
            background: "#080c10",
            border: "1px solid #2a4a2a",
            color: "#c8d8c0",
          }}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={signIn} disabled={loading} style={{ flex: 1 }}>
            SIGN IN
          </button>

          <button onClick={signUp} disabled={loading} style={{ flex: 1 }}>
            CREATE ACCOUNT
          </button>
        </div>

        {message && (
          <div style={{ marginTop: 14, fontSize: 11, color: "#f59e0b" }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}