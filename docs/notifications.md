# Notifications

habitly now supports browser push opt-in, device token storage, and a scheduled reminder sender scaffold.

## What is live

- Browser permission flow from the profile page
- FCM token registration for the current browser
- Foreground notification handling inside the app
- Background notification handling through `public/firebase-messaging-sw.js`
- Per-device storage in `users/{uid}/devices/{tokenId}`
- Profile-level notification settings in `users/{uid}.notificationSettings`
- Scheduled reminder delivery scaffold in [functions/index.js](/D:/Anti/habitflow-next/functions/index.js)

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

The backend sender now lives in [functions/index.js](/D:/Anti/habitflow-next/functions/index.js).

It does this:

1. Runs every 15 minutes.
2. Reads users where `notificationSettings.enabled == true`.
3. Converts the current UTC time into each user timezone.
4. Finds habits in `users/{uid}/habits` with the matching `reminderTime`.
5. Filters by scheduled weekday and habit `createdAt`.
6. Loads active browser tokens from `users/{uid}/devices`.
7. Sends one grouped notification per user per time slot.
8. Writes a dedupe marker to `users/{uid}/reminderDispatches/{date_time}`.
9. Removes dead tokens when FCM reports invalid registrations.

## Deploying the sender

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
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
    "slotTime": "20:00"
  },
  "webpush": {
    "fcmOptions": {
      "link": "/"
    }
  }
}
```
