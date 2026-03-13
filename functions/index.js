const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

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
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  const weekday = get("weekday");
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
    localDate: `${get("year")}-${get("month")}-${get("day")}`,
    slotTime: `${get("hour")}:${get("minute")}`,
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

  const preview = habits
    .slice(0, 2)
    .map((habit) => habit.name)
    .join(" and ");

  return {
    title: `${habits.length} habits are ready`,
    body: `You planned ${preview}. Open habitly and keep the streak alive.`,
  };
}

async function createDispatchMarker(userId, dispatchId, payload) {
  const markerRef = db.doc(`users/${userId}/reminderDispatches/${dispatchId}`);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(markerRef);
    if (snapshot.exists) {
      throw new Error("dispatch-already-sent");
    }

    transaction.create(markerRef, payload);
  });
}

async function sendReminderForUser(userDoc, now = new Date()) {
  const settings = userDoc.get("notificationSettings") || {};
  const timeZone = settings.timezone || "UTC";
  const enabled = settings.enabled === true;

  if (!enabled) {
    return { sent: false, reason: "disabled" };
  }

  const { localDate, slotTime, dayOfWeek } = getLocalParts(now, timeZone);
  if (dayOfWeek < 0) {
    return { sent: false, reason: "invalid-timezone" };
  }

  const devicesSnapshot = await userDoc.ref.collection("devices").where("permission", "==", "granted").get();
  const tokens = devicesSnapshot.docs
    .map((deviceDoc) => deviceDoc.get("token"))
    .filter((token) => typeof token === "string" && token.length > 0);

  if (tokens.length === 0) {
    return { sent: false, reason: "no-devices" };
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
    return { sent: false, reason: "no-habits" };
  }

  const dispatchId = `${localDate}_${slotTime.replace(":", "-")}`;

  try {
    await createDispatchMarker(userDoc.id, dispatchId, {
      localDate,
      slotTime,
      timeZone,
      habitIds: dueHabits.map((habit) => habit.id),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "dispatch-already-sent") {
      return { sent: false, reason: "duplicate" };
    }
    throw error;
  }

  const copy = buildDispatchMessage(dueHabits);
  const message = {
    tokens,
    notification: {
      title: copy.title,
      body: copy.body,
    },
    webpush: {
      fcmOptions: {
        link: "/",
      },
    },
    data: {
      screen: "home",
      localDate,
      slotTime,
    },
  };

  const response = await messaging.sendEachForMulticast(message);

  await Promise.all(
    response.responses.map(async (result, index) => {
      if (result.success) return;

      const code = result.error?.code || "";
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        const deviceDoc = devicesSnapshot.docs.find((docSnapshot) => docSnapshot.get("token") === tokens[index]);
        if (deviceDoc) {
          await deviceDoc.ref.delete().catch(() => undefined);
        }
      }
    }),
  );

  return {
    sent: response.successCount > 0,
    successCount: response.successCount,
    failureCount: response.failureCount,
    habitCount: dueHabits.length,
  };
}

exports.sendHabitReminders = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "UTC",
    region: "us-central1",
    retryCount: 1,
  },
  async () => {
    const usersSnapshot = await db.collection("users").where("notificationSettings.enabled", "==", true).get();

    if (usersSnapshot.empty) {
      logger.info("No users with reminders enabled.");
      return;
    }

    let sentCount = 0;
    let processedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      try {
        const result = await sendReminderForUser(userDoc);
        processedCount += 1;
        if (result.sent) {
          sentCount += 1;
        }
      } catch (error) {
        logger.error(`Reminder send failed for user ${userDoc.id}`, error);
      }
    }

    logger.info("Reminder scheduler run complete.", {
      processedCount,
      sentCount,
    });
  },
);
