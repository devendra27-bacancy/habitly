"use client";

import type { CompletionHistory, Habit, PlayerState } from "./useHabits";
import { ALL_DAYS, localDateStr, todayStr } from "./dates";

export type AchievementTrack =
  | "completion"
  | "perfect"
  | "streak"
  | "consistency"
  | "level"
  | "builder"
  | "special";

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  track: AchievementTrack;
  tier: number;
  icon: string;
  accent: "sage" | "sun" | "sky" | "rose";
  metricKey: AchievementMetricKey;
  threshold: number;
};

export type UnlockedAchievement = {
  id: string;
  unlockedAt: string;
};

export type AchievementState = {
  unlocked: Record<string, string>;
};

export type AchievementMetrics = {
  totalCompletions: number;
  perfectDays: number;
  activeDays: number;
  globalStreak: number;
  longestStreak: number;
  level: number;
  totalXp: number;
  habitsCreated: number;
  remindersEnabled: number;
};

export type AchievementMetricKey = keyof AchievementMetrics;

export type AchievementProgress = {
  definition: AchievementDefinition;
  current: number;
  target: number;
  progress: number;
  unlocked: boolean;
  unlockedAt?: string;
};

export type AchievementTrackGroup = {
  track: AchievementTrack;
  title: string;
  description: string;
  unlockedCount: number;
  totalCount: number;
  progress: number;
  items: AchievementProgress[];
};

export type AchievementSummary = {
  unlockedCount: number;
  totalCount: number;
  completionPercent: number;
  nextUp: AchievementProgress | null;
  recent: AchievementProgress[];
  groups: AchievementTrackGroup[];
};

type EvaluateAchievementOptions = {
  previous: AchievementState | undefined;
  player: PlayerState;
  habits: Habit[];
  completionHistory: CompletionHistory;
  remindersEnabled: boolean;
  now?: string;
};

const TRACK_COPY: Record<AchievementTrack, { title: string; description: string }> = {
  completion: {
    title: "Completions",
    description: "Milestones for total check-ins across every habit.",
  },
  perfect: {
    title: "Perfect Days",
    description: "Days where every scheduled habit got done.",
  },
  streak: {
    title: "Streaks",
    description: "Celebrate your current and longest global streak momentum.",
  },
  consistency: {
    title: "Consistency",
    description: "Rewarding how often you show up over time.",
  },
  level: {
    title: "Levels",
    description: "Cosmetic rewards for climbing your Habitly level ladder.",
  },
  builder: {
    title: "Builder",
    description: "Badges for growing the routines in your garden.",
  },
  special: {
    title: "Milestones",
    description: "A few special firsts you only unlock once.",
  },
};

