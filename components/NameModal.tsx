"use client";

import { useEffect, useState } from "react";

type NameModalProps = {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onSave: (name: string) => void;
};

export function NameModal({ isOpen, currentName, onClose, onSave }: NameModalProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) setName(currentName);
  }, [isOpen, currentName]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSave(name.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay show" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-title">What&apos;s your name? 😊</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input
              className="form-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="George"
              maxLength={20}
            />
          </div>
          <button type="submit" className="modal-submit">Save ✨</button>
        </form>
      </div>
    </div>
  );
}
