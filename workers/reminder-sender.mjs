const DEFAULT_APP_ORIGIN = "https://habitly.web.app";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIREBASE_MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

let accessTokenCache = {
  token: "",
  expiresAt: 0,
};

let signingKeyCache = {
  pem: "",
  key: null,
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeString(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

async function getSigningKey(privateKeyPem) {
  if (signingKeyCache.key && signingKeyCache.pem === privateKeyPem) {
    return signingKeyCache.key;
  }

  const importedKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  signingKeyCache = {
    pem: privateKeyPem,
    key: importedKey,
  };

  return importedKey;
}

function getRequiredEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required Worker binding: ${name}`);
  }
  return value;
}

function normalizePrivateKey(privateKey) {
  return privateKey.replace(/\\n/g, "\n");
}

async function getGoogleAccessToken(env) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (accessTokenCache.token && accessTokenCache.expiresAt - 60 > nowInSeconds) {
    return accessTokenCache.token;
  }

  const clientEmail = getRequiredEnv(env, "FIREBASE_CLIENT_EMAIL");
  const privateKey = normalizePrivateKey(getRequiredEnv(env, "FIREBASE_PRIVATE_KEY"));
  const issuedAt = nowInSeconds;
  const expiresAt = issuedAt + 3600;
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: GOOGLE_TOKEN_URL,
    iat: issuedAt,
    exp: expiresAt,
    scope: `${FIRESTORE_SCOPE} ${FIREBASE_MESSAGING_SCOPE}`,
  };

  const unsignedToken = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(JSON.stringify(payload))}`;
  const signingKey = await getSigningKey(privateKey);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    signingKey,
    new TextEncoder().encode(unsignedToken),
  );

  const assertion = `${unsignedToken}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(`Could not create Google access token: ${details}`);
  }

  const tokenPayload = await tokenResponse.json();
  accessTokenCache = {
    token: tokenPayload.access_token,
    expiresAt: nowInSeconds + Number(tokenPayload.expires_in || 3600),
  };

  return accessTokenCache.token;
}

function getFirestoreBaseUrl(env) {
  const projectId = getRequiredEnv(env, "FIREBASE_PROJECT_ID");
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

async function fetchGoogleJson(env, url, init = {}) {
  const accessToken = await getGoogleAccessToken(env);
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google API request failed (${response.status}): ${details}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function decodeFirestoreValue(value) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("mapValue" in value) return decodeFirestoreFields(value.mapValue.fields || {});
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map((item) => decodeFirestoreValue(item));
  }
  return undefined;
}

function decodeFirestoreFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]),
  );
}

function encodeFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (typeof value === "string") {
    return { stringValue: value };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => encodeFirestoreValue(entry)),
      },
    };
  }

  return {
    mapValue: {
      fields: encodeFirestoreFields(value),
    },
  };
}

function encodeFirestoreFields(data) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeFirestoreValue(value)]),
  );
}

function decodeDocument(document) {
  const path = document.name.split("/documents/")[1];
  return {
    id: path.split("/").pop(),
    path,
    data: decodeFirestoreFields(document.fields || {}),
  };
}

async function getDocument(env, documentPath) {
  const url = `${getFirestoreBaseUrl(env)}/${documentPath}`;
  const accessToken = await getGoogleAccessToken(env);
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Could not load document ${documentPath}: ${details}`);
  }

  return decodeDocument(await response.json());
}

async function deleteDocument(env, documentPath) {
  const accessToken = await getGoogleAccessToken(env);
  const response = await fetch(`${getFirestoreBaseUrl(env)}/${documentPath}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Could not delete document ${documentPath}: ${details}`);
  }
}

async function runStructuredQuery(env, { parentPath = "", collectionId, where }) {
  const baseUrl = getFirestoreBaseUrl(env);
  const url = parentPath ? `${baseUrl}/${parentPath}:runQuery` : `${baseUrl}:runQuery`;
  const response = await fetchGoogleJson(env, url, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where,
      },
    }),
  });

  return (response || [])
    .filter((entry) => entry.document)
    .map((entry) => decodeDocument(entry.document));
}