export const EMPTY_ACHIEVEMENT_STATE: AchievementState = {
  unlocked: {},
};

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "completion_1",
    title: "First Check-In",
    description: "Complete 1 habit action.",
    track: "completion",
    tier: 1,
    icon: "Spark",
    accent: "sage",
    metricKey: "totalCompletions",
    threshold: 1,
  },
  {
    id: "completion_2",
    title: "Momentum Starter",
    description: "Reach 25 total habit completions.",
    track: "completion",
    tier: 2,
    icon: "Pulse",
    accent: "sage",
    metricKey: "totalCompletions",
    threshold: 25,
  },
  {
    id: "completion_3",
    title: "Rhythm Keeper",
    description: "Reach 100 total habit completions.",
    track: "completion",
    tier: 3,
    icon: "Flow",
    accent: "sage",
    metricKey: "totalCompletions",
    threshold: 100,
  },
  {
    id: "completion_4",
    title: "Check-In Legend",
    description: "Reach 250 total habit completions.",
    track: "completion",
    tier: 4,
    icon: "Peak",
    accent: "sage",
    metricKey: "totalCompletions",
    threshold: 250,
  },
  {
    id: "perfect_1",
    title: "Perfect Start",
    description: "Finish your first perfect day.",
    track: "perfect",
    tier: 1,
    icon: "Sun",
    accent: "sun",
    metricKey: "perfectDays",
    threshold: 1,
  },
  {
    id: "perfect_2",
    title: "Clean Run",
    description: "Finish 7 perfect days.",
    track: "perfect",
    tier: 2,
    icon: "Shine",
    accent: "sun",
    metricKey: "perfectDays",
    threshold: 7,
  },
  {
    id: "perfect_3",
    title: "Golden Week",
    description: "Finish 21 perfect days.",
    track: "perfect",
    tier: 3,
    icon: "Glow",
    accent: "sun",
    metricKey: "perfectDays",
    threshold: 21,
  },
  {
    id: "perfect_4",
    title: "Day Maker",
    description: "Finish 60 perfect days.",
    track: "perfect",
    tier: 4,
    icon: "Halo",
    accent: "sun",
    metricKey: "perfectDays",
    threshold: 60,
  },
  {
    id: "streak_1",
    title: "Hot Start",
    description: "Build a 3-day global streak.",
    track: "streak",
    tier: 1,
    icon: "Fire",
    accent: "rose",
    metricKey: "longestStreak",
    threshold: 3,
  },
  {
    id: "streak_2",
    title: "Steady Flame",
    description: "Build a 7-day global streak.",
    track: "streak",
    tier: 2,
    icon: "Flare",
    accent: "rose",
    metricKey: "longestStreak",
    threshold: 7,
  },
  {
    id: "streak_3",
    title: "Unbroken",
    description: "Build a 21-day global streak.",
    track: "streak",
    tier: 3,
    icon: "Inferno",
    accent: "rose",
    metricKey: "longestStreak",
    threshold: 21,
  },
  {
    id: "streak_4",
    title: "All-Time Heat",
    description: "Build a 60-day global streak.",
    track: "streak",
    tier: 4,
    icon: "Ember Crown",
    accent: "rose",
    metricKey: "longestStreak",
    threshold: 60,
  },
  {
    id: "consistency_1",
    title: "Present",
    description: "Show up on 3 active days.",
    track: "consistency",
    tier: 1,
    icon: "Leaf",
    accent: "sky",
    metricKey: "activeDays",
    threshold: 3,
  },
  {
    id: "consistency_2",
    title: "Rooted",
    description: "Show up on 14 active days.",
    track: "consistency",
    tier: 2,
    icon: "Stem",
    accent: "sky",
    metricKey: "activeDays",
    threshold: 14,
  },
  {
    id: "consistency_3",
    title: "Dependable",
    description: "Show up on 45 active days.",
    track: "consistency",
    tier: 3,
    icon: "Branch",
    accent: "sky",
    metricKey: "activeDays",
    threshold: 45,
  },
  {
    id: "consistency_4",
    title: "Always There",
    description: "Show up on 120 active days.",
    track: "consistency",
    tier: 4,
    icon: "Canopy",
    accent: "sky",
    metricKey: "activeDays",
    threshold: 120,
  },
  {
    id: "level_1",
    title: "Level Two",
    description: "Reach level 2.",
    track: "level",
    tier: 1,
    icon: "Rise",
    accent: "sage",
    metricKey: "level",
    threshold: 2,
  },
  {
    id: "level_2",
    title: "Level Five",
    description: "Reach level 5.",
    track: "level",
    tier: 2,
    icon: "Lift",
    accent: "sage",
    metricKey: "level",
    threshold: 5,
  },
  {
    id: "level_3",
    title: "Level Ten",
    description: "Reach level 10.",
    track: "level",
    tier: 3,
    icon: "Launch",
    accent: "sage",
    metricKey: "level",
    threshold: 10,
  },
  {
    id: "level_4",
    title: "Level Twenty",
    description: "Reach level 20.",
    track: "level",
    tier: 4,
    icon: "Summit",
    accent: "sage",
    metricKey: "level",
    threshold: 20,
  },
  {
    id: "builder_1",
    title: "Seed Planted",
    description: "Create your first habit.",
    track: "builder",
    tier: 1,
    icon: "Seed",
    accent: "sage",
    metricKey: "habitsCreated",
    threshold: 1,
  },
  {
    id: "builder_2",
    title: "Routine Builder",
    description: "Create 3 habits.",
    track: "builder",
    tier: 2,
    icon: "Pot",
    accent: "sage",
    metricKey: "habitsCreated",
    threshold: 3,
  },
  {
    id: "builder_3",
    title: "Garden Keeper",
    description: "Create 7 habits.",
    track: "builder",
    tier: 3,
    icon: "Garden",
    accent: "sage",
    metricKey: "habitsCreated",
    threshold: 7,
  },
  {
    id: "builder_4",
    title: "System Architect",
    description: "Create 12 habits.",
    track: "builder",
    tier: 4,
    icon: "Blueprint",
    accent: "sage",
    metricKey: "habitsCreated",
    threshold: 12,
  },
  {
    id: "special_first_habit",
    title: "Hello, Habitly",
    description: "Create your very first habit.",
    track: "special",
    tier: 1,
    icon: "Wave",
    accent: "sun",
    metricKey: "habitsCreated",
    threshold: 1,
  },
  {
    id: "special_first_completion",
    title: "First Tick",
    description: "Log your first completion.",
    track: "special",
    tier: 1,
    icon: "Tick",
    accent: "sky",
    metricKey: "totalCompletions",
    threshold: 1,
  },
  {
    id: "special_first_perfect_day",
    title: "Perfectly Done",
    description: "Finish your first perfect day.",
    track: "special",
    tier: 1,
    icon: "Burst",
    accent: "rose",
    metricKey: "perfectDays",
    threshold: 1,
  },
  {
    id: "special_reminders_on",
    title: "Always in Reach",
    description: "Turn on reminders for the first time.",
    track: "special",
    tier: 1,
    icon: "Bell",
    accent: "sky",
    metricKey: "remindersEnabled",
    threshold: 1,
  },
];

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function habitIsActiveOnDate(habit: Habit, dateKey: string) {
  const hasStarted = !habit.createdAt || habit.createdAt <= dateKey;
  const hasNotEnded = !habit.endDate || habit.endDate >= dateKey;
  return hasStarted && hasNotEnded;
}

