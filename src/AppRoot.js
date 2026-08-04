import { useEffect, useState } from "react";
import App from "./App";
import Auth from "./Auth";
import PasswordRecovery from "./PasswordRecovery";
import { supabase } from "./supabaseClient";

export default function AppRoot() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoutError, setLogoutError] = useState("");
  const [recoveringPassword, setRecoveringPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setLogoutError("");
      if (event === "PASSWORD_RECOVERY") setRecoveringPassword(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logOut = async () => {
    setLogoutError("");
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLogoutError(error.message || "Unable to log out.");
      return;
    }
    setSession(null);
  };

  const finishPasswordRecovery = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setRecoveringPassword(false);
    setSession(null);
  };

  if (loading) return <div>Loading...</div>;
  if (recoveringPassword && session) {
    return <PasswordRecovery onUpdated={finishPasswordRecovery} />;
  }
  if (!session) return <Auth onSignedIn={setSession} />;

  return (
    <App
      key={session.user.id}
      userId={session.user.id}
      userEmail={session.user.email}
      onLogOut={logOut}
      logoutError={logoutError}
    />
  );
}
