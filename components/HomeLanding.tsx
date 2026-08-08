"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function HomeLanding() {
  const router = useRouter();
  const {
    configured,
    loading,
    user,
    profile,
    needsNickname,
    error,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  function goToLesson() {
    router.push("/lesson");
  }

  async function startSignedIn() {
    if (user) {
      if (needsNickname) return;
      goToLesson();
      return;
    }
    if (!configured) {
      goToLesson();
      return;
    }
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      // Error is shown via auth context.
    } finally {
      setSigningIn(false);
    }
  }

  const name =
    profile && !needsNickname
      ? profile.username
      : user?.displayName || null;

  return (
    <main className="home-shell">
      <div className="home-backdrop" aria-hidden="true" />
      <div className="home-glow home-glow-a" aria-hidden="true" />
      <div className="home-glow home-glow-b" aria-hidden="true" />

      <section className="home-hero">
        <p className="home-brand">Avilingo</p>
        <h1 className="home-headline">Speak English with a live AI tutor</h1>
        <p className="home-lead">
          Practice English conversation in a lesson room. Sign in to save
          progress, or start right away as a guest.
        </p>

        <div className="home-actions">
          {loading ? (
            <p className="home-status">Checking sign-in…</p>
          ) : user ? (
            <>
              <button
                type="button"
                className="home-cta home-cta-primary"
                onClick={goToLesson}
                disabled={needsNickname}
              >
                {needsNickname ? "Set nickname to continue" : "Start lesson"}
              </button>
              <button
                type="button"
                className="home-cta home-cta-secondary"
                onClick={() => void signOut()}
              >
                Sign out{name ? ` (${name})` : ""}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="home-cta home-cta-primary"
                onClick={() => void startSignedIn()}
                disabled={signingIn}
              >
                {signingIn
                  ? "Signing in…"
                  : configured
                    ? "Sign in & start"
                    : "Start lesson"}
              </button>
              <button
                type="button"
                className="home-cta home-cta-secondary"
                onClick={goToLesson}
                disabled={signingIn}
              >
                Continue as guest
              </button>
            </>
          )}
        </div>

        {!configured && !loading ? (
          <p className="home-note">
            Google sign-in is not configured yet. You can still start as a guest.
          </p>
        ) : null}
        {error ? <p className="home-error">{error}</p> : null}

        {user && profile && !needsNickname ? (
          <p className="home-progress">
            {profile.levelLabel
              ? `Level ${profile.levelLabel}`
              : "Level pending"}
            {" · "}
            {profile.conversationDays} conversation day
            {profile.conversationDays === 1 ? "" : "s"}
          </p>
        ) : null}
      </section>
    </main>
  );
}
