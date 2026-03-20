# habitly

habitly is a premium habit-tracking app built with Next.js App Router, Firebase Auth, and Firestore. The app keeps habits, streaks, XP, levels, and browser notification tokens synced per user under `users/{uid}`.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill in your Firebase web app values:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

3. Start the app:

```bash
npm run dev
```

## Firebase Production Checklist

### Authentication

- Enable the sign-in providers you want under `Firebase Console > Authentication > Sign-in method`
- Add every dev and production domain under `Firebase Console > Authentication > Settings > Authorized domains`
- If Google sign-in fails with `auth/configuration-not-found` or `auth/unauthorized-domain`, this is a Firebase Console setup issue

### Firestore

- habitly stores data in:
  - `users/{uid}`
  - `users/{uid}/habits/{habitId}`
  - `users/{uid}/devices/{deviceTokenId}`
  - `users/{uid}/reminderDispatches/{dispatchId}`
- Deploy the Firestore rules in [firestore.rules](/D:/Anti/habitflow-next/firestore.rules) before production:

```bash
firebase deploy --only firestore:rules
```

- If habit sync/save fails with `permission-denied`, confirm:
  - the correct Firebase project is selected
  - the Firestore rules are deployed
  - the authenticated user matches the `uid` path being accessed

### Notifications

- Browser push opt-in is handled in the app profile screen
- Reminder token registration requires a valid `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- Push and email reminder preferences are stored together in `users/{uid}.notificationSettings`
- The production reminder sender now lives in the Cloudflare Worker at [workers/reminder-sender.mjs](/D:/Anti/habitflow-next/workers/reminder-sender.mjs)
- The Worker is scheduled every 5 minutes via [wrangler.toml](/D:/Anti/habitflow-next/wrangler.toml)
- GitHub Actions remains available as a temporary manual fallback through [.github/workflows/reminder-sender.yml](/D:/Anti/habitflow-next/.github/workflows/reminder-sender.yml)
- Local manual testing:

```bash
npm run reminders:run -- --dry-run
```

### Cloudflare Reminder Setup

The Cloudflare Worker uses Firestore REST and the FCM HTTP v1 API for production push reminders.

Install / run locally:

```bash
npm run worker:dev
```

Deploy:

```bash
npm run worker:deploy
```

Required Worker vars / secrets for push:

- `APP_ORIGIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `DEBUG_TOKEN` for the `/debug` endpoint

Suggested secret commands:

```bash
wrangler secret put FIREBASE_CLIENT_EMAIL
wrangler secret put FIREBASE_PRIVATE_KEY
wrangler secret put DEBUG_TOKEN
```

Optional future email bindings:

- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_FROM_EMAIL`

Non-secret vars can be kept in [wrangler.toml](/D:/Anti/habitflow-next/wrangler.toml) or added with `wrangler secret put` if you prefer.

## Verification

Run these before release:

```bash
npm run lint
npm run build
```

## Production Notes

- User profile names are resolved in this order:
  1. existing Firestore profile name
  2. Firebase `displayName`
  3. email prefix
  4. `Friend`
- XP, streak, completion history, and level changes are written atomically so progression stays consistent after refresh
- Local legacy data can be migrated into Firebase on first login
- Web push reminder opt-in is handled per browser, with tokens stored under `users/{uid}/devices`
- Reminder scheduling, Cloudflare setup, email delivery, and fallback notes are documented in [docs/notifications.md](/D:/Anti/habitflow-next/docs/notifications.md)
