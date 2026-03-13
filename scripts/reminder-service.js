"use strict";

const admin = require("firebase-admin");

let appInstance = null;
const DEFAULT_APP_ORIGIN = "https://habitly.web.app";

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getServiceAccountFromEnv() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawJson) {
    return null;
  }

  const parsed = JSON.parse(rawJson);
  const privateKey = typeof parsed.private_key === "string"
    ? parsed.private_key.replace(/\\n/g, "\n")
    : parsed.private_key;

  return {
    ...parsed,
    private_key: privateKey,
  };
}

function initializeFirebaseAdmin() {
  if (appInstance) {
    return appInstance;
  }

  const serviceAccount = getServiceAccountFromEnv();

  if (serviceAccount) {
    appInstance = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
    return appInstance;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new Error("Missing FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_JSON for reminder sender.");
  }

  appInstance = admin.initializeApp({ projectId });
  return appInstance;
}

function getLocalParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value || "";
  const weekday = getPart("weekday");
  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    localDate: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    slotTime: `${getPart("hour")}:${getPart("minute")}`,
    dayOfWeek: weekdayMap[weekday] ?? -1,
  };
}

function buildDispatchMessage(habits) {
  if (habits.length === 1) {
    return {
      title: `Time for ${habits[0].name}`,
      body: "A quick check-in keeps your momentum moving.",
    };
  }

  return {
    title: `${habits.length} habits are ready`,
    body: "Open habitly and keep your momentum moving.",
  };
}

function buildDispatchId(localDate, slotTime) {
  return `${localDate}_${slotTime.replace(":", "-")}`;
}

function getAppOrigin() {
  const rawOrigin = process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_ORIGIN || DEFAULT_APP_ORIGIN;
  return rawOrigin.replace(/\/+$/, "");
}

function getNotificationBranding() {
  const origin = getAppOrigin();
  return {
    icon: `${origin}/web-app-manifest-192x192.png`,
    badge: `${origin}/favicon-96x96.png`,
  };
}

async function createDispatchMarker(db, userId, dispatchId, payload, dryRun) {
  if (dryRun) {
    return;
  }

  const markerRef = db.doc(`users/${userId}/reminderDispatches/${dispatchId}`);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(markerRef);
    if (snapshot.exists) {
      throw new Error("dispatch-already-sent");
    }

    transaction.create(markerRef, payload);
  });
}

async function removeInvalidTokens(devicesSnapshot, tokens, responses, dryRun) {
  const invalidCodes = new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
  ]);

  const deletes = responses.map(async (result, index) => {
    if (result.success) return;
    const code = result.error?.code || "";
    if (!invalidCodes.has(code)) return;

    const deviceDoc = devicesSnapshot.docs.find((docSnapshot) => docSnapshot.get("token") === tokens[index]);
    if (!deviceDoc || dryRun) return;

    await deviceDoc.ref.delete().catch(() => undefined);
  });

  await Promise.all(deletes);
}