function getScheduledHabitsForDate(habits: Habit[], dateKey: string) {
  const date = parseDateKey(dateKey);
  const dayOfWeek = date.getDay();

  return habits.filter((habit) => {
    const days = Array.isArray(habit.daysOfWeek) && habit.daysOfWeek.length > 0 ? habit.daysOfWeek : ALL_DAYS;
    return days.includes(dayOfWeek) && habitIsActiveOnDate(habit, dateKey);
  });
}

function isPerfectDay(habits: Habit[], history: CompletionHistory, dateKey: string) {
  const scheduled = getScheduledHabitsForDate(habits, dateKey);
  if (scheduled.length === 0) return false;

  const completed = new Set(history[dateKey] || []);
  return scheduled.every((habit) => completed.has(habit.id));
}

function countPerfectDays(habits: Habit[], history: CompletionHistory) {
  if (habits.length === 0) return 0;

  const createdAtDates = habits
    .map((habit) => habit.createdAt)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const earliestDateKey = createdAtDates.length > 0
    ? createdAtDates.reduce((earliest, value) => (value < earliest ? value : earliest))
    : todayStr();

  const startDate = parseDateKey(earliestDateKey);
  const endDate = parseDateKey(todayStr());
  let cursor = new Date(startDate);
  let perfectDays = 0;

  while (cursor <= endDate) {
    const dateKey = localDateStr(cursor);
    if (isPerfectDay(habits, history, dateKey)) {
      perfectDays += 1;
    }
    cursor = addDays(cursor, 1);
  }

  return perfectDays;
}

export function deriveAchievementMetrics({
  player,
  habits,
  completionHistory,
  remindersEnabled,
}: {
  player: PlayerState;
  habits: Habit[];
  completionHistory: CompletionHistory;
  remindersEnabled: boolean;
}): AchievementMetrics {
  return {
    totalCompletions: habits.reduce((sum, habit) => sum + habit.totalDone, 0),
    perfectDays: countPerfectDays(habits, completionHistory),
    activeDays: Object.values(completionHistory).filter((ids) => ids.length > 0).length,
    globalStreak: player.streak,
    longestStreak: player.longestStreak,
    level: player.level,
    totalXp: player.totalXp,
    habitsCreated: habits.length,
    remindersEnabled: remindersEnabled ? 1 : 0,
  };
}

