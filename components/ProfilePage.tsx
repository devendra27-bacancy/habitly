"use client";

import Image from "next/image";
import { logout } from "../lib/auth";
import { CloseIcon } from "./Icons";

type ProfileStat = {
  label: string;
  value: string;
  tone?: "sage" | "sun" | "sky" | "rose";
};

type ProfilePageProps = {
  isOpen: boolean;
  onClose: () => void;
  onEditName: () => void;
  onDeleteAccount: () => void;
  onEnableNotifications: () => void;
  onDisableNotifications: () => void;
  onEnableEmailNotifications: () => void;
  onDisableEmailNotifications: () => void;
  name: string;
  email?: string;
  photoURL?: string;
  level: number;
  levelXp: number;
  totalXp: number;
  stats: ProfileStat[];
  isDeletingAccount?: boolean;
  readOnly?: boolean;
  notificationsSupported: boolean;
  notificationsEnabled: boolean;
  notificationPermission: "default" | "denied" | "granted" | "unsupported";
  notificationTimezone: string;
  emailNotificationsEnabled: boolean;
  emailNotificationAddress?: string;
  emailNotificationsAvailable?: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  onUpdateQuietHours: (nextQuietHours: { enabled: boolean; start: string; end: string }) => void;
  notificationBusy?: boolean;
  notificationError?: string | null;
};

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "H"
  );
}

