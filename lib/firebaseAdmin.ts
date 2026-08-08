import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

let adminApp: App | null = null;

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY),
  );
}

function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const serviceAccount = JSON.parse(json) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    adminApp = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key?.replace(/\\n/g, "\n"),
      }),
    });
    return adminApp;
  }

  if (
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ) {
    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    return adminApp;
  }

  // Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS)
  adminApp = initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
  return adminApp;
}

export async function getUserLevelAdmin(
  uid: string,
): Promise<{ level: number | null; levelLabel: string | null } | null> {
  if (!uid || !isFirebaseAdminConfigured()) return null;
  const db = getFirestore(getAdminApp());
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as { level?: unknown; levelLabel?: unknown };
  return {
    level: typeof data.level === "number" ? data.level : null,
    levelLabel: typeof data.levelLabel === "string" ? data.levelLabel : null,
  };
}

export async function saveLevelAssessmentAdmin(
  uid: string,
  assessment: { level: number; levelLabel: string; reason?: string },
): Promise<void> {
  if (!uid) {
    throw Object.assign(new Error("uid is required"), { status: 400 });
  }
  if (
    !Number.isFinite(assessment.level) ||
    assessment.level < 1 ||
    assessment.level > 5
  ) {
    throw Object.assign(new Error("Invalid level"), { status: 400 });
  }

  const db = getFirestore(getAdminApp());
  const ref = db.collection("users").doc(uid);
  await ref.set(
    {
      uid,
      level: assessment.level,
      levelLabel: assessment.levelLabel,
      levelReason: assessment.reason || null,
      levelAssessedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
