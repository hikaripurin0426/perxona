"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export function LoginButton() {
  const router = useRouter();
  const {
    configured,
    loading,
    user,
    profile,
    error,
    signInWithGoogle,
    signOut,
  } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  if (!configured) {
    return (
      <p className="auth-hint" title="See FIREBASE_SETUP.md">
        Sign-in unavailable
      </p>
    );
  }

  if (loading) {
    return <p className="auth-hint">Checking sign-in…</p>;
  }

  if (!user) {
    return (
      <div className="auth-block">
        <button
          type="button"
          className="auth-btn"
          onClick={() => {
            void signInWithGoogle().catch(() => undefined);
          }}
        >
          Sign in with Google
        </button>
        {error ? <p className="auth-error">{error}</p> : null}
      </div>
    );
  }

  const name = profile?.username || user.displayName || "Learner";
  const levelText =
    profile?.levelLabel != null
      ? `Level ${profile.levelLabel}`
      : "Level pending";
  const days = profile?.conversationDays ?? 0;

  return (
    <div className="auth-block">
      <div className="auth-user">
        {profile?.photoURL || user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="auth-avatar"
            src={profile?.photoURL || user.photoURL || ""}
            alt=""
            width={32}
            height={32}
            referrerPolicy="no-referrer"
          />
        ) : null}
        <div className="auth-meta">
          <p className="auth-name">{name}</p>
          <p className="auth-stats">
            {levelText} · {days} day{days === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="auth-btn auth-btn-ghost"
        onClick={() => void handleSignOut()}
      >
        Sign out
      </button>
      {error ? <p className="auth-error">{error}</p> : null}
    </div>
  );
}
