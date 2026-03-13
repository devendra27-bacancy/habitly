"use client";

import { useEffect, useState } from "react";
import { PlayerState } from "../lib/useHabits";

type HeaderProps = {
  name: string;
  player: PlayerState;
  streak: number;
  syncStatus?: "idle" | "syncing" | "saved" | "error";
};

export function Header({ name, player, streak, syncStatus = "idle" }: HeaderProps) {
  const [dateStr, setDateStr] = useState("");
  const firstName = (name || "Friend").trim().split(/\s+/)[0] || "Friend";

  useEffect(() => {
    const date = new Date();
    setDateStr(date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
  }, []);

  return (
    <div className="header">
      <div>
        <div className="header-greeting">
          Hey, <span id="userName">{firstName}</span>!
        </div>
        <div className="header-date">{dateStr}</div>
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
      </div>
    </div>
  );
}
