# Notifications

habitly supports browser push opt-in, device token storage, and a scheduled reminder sender driven by GitHub Actions.

## What is live

- Browser permission flow from the profile page
- FCM token registration for the current browser
- Foreground notification handling inside the app
- Background notification handling through `public/firebase-messaging-sw.js`
- Per-device storage in `users/{uid}/devices/{tokenId}`
- Profile-level notification settings in `users/{uid}.notificationSettings`
- Scheduled reminder delivery via [scripts/reminder-runner.js](/D:/Anti/habitflow-next/scripts/reminder-runner.js)
- GitHub Actions orchestration via [.github/workflows/reminder-sender.yml](/D:/Anti/habitflow-next/.github/workflows/reminder-sender.yml)

## Firestore shape

### User profile

```json
{
  "notificationSettings": {
    "enabled": true,
    "permission": "granted",
    "timezone": "Asia/Calcutta",
    "updatedAt": "2026-03-13T12:00:00.000Z",
    "tokenId": "abc123"
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
  "localDate": "2026-03-13",
  "slotTime": "08:00",
  "timeZone": "Asia/Calcutta",
  "habitIds": ["habit_1", "habit_2"],
  "createdAt": "serverTimestamp()"
}
```

## Scheduling scaffold

The backend sender lives in [scripts/reminder-service.js](/D:/Anti/habitflow-next/scripts/reminder-service.js) and is invoked by [scripts/reminder-runner.js](/D:/Anti/habitflow-next/scripts/reminder-runner.js).

It does this:

1. Runs every 5 minutes from GitHub Actions.
2. Reads users where `notificationSettings.enabled == true`.
3. Converts the current UTC time into each user timezone.
4. Finds habits in `users/{uid}/habits` with the matching `reminderTime`.
5. Filters by scheduled weekday and habit `createdAt`.
6. Loads active browser tokens from `users/{uid}/devices`.
7. Sends one grouped notification per user per time slot.
8. Writes a dedupe marker to `users/{uid}/reminderDispatches/{date_time}`.
9. Removes dead tokens when FCM reports invalid registrations.
10. Supports manual targeting with `--dry-run`, `--user-id`, and `--at=ISO_TIMESTAMP`.

## GitHub Actions setup

Add these repository secrets:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_PROJECT_ID`

The workflow supports:

- `schedule`: every 5 minutes
- `workflow_dispatch`: optional `dry_run`, `user_id`, and `at` inputs

## Manual testing

```bash
npm run reminders:run -- --dry-run
npm run reminders:run -- --dry-run --user-id=YOUR_USER_ID
npm run reminders:run -- --dry-run --at=2026-03-13T08:00:00.000Z
```

## Timing note

GitHub Actions cron is not exact-to-the-minute. Reminder delivery should be treated as "within the next few minutes," not second-perfect.

## Payload suggestion

```json
{
  "notification": {
    "title": "Time for Evening Walk",
    "body": "A short check-in keeps the streak alive."
  },
  "data": {
    "screen": "home",
    "localDate": "2026-03-13",
    "slotTime": "20:00",
    "link": "/"
  },
  "webpush": {
    "fcmOptions": {
      "link": "/"
    }
  }
}
```
