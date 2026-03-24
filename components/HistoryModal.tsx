"use client";

import Image from "next/image";
import { Habit, PlayerState } from "../lib/useHabits";
import { CloseIcon } from "./Icons";

export type HistoryEntry = {
  dateKey: string;
  date: string;
  label: string;
  done: Habit[];
  missed: Habit[];
  scheduled: Habit[];
  completedCount: number;
  missedCount: number;
  estimatedXp: number;
  isToday: boolean;
  isFuture: boolean;
};

type HistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  entry: HistoryEntry | null;
  player: PlayerState;
};

export function HistoryModal({ isOpen, onClose, entry, player }: HistoryModalProps) {
  if (!isOpen || !entry) return null;

  return (
    <div className="modal-overlay show" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal history-modal">
        <div className="modal-handle" />
        <div className="history-header">
          <div>
            <div className="modal-title">Your momentum</div>
            <div className="history-subtitle">
              {entry.isFuture
                ? "This day is coming up next. Here is what habitly has planned."
                : "A focused look at what got done, what was missed, and how the day moved your progress."}
            </div>
          </div>
          <button className="history-close" onClick={onClose} aria-label="Close history">
            <CloseIcon className="close-icon" />
          </button>
        </div>

        <div className="history-hero">
          <div className="history-hero-copy">
            <div className="history-hero-kicker">{entry.isFuture ? "Coming up" : "Selected day"}</div>
            <div className="history-hero-title">{entry.label}, {entry.date}</div>
          </div>
          <div className="history-hero-art">
            <Image
              src={entry.isFuture ? "/mascot/mascot_morning_start.png" : "/mascot/mascot_night_wrapup.png"}
              alt={entry.isFuture ? "Mascot previewing a future day" : "Mascot reflecting on progress"}
              width={180}
              height={180}
            />
          </div>
        </div>

        <div className="history-summary">
          <div className="history-summary-card">
            <div className="history-summary-emoji">{entry.isFuture ? "Plan" : "Done"}</div>
            <div className="history-summary-value">{entry.isFuture ? entry.scheduled.length : entry.completedCount}</div>
            <div className="history-summary-label">{entry.isFuture ? "Scheduled habits" : "Completed habits"}</div>
          </div>
          <div className="history-summary-card">
            <div className="history-summary-emoji">Lv</div>
            <div className="history-summary-value">{player.level}</div>
            <div className="history-summary-label">Current level</div>
          </div>
          <div className="history-summary-card">
            <div className="history-summary-emoji">{entry.isFuture ? "XP" : "Now"}</div>
            <div className="history-summary-value">{entry.isFuture ? `~${entry.scheduled.length * 10}` : `${entry.estimatedXp}`}</div>
            <div className="history-summary-label">{entry.isFuture ? "Potential XP" : "Earned XP"}</div>
          </div>
        </div>

        <div className="progression-card">
          <div className="progression-title">{entry.isFuture ? "What is scheduled" : "How XP works"}</div>
          <div className="progression-copy">
            {entry.isFuture
              ? "Future days stay read-only here. You can preview scheduled habits above, and once the day passes the strip becomes clickable with full done and missed details."
              : <>Each completed habit gives <strong>10 XP</strong>. When you finish every scheduled habit for the day, your global streak moves forward. Reaching a streak milestone at <strong>7, 14, 21, 30, 60,</strong> or <strong>100</strong> days adds an extra <strong>25 XP</strong>. Every <strong>100 XP</strong> levels you up.</>}
          </div>
        </div>

        {entry.scheduled.length === 0 ? (
          <div className="history-empty">Nothing was scheduled for this day.</div>
        ) : entry.isFuture ? (
          <div className="history-columns">
            <div className="history-column history-column-full">
              <div className="history-column-title">Scheduled</div>
              {entry.scheduled.map((habit) => (
                <div key={`${entry.dateKey}-${habit.id}-scheduled`} className="history-item info">
                  <span>{habit.emoji}</span>
                  <span>{habit.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="history-columns">
            <div className="history-column">
              <div className="history-column-title">Completed</div>
              {entry.done.length === 0 ? (
                <div className="history-empty small">No completions logged.</div>
              ) : (
                entry.done.map((habit) => (
                  <div key={`${entry.dateKey}-${habit.id}-done`} className="history-item success">
                    <span>{habit.emoji}</span>
                    <span>{habit.name}</span>
                  </div>
                ))
              )}
            </div>
            <div className="history-column">
              <div className="history-column-title">Missed</div>
              {entry.missed.length === 0 ? (
                <div className="history-empty small">Nothing missed.</div>
              ) : (
                entry.missed.map((habit) => (
                  <div key={`${entry.dateKey}-${habit.id}-missed`} className="history-item warning">
                    <span>{habit.emoji}</span>
                    <span>{habit.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
