"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AppErrorState, Habit, SyncStatus, isScheduledToday, todayStr } from "../lib/useHabits";

type MascotMood =
  | "empty"
  | "rest"
  | "error"
  | "syncing"
  | "celebration"
  | "streak"
  | "progress"
  | "morning"
  | "idle";

const MASCOT_ART: Record<MascotMood, { src: string; accent: string; eyebrow: string }> = {
  empty: {
    src: "/mascot/mascot_empty_state_helper.png",
    accent: "mint",
    eyebrow: "Ready to plant something new?",
  },
  rest: {
    src: "/mascot/mascot_rest_day_chill.png",
    accent: "sky",
    eyebrow: "A softer day is still part of the journey.",
  },
  error: {
    src: "/mascot/mascot_error_reassuring.png",
    accent: "rose",
    eyebrow: "A small hiccup. Your progress is still safe.",
  },
  syncing: {
    src: "/mascot/mascot_syncing_working.png",
    accent: "sage",
    eyebrow: "Saving your momentum now.",
  },
  celebration: {
    src: "/mascot/mascot_all_done_celebration.png",
    accent: "sun",
    eyebrow: "Today is officially complete.",
  },
  streak: {
    src: "/mascot/mascot_streak_fire.png",
    accent: "sun",
    eyebrow: "Your streak energy is showing.",
  },
  progress: {
    src: "/mascot/mascot_progress_good.png",
    accent: "mint",
    eyebrow: "You are already in motion.",
  },
  morning: {
    src: "/mascot/mascot_morning_start.png",
    accent: "sage",
    eyebrow: "A fresh start is waiting for you.",
  },
  idle: {
    src: "/mascot/mascot_idle_default.png",
    accent: "cream",
    eyebrow: "Tiny actions. Quiet momentum.",
  },
};

type MascotAreaProps = {
  habits: Habit[];
  globalStreak: number;
  syncStatus?: SyncStatus;
  errorState?: AppErrorState | null;
};

export function MascotArea({ habits, globalStreak, syncStatus = "idle", errorState = null }: MascotAreaProps) {
  const [tip, setTip] = useState("");
  const [mood, setMood] = useState<MascotMood>("idle");

  useEffect(() => {
    const today = todayStr();
    const scheduled = habits.filter((habit) => isScheduledToday(habit.daysOfWeek));
    const done = scheduled.filter((habit) => habit.lastCompleted === today).length;
    const total = scheduled.length;
    const hasMissedToday = scheduled.some(
      (habit) => habit.lastCompleted !== today && habit.totalDone > 0,
    );

    if (errorState) {
      setMood("error");
      setTip("We hit a sync issue. Give it a second or retry and we will steady things.");
      return;
    }

    if (syncStatus === "syncing") {
      setMood("syncing");
      setTip("Your latest changes are being saved now.");
      return;
    }

    if (habits.length === 0) {
      setMood("empty");
      setTip("Start with one habit that feels easy to repeat. The first win changes the whole board.");
      return;
    }

    if (total === 0) {
      setMood("rest");
      setTip("Nothing is scheduled today. Enjoy the breathing room or add a habit if you want more rhythm.");
      return;
    }

    if (done === total && total > 0) {
      setMood("celebration");
      setTip("Everything scheduled for today is done. That is how levels move.");
      return;
    }

    if (globalStreak >= 7) {
      setMood("streak");
      setTip(`Your global streak is ${globalStreak} days. Finish every scheduled habit today to keep the chain alive.`);
      return;
    }

    if (done > 0) {
      setMood("progress");
      setTip(`${done} of ${total} habits are already checked off today. Keep the pace and finish strong.`);
      return;
    }

    if (hasMissedToday) {
      setMood("idle");
      setTip("If today slipped a little, that is okay. Restarting quickly matters more than being perfect.");
      return;
    }

    setMood("morning");
    setTip("Start with the easiest win. Momentum always feels bigger after the first checkmark.");
  }, [errorState, globalStreak, habits, syncStatus]);

  const art = MASCOT_ART[mood];

  return (
    <div className={`mascot-area mascot-area-${art.accent}`}>
      <div className="mascot-art-shell">
        <Image
          className="mascot-image"
          src={art.src}
          alt="habitly mascot"
          width={280}
          height={280}
          priority
        />
      </div>
      <div className="mascot-copy">
        <div className="mascot-kicker">Moe&apos;s take</div>
        <div className="mascot-tip">{tip}</div>
      </div>
    </div>
  );
}
