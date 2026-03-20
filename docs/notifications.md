# Notifications

habitly supports two reminder channels from the same reminder slot:

- web push for browsers with an active FCM token
- email reminders through a future provider integration

The frontend still owns browser permission, token registration, and profile settings. Scheduled delivery is now handled by a Cloudflare Worker.

## What is live

- Browser permission flow from the profile page
- FCM token registration for the current browser
- Foreground notification handling inside the app
- Background notification handling through `public/firebase-messaging-sw.js`
- Per-device storage in `users/{uid}/devices/{tokenId}`
- Profile-level reminder settings in `users/{uid}.notificationSettings`
- Scheduled Cloudflare delivery via [workers/reminder-sender.mjs](/D:/Anti/habitflow-next/workers/reminder-sender.mjs)
- Cron Trigger configuration in [wrangler.toml](/D:/Anti/habitflow-next/wrangler.toml)
- GitHub manual fallback via [.github/workflows/reminder-sender.yml](/D:/Anti/habitflow-next/.github/workflows/reminder-sender.yml)

## Firestore shape

### User profile

```json
{
  "email": "devendra@example.com",
  "notificationSettings": {
    "enabled": true,
    "permission": "granted",
    "timezone": "Asia/Calcutta",
    "updatedAt": "2026-03-20T12:00:00.000Z",
    "tokenId": "abc123",
    "emailEnabled": true,
    "emailAddress": "devendra@example.com",
    "emailUpdatedAt": "2026-03-20T12:00:00.000Z"
  }
}
```

### Device token

```json
{
  "token": "<fcm-token>",
  "platform": "web",
  "permission": "granted",
  "timezone": "Asia/Calcutta",
  "userAgent": "<browser ua>",
  "createdAt": "2026-03-13T12:00:00.000Z",
  "updatedAt": "2026-03-13T12:00:00.000Z",
  "lastSeenAt": "2026-03-13T12:00:00.000Z"
}
```

### Reminder dispatch marker

```json
{
  "localDate": "2026-03-20",
  "slotTime": "22:10",
  "timeZone": "Asia/Calcutta",
  "habitIds": ["habit_1", "habit_2"],
  "channels": {
    "push": true,
    "email": true
  },
  "createdAt": "2026-03-20T16:40:00.000Z"
}
```

## Worker behavior

The Worker does this for every cron run:

1. Reads users where `notificationSettings.enabled == true` or `notificationSettings.emailEnabled == true`.
2. Converts the current UTC time into each user timezone.
3. Finds habits in `users/{uid}/habits` with the matching `reminderTime`.
4. Filters by scheduled weekday and habit `createdAt`.
5. Loads active browser tokens from `users/{uid}/devices`.
6. Builds one grouped reminder per user per slot.
7. Writes a dedupe marker to `users/{uid}/reminderDispatches/{YYYY-MM-DD_HH-mm}`.
8. Sends push notifications through FCM HTTP v1.
9. Leaves email reminders dormant until a provider is configured.
10. Removes dead browser tokens when FCM reports an invalid registration.

## Cloudflare setup

Install Wrangler if needed:

```bash
npm install
```

Run locally:

```bash
npm run worker:dev
```

Deploy:

```bash
npm run worker:deploy
```

### Required bindings

Regular vars:

- `APP_ORIGIN`
- `FIREBASE_PROJECT_ID`

Secrets required for push:

- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `DEBUG_TOKEN`

Suggested setup:

```bash
wrangler secret put FIREBASE_CLIENT_EMAIL
wrangler secret put FIREBASE_PRIVATE_KEY
wrangler secret put DEBUG_TOKEN
```

Optional future email secrets:

- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_FROM_EMAIL`

### Cron Trigger

The Worker is configured for:

```text
*/5 * * * *
```

That means reminder delivery should happen within the next few minutes of the requested time slot, not at second-level precision.

## Manual debug route

The Worker exposes:

- `GET /health`
- `POST /debug`

`POST /debug` requires:

- header: `x-debug-token: <DEBUG_TOKEN>`

Body example:

```json
{
  "dryRun": true,
  "userId": "2HhpRqIiHtVzDqD3ZPlPqvLnViy2",
  "at": "2026-03-13T16:40:00.000Z"
}
```

## Email reminders

Email reminders are independent from push reminders.

- Users can enable email without push
- Users can keep push without email
- The email target defaults to the profile email unless `notificationSettings.emailAddress` is set explicitly

Email reminders are intentionally kept as a frontend/data-model preview right now.

- the profile UI shows the channel
- the Firestore fields are ready
- the Worker safely skips email delivery when no provider secrets are configured
- push reminders continue to work normally without any email provider

Recommended email content:

- concise reminder subject
- one grouped email per reminder slot
- CTA back to `https://habitly.web.app/`

## GitHub fallback

The existing Node reminder sender still exists for manual fallback:

- [scripts/reminder-service.js](/D:/Anti/habitflow-next/scripts/reminder-service.js)
- [scripts/reminder-runner.js](/D:/Anti/habitflow-next/scripts/reminder-runner.js)
- [.github/workflows/reminder-sender.yml](/D:/Anti/habitflow-next/.github/workflows/reminder-sender.yml)

Use that only as a temporary backup while the Cloudflare Worker is being validated. After the Worker is confirmed in production, disable the old `cron-job.org` trigger and leave GitHub for manual dry-run checks only.

## Manual Node fallback tests

```bash
npm run reminders:run -- --dry-run
npm run reminders:run -- --dry-run --user-id=YOUR_USER_ID
npm run reminders:run -- --dry-run --at=2026-03-13T08:00:00.000Z
```
