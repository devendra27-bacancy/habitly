"use client";

import Image from "next/image";

export function LevelUpOverlay({ level, onClose }: { level: number | null; onClose: () => void }) {
  if (level === null) return null;

  return (
    <div className="levelup-overlay show" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="levelup-art">
        <Image
          src="/mascot/mascot_level_up.png"
          alt="Level up mascot"
          width={220}
          height={220}
          priority
        />
      </div>
      <div className="levelup-badge">Level {level}</div>
      <div className="levelup-text">You leveled up</div>
      <div className="levelup-sub">The next 100 XP starts now. Keep the streak moving.</div>
      <button className="levelup-close" onClick={onClose}>
        Keep climbing
      </button>
    </div>
  );
}
