"use client";

type AnalyticsOverviewItem = {
  label: string;
  value: string;
  helper: string;
  tone: "sage" | "sun" | "sky" | "rose";
};

type AnalyticsTrendPoint = {
  dateKey: string;
  label: string;
  done: number;
  total: number;
  rate: number;
};

type AnalyticsWeekdayPoint = {
  label: string;
  done: number;
  total: number;
  rate: number;
};

type AnalyticsHeatmapCell = {
  dateKey: string;
  label: string;
  level: 0 | 1 | 2 | 3;
  done: number;
  total: number;
  isToday: boolean;
};

type AnalyticsHabitInsight = {
  label: string;
  value: string;
  helper: string;
};

export type ProfileAnalyticsData = {
  overview: AnalyticsOverviewItem[];
  trend: AnalyticsTrendPoint[];
  weekday: AnalyticsWeekdayPoint[];
  heatmap: AnalyticsHeatmapCell[];
  insights: AnalyticsHabitInsight[];
};

type ProfileAnalyticsProps = {
  data: ProfileAnalyticsData;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function ProfileAnalytics({ data }: ProfileAnalyticsProps) {
  if (data.trend.length === 0) return null;

  return (
    <section className="profile-story-card profile-analytics-card">
      <div className="profile-story-title">Analytics</div>
      <div className="profile-story-copy">
        A closer look at your consistency, recovery, and where your routines are strongest right now.
      </div>

      <div className="profile-analytics-overview">
        {data.overview.map((item) => (
          <div key={item.label} className={`profile-analytics-stat ${item.tone}`}>
            <div className="profile-analytics-stat-value">{item.value}</div>
            <div className="profile-analytics-stat-label">{item.label}</div>
            <div className="profile-analytics-stat-helper">{item.helper}</div>
          </div>
        ))}
      </div>

      <div className="profile-analytics-grid">
        <div className="profile-analytics-panel">
          <div className="profile-analytics-panel-head">
            <div className="profile-analytics-panel-title">Last 14 days</div>
            <div className="profile-analytics-panel-meta">Daily completion rate</div>
          </div>
          <div className="profile-analytics-trend">
            {data.trend.map((point) => (
              <div key={point.dateKey} className="profile-analytics-bar-wrap" title={`${point.label}: ${point.done}/${point.total || 0}`}>
                <div className="profile-analytics-bar-track">
                  <div className="profile-analytics-bar-fill" style={{ height: `${Math.max(8, Math.round(point.rate * 100))}%` }} />
                </div>
                <div className="profile-analytics-bar-label">{point.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="profile-analytics-panel">
          <div className="profile-analytics-panel-head">
            <div className="profile-analytics-panel-title">Weekday consistency</div>
            <div className="profile-analytics-panel-meta">How often you finish what was scheduled</div>
          </div>
          <div className="profile-analytics-weekday-list">
            {data.weekday.map((point) => (
              <div key={point.label} className="profile-analytics-weekday-row">
                <div className="profile-analytics-weekday-head">
                  <span>{point.label}</span>
                  <span>{point.total > 0 ? formatPercent(point.rate) : "—"}</span>
                </div>
                <div className="profile-analytics-weekday-track">
                  <div className="profile-analytics-weekday-fill" style={{ width: `${Math.round(point.rate * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="profile-analytics-panel profile-analytics-panel-wide">
          <div className="profile-analytics-panel-head">
            <div className="profile-analytics-panel-title">Momentum map</div>
            <div className="profile-analytics-panel-meta">The last 10 weeks of scheduled days</div>
          </div>
          <div className="profile-analytics-heatmap">
            {data.heatmap.map((cell) => (
              <div
                key={cell.dateKey}
                className={`profile-analytics-heatmap-cell level-${cell.level} ${cell.isToday ? "today" : ""}`}
                title={`${cell.label}: ${cell.done}/${cell.total || 0}`}
              />
            ))}
          </div>
          <div className="profile-analytics-legend">
            <span>Less</span>
            <div className="profile-analytics-legend-scale">
              <i className="level-0" />
              <i className="level-1" />
              <i className="level-2" />
              <i className="level-3" />
            </div>
            <span>More</span>
          </div>
        </div>

        <div className="profile-analytics-panel profile-analytics-panel-wide">
          <div className="profile-analytics-panel-head">
            <div className="profile-analytics-panel-title">Highlights</div>
            <div className="profile-analytics-panel-meta">A few useful reads from your recent data</div>
          </div>
          <div className="profile-analytics-insights">
            {data.insights.map((insight) => (
              <div key={insight.label} className="profile-analytics-insight">
                <div className="profile-analytics-insight-label">{insight.label}</div>
                <div className="profile-analytics-insight-value">{insight.value}</div>
                <div className="profile-analytics-insight-helper">{insight.helper}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
