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

## 5. Verify

1. Open the app — lessons still work as a guest
2. Click **Sign in with Google** — a `users/{uid}` document should appear in Firestore
3. Send chat messages on different calendar days — `conversationDays` increments once per day
4. After 3+ user turns in the first lesson (when `level` is still null), level fields should be set
