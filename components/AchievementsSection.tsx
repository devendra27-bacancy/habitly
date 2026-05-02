"use client";

import type { AchievementSummary } from "../lib/achievements";

type AchievementsSectionProps = {
  summary: AchievementSummary;
};

function formatBadgeCount(unlocked: number, total: number) {
  return `${unlocked}/${total}`;
}

export function AchievementsSection({ summary }: AchievementsSectionProps) {
  return (
    <section className="profile-story-card achievements-card">
      <div className="profile-story-title">Achievements</div>
      <div className="profile-story-copy">
        Tiered badges for your streaks, perfect days, consistency, and the habits you keep coming back to.
      </div>

      <div className="achievements-overview">
        <div className="achievements-summary-card sage">
          <div className="achievements-summary-value">{summary.unlockedCount}</div>
          <div className="achievements-summary-label">Unlocked</div>
          <div className="achievements-summary-helper">Out of {summary.totalCount} total badges</div>
        </div>
        <div className="achievements-summary-card sky">
          <div className="achievements-summary-value">{summary.completionPercent}%</div>
          <div className="achievements-summary-label">Collection</div>
          <div className="achievements-summary-helper">How full your badge shelf is right now</div>
        </div>
        <div className="achievements-summary-card sun">
          <div className="achievements-summary-value">
            {summary.nextUp ? Math.round(summary.nextUp.progress * 100) : 100}%
          </div>
          <div className="achievements-summary-label">Next up</div>
          <div className="achievements-summary-helper">
            {summary.nextUp ? summary.nextUp.definition.title : "Every launch badge is unlocked"}
          </div>
        </div>
      </div>

      {summary.recent.length > 0 ? (
        <div className="achievements-recent">
          {summary.recent.map((item) => (
            <div key={item.definition.id} className={`achievement-pill ${item.definition.accent}`}>
              <span>{item.definition.icon}</span>
              <span>{item.definition.title}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="achievements-track-list">
        {summary.groups.map((group) => (
          <div key={group.track} className="achievements-track-card">
            <div className="achievements-track-head">
              <div>
                <div className="achievements-track-title">{group.title}</div>
                <div className="achievements-track-copy">{group.description}</div>
              </div>
              <div className="achievements-track-meta">{formatBadgeCount(group.unlockedCount, group.totalCount)}</div>
            </div>
            <div className="achievements-track-bar">
              <div className="achievements-track-fill" style={{ width: `${Math.round(group.progress * 100)}%` }} />
            </div>

            <div className="achievements-badge-grid">
              {group.items.map((item) => (
                <div
                  key={item.definition.id}
                  className={`achievement-badge ${item.unlocked ? "unlocked" : "locked"} ${item.definition.accent}`}
                >
                  <div className="achievement-badge-icon">{item.definition.icon}</div>
                  <div className="achievement-badge-title">{item.definition.title}</div>
                  <div className="achievement-badge-copy">{item.definition.description}</div>
                  <div className="achievement-badge-progress">
                    {item.unlocked ? (
                      <span>Unlocked</span>
                    ) : (
                      <span>{Math.min(item.current, item.target)}/{item.target}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
