"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '../components/AuthProvider';
import { showToast } from '../components/ToastContainer';
import { db } from './firebase';
import { ALL_DAYS, isScheduledToday, localDateStr, todayStr } from './dates';
import {
  areAchievementStatesEqual,
  EMPTY_ACHIEVEMENT_STATE,
  evaluateAchievements,
  getAchievementDefinition,
  type AchievementState,
  type UnlockedAchievement,
} from './achievements';

export { todayStr, lastScheduledDayBefore, isScheduledToday, ALL_DAYS, DAY_LABELS, formatTime, localDateStr } from './dates';

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  daysOfWeek: number[];
  reminderTime: string;
  streak: number;
  longestStreak: number;
  totalDone: number;
  lastCompleted: string | null;
  createdAt: string;
  endDate?: string | null;
};

export type PlayerState = {
  xp: number;
  totalXp: number;
  level: number;
  streak: number;
  longestStreak: number;
};

export type CompletionHistory = Record<string, string[]>;

export type AppState = {
  uid: string | null;
  name: string;
  email?: string;
  photoURL?: string;
  remindersEnabled: boolean;
  player: PlayerState;
  habits: Habit[];
  completionHistory: CompletionHistory;
  achievements: AchievementState;
};

export type BootStatus = 'loading' | 'ready' | 'error';
export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error';
export type ErrorScope = 'bootstrap' | 'profile' | 'habits' | 'mutation' | 'migration';

export type AppErrorState = {
  scope: ErrorScope;
  message: string;
  retryAction?: string;
};

type PendingMutationState = {
  adding: boolean;
  editingIds: string[];
  deletingIds: string[];
  togglingIds: string[];
  naming: boolean;
};

type LegacyHabit = {
  id?: string | number;
  name?: string;
  emoji?: string;
  color?: string;
  daysOfWeek?: number[];
  reminderTime?: string;
  streak?: number;
  longestStreak?: number;
  totalDone?: number;
  lastCompleted?: string | null;
  createdAt?: string;
  endDate?: string | null;
};

type LegacyAppState = {
  name?: string;
  player?: Partial<PlayerState>;
  habits?: LegacyHabit[];
  completionHistory?: Record<string, Array<string | number>>;
};

type MigrationPreview = {
  name: string;
  player: PlayerState;
  habits: Habit[];
  completionHistory: CompletionHistory;
};

type CompletionOverlayData = {
  habit: Habit;
  xp: number;
  bonusMsg: string;
};

type AchievementOverlayData = {
  achievementId: string;
  remainingCount: number;
};

type ProfileDoc = {
  name?: string;
  email?: string;
  photoURL?: string;
  player?: PlayerState;
  completionHistory?: CompletionHistory;
  achievements?: AchievementState;
  notificationSettings?: {
    enabled?: boolean;
  };
};

const XP_PER_COMPLETION = 10;
const XP_STREAK_BONUS = 25;
const XP_PER_LEVEL = 100;
const STREAK_MILESTONES = [7, 14, 21, 30, 60, 100];
const LEGACY_STORAGE_KEY = 'habitflow_v3_next';
const MIGRATION_DECISION_PREFIX = 'habitflow_migration_seen_';
const ACCOUNT_DELETION_PREFIX = 'habitflow_account_deleting_';
const SAVE_FEEDBACK_DELAY_MS = 1400;

const defaultPlayerState: PlayerState = { xp: 0, totalXp: 0, level: 1, streak: 0, longestStreak: 0 };

const defaultState: AppState = {
  uid: null,
  name: 'Friend',
  email: undefined,
  photoURL: undefined,
  remindersEnabled: false,
  player: defaultPlayerState,
  habits: [],
  completionHistory: {},
  achievements: EMPTY_ACHIEVEMENT_STATE,
};

const defaultPendingMutations: PendingMutationState = {
  adding: false,
  editingIds: [],
  deletingIds: [],
  togglingIds: [],
  naming: false,
};

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        return 'habitly cannot access your cloud data right now. Check your project permissions and make sure you are signed in to the right account.';
      case 'unavailable':
        return 'The sync service is temporarily unavailable. Check your connection and try again.';
      case 'failed-precondition':
        return 'Your data service is missing a required setup step. Finish the project setup and retry.';
      default:
        return error.message || fallback;
    }
  }

  return error instanceof Error ? error.message : fallback;
}

function buildErrorState(scope: ErrorScope, error: unknown, fallback: string, retryAction?: string): AppErrorState {
  return {
    scope,
    message: extractErrorMessage(error, fallback),
    retryAction,
  };
}

function deriveNameFromAuth(user: User): string {
  if (typeof user.displayName === 'string' && user.displayName.trim()) {
    return user.displayName.trim();
  }

  if (typeof user.email === 'string' && user.email.includes('@')) {
    const localPart = user.email.split('@')[0].trim();
    if (localPart) {
      return localPart
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
    }
  }

  return 'Friend';
}

