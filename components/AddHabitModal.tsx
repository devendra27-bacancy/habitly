"use client";

import { useEffect, useState } from 'react';
import { Habit, ALL_DAYS, DAY_LABELS } from '../lib/useHabits';

const EMOJIS = ['🚶', '📖', '💧', '🏃', '🧘', '😴', '🥗', '💪', '🎯', '✍️', '🎨', '🎵', '🌿', '🧠', '🏊', '🚴', '🌅', '🍎', '☕', '🏋️', '📝', '🌸', '🧹', '🎮', '🤸', '🛁', '📱', '👟', '💊'];
const COLORS = ['#3d8b4e', '#4ecdc4', '#ff6b9d', '#ffd166', '#c084fc', '#ff9f43', '#45b7d1', '#96e6a1', '#f093fb', '#4facfe', '#f5576c', '#43e97b'];

type AddHabitModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string | null, updates: Partial<Habit>) => void;
  onDelete: (id: string) => void;
  editData: Habit | null;
  isSaving?: boolean;
  isDeleting?: boolean;
};

export function AddHabitModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editData,
  isSaving = false,
  isDeleting = false,
}: AddHabitModalProps) {
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [days, setDays] = useState<number[]>([...ALL_DAYS]);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setName(editData.name);
        setTime(editData.reminderTime || '');
        setDays([...(editData.daysOfWeek || ALL_DAYS)]);
        setEmoji(editData.emoji);
        setColor(editData.color);
      } else {
        setName('');
        setTime('');
        setDays([...ALL_DAYS]);
        setEmoji(EMOJIS[0]);
        setColor(COLORS[0]);
      }
      setError('');
    }
  }, [isOpen, editData]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const finalName = name.trim();

    if (!finalName) {
      setError('Give this habit a name so it can be saved.');
      return;
    }

    if (days.length === 0) {
      setError('Select at least one active day.');
      return;
    }

    setError('');
    onSave(editData ? editData.id : null, {
      name: finalName,
      reminderTime: time,
      daysOfWeek: [...days].sort((a, b) => a - b),
      emoji,
      color,
    });
  };

  const toggleDay = (dow: number) => {
    if (days.includes(dow)) {
      if (days.length === 1) return;
      setDays((current) => current.filter((item) => item !== dow));
    } else {
      setDays((current) => [...current, dow]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay show" onClick={(event) => { if (event.target === event.currentTarget && !isSaving && !isDeleting) onClose(); }}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-title">{editData ? 'Edit Habit ✏️' : 'New Habit ✨'}</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Habit Name</label>
            <input
              className={`form-input ${error ? 'input-error' : ''}`}
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
              <input
                type="time"
                className="form-input form-time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={isSaving || isDeleting}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Active Days</label>
            <div className="day-selector">
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
                <button
                  key={dow}
                  type="button"
                  className={`day-btn ${days.includes(dow) ? 'active' : ''}`}
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
                  className={`emoji-opt ${entry === emoji ? 'selected' : ''}`}
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
                  className={`color-opt ${entry === color ? 'selected' : ''}`}
                  style={{ background: entry }}
                  onClick={() => setColor(entry)}
                  disabled={isSaving || isDeleting}
                />
              ))}
            </div>
          </div>

          <button type="submit" className="modal-submit" disabled={isSaving || isDeleting}>
            {isDeleting ? 'Deleting...' : isSaving ? 'Saving...' : editData ? 'Save Changes ✓' : 'Add Habit 🌱'}
          </button>

          {editData && (
            <div className="delete-confirm" style={{ display: 'flex' }}>
              <button type="button" className="btn-del" onClick={() => onDelete(editData.id)} disabled={isSaving || isDeleting}>
                {isDeleting ? 'Deleting...' : '🗑 Delete'}
              </button>
              <button type="button" className="btn-cancel" onClick={onClose} disabled={isSaving || isDeleting}>
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