async function createDocument(env, collectionPath, documentId, data) {
  const url = `${getFirestoreBaseUrl(env)}/${collectionPath}?documentId=${encodeURIComponent(documentId)}`;
  const accessToken = await getGoogleAccessToken(env);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      fields: encodeFirestoreFields(data),
    }),
  });

  if (response.status === 409) {
    return { duplicate: true };
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Could not create document ${collectionPath}/${documentId}: ${details}`);
  }

  return { duplicate: false };
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

function buildDispatchMessage(habits, globalStreak = 0) {
  const [firstHabit] = habits;
  const hour = Number((firstHabit?.reminderTime || "00:00").split(":")[0]);

  if (habits.length === 1) {
    if (globalStreak >= 7) {
      return {
        title: `Protect your ${globalStreak}-day streak`,
        body: `${firstHabit.name} is ready. A quick check-in keeps the run alive.`,
      };
    }

    if (hour >= 18) {
      return {
        title: `Wrap up with ${firstHabit.name}`,
        body: "A short evening check-in will keep today feeling complete.",
      };
    }

    return {
      title: firstHabit.name,
      body: "A small check-in now keeps your day on track.",
    };
  }

  if (hour >= 18) {
    return {
      title: `${habits.length} habits are waiting tonight`,
      body: "Close the day strong with a quick habit check-in.",
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

function getAppOrigin(env) {
  const rawOrigin = env.APP_ORIGIN || DEFAULT_APP_ORIGIN;
  return rawOrigin.replace(/\/+$/, "");
}

function isQuietHoursActive(settings, slotTime) {
  if (!settings.quietHoursEnabled) return false;

  const start = typeof settings.quietHoursStart === "string" ? settings.quietHoursStart : "";
  const end = typeof settings.quietHoursEnd === "string" ? settings.quietHoursEnd : "";
  if (!start || !end) return false;

  const toMinutes = (value) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const slotMinutes = toMinutes(slotTime);
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  }

  return slotMinutes >= startMinutes || slotMinutes < endMinutes;
}

function getNotificationBranding(env) {
  const origin = getAppOrigin(env);
  return {
    badge: `${origin}/favicon-96x96.png`,
  };
}

function hexToRgb(color) {
  const normalized = color.replace("#", "");
  const hex = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;

  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return null;
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function buildHabitNotificationIcon(habit) {
  const emoji = typeof habit?.emoji === "string" && habit.emoji ? habit.emoji : "🌿";
  const color = typeof habit?.color === "string" && habit.color ? habit.color : "#5f8e59";
  const safeColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : "#5f8e59";
  const rgb = hexToRgb(safeColor) ?? { r: 95, g: 142, b: 89 };
  const accentRing = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
      <rect width="192" height="192" rx="96" fill="#ffffff" />
      <circle cx="96" cy="96" r="92" fill="#ffffff" stroke="${accentRing}" stroke-width="4" />
      <text x="96" y="96" text-anchor="middle" dominant-baseline="middle" font-size="88">${emoji}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildEmailPayload(env, habits, globalStreak = 0) {
  const copy = buildDispatchMessage(habits, globalStreak);
  const origin = getAppOrigin(env);
  const habitList = habits
    .map((habit) => `<li style="margin-bottom:8px;">${habit.name}</li>`)
    .join("");

  return {
    subject: copy.title,
    text: `${copy.body}\n\nOpen habitly: ${origin}/`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f2e6;padding:24px;color:#29452f;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:24px;border:1px solid rgba(92,126,88,0.12);">
          <div style="font-size:24px;font-weight:700;margin-bottom:10px;">${copy.title}</div>
          <div style="font-size:15px;line-height:1.6;color:#5a6c5e;margin-bottom:18px;">${copy.body}</div>
          <ul style="padding-left:18px;margin:0 0 18px;">${habitList}</ul>
          <a href="${origin}/" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#2f4c35;color:#fffdf8;text-decoration:none;font-weight:700;">
            Open habitly
          </a>
        </div>
      </div>
    `,
  };
}

