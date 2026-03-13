"use client";

import { useEffect, useState } from "react";
import { Habit, ALL_DAYS, DAY_LABELS } from "../lib/useHabits";

const EMOJIS = [
  "🚶",
  "📖",
  "💧",
  "🏃",
  "🧘",
  "😴",
  "🥗",
  "💪",
  "🎯",
  "✍️",
  "🎨",
  "🎵",
  "🌿",
  "🧠",
  "🏊",
  "🚴",
  "🌅",
  "🍎",
  "☕",
  "🏋️",
  "📝",
  "🌸",
  "🧹",
  "🎮",
  "🤸",
  "🛁",
  "📱",
  "👟",
  "💊",
];

const COLORS = [
  "#3d8b4e",
  "#4ecdc4",
  "#ff6b9d",
  "#ffd166",
  "#c084fc",
  "#ff9f43",
  "#45b7d1",
  "#96e6a1",
  "#f093fb",
  "#4facfe",
  "#f5576c",
  "#43e97b",
];

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));
const PERIOD_OPTIONS = ["AM", "PM"] as const;
type PeriodOption = (typeof PERIOD_OPTIONS)[number];

type AddHabitModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string | null, updates: Partial<Habit>) => void;
  onDelete: (id: string) => void;
  editData: Habit | null;
  isSaving?: boolean;
  isDeleting?: boolean;
};

function parseTimeForPicker(time: string) {
  if (!time) {
    return { hour: "8", minute: "00", period: "AM" as PeriodOption };
  }

  const [rawHour, rawMinute] = time.split(":");
  const parsedHour = Number(rawHour);
  const parsedMinute = Number(rawMinute);

  if (!Number.isFinite(parsedHour) || !Number.isFinite(parsedMinute)) {
    return { hour: "8", minute: "00", period: "AM" as PeriodOption };
  }

  const period: PeriodOption = parsedHour >= 12 ? "PM" : "AM";
  const hour12 = parsedHour % 12 || 12;

  return {
    hour: String(hour12),
    minute: String(parsedMinute).padStart(2, "0"),
    period,
  };
}

function toTwentyFourHourTime(hour: string, minute: string, period: PeriodOption) {
  const parsedHour = Number(hour);
  if (!Number.isFinite(parsedHour)) {
    return "";
  }

  let hour24 = parsedHour % 12;
  if (period === "PM") {
    hour24 += 12;
  }

  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

export function AddHabitModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editData,
  isSaving = false,
  isDeleting = false,
}: AddHabitModalProps) {
  const [name, setName] = useState("");
  const [timeHour, setTimeHour] = useState("8");
  const [timeMinute, setTimeMinute] = useState("00");
  const [timePeriod, setTimePeriod] = useState<PeriodOption>("AM");
  const [days, setDays] = useState<number[]>([...ALL_DAYS]);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    if (editData) {
      const pickerTime = parseTimeForPicker(editData.reminderTime || "");
      setName(editData.name);
      setTimeHour(pickerTime.hour);
      setTimeMinute(MINUTE_OPTIONS.includes(pickerTime.minute) ? pickerTime.minute : "00");
      setTimePeriod(pickerTime.period);
      setDays([...(editData.daysOfWeek || ALL_DAYS)]);
      setEmoji(editData.emoji);
      setColor(editData.color);
    } else {
      setName("");
      setTimeHour("8");
      setTimeMinute("00");
      setTimePeriod("AM");
      setDays([...ALL_DAYS]);
      setEmoji(EMOJIS[0]);
      setColor(COLORS[0]);
    }

    setError("");
  }, [isOpen, editData]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const finalName = name.trim();

    if (!finalName) {
      setError("Give this habit a name so it can be saved.");
      return;
    }

    if (days.length === 0) {
      setError("Select at least one active day.");
      return;
    }

    setError("");
    onSave(editData ? editData.id : null, {
      name: finalName,
      reminderTime: toTwentyFourHourTime(timeHour, timeMinute, timePeriod),
      daysOfWeek: [...days].sort((a, b) => a - b),
      emoji,
      color,
    });
  };

  const toggleDay = (dow: number) => {
    if (days.includes(dow)) {
      if (days.length === 1) return;
      setDays((current) => current.filter((item) => item !== dow));
      return;
    }

    setDays((current) => [...current, dow]);
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay show"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving && !isDeleting) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-title">{editData ? "Edit Habit ✍️" : "New Habit ✨"}</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Habit Name</label>
            <input
              className={`form-input ${error ? "input-error" : ""}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Go for a walk"
              maxLength={40}
              disabled={isSaving || isDeleting}
            />
            {error ? <div className="form-error">{error}</div> : null}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Reminder Time</label>
              <div className="time-picker">
                <select
                  className="form-input form-time-select"
                  value={timeHour}
                  onChange={(event) => setTimeHour(event.target.value)}
                  disabled={isSaving || isDeleting}
                >
                  {HOUR_OPTIONS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
                <span className="time-picker-separator">:</span>
                <select
                  className="form-input form-time-select"
                  value={timeMinute}
                  onChange={(event) => setTimeMinute(event.target.value)}
                  disabled={isSaving || isDeleting}
                >
                  {MINUTE_OPTIONS.map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ))}
                </select>
                <select
                  className="form-input form-time-period"
                  value={timePeriod}
                  onChange={(event) => setTimePeriod(event.target.value as PeriodOption)}
                  disabled={isSaving || isDeleting}
                >
                  {PERIOD_OPTIONS.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Active Days</label>
            <div className="day-selector">
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
                <button
                  key={dow}
                  type="button"
                  className={`day-btn ${days.includes(dow) ? "active" : ""}`}
                  onClick={() => toggleDay(dow)}
                  disabled={isSaving || isDeleting}
                >
                  {DAY_LABELS[dow].slice(0, 2)}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Pick an Emoji</label>
            <div className="emoji-grid">
              {EMOJIS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className={`emoji-opt ${entry === emoji ? "selected" : ""}`}
                  onClick={() => setEmoji(entry)}
                  disabled={isSaving || isDeleting}
                >
                  {entry}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Color</label>
            <div className="color-grid">
              {COLORS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className={`color-opt ${entry === color ? "selected" : ""}`}
                  style={{ background: entry }}
                  onClick={() => setColor(entry)}
                  disabled={isSaving || isDeleting}
                  aria-label={`Choose ${entry} color`}
                />
              ))}
            </div>
          </div>

          <button type="submit" className="modal-submit" disabled={isSaving || isDeleting}>
            {isDeleting ? "Deleting..." : isSaving ? "Saving..." : editData ? "Save Changes ✓" : "Add Habit 🌱"}
          </button>

          {editData ? (
            <div className="delete-confirm" style={{ display: "flex" }}>
              <button
                type="button"
                className="btn-del"
                onClick={() => onDelete(editData.id)}
                disabled={isSaving || isDeleting}
              >
                {isDeleting ? "Deleting..." : "🗑 Delete"}
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={isSaving || isDeleting}
              >
                Cancel
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
