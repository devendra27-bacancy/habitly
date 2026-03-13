"use client";

import { Habit, formatTime, isScheduledToday, todayStr } from '../lib/useHabits';

type HabitCardProps = {
  habit: Habit;
  index: number;
  onEdit: (id: string) => void;
  onToggle: (id: string) => void;
  isSaving?: boolean;
  isDeleting?: boolean;
  isEditing?: boolean;
};

export function HabitCard({
  habit,
  index,
  onToggle,
  onEdit,
  isSaving = false,
  isDeleting = false,
  isEditing = false,
}: HabitCardProps) {
  const today = todayStr();
  const isRestDay = !isScheduledToday(habit.daysOfWeek);
  const isCompleted = !isRestDay && habit.lastCompleted === today;
  const isStreak = habit.streak >= 7 && !isRestDay;
  const isBusy = isSaving || isDeleting || isEditing;

  return (
    <div
      className={`habit-card${isCompleted ? ' done' : ''}${isStreak ? ' streak-fire' : ''}${isRestDay ? ' rest-day' : ''}${isBusy ? ' pending' : ''}`}
      style={{ animationDelay: `${index * 0.07}s` }}
    >
      <div className="habit-icon" style={{ background: `${habit.color}22` }}>
        <span>{habit.emoji}</span>
        {isStreak && <span className="fire-badge">🔥</span>}
      </div>
      <div className="habit-info">
        <div className="habit-name">{habit.name}</div>
        <div className="habit-meta">
          {isDeleting ? (
            <span className="badge rest">Removing...</span>
          ) : isEditing ? (
            <span className="badge new">Saving changes...</span>
          ) : isSaving ? (
            <span className="badge streak">Syncing...</span>
          ) : isRestDay ? (
            <span className="badge rest">😴 Rest Day</span>
          ) : isCompleted ? (
            <span className="badge done">&#10003; Done</span>
          ) : habit.streak === 0 ? (
            <span className="badge new">&#9733; New</span>
          ) : habit.streak >= 3 ? (
            <span className="badge streak">🔥 {habit.streak} days</span>
          ) : null}
        </div>
      </div>
      <div className="habit-right">
        <div className="habit-duration">{habit.reminderTime ? `⏱ ${formatTime(habit.reminderTime)}` : '—'}</div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button className="edit-btn" onClick={() => onEdit(habit.id)} aria-label={`Edit ${habit.name}`} disabled={isBusy}>
            ✏️
          </button>
          <button
            className={`check-btn${isCompleted ? ' checked' : ''}`}
            disabled={isRestDay || isBusy}
            onClick={() => onToggle(habit.id)}
            aria-label={isCompleted ? `Undo ${habit.name}` : `Complete ${habit.name}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l4 4 6-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