function isHabitDue(habit, localDate, dayOfWeek) {
  const days = Array.isArray(habit.daysOfWeek) ? habit.daysOfWeek : [];
  const createdAt = typeof habit.createdAt === "string" ? habit.createdAt : localDate;
  return days.includes(dayOfWeek) && createdAt <= localDate;
}

function isInvalidFcmError(errorPayload) {
  const details = Array.isArray(errorPayload?.error?.details) ? errorPayload.error.details : [];
  const errorCode = details.find((entry) => typeof entry?.errorCode === "string")?.errorCode;
  return errorCode === "UNREGISTERED" || errorCode === "INVALID_ARGUMENT";
}

async function sendPushNotifications(env, { tokens, dispatchId, localDate, slotTime, habits, globalStreak, dryRun }) {
  const copy = buildDispatchMessage(habits, globalStreak);
  const branding = getNotificationBranding(env);
  const habitIcon = buildHabitNotificationIcon(habits[0]);
  const projectId = getRequiredEnv(env, "FIREBASE_PROJECT_ID");
  const accessToken = await getGoogleAccessToken(env);
  const results = await Promise.all(
    tokens.map(async ({ token, deviceDocId }) => {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: copy.title,
              body: copy.body,
            },
            webpush: {
              notification: {
                icon: habitIcon,
                badge: branding.badge,
                tag: dispatchId,
                data: {
                  link: "/",
                  focusDate: localDate,
                  focusSlotTime: slotTime,
                },
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
              focusDate: localDate,
              focusSlotTime: slotTime,
            },
          },
        }),
      });

      if (response.ok) {
        return {
          success: true,
          deviceDocId,
          token,
        };
      }

      const errorPayload = await response.json().catch(() => ({}));
      return {
        success: false,
        deviceDocId,
        token,
        invalid: isInvalidFcmError(errorPayload),
        error: errorPayload,
      };
    }),
  );

  const invalidTokenDocIds = results
    .filter((result) => !result.success && result.invalid)
    .map((result) => result.deviceDocId);

  if (!dryRun) {
    await Promise.all(
      invalidTokenDocIds.map((deviceDocId) => deleteDocument(env, `users/${tokens[0].userId}/devices/${deviceDocId}`).catch(() => undefined)),
    );
  }

  return {
    tokenCount: tokens.length,
    successCount: results.filter((result) => result.success).length,
    failureCount: results.filter((result) => !result.success).length,
    invalidTokenDocIds,
  };
}

