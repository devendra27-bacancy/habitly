"use client";

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
};

export function WeekStrip({ days, selectedDateKey, onSelectDate }: WeekStripProps) {
  return (
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
  );
}
