# Firebase setup (Avilingo)

Guest lessons work without Firebase. Configure the project below to enable Google sign-in and Firestore progress (username, conversation days, CEFR-style level).

## 1. Create a Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Add a **Web** app and copy the config object values.

## 2. Enable Google Authentication

1. **Build → Authentication → Sign-in method**
2. Enable **Google**
3. Set a project support email and save
4. Under **Authentication → Settings → Authorized domains**, add:
   - `localhost`
   - your production domain (when you deploy)

## 3. Create Firestore

1. **Build → Firestore Database → Create database**
2. Start in **production mode** (you will paste rules next)
3. Choose a region close to your users

### Security rules

Paste these rules (users can only read/write their own document):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 4. Env vars

Copy values into `work/.env.local` (see `.env.example`):

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Restart `npm run dev` after editing env files.

## 5. Admin SDK (level updates via Connect Function Tool)

Client rules already allow the signed-in user to write their own `users/{uid}`.  
For **chatbot → Function Tool → Firestore**, the server needs Admin credentials:

1. Firebase Console → **Project settings → Service accounts → Generate new private key**
2. Put the JSON in env as a single line:

```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN...","client_email":"..."}
```

Or set `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` (with `\n` for newlines).

Also set `AVILINGO_TOOL_SECRET` and a **public** `AVILINGO_PUBLIC_BASE_URL` (Connect blocks localhost). See `CONNECT_KIT.md`.

Without Admin + public URL, level still saves via the client after assessment.

## 6. Verify

1. Open the app — lessons still work as a guest
2. Click **Sign in with Google** — a `users/{uid}` document should appear in Firestore
3. Send chat messages on different calendar days — `conversationDays` increments once per day
4. After every 5 user chat turns while signed in, `level` increases by 1 (A1→A2→…→C1, max 5). `userMessageCount` tracks turns.
