"use client";

import { PlayerState } from '../lib/useHabits';

const XP_PER_LEVEL = 100;

export function XPBar({ player }: { player: PlayerState }) {
  const xpInLevel = Math.max(0, Math.min(player.xp, XP_PER_LEVEL));
  const progressPct = `${Math.max(0, Math.min((xpInLevel / XP_PER_LEVEL) * 100, 100))}%`;

  return (
    <div className="xp-section">
      <div className="xp-label">
        <span id="xpLabel">Level {player.level}</span>
        <span id="xpProgress">{xpInLevel} / {XP_PER_LEVEL} XP</span>
      </div>
      <div className="xp-bar-wrap">
        <div className="xp-bar-fill" id="xpBarFill" style={{ width: progressPct }} />
      </div>
    </div>
  );
}
