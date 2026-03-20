"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteDoc, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { useAuth } from "../components/AuthProvider";
import { showToast } from "../components/ToastContainer";
import { app, db } from "./firebase";
import {
  getBrowserNotificationPermission,
  getBrowserTimezone,
  hashNotificationToken,
  NotificationPermissionState,
  NotificationDeviceRecord,
  UserNotificationSettings,
} from "./notifications";

type NotificationProfileDoc = {
  notificationSettings?: Partial<UserNotificationSettings>;
};

type UseNotificationsResult = {
  isSupported: boolean;
  permission: NotificationPermissionState;
  settings: UserNotificationSettings;
  isBusy: boolean;
  error: string | null;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => Promise<boolean>;
  enableEmailNotifications: () => Promise<boolean>;
  disableEmailNotifications: () => Promise<boolean>;
  updateQuietHours: (nextQuietHours: {
    enabled: boolean;
    start: string;
    end: string;
  }) => Promise<boolean>;
};

const defaultSettings: UserNotificationSettings = {
  enabled: false,
  permission: "default",
  timezone: "UTC",
  updatedAt: "",
  emailEnabled: false,
  emailAddress: "",
  emailUpdatedAt: "",
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

const firebaseEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

function looksLikeValidVapidKey(value: string) {
  return /^[A-Za-z0-9_-]{80,120}$/.test(value);
}

function getNotificationErrorMessage(error: unknown) {
  const fallback = "Could not enable reminders.";

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message || fallback;

  if (
    message.includes("applicationServerKey is not valid") ||
    message.includes("Missing notification VAPID key")
  ) {
    return "Your web push key is invalid. Add the public VAPID key from Firebase Console > Cloud Messaging > Web configuration.";
  }

  return message;
}

function buildMessagingServiceWorkerUrl() {
  const url = new URL("/firebase-messaging-sw.js", window.location.origin);
  Object.entries(firebaseEnv).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

async function getMessagingSupport() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || typeof Notification === "undefined") return false;
  return isSupported().catch(() => false);
}

async function registerMessagingServiceWorker() {
  const registration = await navigator.serviceWorker.register(buildMessagingServiceWorkerUrl(), { scope: "/firebase-push/" });

  if (registration.active) {
    return registration;
  }

  await navigator.serviceWorker.ready;
  return navigator.serviceWorker.getRegistration("/firebase-push/") ?? registration;
}