function sanitizeHabit(legacyHabit: LegacyHabit, index: number): Habit | null {
  if (!legacyHabit.name || typeof legacyHabit.name !== 'string') {
    return null;
  }

  const daysOfWeek = Array.isArray(legacyHabit.daysOfWeek)
    ? legacyHabit.daysOfWeek.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
    : ALL_DAYS;

  return {
    id: String(legacyHabit.id ?? `legacy-${index}`),
    name: legacyHabit.name,
    emoji: typeof legacyHabit.emoji === 'string' && legacyHabit.emoji ? legacyHabit.emoji : '🌿',
    color: typeof legacyHabit.color === 'string' && legacyHabit.color ? legacyHabit.color : '#5f8e59',
    daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : ALL_DAYS,
    reminderTime: typeof legacyHabit.reminderTime === 'string' ? legacyHabit.reminderTime : '',
    streak: typeof legacyHabit.streak === 'number' ? legacyHabit.streak : 0,
    longestStreak: typeof legacyHabit.longestStreak === 'number' ? legacyHabit.longestStreak : 0,
    totalDone: typeof legacyHabit.totalDone === 'number' ? legacyHabit.totalDone : 0,
    lastCompleted: typeof legacyHabit.lastCompleted === 'string' ? legacyHabit.lastCompleted : null,
    createdAt: typeof legacyHabit.createdAt === 'string' ? legacyHabit.createdAt : todayStr(),
    endDate: typeof legacyHabit.endDate === 'string' && legacyHabit.endDate ? legacyHabit.endDate : null,
  };
}

function parseLegacyState(): MigrationPreview | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as LegacyAppState;
    const habits = Array.isArray(parsed.habits)
      ? parsed.habits.map(sanitizeHabit).filter((habit): habit is Habit => habit !== null)
      : [];

    if (habits.length === 0) return null;

    const player = parsed.player ?? {};
    const rawHistory = parsed.completionHistory ?? {};

    return {
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : defaultState.name,
      player: {
        xp: typeof player.xp === 'number' ? player.xp : defaultPlayerState.xp,
        totalXp: typeof player.totalXp === 'number' ? player.totalXp : defaultPlayerState.totalXp,
        level: typeof player.level === 'number' ? player.level : defaultPlayerState.level,
        streak: typeof player.streak === 'number' ? player.streak : defaultPlayerState.streak,
        longestStreak: typeof player.longestStreak === 'number' ? player.longestStreak : defaultPlayerState.longestStreak,
      },
      habits,
      completionHistory: Object.fromEntries(
        Object.entries(rawHistory).map(([date, ids]) => [
          date,
          Array.isArray(ids) ? ids.map((id) => String(id)) : [],
        ]),
      ),
    };
  } catch (error) {
    console.error('Could not parse local habitly data:', error);
    return null;
  }
}

function removeId(list: string[], id: string) {
  return list.filter((item) => item !== id);
}

function addId(list: string[], id: string) {
  return list.includes(id) ? list : [...list, id];
}

