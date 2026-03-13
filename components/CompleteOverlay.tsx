"use client";

import Image from "next/image";
import { Habit } from "../lib/useHabits";
import { CloseIcon } from "./Icons";

const TIPS: Record<string, string[]> = {
  "\u{1F6B6}": ["Wear comfy shoes", "Bring water", "Try a new route"],
  "\u{1F4DA}": ["Set up a calm corner", "Put your phone away", "Read one page to begin"],
  "\u{1F4A7}": ["Keep a bottle nearby", "Add lemon for flavor", "Use reminders"],
  default: ["Stack this onto an existing routine", "Protect the streak tomorrow", "Enjoy the process"],
};

export function CompleteOverlay({
  data,
  onClose,
}: {
  data: { habit: Habit; xp: number; bonusMsg: string } | null;
  onClose: () => void;
}) {
  if (!data) return null;

  const { habit, xp, bonusMsg } = data;
  const tips = TIPS[habit.emoji] || TIPS.default;

  return (
    <div className="complete-overlay show">
      <button className="complete-close" onClick={onClose} aria-label="Close celebration">
        <CloseIcon className="close-icon" />
      </button>
      <div className="complete-title">{habit.name}</div>
      <div className="complete-hero">
        <div className="complete-good-job">Good job. Locked in.</div>
        <div className="complete-mascot">
          <Image
            src="/mascot/mascot_all_done_celebration.png"
            alt="Celebrating mascot"
            width={220}
            height={220}
            priority
          />
        </div>
      </div>
      <div className="complete-timer">+{xp} XP earned{bonusMsg}</div>
      <div className="tips-box">
        <div className="tips-title">Keep the rhythm</div>
        <div className="tip-item">{tips[0]}</div>
        <div className="tip-item">{tips[1]}</div>
        <div className="tip-item">{tips[2] || "Great work. Come back tomorrow."}</div>
      </div>
      <button className="complete-finish" onClick={onClose}>
        Back to today
      </button>
    </div>
  );
}
