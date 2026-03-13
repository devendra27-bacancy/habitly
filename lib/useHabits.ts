"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
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
import { ALL_DAYS, isScheduledToday, lastScheduledDayBefore, todayStr } from './dates';

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
};

export type PlayerState = {
  xp: number;
  totalXp: number;
  level: number;
};

export type CompletionHistory = Record<string, string[]>;

export type AppState = {
  uid: string | null;
  name: string;
  email?: string;
  photoURL?: string;
  player: PlayerState;
  habits: Habit[];
  completionHistory: CompletionHistory;
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

type ProfileDoc = {
  name?: string;
  email?: string;
  photoURL?: string;
  player?: PlayerState;
  completionHistory?: CompletionHistory;
};

const XP_PER_COMPLETION = 10;
const XP_STREAK_BONUS = 25;
const XP_PER_LEVEL = 100;
const STREAK_MILESTONES = [7, 14, 21, 30, 60, 100];
const LEGACY_STORAGE_KEY = 'habitflow_v3_next';
const MIGRATION_DECISION_PREFIX = 'habitflow_migration_seen_';
const SAVE_FEEDBACK_DELAY_MS = 1400;

const defaultPlayerState: PlayerState = { xp: 0, totalXp: 0, level: 1 };

const defaultState: AppState = {
  uid: null,
  name: 'Friend',
  email: undefined,
  photoURL: undefined,
  player: defaultPlayerState,
  habits: [],
  completionHistory: {},
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
  const saveTimerRef = useRef<number | null>(null);

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
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const habitsColRef = collection(db, 'users', user.uid, 'habits');
    const migrationDecisionKey = `${MIGRATION_DECISION_PREFIX}${user.uid}`;

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
        },
        { merge: true },
      );
    };

    void bootstrapProfile().catch((error) => {
      console.error('Failed to bootstrap profile:', error);
      setBootStatus('error');
      setErrorState(buildErrorState('bootstrap', error, 'Could not prepare your habitly profile.', 'Retry loading'));
    });

    const unsubUser = onSnapshot(
      userDocRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
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

        if (!data.name || !data.name.trim()) {
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

        setState((prev) => ({
          ...prev,
          uid: user.uid,
          name: resolvedName,
          email: user.email ?? data.email ?? prev.email,
          photoURL: user.photoURL ?? data.photoURL ?? prev.photoURL,
          player: data.player ?? prev.player,
          completionHistory: data.completionHistory ?? prev.completionHistory,
        }));

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
        const today = todayStr();

        habits.forEach((habit) => {
          if (!habit.lastCompleted) return;
          const lastSched = lastScheduledDayBefore(habit.daysOfWeek, today);
          if (lastSched && habit.lastCompleted < lastSched && habit.streak > 0) {
            void updateDoc(doc(habitsColRef, habit.id), { streak: 0 }).catch(console.error);
          }
        });

        setState((prev) => ({ ...prev, habits }));
        setBootStatus('ready');
        setErrorState((current) => (current?.scope === 'habits' ? null : current));

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
    const optimisticHabit: Habit = {
      id: tempId,
      ...habit,
      streak: 0,
      longestStreak: 0,
      totalDone: 0,
      lastCompleted: null,
      createdAt: todayStr(),
    };

    beginSync();
    updatePending((current) => ({ ...current, adding: true }));
    setState((prev) => ({ ...prev, habits: [optimisticHabit, ...prev.habits] }));

    try {
      await addDoc(collection(db, 'users', user.uid, 'habits'), {
        ...habit,
        streak: 0,
        longestStreak: 0,
        totalDone: 0,
        lastCompleted: null,
        createdAt: todayStr(),
      });
      showToast('🌱', 'Habit saved', 'success');
      markSaved();
      return true;
    } catch (error) {
      setState((prev) => ({ ...prev, habits: prev.habits.filter((item) => item.id !== tempId) }));
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

    beginSync();
    updatePending((current) => ({ ...current, editingIds: addId(current.editingIds, id) }));
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((habit) => (habit.id === id ? { ...habit, ...updates } : habit)),
    }));

    try {
      await updateDoc(doc(db, 'users', user.uid, 'habits', id), updates);
      showToast('✨', 'Habit updated', 'success');
      markSaved();
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((habit) => (habit.id === id ? previousHabit : habit)),
      }));
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

    beginSync();
    updatePending((current) => ({ ...current, deletingIds: addId(current.deletingIds, id) }));
    setState((prev) => ({ ...prev, habits: prev.habits.filter((habit) => habit.id !== id) }));

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'habits', id));
      showToast('🗑️', 'Habit deleted', 'info');
      markSaved();
      return true;
    } catch (error) {
      setState((prev) => ({ ...prev, habits: [previousHabit, ...prev.habits].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }));
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

      batch.set(
        userDocRef,
        {
          name: migrationPreview.name,
          email: user.email ?? '',
          photoURL: user.photoURL ?? '',
          player: migrationPreview.player,
          completionHistory,
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
    const previousLevel = state.player.level;
    const alreadyDone = habit.lastCompleted === today;
    const lastSched = lastScheduledDayBefore(habit.daysOfWeek, today);
    const optimisticStreak = alreadyDone
      ? Math.max(0, habit.streak - 1)
      : habit.lastCompleted && lastSched && habit.lastCompleted >= lastSched
        ? habit.streak + 1
        : 1;
    const optimisticTotalDone = alreadyDone ? Math.max(0, habit.totalDone - 1) : habit.totalDone + 1;
    const optimisticLongest = alreadyDone ? habit.longestStreak : Math.max(habit.longestStreak, optimisticStreak);
    const optimisticMilestone = !alreadyDone && STREAK_MILESTONES.includes(optimisticStreak);
    const optimisticXpGain = alreadyDone ? -XP_PER_COMPLETION : optimisticMilestone ? XP_PER_COMPLETION + XP_STREAK_BONUS : XP_PER_COMPLETION;
    const optimisticPlayer = { ...state.player };

    if (alreadyDone) {
      optimisticPlayer.xp = Math.max(0, optimisticPlayer.xp - XP_PER_COMPLETION);
      optimisticPlayer.totalXp = Math.max(0, optimisticPlayer.totalXp - XP_PER_COMPLETION);
    } else {
      optimisticPlayer.xp += optimisticXpGain;
      optimisticPlayer.totalXp += optimisticXpGain;
      while (optimisticPlayer.xp >= XP_PER_LEVEL) {
        optimisticPlayer.xp -= XP_PER_LEVEL;
        optimisticPlayer.level += 1;
      }
    }

    const optimisticHistory: CompletionHistory = { ...state.completionHistory };
    if (alreadyDone) {
      optimisticHistory[today] = (optimisticHistory[today] || []).filter((id) => id !== habitId);
    } else {
      optimisticHistory[today] = [...(optimisticHistory[today] || []), habitId];
    }

    beginSync();
    updatePending((current) => ({ ...current, togglingIds: addId(current.togglingIds, habitId) }));
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((item) => (
        item.id === habitId
          ? {
              ...item,
              lastCompleted: alreadyDone ? null : today,
              streak: optimisticStreak,
              totalDone: optimisticTotalDone,
              longestStreak: optimisticLongest,
            }
          : item
      )),
      player: optimisticPlayer,
      completionHistory: optimisticHistory,
    }));

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
        const profilePlayer = profileData.player ?? defaultPlayerState;
        const profileHistory = profileData.completionHistory ?? {};
        const habitData = { id: habitSnapshot.id, ...habitSnapshot.data() } as Habit;
        const isUndo = habitData.lastCompleted === today;
        const profileLastSched = lastScheduledDayBefore(habitData.daysOfWeek, today);
        const newStreak = isUndo
          ? Math.max(0, habitData.streak - 1)
          : habitData.lastCompleted && profileLastSched && habitData.lastCompleted >= profileLastSched
            ? habitData.streak + 1
            : 1;
        const newTotal = isUndo ? Math.max(0, habitData.totalDone - 1) : habitData.totalDone + 1;
        const newLongest = isUndo ? habitData.longestStreak : Math.max(habitData.longestStreak, newStreak);
        const nextPlayer = { ...profilePlayer };
        const nextHistory: CompletionHistory = { ...profileHistory };
        let xpDelta = 0;
        let leveledUp = false;
        let bonusMsg = '';

        if (isUndo) {
          transaction.update(habitDocRef, {
            lastCompleted: null,
            streak: newStreak,
            totalDone: newTotal,
          });

          nextPlayer.xp = Math.max(0, nextPlayer.xp - XP_PER_COMPLETION);
          nextPlayer.totalXp = Math.max(0, nextPlayer.totalXp - XP_PER_COMPLETION);
          nextHistory[today] = (nextHistory[today] || []).filter((id) => id !== habitId);
          xpDelta = -XP_PER_COMPLETION;
        } else {
          transaction.update(habitDocRef, {
            lastCompleted: today,
            streak: newStreak,
            totalDone: newTotal,
            longestStreak: newLongest,
          });

          const isMilestone = STREAK_MILESTONES.includes(newStreak);
          xpDelta = isMilestone ? XP_PER_COMPLETION + XP_STREAK_BONUS : XP_PER_COMPLETION;
          bonusMsg = isMilestone ? ` (+${XP_STREAK_BONUS} streak bonus! 🔥)` : '';
          nextPlayer.xp += xpDelta;
          nextPlayer.totalXp += xpDelta;
          nextHistory[today] = [...(nextHistory[today] || []), habitId];

          while (nextPlayer.xp >= XP_PER_LEVEL) {
            nextPlayer.xp -= XP_PER_LEVEL;
            nextPlayer.level += 1;
            leveledUp = true;
          }
        }

        transaction.set(userDocRef, {
          name: profileData.name ?? deriveNameFromAuth(user),
          email: user.email ?? profileData.email ?? '',
          photoURL: user.photoURL ?? profileData.photoURL ?? '',
          player: nextPlayer,
          completionHistory: nextHistory,
        }, { merge: true });

        return {
          habit: {
            ...habitData,
            lastCompleted: isUndo ? null : today,
            streak: newStreak,
            totalDone: newTotal,
            longestStreak: newLongest,
          },
          player: nextPlayer,
          completionHistory: nextHistory,
          xpDelta,
          leveledUp,
          bonusMsg,
          isUndo,
        };
      });

      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((item) => (item.id === habitId ? result.habit : item)),
        player: result.player,
        completionHistory: result.completionHistory,
      }));

      if (!result.isUndo) {
        setTriggerConfetti((count) => count + 1);
        setCompleteOverlayData({
          habit: result.habit,
          xp: result.xpDelta,
          bonusMsg: result.bonusMsg,
        });
      }

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
      }));
      showToast('⚠️', extractErrorMessage(error, 'Could not save your progress.'), 'error');
      endSyncWithError(error, 'Could not save your progress.');
      return false;
    } finally {
      updatePending((current) => ({ ...current, togglingIds: removeId(current.togglingIds, habitId) }));
    }
  };

  const closeCompleteOverlay = () => setCompleteOverlayData(null);
  const closeLevelUpOverlay = () => setLevelUpData(null);

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
    closeCompleteOverlay,
    closeLevelUpOverlay,
    migrationOpen,
    migrationBusy,
    migrationError,
    migrationHabitCount: migrationPreview?.habits.length ?? 0,
    migrateLocalData,
    dismissLocalMigration,
  };
}