function stripHabitFromCompletionHistory(history: CompletionHistory, habitId: string): CompletionHistory {
  return Object.fromEntries(
    Object.entries(history)
      .map(([date, ids]) => [date, ids.filter((id) => id !== habitId)] as const)
      .filter(([, ids]) => ids.length > 0),
  );
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getScheduledHabitsForDate(habits: Habit[], dateKey: string): Habit[] {
  const date = parseDateKey(dateKey);
  const dayOfWeek = date.getDay();

  return habits.filter((habit) => {
    const days = Array.isArray(habit.daysOfWeek) && habit.daysOfWeek.length > 0 ? habit.daysOfWeek : ALL_DAYS;
    const hasStarted = !habit.createdAt || habit.createdAt <= dateKey;
    const hasNotEnded = !habit.endDate || habit.endDate >= dateKey;
    return days.includes(dayOfWeek) && hasStarted && hasNotEnded;
  });
}

function isDayFullyCompleted(habits: Habit[], history: CompletionHistory, dateKey: string): boolean {
  const scheduled = getScheduledHabitsForDate(habits, dateKey);
  if (scheduled.length === 0) {
    return false;
  }

  const completedIds = new Set(history[dateKey] || []);
  return scheduled.every((habit) => completedIds.has(habit.id));
}

function getGlobalStreakStats(habits: Habit[], history: CompletionHistory) {
  if (habits.length === 0) {
    return { streak: 0, longestStreak: 0 };
  }

  const createdAtDates = habits
    .map((habit) => habit.createdAt)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const earliestDateKey = createdAtDates.length > 0
    ? createdAtDates.reduce((earliest, value) => (value < earliest ? value : earliest))
    : todayStr();

  const startDate = parseDateKey(earliestDateKey);
  const todayDate = parseDateKey(todayStr());
  let cursor = new Date(startDate);
  let running = 0;
  let longestStreak = 0;

  while (cursor <= todayDate) {
    const dateKey = localDateStr(cursor);
    const scheduled = getScheduledHabitsForDate(habits, dateKey);

    if (scheduled.length > 0) {
      if (isDayFullyCompleted(habits, history, dateKey)) {
        running += 1;
        longestStreak = Math.max(longestStreak, running);
      } else {
        running = 0;
      }
    }

    cursor = addDays(cursor, 1);
  }

  let streak = 0;
  cursor = parseDateKey(todayStr());

  while (cursor >= startDate) {
    const dateKey = localDateStr(cursor);
    const scheduled = getScheduledHabitsForDate(habits, dateKey);

    if (scheduled.length === 0) {
      cursor = addDays(cursor, -1);
      continue;
    }

    if (!isDayFullyCompleted(habits, history, dateKey)) {
      break;
    }

    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return { streak, longestStreak };
}

function derivePlayerState(player: PlayerState | undefined, habits: Habit[], history: CompletionHistory): PlayerState {
  const basePlayer = player ?? defaultPlayerState;
  const streakStats = getGlobalStreakStats(habits, history);

  return {
    ...basePlayer,
    streak: streakStats.streak,
    longestStreak: streakStats.longestStreak,
  };
}

export function useHabits() {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>(defaultState);
  const [bootStatus, setBootStatus] = useState<BootStatus>('loading');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [errorState, setErrorState] = useState<AppErrorState | null>(null);
  const [pendingMutations, setPendingMutations] = useState<PendingMutationState>(defaultPendingMutations);
  const [bootstrapVersion, setBootstrapVersion] = useState(0);
  const [migrationPreview, setMigrationPreview] = useState<MigrationPreview | null>(null);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [triggerConfetti, setTriggerConfetti] = useState(0);
  const [completeOverlayData, setCompleteOverlayData] = useState<CompletionOverlayData | null>(null);
  const [levelUpData, setLevelUpData] = useState<number | null>(null);
  const [achievementOverlayData, setAchievementOverlayData] = useState<AchievementOverlayData | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const achievementHydratedRef = useRef(false);
  const profileSnapshotHydratedRef = useRef(false);
  const habitsSnapshotHydratedRef = useRef(false);
  const latestStateRef = useRef<AppState>(defaultState);

  const queueAchievementOverlay = useCallback((unlocks: UnlockedAchievement[]) => {
    if (unlocks.length === 0) return;

    setAchievementOverlayData((current) => {
      if (current) return current;

      return {
        achievementId: unlocks[0].id,
        remainingCount: Math.max(0, unlocks.length - 1),
      };
    });
  }, []);

  const markSaved = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSyncStatus('saved');
    saveTimerRef.current = window.setTimeout(() => {
      setSyncStatus('idle');
    }, SAVE_FEEDBACK_DELAY_MS);
  }, []);

  const beginSync = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSyncStatus('syncing');
    setErrorState((current) => (current?.scope === 'mutation' ? null : current));
  }, []);

  const endSyncWithError = useCallback((error: unknown, fallback: string) => {
    setSyncStatus('error');
    setErrorState(buildErrorState('mutation', error, fallback, 'Try again'));
  }, []);

  const retryBootstrap = useCallback(() => {
    setErrorState(null);
    setBootStatus('loading');
    setBootstrapVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setState(defaultState);
      setBootStatus('loading');
      setSyncStatus('idle');
      setErrorState(null);
      setPendingMutations(defaultPendingMutations);
      setMigrationPreview(null);
      setMigrationOpen(false);
      setMigrationError(null);
      setAchievementOverlayData(null);
      achievementHydratedRef.current = false;
      profileSnapshotHydratedRef.current = false;
      habitsSnapshotHydratedRef.current = false;
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const habitsColRef = collection(db, 'users', user.uid, 'habits');
    const migrationDecisionKey = `${MIGRATION_DECISION_PREFIX}${user.uid}`;
    const accountDeletionKey = `${ACCOUNT_DELETION_PREFIX}${user.uid}`;
    const isDeletionInProgress = () =>
      typeof window !== 'undefined' && window.sessionStorage.getItem(accountDeletionKey) === '1';

    setBootStatus('loading');
    setErrorState(null);
    setState((prev) => ({
      ...prev,
      uid: user.uid,
      email: user.email ?? prev.email,
      photoURL: user.photoURL ?? prev.photoURL,
      name: prev.name === 'Friend' ? deriveNameFromAuth(user) : prev.name,
    }));

    const bootstrapProfile = async () => {
      const profileName = deriveNameFromAuth(user);
      await setDoc(
        userDocRef,
        {
          name: profileName,
          email: user.email ?? '',
          photoURL: user.photoURL ?? '',
          player: defaultPlayerState,
          completionHistory: {},
          achievements: EMPTY_ACHIEVEMENT_STATE,
        },
        { merge: true },
      );
    };

    const unsubUser = onSnapshot(
      userDocRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          if (isDeletionInProgress()) {
            return;
          }
          try {
            await bootstrapProfile();
          } catch (error) {
            console.error('Profile document missing and could not be created:', error);
            setBootStatus('error');
            setErrorState(buildErrorState('bootstrap', error, 'Could not create your habitly profile.', 'Retry loading'));
          }
          return;
        }

        const data = snapshot.data() as ProfileDoc;
        const resolvedName = typeof data.name === 'string' && data.name.trim()
          ? data.name
          : deriveNameFromAuth(user);
        const resolvedHistory = data.completionHistory ?? {};
        const remindersEnabled = Boolean(data.notificationSettings?.enabled);

        if ((!data.name || !data.name.trim()) && !isDeletionInProgress()) {
          void setDoc(
            userDocRef,
            {
              name: resolvedName,
              email: user.email ?? data.email ?? '',
              photoURL: user.photoURL ?? data.photoURL ?? '',
            },
            { merge: true },
          ).catch(console.error);
        }

        let shouldCelebrateAchievements = false;
        let newlyUnlockedAchievements: UnlockedAchievement[] = [];
        setState((prev) => {
          const nextPlayer = derivePlayerState((data.player as PlayerState | undefined) ?? prev.player, prev.habits, resolvedHistory);
          const achievementResult = evaluateAchievements({
            previous: data.achievements ?? prev.achievements,
            player: nextPlayer,
            habits: prev.habits,
            completionHistory: resolvedHistory,
            remindersEnabled,
          });

          shouldCelebrateAchievements = achievementHydratedRef.current;
          newlyUnlockedAchievements = achievementResult.newlyUnlocked;

          return {
            ...prev,
            uid: user.uid,
            name: resolvedName,
            email: user.email ?? data.email ?? prev.email,
            photoURL: user.photoURL ?? data.photoURL ?? prev.photoURL,
            remindersEnabled,
            player: nextPlayer,
            completionHistory: resolvedHistory,
            achievements: achievementResult.state,
          };
        });

        const latestState = latestStateRef.current;
        if (!areAchievementStatesEqual(data.achievements, evaluateAchievements({
          previous: data.achievements,
          player: derivePlayerState((data.player as PlayerState | undefined) ?? latestState.player, latestState.habits, resolvedHistory),
          habits: latestState.habits,
          completionHistory: resolvedHistory,
          remindersEnabled,
        }).state) && !isDeletionInProgress()) {
          const nextPlayer = derivePlayerState((data.player as PlayerState | undefined) ?? latestState.player, latestState.habits, resolvedHistory);
          const nextAchievementResult = evaluateAchievements({
            previous: data.achievements,
            player: nextPlayer,
            habits: latestState.habits,
            completionHistory: resolvedHistory,
            remindersEnabled,
          });

          void setDoc(userDocRef, { achievements: nextAchievementResult.state }, { merge: true }).catch(console.error);
        }

        profileSnapshotHydratedRef.current = true;
        if (!achievementHydratedRef.current && profileSnapshotHydratedRef.current && habitsSnapshotHydratedRef.current) {
          achievementHydratedRef.current = true;
        } else if (shouldCelebrateAchievements) {
          queueAchievementOverlay(newlyUnlockedAchievements);
        }

        setBootStatus('ready');
        setErrorState((current) => (current?.scope === 'bootstrap' || current?.scope === 'profile' ? null : current));
      },
      (error) => {
        console.error('User profile sync error:', error);
        setBootStatus('error');
        setErrorState(buildErrorState('profile', error, 'Could not sync your profile right now.', 'Retry loading'));
      },
    );

    const habitsQuery = query(habitsColRef, orderBy('createdAt', 'desc'));
    const unsubHabits = onSnapshot(
      habitsQuery,
      async (snapshot) => {
        const habits = snapshot.docs.map((habitDoc) => ({ id: habitDoc.id, ...habitDoc.data() }) as Habit);
        const latestState = latestStateRef.current;
        const nextPlayerFromSnapshot = derivePlayerState(latestState.player, habits, latestState.completionHistory);
        const nextAchievementResult = evaluateAchievements({
          previous: latestState.achievements,
          player: nextPlayerFromSnapshot,
          habits,
          completionHistory: latestState.completionHistory,
          remindersEnabled: latestState.remindersEnabled,
        });
        let shouldCelebrateAchievements = false;
        let newlyUnlockedAchievements: UnlockedAchievement[] = [];
        setState((prev) => {
          const nextPlayer = derivePlayerState(prev.player, habits, prev.completionHistory);
          const achievementResult = evaluateAchievements({
            previous: prev.achievements,
            player: nextPlayer,
            habits,
            completionHistory: prev.completionHistory,
            remindersEnabled: prev.remindersEnabled,
          });
          shouldCelebrateAchievements = achievementHydratedRef.current;
          newlyUnlockedAchievements = achievementResult.newlyUnlocked;

          return {
            ...prev,
            habits,
            player: nextPlayer,
            achievements: achievementResult.state,
          };
        });
        setBootStatus('ready');
        setErrorState((current) => (current?.scope === 'habits' ? null : current));
        if (!areAchievementStatesEqual(latestState.achievements, nextAchievementResult.state) && !isDeletionInProgress()) {
          void setDoc(userDocRef, { achievements: nextAchievementResult.state }, { merge: true }).catch(console.error);
        }
        habitsSnapshotHydratedRef.current = true;
        if (!achievementHydratedRef.current && profileSnapshotHydratedRef.current && habitsSnapshotHydratedRef.current) {
          achievementHydratedRef.current = true;
        } else if (shouldCelebrateAchievements) {
          queueAchievementOverlay(newlyUnlockedAchievements);
        }

        if (!snapshot.empty || typeof window === 'undefined') {
          return;
        }

        const alreadyDecidedMigration = window.localStorage.getItem(migrationDecisionKey) === '1';
        const legacyState = parseLegacyState();

        if (!alreadyDecidedMigration && legacyState) {
          setMigrationPreview(legacyState);
          setMigrationOpen(true);
          return;
        }

        try {
          await getDocs(query(habitsColRef, limit(1)));
        } catch (error) {
          console.error('Failed to check existing habits:', error);
        }
      },
      (error) => {
        console.error('Habits sync error:', error);
        setBootStatus('error');
        setErrorState(buildErrorState('habits', error, 'Could not sync your habits right now.', 'Retry loading'));
      },
    );

    return () => {
      unsubUser();
      unsubHabits();
    };
  }, [user, bootstrapVersion]);

  const updatePending = useCallback((updater: (current: PendingMutationState) => PendingMutationState) => {
    setPendingMutations((current) => updater(current));
  }, []);

  const updateName = async (name: string) => {
    if (!user) return false;

    const trimmedName = name.trim();
    if (!trimmedName) return false;

    const previousName = state.name;
    beginSync();
    updatePending((current) => ({ ...current, naming: true }));
    setState((prev) => ({ ...prev, name: trimmedName }));

    try {
      await updateDoc(doc(db, 'users', user.uid), { name: trimmedName });
      showToast('✨', 'Profile updated', 'success');
      markSaved();
      return true;
    } catch (error) {
      setState((prev) => ({ ...prev, name: previousName }));
      showToast('⚠️', extractErrorMessage(error, 'Could not save your name.'), 'error');
      endSyncWithError(error, 'Could not save your name.');
      return false;
    } finally {
      updatePending((current) => ({ ...current, naming: false }));
    }
  };

  const addHabit = async (habit: Omit<Habit, 'id' | 'streak' | 'longestStreak' | 'totalDone' | 'lastCompleted' | 'createdAt'>) => {
    if (!user) return false;

    const tempId = `temp-${Date.now()}`;
    const previousAchievements = state.achievements;
    const optimisticHabit: Habit = {
      id: tempId,
      ...habit,
      streak: 0,
      longestStreak: 0,
      totalDone: 0,
      lastCompleted: null,
      createdAt: todayStr(),
    };
    const nextHabitsAfterAdd = [optimisticHabit, ...state.habits];
    const nextPlayerAfterAdd = derivePlayerState(state.player, nextHabitsAfterAdd, state.completionHistory);
    const nextAchievementsAfterAdd = evaluateAchievements({
      previous: state.achievements,
      player: nextPlayerAfterAdd,
      habits: nextHabitsAfterAdd,
      completionHistory: state.completionHistory,
      remindersEnabled: state.remindersEnabled,
    });

    beginSync();
    updatePending((current) => ({ ...current, adding: true }));
    setState((prev) => {
      const nextHabits = [optimisticHabit, ...prev.habits];
      const nextPlayer = derivePlayerState(prev.player, nextHabits, prev.completionHistory);
      const nextAchievements = evaluateAchievements({
        previous: prev.achievements,
        player: nextPlayer,
        habits: nextHabits,
        completionHistory: prev.completionHistory,
        remindersEnabled: prev.remindersEnabled,
      });
      return {
        ...prev,
        habits: nextHabits,
        player: nextPlayer,
        achievements: nextAchievements.state,
      };
    });

    try {
      await addDoc(collection(db, 'users', user.uid, 'habits'), {
        ...habit,
        streak: 0,
        longestStreak: 0,
        totalDone: 0,
        lastCompleted: null,
        createdAt: todayStr(),
      });
      await setDoc(doc(db, 'users', user.uid), { player: nextPlayerAfterAdd, achievements: nextAchievementsAfterAdd.state }, { merge: true });
      queueAchievementOverlay(nextAchievementsAfterAdd.newlyUnlocked);
      showToast('🌱', 'Habit saved', 'success');
      markSaved();
      return true;
    } catch (error) {
      setState((prev) => {
        const nextHabits = prev.habits.filter((item) => item.id !== tempId);
        return {
          ...prev,
          habits: nextHabits,
          player: derivePlayerState(prev.player, nextHabits, prev.completionHistory),
          achievements: previousAchievements,
        };
      });
      showToast('⚠️', extractErrorMessage(error, 'Could not save your habit.'), 'error');
      endSyncWithError(error, 'Could not save your habit.');
      return false;
    } finally {
      updatePending((current) => ({ ...current, adding: false }));
    }
  };

  const editHabit = async (id: string, updates: Partial<Habit>) => {
    if (!user) return false;

    const previousHabit = state.habits.find((habit) => habit.id === id);
    if (!previousHabit) return false;
    const previousAchievements = state.achievements;
    const nextHabitsAfterEdit = state.habits.map((habit) => (habit.id === id ? { ...habit, ...updates } : habit));
    const nextPlayerAfterEdit = derivePlayerState(state.player, nextHabitsAfterEdit, state.completionHistory);
    const nextAchievementsAfterEdit = evaluateAchievements({
      previous: state.achievements,
      player: nextPlayerAfterEdit,
      habits: nextHabitsAfterEdit,
      completionHistory: state.completionHistory,
      remindersEnabled: state.remindersEnabled,
    });

    beginSync();
    updatePending((current) => ({ ...current, editingIds: addId(current.editingIds, id) }));
    setState((prev) => {
      const nextHabits = prev.habits.map((habit) => (habit.id === id ? { ...habit, ...updates } : habit));
      const nextPlayer = derivePlayerState(prev.player, nextHabits, prev.completionHistory);
      const nextAchievements = evaluateAchievements({
        previous: prev.achievements,
        player: nextPlayer,
        habits: nextHabits,
        completionHistory: prev.completionHistory,
        remindersEnabled: prev.remindersEnabled,
      });
      return {
        ...prev,
        habits: nextHabits,
        player: nextPlayer,
        achievements: nextAchievements.state,
      };
    });

    try {
      await updateDoc(doc(db, 'users', user.uid, 'habits', id), updates);
      await setDoc(doc(db, 'users', user.uid), { player: nextPlayerAfterEdit, achievements: nextAchievementsAfterEdit.state }, { merge: true });
      queueAchievementOverlay(nextAchievementsAfterEdit.newlyUnlocked);
      showToast('✨', 'Habit updated', 'success');
      markSaved();
      return true;
    } catch (error) {
      setState((prev) => {
        const nextHabits = prev.habits.map((habit) => (habit.id === id ? previousHabit : habit));
        return {
          ...prev,
          habits: nextHabits,
          player: derivePlayerState(prev.player, nextHabits, prev.completionHistory),
          achievements: previousAchievements,
        };
      });
      showToast('⚠️', extractErrorMessage(error, 'Could not update your habit.'), 'error');
      endSyncWithError(error, 'Could not update your habit.');
      return false;
    } finally {
      updatePending((current) => ({ ...current, editingIds: removeId(current.editingIds, id) }));
    }
  };

  const deleteHabit = async (id: string) => {
    if (!user) return false;

    const previousHabit = state.habits.find((habit) => habit.id === id);
    if (!previousHabit) return false;
    const previousHistory = state.completionHistory;
    const previousAchievements = state.achievements;
    const nextHistory = stripHabitFromCompletionHistory(previousHistory, id);
    const nextHabitsAfterDelete = state.habits.filter((habit) => habit.id !== id);
    const nextPlayerAfterDelete = derivePlayerState(state.player, nextHabitsAfterDelete, nextHistory);
    const nextAchievementsAfterDelete = evaluateAchievements({
      previous: state.achievements,
      player: nextPlayerAfterDelete,
      habits: nextHabitsAfterDelete,
      completionHistory: nextHistory,
      remindersEnabled: state.remindersEnabled,
    });

    beginSync();
    updatePending((current) => ({ ...current, deletingIds: addId(current.deletingIds, id) }));
    setState((prev) => {
      const nextHabits = prev.habits.filter((habit) => habit.id !== id);
      const nextCompletionHistory = stripHabitFromCompletionHistory(prev.completionHistory, id);
      const nextPlayer = derivePlayerState(prev.player, nextHabits, nextCompletionHistory);
      const nextAchievements = evaluateAchievements({
        previous: prev.achievements,
        player: nextPlayer,
        habits: nextHabits,
        completionHistory: nextCompletionHistory,
        remindersEnabled: prev.remindersEnabled,
      });
      return {
        ...prev,
        habits: nextHabits,
        completionHistory: nextCompletionHistory,
        player: nextPlayer,
        achievements: nextAchievements.state,
      };
    });

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', user.uid, 'habits', id));
      batch.set(
        doc(db, 'users', user.uid),
        { completionHistory: nextHistory, player: nextPlayerAfterDelete, achievements: nextAchievementsAfterDelete.state },
        { merge: true },
      );
      await batch.commit();
      showToast('🗑️', 'Habit deleted', 'info');
      markSaved();
      return true;
    } catch (error) {
      setState((prev) => {
        const nextHabits = [previousHabit, ...prev.habits].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return {
          ...prev,
          habits: nextHabits,
          completionHistory: previousHistory,
          player: derivePlayerState(prev.player, nextHabits, previousHistory),
          achievements: previousAchievements,
        };
      });
      showToast('⚠️', extractErrorMessage(error, 'Could not delete your habit.'), 'error');
      endSyncWithError(error, 'Could not delete your habit.');
      return false;
    } finally {
      updatePending((current) => ({ ...current, deletingIds: removeId(current.deletingIds, id) }));
    }
  };

  const dismissLocalMigration = async () => {
    if (!user || typeof window === 'undefined') return false;

    const migrationDecisionKey = `${MIGRATION_DECISION_PREFIX}${user.uid}`;
    setMigrationError(null);
    window.localStorage.setItem(migrationDecisionKey, '1');
    setMigrationOpen(false);
    setMigrationPreview(null);

    return true;
  };

  const migrateLocalData = async () => {
    if (!user || !migrationPreview || typeof window === 'undefined') return false;

    const migrationDecisionKey = `${MIGRATION_DECISION_PREFIX}${user.uid}`;
    const userDocRef = doc(db, 'users', user.uid);
    const habitsColRef = collection(db, 'users', user.uid, 'habits');

    setMigrationBusy(true);
    setMigrationError(null);

    try {
      const habitIdMap = new Map<string, string>();
      const batch = writeBatch(db);

      migrationPreview.habits.forEach((habit) => {
        const { id: legacyId, ...habitData } = habit;
        const habitDocRef = doc(habitsColRef);
        habitIdMap.set(legacyId, habitDocRef.id);
        batch.set(habitDocRef, habitData);
      });

      const completionHistory: CompletionHistory = Object.fromEntries(
        Object.entries(migrationPreview.completionHistory).map(([date, ids]) => [
          date,
          ids.map((id) => habitIdMap.get(id)).filter((id): id is string => Boolean(id)),
        ]),
      );

      const migratedPlayer = derivePlayerState(migrationPreview.player, migrationPreview.habits, completionHistory);
      const migratedAchievements = evaluateAchievements({
        previous: EMPTY_ACHIEVEMENT_STATE,
        player: migratedPlayer,
        habits: migrationPreview.habits,
        completionHistory,
        remindersEnabled: false,
      });
      batch.set(
        userDocRef,
        {
          name: migrationPreview.name,
          email: user.email ?? '',
          photoURL: user.photoURL ?? '',
          player: migratedPlayer,
          completionHistory,
          achievements: migratedAchievements.state,
        },
        { merge: true },
      );

      await batch.commit();

      window.localStorage.setItem(migrationDecisionKey, '1');
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);

      setMigrationOpen(false);
      setMigrationPreview(null);
      showToast('☁️', 'Local habits synced successfully', 'success');
      return true;
    } catch (error) {
      const message = extractErrorMessage(error, 'Failed to migrate your local habitly data.');
      setMigrationError(message);
      setErrorState(buildErrorState('migration', error, message, 'Retry migration'));
      showToast('⚠️', message, 'error');
      return false;
    } finally {
      setMigrationBusy(false);
    }
  };

  const toggleComplete = async (habitId: string) => {
    if (!user) return false;

    const today = todayStr();
    const habit = state.habits.find((item) => item.id === habitId);
    if (!habit || !isScheduledToday(habit.daysOfWeek) || pendingMutations.togglingIds.includes(habitId)) {
      return false;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const habitDocRef = doc(db, 'users', user.uid, 'habits', habitId);
    const previousHabit = habit;
    const previousPlayer = state.player;
    const previousHistory = state.completionHistory;
    const previousAchievements = state.achievements;
    const previousLevel = state.player.level;
    const alreadyDone = habit.lastCompleted === today;
    const optimisticTotalDone = alreadyDone ? Math.max(0, habit.totalDone - 1) : habit.totalDone + 1;
    const wasDayComplete = isDayFullyCompleted(state.habits, state.completionHistory, today);
    const optimisticPlayer = { ...state.player };

    const optimisticHistory: CompletionHistory = { ...state.completionHistory };
    if (alreadyDone) {
      optimisticHistory[today] = (optimisticHistory[today] || []).filter((id) => id !== habitId);
    } else {
      optimisticHistory[today] = [...(optimisticHistory[today] || []), habitId];
    }

    const optimisticHabits = state.habits.map((item) => (
      item.id === habitId
        ? {
            ...item,
            lastCompleted: alreadyDone ? null : today,
            totalDone: optimisticTotalDone,
          }
        : item
    ));
    const optimisticDerivedPlayer = derivePlayerState(optimisticPlayer, optimisticHabits, optimisticHistory);
    const isCompletingDay = !alreadyDone && !wasDayComplete && isDayFullyCompleted(optimisticHabits, optimisticHistory, today);
    const isUndoingCompletedDay = alreadyDone && wasDayComplete;
    const optimisticMilestoneReached = isCompletingDay && STREAK_MILESTONES.includes(optimisticDerivedPlayer.streak);
    const optimisticXpGain = alreadyDone
      ? -(XP_PER_COMPLETION + (isUndoingCompletedDay && STREAK_MILESTONES.includes(state.player.streak) ? XP_STREAK_BONUS : 0))
      : XP_PER_COMPLETION + (optimisticMilestoneReached ? XP_STREAK_BONUS : 0);

    if (alreadyDone) {
      optimisticPlayer.xp = Math.max(0, optimisticPlayer.xp + optimisticXpGain);
      optimisticPlayer.totalXp = Math.max(0, optimisticPlayer.totalXp + optimisticXpGain);
    } else {
      optimisticPlayer.xp += optimisticXpGain;
      optimisticPlayer.totalXp += optimisticXpGain;
      while (optimisticPlayer.xp >= XP_PER_LEVEL) {
        optimisticPlayer.xp -= XP_PER_LEVEL;
        optimisticPlayer.level += 1;
      }
    }
    optimisticPlayer.streak = optimisticDerivedPlayer.streak;
    optimisticPlayer.longestStreak = optimisticDerivedPlayer.longestStreak;
    const optimisticAchievements = evaluateAchievements({
      previous: state.achievements,
      player: optimisticPlayer,
      habits: optimisticHabits,
      completionHistory: optimisticHistory,
      remindersEnabled: state.remindersEnabled,
    });

    beginSync();
    updatePending((current) => ({ ...current, togglingIds: addId(current.togglingIds, habitId) }));
    setState((prev) => ({
      ...prev,
      habits: optimisticHabits,
      player: optimisticPlayer,
      completionHistory: optimisticHistory,
      achievements: optimisticAchievements.state,
    }));

    if (!alreadyDone) {
      setTriggerConfetti((count) => count + 1);
      setCompleteOverlayData({
        habit: {
          ...habit,
          lastCompleted: today,
          totalDone: optimisticTotalDone,
        },
        xp: optimisticXpGain,
        bonusMsg: optimisticMilestoneReached ? ` (+${XP_STREAK_BONUS} streak bonus! 🔥)` : '',
      });
    }

    try {
      const result = await runTransaction(db, async (transaction) => {
        const [userSnapshot, habitSnapshot] = await Promise.all([
          transaction.get(userDocRef),
          transaction.get(habitDocRef),
        ]);

        if (!habitSnapshot.exists()) {
          throw new Error('This habit could not be found anymore.');
        }

        const profileData = (userSnapshot.data() as ProfileDoc | undefined) ?? {};
        const profilePlayer = (profileData.player as PlayerState | undefined) ?? defaultPlayerState;
        const profileHistory = profileData.completionHistory ?? {};
        const habitData = { id: habitSnapshot.id, ...habitSnapshot.data() } as Habit;
        const isUndo = habitData.lastCompleted === today;
        const newTotal = isUndo ? Math.max(0, habitData.totalDone - 1) : habitData.totalDone + 1;
        const nextPlayer = { ...profilePlayer };
        const nextHistory: CompletionHistory = { ...profileHistory };
        const currentHabits = state.habits.map((item) => (item.id === habitId ? { ...habitData } : item));
        let xpDelta = 0;
        let leveledUp = false;
        let bonusMsg = '';
        const wasProfileDayComplete = isDayFullyCompleted(currentHabits, profileHistory, today);

        if (isUndo) {
          transaction.update(habitDocRef, {
            lastCompleted: null,
            totalDone: newTotal,
          });
          nextHistory[today] = (nextHistory[today] || []).filter((id) => id !== habitId);
        } else {
          transaction.update(habitDocRef, {
            lastCompleted: today,
            totalDone: newTotal,
          });
          nextHistory[today] = [...(nextHistory[today] || []), habitId];
        }

        const nextHabits = currentHabits.map((item) => (
          item.id === habitId
            ? {
                ...item,
                lastCompleted: isUndo ? null : today,
                totalDone: newTotal,
              }
            : item
        ));
        const nextDerivedPlayer = derivePlayerState(nextPlayer, nextHabits, nextHistory);
        const becomesCompletedDay = !isUndo && !wasProfileDayComplete && isDayFullyCompleted(nextHabits, nextHistory, today);
        const removesCompletedDay = isUndo && wasProfileDayComplete;
        const isMilestone = becomesCompletedDay && STREAK_MILESTONES.includes(nextDerivedPlayer.streak);
        xpDelta = isUndo
          ? -(XP_PER_COMPLETION + (removesCompletedDay && STREAK_MILESTONES.includes(profilePlayer.streak) ? XP_STREAK_BONUS : 0))
          : XP_PER_COMPLETION + (isMilestone ? XP_STREAK_BONUS : 0);
        bonusMsg = isMilestone ? ` (+${XP_STREAK_BONUS} streak bonus! 🔥)` : '';

        if (xpDelta < 0) {
          nextPlayer.xp = Math.max(0, nextPlayer.xp + xpDelta);
          nextPlayer.totalXp = Math.max(0, nextPlayer.totalXp + xpDelta);
        } else {
          nextPlayer.xp += xpDelta;
          nextPlayer.totalXp += xpDelta;

          while (nextPlayer.xp >= XP_PER_LEVEL) {
            nextPlayer.xp -= XP_PER_LEVEL;
            nextPlayer.level += 1;
            leveledUp = true;
          }
        }

        nextPlayer.streak = nextDerivedPlayer.streak;
        nextPlayer.longestStreak = nextDerivedPlayer.longestStreak;

        const nextAchievements = evaluateAchievements({
          previous: profileData.achievements ?? previousAchievements,
          player: nextPlayer,
          habits: nextHabits,
          completionHistory: nextHistory,
          remindersEnabled: state.remindersEnabled,
        });

        transaction.set(userDocRef, {
          name: profileData.name ?? deriveNameFromAuth(user),
          email: user.email ?? profileData.email ?? '',
          photoURL: user.photoURL ?? profileData.photoURL ?? '',
          player: nextPlayer,
          completionHistory: nextHistory,
          achievements: nextAchievements.state,
        }, { merge: true });

        return {
          habit: {
            ...habitData,
            lastCompleted: isUndo ? null : today,
            totalDone: newTotal,
          },
          player: nextPlayer,
          completionHistory: nextHistory,
          xpDelta,
          leveledUp,
          bonusMsg,
          isUndo,
          achievements: nextAchievements.state,
          newlyUnlockedAchievements: nextAchievements.newlyUnlocked,
        };
      });

      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((item) => (item.id === habitId ? result.habit : item)),
        player: result.player,
        completionHistory: result.completionHistory,
        achievements: result.achievements,
      }));

      queueAchievementOverlay(result.newlyUnlockedAchievements);

      if (result.leveledUp && result.player.level !== previousLevel) {
        setTimeout(() => setLevelUpData(result.player.level), 2500);
      }

      showToast(result.isUndo ? '↩️' : '⚡', result.isUndo ? 'Completion removed' : 'XP saved successfully', 'success');
      markSaved();
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((item) => (item.id === habitId ? previousHabit : item)),
        player: previousPlayer,
        completionHistory: previousHistory,
        achievements: previousAchievements,
      }));
      if (!alreadyDone) {
        setCompleteOverlayData(null);
      }
      showToast('⚠️', extractErrorMessage(error, 'Could not save your progress.'), 'error');
      endSyncWithError(error, 'Could not save your progress.');
      return false;
    } finally {
      updatePending((current) => ({ ...current, togglingIds: removeId(current.togglingIds, habitId) }));
    }
  };

  const closeCompleteOverlay = () => setCompleteOverlayData(null);
  const closeLevelUpOverlay = () => setLevelUpData(null);
  const closeAchievementOverlay = () => setAchievementOverlayData(null);

  return {
    state,
    loaded: bootStatus === 'ready',
    bootStatus,
    syncStatus,
    errorState,
    retryBootstrap,
    pendingMutations,
    updateName,
    addHabit,
    editHabit,
    deleteHabit,
    toggleComplete,
    triggerConfetti,
    completeOverlayData,
    levelUpData,
    achievementOverlayData: achievementOverlayData
      ? {
          ...achievementOverlayData,
          definition: getAchievementDefinition(achievementOverlayData.achievementId),
        }
      : null,
    closeCompleteOverlay,
    closeLevelUpOverlay,
    closeAchievementOverlay,
    migrationOpen,
    migrationBusy,
    migrationError,
    migrationHabitCount: migrationPreview?.habits.length ?? 0,
    migrateLocalData,
    dismissLocalMigration,
  };
}
