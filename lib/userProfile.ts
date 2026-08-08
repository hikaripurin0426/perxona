import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirestoreDb } from "./firebase";
import { isValidRomajiNickname, normalizeNickname } from "./nickname";

export type UserProfile = {
  uid: string;
  email: string;
  /** Roman-letter nickname used by the AI tutor. Empty until first setup. */
  username: string;
  photoURL: string | null;
  conversationDays: number;
  lastConversationDate: string | null;
  level: number | null;
  levelLabel: string | null;
  levelAssessedAt: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

export function profileNeedsNickname(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return !isValidRomajiNickname(profile.username || "");
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function usersRef(uid: string) {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore is not configured.");
  return doc(db, "users", uid);
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = usersRef(user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  const profile: Omit<UserProfile, "createdAt" | "updatedAt" | "levelAssessedAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
    levelAssessedAt: null;
  } = {
    uid: user.uid,
    email: user.email || "",
    username: "",
    photoURL: user.photoURL || null,
    conversationDays: 0,
    lastConversationDate: null,
    level: null,
    levelLabel: null,
    levelAssessedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, profile);
  const created = await getDoc(ref);
  return created.data() as UserProfile;
}

export async function saveNickname(uid: string, nickname: string): Promise<string> {
  const next = normalizeNickname(nickname);
  if (!isValidRomajiNickname(next)) {
    throw new Error("Nickname must be 2–20 Roman letters (A–Z) only.");
  }
  await updateDoc(usersRef(uid), {
    username: next,
    updatedAt: serverTimestamp(),
  });
  return next;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(usersRef(uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

/** Bump conversationDays once per local calendar day. */
export async function recordConversationDay(uid: string): Promise<UserProfile | null> {
  const ref = usersRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as UserProfile;
  const today = todayLocal();
  if (data.lastConversationDate === today) {
    return data;
  }

  const nextDays = (data.conversationDays || 0) + 1;
  await updateDoc(ref, {
    conversationDays: nextDays,
    lastConversationDate: today,
    updatedAt: serverTimestamp(),
  });

  return {
    ...data,
    conversationDays: nextDays,
    lastConversationDate: today,
  };
}

export async function saveLevelAssessment(
  uid: string,
  assessment: { level: number; levelLabel: string },
): Promise<void> {
  await updateDoc(usersRef(uid), {
    level: assessment.level,
    levelLabel: assessment.levelLabel,
    levelAssessedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