export function ProfilePage({
  isOpen,
  onClose,
  onEditName,
  onDeleteAccount,
  onEnableNotifications,
  onDisableNotifications,
  onEnableEmailNotifications,
  onDisableEmailNotifications,
  name,
  email,
  photoURL,
  level,
  levelXp,
  totalXp,
  stats,
  isDeletingAccount = false,
  readOnly = false,
  notificationsSupported,
  notificationsEnabled,
  notificationPermission,
  notificationTimezone,
  emailNotificationsEnabled,
  emailNotificationAddress,
  emailNotificationsAvailable = false,
  quietHoursEnabled,
  quietHoursStart,
  quietHoursEnd,
  onUpdateQuietHours,
  notificationBusy = false,
  notificationError = null,
}: ProfilePageProps) {
  if (!isOpen) return null;

  const permissionCopy =
    notificationPermission === "granted"
      ? notificationsEnabled
        ? "Reminders are active on this browser."
        : "Browser permission is on, but Habitly reminders are paused."
      : notificationPermission === "denied"
        ? "Notifications are blocked in browser settings."
        : notificationPermission === "unsupported"
          ? "This browser does not support web notifications."
          : "Turn on reminders to get nudges at your habit times.";

  return (
    <div className="profile-shell">
      <div className="profile-backdrop" onClick={onClose} />
      <div className="profile-page">
        <div className="profile-content">
          <div className="profile-topbar">
            <button className="profile-close" onClick={onClose} aria-label="Close profile">
              <CloseIcon className="close-icon" />
            </button>
          </div>

          <div className="profile-hero">
            <div className="profile-hero-top">
              {photoURL ? (
                <div className="profile-avatar-image-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoURL} alt={name} className="profile-avatar-image" />
                </div>
              ) : (
                <div className="profile-avatar-fallback">{getInitials(name)}</div>
              )}
              <div className="profile-mascot-chip">
                <Image src="/mascot/mascot_idle_default.png" alt="habitly mascot" width={92} height={92} />
              </div>
            </div>
            <div className="profile-name-row">
              <div>
                <div className="profile-eyebrow">habitly profile</div>
                <h1>{name}</h1>
                <p>{email || "Signed in"}</p>
              </div>
              <button className="profile-edit" onClick={onEditName} disabled={readOnly}>
                Edit name
              </button>
            </div>
          </div>

          <div className="profile-progress-card">
            <div>
              <div className="profile-progress-label">Level {level}</div>
              <div className="profile-progress-meta">{levelXp}/100 XP toward the next level</div>
            </div>
            <div className="profile-progress-total">{totalXp} total XP</div>
            <div className="profile-progress-track">
              <div className="profile-progress-fill" style={{ width: `${Math.min(levelXp, 100)}%` }} />
            </div>
          </div>

          <div className="profile-story-card profile-notification-card">
            <div className="profile-story-title">Reminders</div>
            <div className="profile-story-copy">
              {permissionCopy}
              {notificationsSupported ? ` Your browser timezone is ${notificationTimezone}.` : ""}
            </div>
            <div className="profile-notification-stack">
              <div className="profile-channel-row">
                <div className="profile-channel-copy">
                  <div className="profile-channel-title">Push reminders</div>
                  <div className="profile-channel-subcopy">
                    Timely nudges on this browser when a habit slot comes up.
                  </div>
                </div>
                <div className="profile-notification-actions">
                  <button
                    className="profile-notification-button"
                    onClick={notificationsEnabled ? onDisableNotifications : onEnableNotifications}
                    disabled={readOnly || notificationBusy || !notificationsSupported}
                  >
                    {notificationBusy
                      ? "Updating..."
                      : notificationsEnabled
                        ? "Turn off push"
                        : "Turn on push"}
                  </button>
                  <div className={`profile-notification-chip ${notificationsEnabled ? "active" : ""}`}>
                    {notificationsEnabled ? "Active on this device" : "Currently off"}
                  </div>
                </div>
              </div>
              <div className="profile-channel-row">
                <div className="profile-channel-copy">
                  <div className="profile-channel-title">Email reminders</div>
                  <div className="profile-channel-subcopy">
                    {emailNotificationsAvailable
                      ? emailNotificationAddress
                        ? `Send reminder emails to ${emailNotificationAddress}.`
                        : "No email address is available for reminder delivery yet."
                      : "Email reminders are coming soon. Your account email is ready for future activation."}
                  </div>
                </div>
                <div className="profile-notification-actions">
                  <button
                    className="profile-notification-button secondary"
                    onClick={emailNotificationsEnabled ? onDisableEmailNotifications : onEnableEmailNotifications}
                    disabled={readOnly || notificationBusy || !emailNotificationAddress || !emailNotificationsAvailable}
                  >
                    {!emailNotificationsAvailable
                      ? "Coming soon"
                      : notificationBusy
                        ? "Updating..."
                        : emailNotificationsEnabled
                          ? "Turn off email"
                          : "Turn on email"}
                  </button>
                  <div className={`profile-notification-chip ${emailNotificationsEnabled ? "active" : ""}`}>
                    {emailNotificationsAvailable
                      ? emailNotificationsEnabled
                        ? "Email is active"
                        : "Email is off"
                      : "Not active yet"}
                  </div>
                </div>
              </div>
              <div className="profile-channel-row">
                <div className="profile-channel-copy">
                  <div className="profile-channel-title">Quiet hours</div>
                  <div className="profile-channel-subcopy">
                    Push reminders are skipped during this window and resume on the next scheduled slot.
                  </div>
                </div>
                <div className="profile-notification-actions">
                  <button
                    className="profile-notification-button secondary"
                    onClick={() => onUpdateQuietHours({
                      enabled: !quietHoursEnabled,
                      start: quietHoursStart,
                      end: quietHoursEnd,
                    })}
                    disabled={readOnly || notificationBusy}
                  >
                    {notificationBusy ? "Updating..." : quietHoursEnabled ? "Turn off quiet hours" : "Turn on quiet hours"}
                  </button>
                  <div className={`profile-notification-chip ${quietHoursEnabled ? "active" : ""}`}>
                    {quietHoursEnabled ? `${quietHoursStart} - ${quietHoursEnd}` : "Not active"}
                  </div>
                </div>
                <div className="profile-quiet-grid">
                  <label className="profile-quiet-field">
                    <span>Start</span>
                    <input
                      type="time"
                      step={300}
                      value={quietHoursStart}
                      onChange={(event) => onUpdateQuietHours({
                        enabled: quietHoursEnabled,
                        start: event.target.value,
                        end: quietHoursEnd,
                      })}
                      disabled={readOnly || notificationBusy}
                    />
                  </label>
                  <label className="profile-quiet-field">
                    <span>End</span>
                    <input
                      type="time"
                      step={300}
                      value={quietHoursEnd}
                      onChange={(event) => onUpdateQuietHours({
                        enabled: quietHoursEnabled,
                        start: quietHoursStart,
                        end: event.target.value,
                      })}
                      disabled={readOnly || notificationBusy}
                    />
                  </label>
                </div>
              </div>
            </div>
            {notificationError ? <div className="profile-notification-error">{notificationError}</div> : null}
          </div>

          <div className="profile-grid">
            {stats.map((stat) => (
              <div key={stat.label} className={`profile-stat-card ${stat.tone || "sage"}`}>
                <div className="profile-stat-value">{stat.value}</div>
                <div className="profile-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="profile-story-card">
            <div className="profile-story-title">What lives here</div>
            <div className="profile-story-copy">
              Your profile pulls together your current level, lifetime XP, active streaks, completion momentum, and how many days you&apos;ve shown up. It&apos;s your personal control room.
            </div>
          </div>

          <div className="profile-actions">
            <button className="profile-logout" onClick={() => void logout()}>
              Log out
            </button>
            <button className="profile-delete" onClick={onDeleteAccount} disabled={readOnly || isDeletingAccount}>
              {isDeletingAccount ? "Deleting account..." : "Delete account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
