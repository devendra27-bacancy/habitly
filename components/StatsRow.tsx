"use client";

import { Habit, todayStr, isScheduledToday } from '../lib/useHabits';

export function StatsRow({ habits }: { habits: Habit[] }) {
  const today = todayStr();
  const total = habits.length;

  const doneToday = habits.filter((habit) => habit.lastCompleted === today).length;
  const bestStreak = Math.max(0, ...habits.map((habit) => habit.longestStreak || 0));

  const scheduled = habits.filter((habit) => isScheduledToday(habit.daysOfWeek));
  const schedDone = scheduled.filter((habit) => habit.lastCompleted === today).length;
  const schedTot = scheduled.length;
  const pct = schedTot === 0 ? 0 : Math.round((schedDone / schedTot) * 100);

  return (
    <>
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-emoji">📋</div>
          <div className="stat-val">{total}</div>
          <div className="stat-lbl">Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-emoji">✅</div>
          <div className="stat-val">{doneToday}</div>
          <div className="stat-lbl">Done</div>
        </div>
        <div className="stat-card">
          <div className="stat-emoji">🔥</div>
          <div className="stat-val">{bestStreak}</div>
          <div className="stat-lbl">Best</div>
        </div>
      </div>

      <div className="progress-label">
        <span>Today&apos;s scheduled progress</span>
        <span>{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}