async function sendReminderForUser({ db, messaging, userDoc, now, dryRun }) {
  const settings = userDoc.get("notificationSettings") || {};
  const timeZone = settings.timezone || "UTC";
  const enabled = settings.enabled === true;

  if (!enabled) {
    return { sent: false, reason: "disabled", userId: userDoc.id };
  }

  const { localDate, slotTime, dayOfWeek } = getLocalParts(now, timeZone);
  if (dayOfWeek < 0) {
    return { sent: false, reason: "invalid-timezone", userId: userDoc.id };
  }

  const devicesSnapshot = await userDoc.ref.collection("devices").where("permission", "==", "granted").get();
  const tokens = devicesSnapshot.docs
    .map((deviceDoc) => deviceDoc.get("token"))
    .filter((token) => typeof token === "string" && token.length > 0);

  if (tokens.length === 0) {
    return { sent: false, reason: "no-devices", userId: userDoc.id };
  }

  const habitsSnapshot = await userDoc.ref.collection("habits").where("reminderTime", "==", slotTime).get();
  const dueHabits = habitsSnapshot.docs
    .map((habitDoc) => ({ id: habitDoc.id, ...habitDoc.data() }))
    .filter((habit) => {
      const days = Array.isArray(habit.daysOfWeek) ? habit.daysOfWeek : [];
      const createdAt = typeof habit.createdAt === "string" ? habit.createdAt : localDate;
      return days.includes(dayOfWeek) && createdAt <= localDate;
    });

  if (dueHabits.length === 0) {
    return { sent: false, reason: "no-habits", userId: userDoc.id };
  }

  const dispatchId = buildDispatchId(localDate, slotTime);

  try {
    await createDispatchMarker(
      db,
      userDoc.id,
      dispatchId,
      {
        localDate,
        slotTime,
        timeZone,
        habitIds: dueHabits.map((habit) => habit.id),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      dryRun,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "dispatch-already-sent") {
      return { sent: false, reason: "duplicate", userId: userDoc.id, dispatchId };
    }
    throw error;
  }

  const copy = buildDispatchMessage(dueHabits);
  const branding = getNotificationBranding();
  const message = {
    tokens,
    notification: {
      title: copy.title,
      body: copy.body,
    },
    webpush: {
      notification: {
        icon: branding.icon,
        badge: branding.badge,
        tag: dispatchId,
      },
      fcmOptions: {
        link: "/",
      },
    },
    data: {
      screen: "home",
      localDate,
      slotTime,
      link: "/",
    },
  };

  if (dryRun) {
    return {
      sent: false,
      reason: "dry-run",
      userId: userDoc.id,
      dispatchId,
      habitCount: dueHabits.length,
      tokenCount: tokens.length,
      payload: message,
    };
  }

  const response = await messaging.sendEachForMulticast(message);
  await removeInvalidTokens(devicesSnapshot, tokens, response.responses, dryRun);

  return {
    sent: response.successCount > 0,
    reason: response.successCount > 0 ? "sent" : "all-failed",
    userId: userDoc.id,
    dispatchId,
    habitCount: dueHabits.length,
    tokenCount: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
  };
}

async function runReminderSender({ now = new Date(), userId, dryRun = false } = {}) {
  initializeFirebaseAdmin();
  const db = admin.firestore();
  const messaging = admin.messaging();

  let usersQuery = db.collection("users").where("notificationSettings.enabled", "==", true);
  if (userId) {
    usersQuery = db.collection("users").where(admin.firestore.FieldPath.documentId(), "==", userId);
  }

  const usersSnapshot = await usersQuery.get();
  const results = [];

  for (const userDoc of usersSnapshot.docs) {
    const result = await sendReminderForUser({
      db,
      messaging,
      userDoc,
      now,
      dryRun,
    });
    results.push(result);
  }

  const summary = results.reduce(
    (acc, result) => {
      acc.processed += 1;
      if (result.sent) acc.sent += 1;
      if (result.reason === "duplicate") acc.duplicates += 1;
      if (result.reason === "dry-run") acc.dryRuns += 1;
      return acc;
    },
    { processed: 0, sent: 0, duplicates: 0, dryRuns: 0 },
  );

  return {
    now: now.toISOString(),
    dryRun,
    userId: userId || null,
    summary,
    results,
  };
}

function parseArgs(argv) {
  return argv.reduce(
    (acc, arg) => {
      if (arg === "--dry-run") {
        acc.dryRun = true;
      } else if (arg.startsWith("--user-id=")) {
        acc.userId = arg.slice("--user-id=".length);
      } else if (arg.startsWith("--at=")) {
        acc.at = arg.slice("--at=".length);
      }
      return acc;
    },
    { dryRun: false, userId: "", at: "" },
  );
}

async function runFromCli(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  const now = parsed.at ? new Date(parsed.at) : new Date();

  if (Number.isNaN(now.getTime())) {
    throw new Error("Invalid --at value. Use an ISO timestamp, for example 2026-03-13T08:00:00.000Z");
  }

  const result = await runReminderSender({
    now,
    userId: parsed.userId || undefined,
    dryRun: parsed.dryRun,
  });

  console.log(JSON.stringify(result, null, 2));
  return result;
}

module.exports = {
  buildDispatchId,
  buildDispatchMessage,
  getLocalParts,
  initializeFirebaseAdmin,
  runReminderSender,
  runFromCli,
};

if (require.main === module) {
  runFromCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
