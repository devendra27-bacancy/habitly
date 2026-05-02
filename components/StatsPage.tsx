"use client";

import { CloseIcon } from "./Icons";
import { ProfileAnalytics, type ProfileAnalyticsData } from "./ProfileAnalytics";
import { AchievementsSection } from "./AchievementsSection";
import type { AchievementSummary } from "../lib/achievements";

type ProfileStat = {
  label: string;
  value: string;
  tone?: "sage" | "sun" | "sky" | "rose";
};

type StatsPageProps = {
  isOpen: boolean;
  onClose: () => void;
  level: number;
  levelXp: number;
  totalXp: number;
  stats: ProfileStat[];
  analytics: ProfileAnalyticsData;
  achievements: AchievementSummary;
};

export function StatsPage({ isOpen, onClose, level, levelXp, totalXp, stats, analytics, achievements }: StatsPageProps) {
  if (!isOpen) return null;

  return (
    <div className="profile-shell">
      <div className="profile-backdrop" onClick={onClose} />
      <div className="profile-page">
        <div className="profile-content">
          <div className="profile-topbar">
            <button className="profile-close" onClick={onClose} aria-label="Close stats">
              <CloseIcon className="close-icon" />
            </button>
          </div>

          <div className="profile-hero stats-hero">
            <div className="profile-name-row">
              <div>
                <div className="profile-eyebrow">habitly stats</div>
                <h1>Your momentum</h1>
                <p>A dedicated look at your level, streak rhythm, and recent consistency.</p>
              </div>
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

          <AchievementsSection summary={achievements} />
          <ProfileAnalytics data={analytics} />
        </div>
      </div>
    </div>
  );
}
