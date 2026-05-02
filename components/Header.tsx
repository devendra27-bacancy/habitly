"use client";

import { useRef } from "react";
import { PlayerState } from "../lib/useHabits";
import { CalendarIcon } from "./Icons";

type HeaderProps = {
  name: string;
  player: PlayerState;
  streak: number;
  weekLabel: string;
  pickerDateValue: string;
  showCurrentWeekButton: boolean;
  onPickerDateChange: (value: string) => void;
  onCurrentWeek: () => void;
  syncStatus?: "idle" | "syncing" | "saved" | "error";
};

export function Header({
  name,
  player,
  streak,
  weekLabel,
  pickerDateValue,
  showCurrentWeekButton,
  onPickerDateChange,
  onCurrentWeek,
  syncStatus = "idle",
}: HeaderProps) {
  const pickerInputRef = useRef<HTMLInputElement | null>(null);
  const firstName = (name || "Friend").trim().split(/\s+/)[0] || "Friend";

  const openDatePicker = () => {
    const input = pickerInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <div className="header">
      <div className="header-greeting">
        Hey, <span id="userName">{firstName}</span>!
      </div>
      <div className="header-meta">
        <div className="header-meta-copy">
          <div className="header-date-row">
            <div className="header-date">{weekLabel}</div>
            {!showCurrentWeekButton ? (
              <div className="header-picker-wrap">
                <input
                  ref={pickerInputRef}
                  type="date"
                  className="header-picker-input"
                  value={pickerDateValue}
                  onChange={(event) => onPickerDateChange(event.target.value)}
                  aria-label="Choose date"
                  tabIndex={-1}
                />
                <button type="button" className="header-picker-btn" onClick={openDatePicker} aria-label="Choose date">
                  <CalendarIcon className="toolbar-icon" />
                </button>
              </div>
            ) : null}
          </div>
          {syncStatus !== "idle" ? (
            <div className={`header-sync header-sync-${syncStatus}`}>
              {syncStatus === "syncing"
                ? "Syncing changes..."
                : syncStatus === "saved"
                  ? "All changes saved"
                  : "Sync needs attention"}
            </div>
          ) : null}
        </div>
        <div className="header-chips">
          <div className="xp-pill">
            <span className="lvl">Lv.{player.level}</span>
            <span>{player.xp} XP</span>
          </div>
          <div className="streak-pill">
            <span className="streak-pill-label">Streak</span>
            <span>{streak}</span>
          </div>
          {showCurrentWeekButton ? (
            <button type="button" className="header-current-btn" onClick={onCurrentWeek}>
              Current
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
