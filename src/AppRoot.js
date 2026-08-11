import { useEffect, useState } from "react";
import App from "./App";
import Auth from "./Auth";
import PasswordRecovery from "./PasswordRecovery";
import { supabase } from "./supabaseClient";
import {
  clearGuestPortfolio,
  getPortfolioSnapshotHash,
  hasMeaningfulPortfolio,
  hasMigratedGuestSnapshot,
  isGuestModeEnabled,
  markGuestSnapshotMigrated,
  readGuestPortfolio,
  setGuestModeEnabled,
} from "./guestStorage";

export default function AppRoot() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoutError, setLogoutError] = useState("");
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [pendingGuestMigration, setPendingGuestMigration] = useState(null);

  const prepareGuestMigration = (nextSession) => {
    if (!nextSession?.user?.id) {
      setPendingGuestMigration(null);
      return;
    }
    const portfolio = readGuestPortfolio();
    const snapshotHash = getPortfolioSnapshotHash(portfolio);
    setPendingGuestMigration(
      hasMeaningfulPortfolio(portfolio) && !hasMigratedGuestSnapshot(nextSession.user.id, snapshotHash)
        ? { portfolio, snapshotHash }
        : null
    );
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setGuestMode(!data.session && isGuestModeEnabled());
      prepareGuestMigration(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setGuestMode(false);
        setGuestModeEnabled(false);
        prepareGuestMigration(newSession);
      } else if (!isGuestModeEnabled()) {
        setGuestMode(false);
        setPendingGuestMigration(null);
      }
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
    setGuestMode(false);
    setGuestModeEnabled(false);
    setPendingGuestMigration(null);
  };

  const continueAsGuest = () => {
    setGuestModeEnabled(true);
    setGuestMode(true);
  };

  const leaveGuestForAuth = () => {
    setGuestModeEnabled(false);
    setGuestMode(false);
  };

  const exitGuest = () => {
    setGuestModeEnabled(false);
    setGuestMode(false);
  };

  const returnToGuest = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setPendingGuestMigration(null);
    setGuestModeEnabled(true);
    setGuestMode(true);
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
  if (!session && !guestMode) {
    return <Auth onSignedIn={setSession} onContinueAsGuest={continueAsGuest} guestDataAvailable={hasMeaningfulPortfolio(readGuestPortfolio())} />;
  }

  if (guestMode) {
    return <App key="guest" mode="guest" onSignIn={leaveGuestForAuth} onCreateAccount={leaveGuestForAuth} onExitGuest={exitGuest} />;
  }

  return (
    <App
      key={session.user.id}
      userId={session.user.id}
      userEmail={session.user.email}
      onLogOut={logOut}
      logoutError={logoutError}
      mode="authenticated"
      guestMigration={pendingGuestMigration}
      onGuestMigrationSaved={(snapshotHash) => markGuestSnapshotMigrated(session.user.id, snapshotHash)}
      onClearGuestData={() => {
        clearGuestPortfolio();
        setPendingGuestMigration(null);
      }}
      onDismissGuestMigration={() => setPendingGuestMigration(null)}
      onReturnToGuest={returnToGuest}
    />
  );
}
