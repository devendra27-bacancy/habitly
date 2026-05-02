"use client";

import type { AchievementDefinition } from "../lib/achievements";

type AchievementUnlockOverlayProps = {
  achievement: AchievementDefinition | null;
  remainingCount: number;
  onClose: () => void;
};

export function AchievementUnlockOverlay({
  achievement,
  remainingCount,
  onClose,
}: AchievementUnlockOverlayProps) {
  if (!achievement) return null;

  return (
    <div className="achievement-unlock-overlay" role="status" aria-live="polite">
      <div className={`achievement-unlock-card ${achievement.accent}`}>
        <div className="achievement-unlock-icon">{achievement.icon}</div>
        <div className="achievement-unlock-copy">
          <div className="achievement-unlock-kicker">Achievement unlocked</div>
          <div className="achievement-unlock-title">{achievement.title}</div>
          <div className="achievement-unlock-text">{achievement.description}</div>
          {remainingCount > 0 ? (
            <div className="achievement-unlock-more">+{remainingCount} more waiting in your stats</div>
          ) : null}
        </div>
        <button className="achievement-unlock-close" onClick={onClose}>
          Nice
        </button>
      </div>
    </div>
  );
}
