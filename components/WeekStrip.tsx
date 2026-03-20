"use client";

import { useRef } from "react";
import { CalendarIcon } from "./Icons";

type StripDay = {
  label: string;
  num: number;
  hasDots: boolean;
  isToday: boolean;
  isFuture: boolean;
  dateKey: string;
};

type WeekStripProps = {
  days: StripDay[];
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
  weekLabel: string;
  weekValue: string;
  showCurrentWeekButton: boolean;
  onWeekChange: (value: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
};

export function WeekStrip({
  days,
  selectedDateKey,
  onSelectDate,
  weekLabel,
  weekValue,
  showCurrentWeekButton,
  onWeekChange,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
}: WeekStripProps) {
  const weekInputRef = useRef<HTMLInputElement | null>(null);

  const openWeekPicker = () => {
    const input = weekInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <div className="week-strip-wrap">
      <div className="week-toolbar">
        <div className="week-toolbar-copy">
          <div className="week-toolbar-label">{weekLabel}</div>
        </div>
        <div className="week-toolbar-actions">
          <button type="button" className="week-nav-btn" onClick={onPreviousWeek} aria-label="Previous week">
            ←
          </button>
          <div className="week-picker-trigger">
            <input
              ref={weekInputRef}
              type="week"
              className="week-input-hidden"
              value={weekValue}
              onChange={(event) => onWeekChange(event.target.value)}
              aria-label="Choose week"
              tabIndex={-1}
            />
            <button type="button" className="week-nav-btn week-picker-btn" onClick={openWeekPicker} aria-label="Choose week">
              <CalendarIcon className="toolbar-icon" />
            </button>
          </div>
          <button type="button" className="week-nav-btn" onClick={onNextWeek} aria-label="Next week">
            →
          </button>
          {showCurrentWeekButton ? (
            <button type="button" className="week-today-btn" onClick={onCurrentWeek}>
              Current
            </button>
          ) : null}
        </div>
      </div>

      <div className="week-strip">
        {days.map((day) => {
          const isSelected = day.dateKey === selectedDateKey;

          return (
            <button
              key={day.dateKey}
              type="button"
              className={`day-pill ${day.isToday ? "active" : ""} ${day.hasDots ? "has-dot" : ""} ${isSelected ? "selected" : ""} ${day.isFuture ? "future" : ""}`}
              onClick={() => onSelectDate(day.dateKey)}
              aria-pressed={isSelected}
            >
              <span className="day-name">{day.label}</span>
              <span className="day-num">{day.num}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