export function evaluateAchievements({
  previous,
  player,
  habits,
  completionHistory,
  remindersEnabled,
  now,
}: EvaluateAchievementOptions) {
  const metrics = deriveAchievementMetrics({
    player,
    habits,
    completionHistory,
    remindersEnabled,
  });
  const previousUnlocked = previous?.unlocked ?? EMPTY_ACHIEVEMENT_STATE.unlocked;
  const nextUnlocked = { ...previousUnlocked };
  const unlockedAt = now ?? new Date().toISOString();
  const newlyUnlocked: UnlockedAchievement[] = [];

  ACHIEVEMENT_DEFINITIONS.forEach((definition) => {
    const current = metrics[definition.metricKey];
    const alreadyUnlocked = Boolean(previousUnlocked[definition.id]);
    if (alreadyUnlocked || current < definition.threshold) return;

    nextUnlocked[definition.id] = unlockedAt;
    newlyUnlocked.push({
      id: definition.id,
      unlockedAt,
    });
  });

  return {
    metrics,
    state: {
      unlocked: nextUnlocked,
    } satisfies AchievementState,
    newlyUnlocked,
  };
}

export function areAchievementStatesEqual(left: AchievementState | undefined, right: AchievementState | undefined) {
  const leftUnlocked = left?.unlocked ?? {};
  const rightUnlocked = right?.unlocked ?? {};
  const leftKeys = Object.keys(leftUnlocked);
  const rightKeys = Object.keys(rightUnlocked);

  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => leftUnlocked[key] === rightUnlocked[key]);
}

export function buildAchievementSummary({
  achievements,
  player,
  habits,
  completionHistory,
  remindersEnabled,
}: {
  achievements: AchievementState | undefined;
  player: PlayerState;
  habits: Habit[];
  completionHistory: CompletionHistory;
  remindersEnabled: boolean;
}): AchievementSummary {
  const unlocked = achievements?.unlocked ?? {};
  const metrics = deriveAchievementMetrics({
    player,
    habits,
    completionHistory,
    remindersEnabled,
  });

  const grouped = Object.entries(TRACK_COPY).map(([track, copy]) => {
    const items = ACHIEVEMENT_DEFINITIONS
      .filter((definition) => definition.track === track)
      .map((definition) => {
        const current = metrics[definition.metricKey];
        const unlockedAt = unlocked[definition.id];
        return {
          definition,
          current,
          target: definition.threshold,
          progress: Math.min(1, current / definition.threshold),
          unlocked: Boolean(unlockedAt),
          unlockedAt,
        } satisfies AchievementProgress;
      });

    const unlockedCount = items.filter((item) => item.unlocked).length;
    return {
      track: track as AchievementTrack,
      title: copy.title,
      description: copy.description,
      unlockedCount,
      totalCount: items.length,
      progress: items.length > 0 ? unlockedCount / items.length : 0,
      items,
    } satisfies AchievementTrackGroup;
  });

  const allItems = grouped.flatMap((group) => group.items);
  const unlockedCount = allItems.filter((item) => item.unlocked).length;
  const nextUp = allItems
    .filter((item) => !item.unlocked)
    .sort((a, b) => b.progress - a.progress || a.target - b.target)[0] ?? null;
  const recent = allItems
    .filter((item) => item.unlocked && item.unlockedAt)
    .sort((a, b) => (b.unlockedAt || "").localeCompare(a.unlockedAt || ""))
    .slice(0, 3);

  return {
    unlockedCount,
    totalCount: allItems.length,
    completionPercent: allItems.length > 0 ? Math.round((unlockedCount / allItems.length) * 100) : 0,
    nextUp,
    recent,
    groups: grouped,
  };
}

export function getAchievementDefinition(id: string) {
  return ACHIEVEMENT_DEFINITIONS.find((definition) => definition.id === id) ?? null;
}
