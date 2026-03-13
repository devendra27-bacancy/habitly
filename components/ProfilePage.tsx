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
  name: string;
  email?: string;
  photoURL?: string;
  level: number;
  levelXp: number;
  totalXp: number;
  stats: ProfileStat[];
  isDeletingAccount?: boolean;
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
  name,
  email,
  photoURL,
  level,
  levelXp,
  totalXp,
  stats,
  isDeletingAccount = false,
}: ProfilePageProps) {
  if (!isOpen) return null;

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
              <button className="profile-edit" onClick={onEditName}>
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
            <button className="profile-delete" onClick={onDeleteAccount} disabled={isDeletingAccount}>
              {isDeletingAccount ? "Deleting account..." : "Delete account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
