"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { NicknameSetupDialog } from "@/components/NicknameSetupDialog";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import {
  ensureUserProfile,
  profileNeedsNickname,
  saveNickname,
  type UserProfile,
} from "@/lib/userProfile";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  profile: UserProfile | null;
  needsNickname: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  completeNickname: (nickname: string) => Promise<void>;
  setProfile: (
    profile:
      | UserProfile
      | null
      | ((prev: UserProfile | null) => UserProfile | null),
  ) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const configured = isFirebaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [redirectAfterAuth, setRedirectAfterAuth] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setError(null);
      setNicknameError(null);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const nextProfile = await ensureUserProfile(nextUser);
        setProfile(nextProfile);
      } catch (err) {
        setProfile(null);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [configured]);

  const needsNickname = Boolean(
    user && profile !== null && profileNeedsNickname(profile),
  );

  useEffect(() => {
    if (!redirectAfterAuth) return;
    if (loading || !user || !profile) return;
    if (needsNickname) return;
    const path = redirectAfterAuth;
    setRedirectAfterAuth(null);
    router.push(path);
  }, [redirectAfterAuth, loading, user, profile, needsNickname, router]);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    try {
      const nextProfile = await ensureUserProfile(user);
      setProfile(nextProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [user]);

  const completeNickname = useCallback(
    async (nickname: string) => {
      if (!user) {
        throw new Error("Not signed in.");
      }
      setNicknameSaving(true);
      setNicknameError(null);
      try {
        const saved = await saveNickname(user.uid, nickname);
        setProfile((prev) => (prev ? { ...prev, username: saved } : prev));
        // Ensure lesson redirect even if login redirect flag was cleared.
        setRedirectAfterAuth("/lesson");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setNicknameError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setNicknameSaving(false);
      }
    },
    [user],
  );

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      const message = "Firebase is not configured. See FIREBASE_SETUP.md.";
      setError(message);
      throw new Error(message);
    }
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setRedirectAfterAuth("/lesson");
    } catch (err) {
      setRedirectAfterAuth(null);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    }
  }, []);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    setError(null);
    setNicknameError(null);
    setRedirectAfterAuth(null);
    try {
      await firebaseSignOut(auth);
      setProfile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const value = useMemo(
    () => ({
      configured,
      loading,
      user,
      profile,
      needsNickname,
      error,
      signInWithGoogle,
      signOut,
      refreshProfile,
      completeNickname,
      setProfile,
    }),
    [
      configured,
      loading,
      user,
      profile,
      needsNickname,
      error,
      signInWithGoogle,
      signOut,
      refreshProfile,
      completeNickname,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <NicknameSetupDialog
        open={needsNickname}
        saving={nicknameSaving}
        error={nicknameError}
        onSubmit={completeNickname}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