export function useNotifications(): UseNotificationsResult {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [settings, setSettings] = useState<UserNotificationSettings>(defaultSettings);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenDocIdRef = useRef<string | null>(null);
  const hasAutoRegisteredRef = useRef(false);

  const getMessagingClient = useCallback(async () => {
    const supported = await getMessagingSupport();
    if (!supported) return null;
    return getMessaging(app);
  }, []);

  const syncProfileSettings = useCallback(async (nextSettings: UserNotificationSettings) => {
    if (!user) return;
    await setDoc(
      doc(db, "users", user.uid),
      {
        notificationSettings: nextSettings,
      },
      { merge: true },
    );
  }, [user]);

  const registerNotificationToken = useCallback(async () => {
    if (!user) {
      throw new Error("You need to be signed in before enabling reminders.");
    }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
    if (!vapidKey) {
      throw new Error("Missing notification VAPID key. Add NEXT_PUBLIC_FIREBASE_VAPID_KEY to your env file.");
    }
    if (!looksLikeValidVapidKey(vapidKey)) {
      throw new Error("Missing notification VAPID key. Add NEXT_PUBLIC_FIREBASE_VAPID_KEY to your env file.");
    }

    const messaging = await getMessagingClient();
    if (!messaging) {
      throw new Error("This browser does not support habitly reminders.");
    }

    const serviceWorkerRegistration = await registerMessagingServiceWorker();
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });

    if (!token) {
      throw new Error("Could not create a browser notification token. Try again in a fresh tab.");
    }

    const timezone = getBrowserTimezone();
    const permissionValue = getBrowserNotificationPermission();

    if (permissionValue === "unsupported") {
      throw new Error("This browser does not support web notifications.");
    }

    const tokenDocId = await hashNotificationToken(token);
    const tokenDocRef = doc(db, "users", user.uid, "devices", tokenDocId);
    const existingDoc = await getDoc(tokenDocRef);
    const now = new Date().toISOString();
    const deviceRecord: NotificationDeviceRecord = {
      token,
      platform: "web",
      permission: permissionValue,
      timezone,
      userAgent: navigator.userAgent,
      createdAt: existingDoc.exists() ? (existingDoc.data().createdAt as string | undefined) ?? now : now,
      updatedAt: now,
      lastSeenAt: now,
    };

    await setDoc(tokenDocRef, deviceRecord, { merge: true });

    const nextSettings: UserNotificationSettings = {
      enabled: true,
      permission: permissionValue,
      timezone,
      updatedAt: now,
      tokenId: tokenDocId,
      emailEnabled: settings.emailEnabled ?? false,
      emailAddress: settings.emailAddress ?? user.email ?? "",
      emailUpdatedAt: settings.emailUpdatedAt ?? "",
      quietHoursEnabled: settings.quietHoursEnabled ?? false,
      quietHoursStart: settings.quietHoursStart ?? "22:00",
      quietHoursEnd: settings.quietHoursEnd ?? "07:00",
    };

    await syncProfileSettings(nextSettings);
    tokenDocIdRef.current = tokenDocId;
    setSettings(nextSettings);
    setPermission(permissionValue);
    return true;
  }, [
    getMessagingClient,
    settings.emailAddress,
    settings.emailEnabled,
    settings.emailUpdatedAt,
    settings.quietHoursEnabled,
    settings.quietHoursEnd,
    settings.quietHoursStart,
    syncProfileSettings,
    user,
  ]);

  useEffect(() => {
    let cancelled = false;

    void getMessagingSupport().then((supported) => {
      if (cancelled) return;
      setIsSupported(supported);
      setPermission(supported ? getBrowserNotificationPermission() : "unsupported");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setSettings(defaultSettings);
      setError(null);
      tokenDocIdRef.current = null;
      hasAutoRegisteredRef.current = false;
      return;
    }

    const unsub = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      const data = snapshot.data() as NotificationProfileDoc | undefined;
      const notificationSettings = data?.notificationSettings;
      if (!notificationSettings) {
        setSettings((current) => ({
          ...current,
          enabled: false,
          permission: getBrowserNotificationPermission(),
          timezone: getBrowserTimezone(),
          emailEnabled: false,
          emailAddress: user.email ?? current.emailAddress ?? "",
          emailUpdatedAt: "",
          quietHoursEnabled: false,
          quietHoursStart: "22:00",
          quietHoursEnd: "07:00",
        }));
        return;
      }

      const mergedSettings: UserNotificationSettings = {
        enabled: Boolean(notificationSettings.enabled),
        permission: (notificationSettings.permission as NotificationPermissionState | undefined) ?? getBrowserNotificationPermission(),
        timezone: notificationSettings.timezone ?? getBrowserTimezone(),
        updatedAt: notificationSettings.updatedAt ?? "",
        tokenId: notificationSettings.tokenId,
        emailEnabled: Boolean(notificationSettings.emailEnabled),
        emailAddress: notificationSettings.emailAddress ?? user.email ?? "",
        emailUpdatedAt: notificationSettings.emailUpdatedAt ?? "",
        quietHoursEnabled: Boolean(notificationSettings.quietHoursEnabled),
        quietHoursStart: notificationSettings.quietHoursStart ?? "22:00",
        quietHoursEnd: notificationSettings.quietHoursEnd ?? "07:00",
      };

      setSettings(mergedSettings);
      tokenDocIdRef.current = mergedSettings.tokenId ?? null;
    });

    return () => {
      unsub();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (!isSupported) return;
    if (permission !== "granted") return;
    if (hasAutoRegisteredRef.current) return;

    hasAutoRegisteredRef.current = true;
    void registerNotificationToken().catch((registrationError) => {
      console.error("Failed to auto-register notification token:", registrationError);
      setError(getNotificationErrorMessage(registrationError));
    });
  }, [isSupported, permission, registerNotificationToken, user]);

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    let active = true;

    void (async () => {
      const messaging = await getMessagingClient();
      if (!messaging || !active) return;

      unsubscribe = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || "habitly reminder";
        const body = payload.notification?.body || "Your next habit is waiting for you.";
        showToast("Push", `${title} - ${body}`, "info");
      });
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [getMessagingClient]);

  const enableNotifications = useCallback(async () => {
    if (!isSupported) {
      setError("This browser does not support web notifications.");
      return false;
    }

    setIsBusy(true);
    setError(null);

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        const deniedSettings: UserNotificationSettings = {
          enabled: false,
          permission: permissionResult,
          timezone: getBrowserTimezone(),
          updatedAt: new Date().toISOString(),
          emailEnabled: settings.emailEnabled ?? false,
          emailAddress: settings.emailAddress ?? user?.email ?? "",
          emailUpdatedAt: settings.emailUpdatedAt ?? "",
          quietHoursEnabled: settings.quietHoursEnabled ?? false,
          quietHoursStart: settings.quietHoursStart ?? "22:00",
          quietHoursEnd: settings.quietHoursEnd ?? "07:00",
        };
        await syncProfileSettings(deniedSettings);
        setSettings(deniedSettings);
        showToast("!", "Notifications are blocked in this browser. You can enable them later in site settings.", "warning");
        return false;
      }

      await registerNotificationToken();
      showToast("On", "Reminders are on for this browser.", "success");
      return true;
    } catch (registrationError) {
      const message = getNotificationErrorMessage(registrationError);
      setError(message);
      showToast("!", message, "error");
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [
    isSupported,
    registerNotificationToken,
    settings.emailAddress,
    settings.emailEnabled,
    settings.emailUpdatedAt,
    settings.quietHoursEnabled,
    settings.quietHoursEnd,
    settings.quietHoursStart,
    syncProfileSettings,
    user?.email,
  ]);

  const disableNotifications = useCallback(async () => {
    if (!user) return false;

    setIsBusy(true);
    setError(null);

    try {
      const permissionValue = getBrowserNotificationPermission();
      const messaging = await getMessagingClient();
      if (messaging) {
        await deleteToken(messaging).catch(() => undefined);
      }

      if (tokenDocIdRef.current) {
        await deleteDoc(doc(db, "users", user.uid, "devices", tokenDocIdRef.current)).catch(() => undefined);
      }

      const nextSettings: UserNotificationSettings = {
        enabled: false,
        permission: permissionValue,
        timezone: getBrowserTimezone(),
        updatedAt: new Date().toISOString(),
        emailEnabled: settings.emailEnabled ?? false,
        emailAddress: settings.emailAddress ?? user.email ?? "",
        emailUpdatedAt: settings.emailUpdatedAt ?? "",
        quietHoursEnabled: settings.quietHoursEnabled ?? false,
        quietHoursStart: settings.quietHoursStart ?? "22:00",
        quietHoursEnd: settings.quietHoursEnd ?? "07:00",
      };

      await syncProfileSettings(nextSettings);
      tokenDocIdRef.current = null;
      setSettings(nextSettings);
      showToast("Off", "Reminders are off for this browser.", "info");
      return true;
    } catch (disableError) {
      const message = disableError instanceof Error ? disableError.message : "Could not turn off reminders.";
      setError(message);
      showToast("!", message, "error");
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [
    getMessagingClient,
    settings.emailAddress,
    settings.emailEnabled,
    settings.emailUpdatedAt,
    settings.quietHoursEnabled,
    settings.quietHoursEnd,
    settings.quietHoursStart,
    syncProfileSettings,
    user,
  ]);

  const enableEmailNotifications = useCallback(async () => {
    if (!user) {
      setError("You need to be signed in before enabling email reminders.");
      return false;
    }

    const emailAddress = user.email?.trim() || settings.emailAddress?.trim() || "";
    if (!emailAddress) {
      const message = "Add an email address to your account before enabling email reminders.";
      setError(message);
      showToast("!", message, "warning");
      return false;
    }

    setIsBusy(true);
    setError(null);

    try {
      const nextSettings: UserNotificationSettings = {
        ...settings,
        emailEnabled: true,
        emailAddress,
        emailUpdatedAt: new Date().toISOString(),
      };

      await syncProfileSettings(nextSettings);
      setSettings(nextSettings);
      showToast("Mail", "Email reminders are on.", "success");
      return true;
    } catch (enableError) {
      const message = enableError instanceof Error ? enableError.message : "Could not turn on email reminders.";
      setError(message);
      showToast("!", message, "error");
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [settings, syncProfileSettings, user]);

  const disableEmailNotifications = useCallback(async () => {
    if (!user) return false;

    setIsBusy(true);
    setError(null);

    try {
      const nextSettings: UserNotificationSettings = {
        ...settings,
        emailEnabled: false,
        emailAddress: settings.emailAddress ?? user.email ?? "",
        emailUpdatedAt: new Date().toISOString(),
      };

      await syncProfileSettings(nextSettings);
      setSettings(nextSettings);
      showToast("Mail", "Email reminders are off.", "info");
      return true;
    } catch (disableError) {
      const message = disableError instanceof Error ? disableError.message : "Could not turn off email reminders.";
      setError(message);
      showToast("!", message, "error");
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [settings, syncProfileSettings, user]);

  const updateQuietHours = useCallback(async ({
    enabled,
    start,
    end,
  }: {
    enabled: boolean;
    start: string;
    end: string;
  }) => {
    if (!user) return false;

    setIsBusy(true);
    setError(null);

    try {
      const nextSettings: UserNotificationSettings = {
        ...settings,
        quietHoursEnabled: enabled,
        quietHoursStart: start,
        quietHoursEnd: end,
      };

      await syncProfileSettings(nextSettings);
      setSettings(nextSettings);
      showToast("Moon", enabled ? "Quiet hours updated." : "Quiet hours turned off.", "success");
      return true;
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Could not update quiet hours.";
      setError(message);
      showToast("!", message, "error");
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [settings, syncProfileSettings, user]);

  return {
    isSupported,
    permission,
    settings,
    isBusy,
    error,
    enableNotifications,
    disableNotifications,
    enableEmailNotifications,
    disableEmailNotifications,
    updateQuietHours,
  };
}
