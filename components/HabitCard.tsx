"use client";

import { Habit, formatTime, isScheduledToday, todayStr } from "../lib/useHabits";

type HabitCardProps = {
  habit: Habit;
  index: number;
  onEdit: (id: string) => void;
  onToggle: (id: string) => void;
  isSaving?: boolean;
  isDeleting?: boolean;
  isEditing?: boolean;
  disabled?: boolean;
  isHighlighted?: boolean;
};

export function HabitCard({
  habit,
  index,
  onToggle,
  onEdit,
  isSaving = false,
  isDeleting = false,
  isEditing = false,
  disabled = false,
  isHighlighted = false,
}: HabitCardProps) {
  const today = todayStr();
  const isRestDay = !isScheduledToday(habit.daysOfWeek);
  const isCompleted = !isRestDay && habit.lastCompleted === today;
  const isStreak = habit.streak >= 7 && !isRestDay;
  const isBusy = isSaving || isDeleting || isEditing || disabled;

  return (
    <div
      className={`habit-card${isCompleted ? " done" : ""}${isStreak ? " streak-fire" : ""}${isRestDay ? " rest-day" : ""}${isBusy ? " pending" : ""}${isHighlighted ? " highlighted" : ""}`}
      style={{ animationDelay: `${index * 0.07}s` }}
    >
      <div className="habit-icon" style={{ background: `${habit.color}22` }}>
        <span>{habit.emoji}</span>
        {isStreak ? <span className="fire-badge">Hot</span> : null}
      </div>
      <div className="habit-info">
        <div className="habit-name">{habit.name}</div>
        <div className="habit-meta">
          {disabled ? (
            <span className="badge rest">Offline</span>
          ) : isDeleting ? (
            <span className="badge rest">Removing...</span>
          ) : isEditing ? (
            <span className="badge new">Saving changes...</span>
          ) : isSaving ? (
            <span className="badge streak">Syncing...</span>
          ) : isRestDay ? (
            <span className="badge rest">Rest day</span>
          ) : isCompleted ? (
            <span className="badge done">Done</span>
          ) : habit.streak === 0 ? (
            <span className="badge new">New</span>
          ) : habit.streak >= 3 ? (
            <span className="badge streak">{habit.streak} day streak</span>
          ) : null}
        </div>
      </div>
      <div className="habit-right">
        <div className="habit-duration">{habit.reminderTime ? `At ${formatTime(habit.reminderTime)}` : "-"}</div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button className="edit-btn" onClick={() => onEdit(habit.id)} aria-label={`Edit ${habit.name}`} disabled={isBusy}>
            Edit
          </button>
          <button
            className={`check-btn${isCompleted ? " checked" : ""}`}
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