async function sendReminderEmail(env, { emailAddress, habits, globalStreak, dryRun }) {
  const mailgunApiKey = env.MAILGUN_API_KEY;
  const mailgunDomain = env.MAILGUN_DOMAIN;
  const mailgunFromEmail = env.MAILGUN_FROM_EMAIL;
  if (!mailgunApiKey || !mailgunDomain || !mailgunFromEmail) {
    return {
      sent: false,
      configured: false,
      to: emailAddress,
    };
  }

  const emailPayload = buildEmailPayload(env, habits, globalStreak);
  if (dryRun) {
    return {
      sent: false,
      configured: true,
      subject: emailPayload.subject,
      to: emailAddress,
    };
  }

  const response = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      from: mailgunFromEmail,
      to: emailAddress,
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
    }).toString(),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Could not send reminder email: ${details}`);
  }

  return {
    sent: true,
    configured: true,
    to: emailAddress,
  };
}

async function createDispatchMarker(env, userId, dispatchId, payload, dryRun) {
  if (dryRun) {
    return { duplicate: false };
  }

  return createDocument(env, `users/${userId}/reminderDispatches`, dispatchId, payload);
}

function getUserNotificationSettings(userData) {
  return userData.notificationSettings || {};
}

async function loadTargetUsers(env, userId) {
  if (userId) {
    const userDocument = await getDocument(env, `users/${userId}`);
    return userDocument ? [userDocument] : [];
  }

  return runStructuredQuery(env, {
    collectionId: "users",
    where: {
      compositeFilter: {
        op: "OR",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "notificationSettings.enabled" },
              op: "EQUAL",
              value: { booleanValue: true },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "notificationSettings.emailEnabled" },
              op: "EQUAL",
              value: { booleanValue: true },
            },
          },
        ],
      },
    },
  });
}

async function loadDueHabits(env, userId, slotTime, localDate, dayOfWeek) {
  const habits = await runStructuredQuery(env, {
    parentPath: `users/${userId}`,
    collectionId: "habits",
    where: {
      fieldFilter: {
        field: { fieldPath: "reminderTime" },
        op: "EQUAL",
        value: { stringValue: slotTime },
      },
    },
  });

  return habits
    .map((habit) => ({
      id: habit.id,
      ...habit.data,
    }))
    .filter((habit) => isHabitDue(habit, localDate, dayOfWeek));
}

async function loadGrantedDevices(env, userId) {
  const devices = await runStructuredQuery(env, {
    parentPath: `users/${userId}`,
    collectionId: "devices",
    where: {
      fieldFilter: {
        field: { fieldPath: "permission" },
        op: "EQUAL",
        value: { stringValue: "granted" },
      },
    },
  });

  return devices
    .map((device) => ({
      deviceDocId: device.id,
      userId,
      ...device.data,
    }))
    .filter((device) => typeof device.token === "string" && device.token.length > 0);
}

async function sendReminderForUser(env, userDocument, { now, dryRun }) {
  const settings = getUserNotificationSettings(userDocument.data);
  const timeZone = settings.timezone || "UTC";
  const pushEnabled = settings.enabled === true;
  const emailEnabled = settings.emailEnabled === true;
  const globalStreak = Number(userDocument.data?.player?.streak || 0);

  if (!pushEnabled && !emailEnabled) {
    return { sent: false, reason: "disabled", userId: userDocument.id };
  }

  const { localDate, slotTime, dayOfWeek } = getLocalParts(now, timeZone);
  if (dayOfWeek < 0) {
    return { sent: false, reason: "invalid-timezone", userId: userDocument.id };
  }

  const dueHabits = await loadDueHabits(env, userDocument.id, slotTime, localDate, dayOfWeek);
  if (dueHabits.length === 0) {
    return { sent: false, reason: "no-habits", userId: userDocument.id };
  }
  const pushAllowed = pushEnabled && !isQuietHoursActive(settings, slotTime);
  const quietHoursSuppressed = pushEnabled && !pushAllowed;
  const deviceRecords = pushAllowed ? await loadGrantedDevices(env, userDocument.id) : [];
  const pushTokens = deviceRecords.map((device) => ({
    token: device.token,
    deviceDocId: device.deviceDocId,
    userId: userDocument.id,
  }));
  const emailAddress = (settings.emailAddress || userDocument.data.email || "").trim();
  const hasEmailChannel = emailEnabled && emailAddress.length > 0;
  const hasPushChannel = pushTokens.length > 0;

  if (!hasEmailChannel && !hasPushChannel) {
    return { sent: false, reason: quietHoursSuppressed ? "quiet-hours" : "no-channels", userId: userDocument.id };
  }

  const dispatchId = buildDispatchId(localDate, slotTime);
  const dispatchMarker = await createDispatchMarker(
    env,
    userDocument.id,
    dispatchId,
    {
      localDate,
      slotTime,
      timeZone,
      habitIds: dueHabits.map((habit) => habit.id),
      channels: {
        push: hasPushChannel,
        email: hasEmailChannel,
      },
      createdAt: new Date().toISOString(),
    },
    dryRun,
  );

  if (dispatchMarker.duplicate) {
    return { sent: false, reason: "duplicate", userId: userDocument.id, dispatchId };
  }

  if (dryRun) {
    const copy = buildDispatchMessage(dueHabits, globalStreak);
    const emailPayload = hasEmailChannel ? buildEmailPayload(env, dueHabits, globalStreak) : null;
    return {
      sent: false,
      reason: "dry-run",
      userId: userDocument.id,
      dispatchId,
      habitCount: dueHabits.length,
      tokenCount: pushTokens.length,
      emailEnabled: hasEmailChannel,
      payload: {
        notification: copy,
        data: {
          screen: "home",
          localDate,
          slotTime,
          link: "/",
          focusDate: localDate,
          focusSlotTime: slotTime,
        },
        email: emailPayload
          ? {
              to: emailAddress,
              subject: emailPayload.subject,
            }
          : null,
      },
    };
  }

  const pushResult = hasPushChannel
      ? await sendPushNotifications(env, {
        tokens: pushTokens,
        dispatchId,
        localDate,
        slotTime,
        habits: dueHabits,
        globalStreak,
        dryRun,
      })
    : {
        tokenCount: 0,
        successCount: 0,
        failureCount: 0,
        invalidTokenDocIds: [],
      };

  const emailResult = hasEmailChannel
      ? await sendReminderEmail(env, {
        emailAddress,
        habits: dueHabits,
        globalStreak,
        dryRun,
      })
    : {
      sent: false,
      configured: false,
      to: null,
    };
  const wasDelivered = pushResult.successCount > 0 || Boolean(emailResult.sent);

  return {
    sent: wasDelivered,
    reason: wasDelivered ? "sent" : quietHoursSuppressed ? "quiet-hours" : "all-failed",
    userId: userDocument.id,
    dispatchId,
    habitCount: dueHabits.length,
    tokenCount: pushTokens.length,
    successCount: pushResult.successCount,
    failureCount: pushResult.failureCount,
    invalidTokenDocIds: pushResult.invalidTokenDocIds,
    emailSent: Boolean(emailResult.sent),
    emailConfigured: Boolean(emailResult.configured),
    emailAddress: emailResult.to,
    quietHoursSuppressed,
  };
}

async function runReminderSender(env, { now = new Date(), userId, dryRun = false } = {}) {
  const users = await loadTargetUsers(env, userId);
  const results = [];

  for (const userDocument of users) {
    const result = await sendReminderForUser(env, userDocument, { now, dryRun });
    results.push(result);
  }

  const summary = results.reduce(
    (accumulator, result) => {
      accumulator.processed += 1;
      if (result.sent) accumulator.sent += 1;
      if (result.reason === "duplicate") accumulator.duplicates += 1;
      if (result.reason === "dry-run") accumulator.dryRuns += 1;
      if (result.emailSent) accumulator.emails += 1;
      return accumulator;
    },
    { processed: 0, sent: 0, duplicates: 0, dryRuns: 0, emails: 0 },
  );

  return {
    now: now.toISOString(),
    dryRun,
    userId: userId || null,
    summary,
    results,
  };
}

async function handleDebugRequest(request, env) {
  if (!env.DEBUG_TOKEN) {
    return jsonResponse({ ok: false, error: "DEBUG_TOKEN is not configured." }, 503);
  }

  const providedToken = request.headers.get("x-debug-token");
  if (providedToken !== env.DEBUG_TOKEN) {
    return jsonResponse({ ok: false, error: "Unauthorized debug request." }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const now = body.at ? new Date(body.at) : new Date();
  if (Number.isNaN(now.getTime())) {
    return jsonResponse({ ok: false, error: "Invalid 'at' value. Use an ISO timestamp." }, 400);
  }

  const result = await runReminderSender(env, {
    now,
    userId: body.userId || undefined,
    dryRun: body.dryRun !== false,
  });

  return jsonResponse(result);
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      runReminderSender(env, {
        now: new Date(controller.scheduledTime),
        dryRun: false,
      }).then((result) => {
        console.log(JSON.stringify(result));
      }).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
      }),
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return jsonResponse({
        ok: true,
        service: "habitly-reminder-sender",
      });
    }

    if (request.method === "POST" && url.pathname === "/debug") {
      return handleDebugRequest(request, env);
    }

    return jsonResponse({ ok: false, error: "Not found." }, 404);
  },
};

export {
  buildDispatchId,
  buildDispatchMessage,
  getLocalParts,
  runReminderSender,
};
