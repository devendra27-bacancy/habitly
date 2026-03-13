export type NotificationPermissionState = NotificationPermission | "unsupported";

export type UserNotificationSettings = {
  enabled: boolean;
  permission: NotificationPermissionState;
  timezone: string;
  updatedAt: string;
  tokenId?: string;
};

export type NotificationDeviceRecord = {
  token: string;
  platform: "web";
  permission: NotificationPermission;
  timezone: string;
  userAgent: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
};

export type ReminderDispatchScaffold = {
  userId: string;
  habitId: string;
  habitName: string;
  reminderTime: string;
  timezone: string;
  tokenIds: string[];
};

export function getBrowserNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }

  return Notification.permission;
}

export function getBrowserTimezone() {
  if (typeof Intl === "undefined") {
    return "UTC";
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export async function hashNotificationToken(token: string) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

export function buildReminderDispatchScaffold(
  userId: string,
  habitId: string,
  habitName: string,
  reminderTime: string,
  timezone: string,
  tokenIds: string[],
): ReminderDispatchScaffold {
  return {
    userId,
    habitId,
    habitName,
    reminderTime,
    timezone,
    tokenIds,
  };
}
