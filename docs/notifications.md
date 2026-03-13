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

1. Reads users where `notificationSettings.enabled == true`.
2. Converts the current UTC time into each user timezone.
3. Finds habits in `users/{uid}/habits` with the matching `reminderTime`.
4. Filters by scheduled weekday and habit `createdAt`.
5. Loads active browser tokens from `users/{uid}/devices`.
6. Sends one grouped notification per user per time slot.
7. Writes a dedupe marker to `users/{uid}/reminderDispatches/{date_time}`.
8. Removes dead tokens when FCM reports invalid registrations.
9. Supports manual targeting with `--dry-run`, `--user-id`, and `--at=ISO_TIMESTAMP`.

## Recommended production trigger

Use `cron-job.org` to call the GitHub Actions `workflow_dispatch` API every 5 minutes.

Why:

- More reliable than GitHub's built-in scheduled workflows for reminder timing
- Still free for this use case
- Reuses the working GitHub Actions runner and existing reminder script

## GitHub setup

Add these repository secrets:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_PROJECT_ID`

Create a GitHub token for `cron-job.org`:

- Recommended: fine-grained personal access token
- Repository access: `habitly`
- Permissions:
  - `Actions: Read and write`
  - `Contents: Read-only`

## cron-job.org request config

Create a job that runs every 5 minutes.

### URL

```text
https://api.github.com/repos/devendra27-bacancy/habitly/actions/workflows/reminder-sender.yml/dispatches
```

### Method

```text
POST
```

### Headers

```text
Accept: application/vnd.github+json
Authorization: Bearer YOUR_GITHUB_TOKEN
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json
```

### Request body

```json
{
  "ref": "master",
  "inputs": {
    "dry_run": "false",
    "user_id": "",
    "at": ""
  }
}
```

## Manual testing

```bash
npm run reminders:run -- --dry-run
npm run reminders:run -- --dry-run --user-id=YOUR_USER_ID
npm run reminders:run -- --dry-run --at=2026-03-13T08:00:00.000Z
```

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
