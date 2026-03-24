"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDocs, limit, query, writeBatch } from "firebase/firestore";
import { Header } from "../components/Header";
import { WeekStrip } from "../components/WeekStrip";
import { MascotArea } from "../components/MascotArea";
import { HabitCard } from "../components/HabitCard";
import { BottomBar } from "../components/BottomBar";
import { AddHabitModal } from "../components/AddHabitModal";
import { NameModal } from "../components/NameModal";
import { ProfilePage } from "../components/ProfilePage";
import type { ProfileAnalyticsData } from "../components/ProfileAnalytics";
import { CompleteOverlay } from "../components/CompleteOverlay";
import { LevelUpOverlay } from "../components/LevelUpOverlay";
import { ConfettiCanvas } from "../components/ConfettiCanvas";
import { LocalMigrationPrompt } from "../components/LocalMigrationPrompt";
import { ToastContainer } from "../components/ToastContainer";
import { ClockIcon } from "../components/Icons";
import { useHabits, todayStr, isScheduledToday, Habit, formatTime, AppState, ALL_DAYS, DAY_LABELS } from "../lib/useHabits";
import { localDateStr } from "../lib/dates";
import { deleteCurrentUserAccount } from "../lib/auth";
import { db } from "../lib/firebase";
import { useNotifications } from "../lib/useNotifications";
import { showToast } from "../components/ToastContainer";
import { useAuth } from "../components/AuthProvider";
import Login from "../components/Login";
import SplashScreen from "../components/SplashScreen";

type HabitDraft = Omit<Habit, "id" | "streak" | "longestStreak" | "totalDone" | "lastCompleted" | "createdAt">;
const ACCOUNT_DELETION_PREFIX = "habitflow_account_deleting_";
const DASHBOARD_CACHE_PREFIX = "habitly_dashboard_cache_";
const LEGACY_STORAGE_KEY = "habitflow_v3_next";
const MIGRATION_DECISION_PREFIX = "habitflow_migration_seen_";

type CachedDashboard = {
  updatedAt: string;
  state: AppState;
};

function LoadingShell({ title, subtitle, imageSrc = "/mascot/mascot_idle_default.png" }: { title: string; subtitle: string; imageSrc?: string }) {
  return (
    <div className="app-shell state-shell">
      <div className="state-card">
        <div className="state-mascot">
          <Image src={imageSrc} alt="Lizzo the habitly mascot" width={160} height={160} priority />
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function ErrorShell({ title, message, actionLabel, onRetry }: { title: string; message: string; actionLabel: string; onRetry: () => void }) {
  return (
    <div className="app-shell state-shell">
      <div className="state-card">
        <div className="state-mascot">
          <Image src="/mascot/mascot_error_reassuring.png" alt="Error mascot" width={160} height={160} priority />
        </div>
        <h1>{title}</h1>
        <p>{message}</p>
        <button className="state-button" onClick={onRetry}>{actionLabel}</button>
      </div>
    </div>
  );
}

function OfflineBanner({ hasCachedDashboard }: { hasCachedDashboard: boolean }) {
  return (
    <div className="offline-banner" role="status">
      <div className="offline-banner-title">You are offline</div>
      <div className="offline-banner-copy">
        {hasCachedDashboard
          ? "Showing your last synced dashboard in read-only mode until the connection returns."
          : "Some screens may be unavailable until you reconnect."}
      </div>
    </div>
  );
}

function formatHistoryLabel(date: Date, offset: number) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function habitWasActiveOnDate(habit: Habit, dateKey: string) {
  const hasStarted = !habit.createdAt || habit.createdAt <= dateKey;
  const hasNotEnded = !habit.endDate || habit.endDate >= dateKey;
  return hasStarted && hasNotEnded;
}

function getHabitsScheduledForDate(habits: Habit[], dateKey: string) {
  const dayOfWeek = parseDateKey(dateKey).getDay();
  return habits.filter((habit) => {
    const days = Array.isArray(habit.daysOfWeek) && habit.daysOfWeek.length > 0 ? habit.daysOfWeek : ALL_DAYS;
    return days.includes(dayOfWeek) && habitWasActiveOnDate(habit, dateKey);
  });
}

function getStartOfWeek(date: Date) {
  const result = new Date(date);
  const mondayOffset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - mondayOffset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

async function deleteCollectionInBatches(collectionRef: ReturnType<typeof collection>, batchSize = 200) {
  while (true) {
    const snapshot = await getDocs(query(collectionRef, limit(batchSize)));
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.forEach((documentSnapshot) => {
      batch.delete(documentSnapshot.ref);
    });
    await batch.commit();

    if (snapshot.size < batchSize) {
      return;
    }
  }
}

function clearDeletedUserClientData(uid: string) {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(`${DASHBOARD_CACHE_PREFIX}${uid}`);
  window.localStorage.removeItem(`${MIGRATION_DECISION_PREFIX}${uid}`);
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export default function Home() {
  const { user, loading } = useAuth();
  const {
    state,
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
    migrationHabitCount,
    migrateLocalData,
    dismissLocalMigration,
  } = useHabits();
  const {
    isSupported: notificationsSupported,
    permission: notificationPermission,
    settings: notificationSettings,
    isBusy: notificationBusy,
    error: notificationError,
    enableNotifications,
    disableNotifications,
    enableEmailNotifications,
    disableEmailNotifications,
    updateQuietHours,
  } = useNotifications();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isNameOpen, setIsNameOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [displayWeekStartKey, setDisplayWeekStartKey] = useState(localDateStr(getStartOfWeek(new Date())));
  const [selectedDateKey, setSelectedDateKey] = useState(todayStr());
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [hasDismissedSplash, setHasDismissedSplash] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [, setIsStandalone] = useState(false);
  const [cachedDashboard, setCachedDashboard] = useState<CachedDashboard | null>(null);
  const [focusedReminderSlot, setFocusedReminderSlot] = useState<string | null>(null);
  const habitsListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (user) return;

    if (typeof window !== "undefined") {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i += 1) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(ACCOUNT_DELETION_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
    }

    setIsAddOpen(false);
    setIsNameOpen(false);
    setIsProfileOpen(false);
    setEditingId(null);
    setDisplayWeekStartKey(localDateStr(getStartOfWeek(new Date())));
    setSelectedDateKey(todayStr());
    setIsDeletingAccount(false);
    setHasDismissedSplash(false);
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncOnlineState = () => setIsOffline(!window.navigator.onLine);
    syncOnlineState();
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);

    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(display-mode: standalone)");
    const updateStandalone = () => {
      const standalone = media.matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      setIsStandalone(standalone);
      document.body.classList.toggle("standalone-mode", standalone);
    };

    updateStandalone();
    media.addEventListener("change", updateStandalone);
    return () => {
      media.removeEventListener("change", updateStandalone);
      document.body.classList.remove("standalone-mode");
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/app-sw.js").catch((error) => {
      console.error("Failed to register app service worker:", error);
    });
  }, []);

  useEffect(() => {
    if (!user || typeof window === "undefined") {
      setCachedDashboard(null);
      return;
    }

    try {
      const raw = window.localStorage.getItem(`${DASHBOARD_CACHE_PREFIX}${user.uid}`);
      setCachedDashboard(raw ? (JSON.parse(raw) as CachedDashboard) : null);
    } catch (error) {
      console.error("Could not read cached dashboard:", error);
      setCachedDashboard(null);
    }
  }, [user]);

  useEffect(() => {
    if (!user || bootStatus !== "ready" || typeof window === "undefined") return;

    const nextCache: CachedDashboard = {
      updatedAt: new Date().toISOString(),
      state,
    };

    setCachedDashboard(nextCache);
    window.localStorage.setItem(`${DASHBOARD_CACHE_PREFIX}${user.uid}`, JSON.stringify(nextCache));
  }, [bootStatus, state, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const focusDate = params.get("focusDate");
    const focusSlotTime = params.get("focusSlotTime");

    if (!focusDate && !focusSlotTime) return;

    if (focusDate) {
      const nextDate = parseDateKey(focusDate);
      setDisplayWeekStartKey(localDateStr(getStartOfWeek(nextDate)));
      setSelectedDateKey(focusDate);
    }

    if (focusSlotTime) {
      setFocusedReminderSlot(focusSlotTime);
      window.setTimeout(() => setFocusedReminderSlot(null), 8000);
    }

    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const todayKey = todayStr();
  const todayDate = useMemo(() => parseDateKey(todayKey), [todayKey]);
  const displayWeekStart = useMemo(() => parseDateKey(displayWeekStartKey), [displayWeekStartKey]);
  const hasCachedDashboard = Boolean(cachedDashboard?.state);
  const shouldUseCachedDashboard =
    isOffline &&
    Boolean(user) &&
    cachedDashboard?.state?.uid === user?.uid &&
    (bootStatus !== "ready" || syncStatus === "error");
  const activeState = shouldUseCachedDashboard && cachedDashboard ? cachedDashboard.state : state;

  useEffect(() => {
    if (!focusedReminderSlot || !selectedDateKey || selectedDateKey !== todayKey) return;
    habitsListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusedReminderSlot, selectedDateKey, todayKey]);

  const updateDisplayedWeek = (nextWeekStart: Date) => {
    const normalizedNextWeekStart = getStartOfWeek(nextWeekStart);
    const previousWeekStart = displayWeekStart;
    const selectedDate = parseDateKey(selectedDateKey);
    const weekdayOffset = Math.max(
      0,
      Math.min(
        6,
        Math.round((selectedDate.getTime() - previousWeekStart.getTime()) / (1000 * 60 * 60 * 24)),
      ),
    );
    const nextSelectedDate = addDays(normalizedNextWeekStart, weekdayOffset);
    setDisplayWeekStartKey(localDateStr(normalizedNextWeekStart));
    setSelectedDateKey(localDateStr(nextSelectedDate));
  };

  const stripEntries = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(displayWeekStart, index);
      const dateKey = localDateStr(date);
      const dayOfWeek = date.getDay();
      const completedIds = new Set(activeState.completionHistory[dateKey] || []);
      const scheduled = activeState.habits.filter(
        (habit) =>
          Array.isArray(habit.daysOfWeek) &&
          habit.daysOfWeek.includes(dayOfWeek) &&
          habitWasActiveOnDate(habit, dateKey),
      );
      const done = scheduled.filter((habit) => completedIds.has(habit.id));
      const isFuture = dateKey > todayKey;
      const diffDays = Math.round((date.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      const missed = isFuture || dateKey === todayKey ? [] : scheduled.filter((habit) => !completedIds.has(habit.id));

      return {
        dateKey,
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        dayNum: date.getDate(),
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        historyLabel: isFuture ? date.toLocaleDateString("en-US", { weekday: "long" }) : formatHistoryLabel(date, Math.abs(diffDays)),
        done,
        missed,
        scheduled,
        completedCount: done.length,
        missedCount: missed.length,
        estimatedXp: done.length * 10,
        isToday: dateKey === todayKey,
        isFuture,
      };
    });
  }, [activeState.completionHistory, activeState.habits, displayWeekStart, todayDate, todayKey]);

  const weekDays = useMemo(() => {
    return stripEntries.map((entry) => ({
      label: entry.label,
      num: entry.dayNum,
      hasDots: entry.scheduled.length > 0,
      marker: (entry.isFuture
        ? (entry.scheduled.length > 0 ? "dot" : undefined)
        : entry.missed.length > 0
          ? "missed"
          : entry.done.length > 0 && entry.done.length === entry.scheduled.length
            ? "streak"
            : entry.scheduled.length > 0
              ? "dot"
              : undefined) as "dot" | "streak" | "missed" | undefined,
      isToday: entry.isToday,
      isFuture: entry.isFuture,
      dateKey: entry.dateKey,
    }));
  }, [stripEntries]);

  const selectedEntry = useMemo(
    () => stripEntries.find((entry) => entry.dateKey === selectedDateKey) ?? stripEntries.find((entry) => entry.isToday) ?? null,
    [selectedDateKey, stripEntries],
  );
  const pickerDateValue = useMemo(() => localDateStr(displayWeekStart), [displayWeekStart]);
  const weekLabel = useMemo(() => {
    const weekEnd = addDays(displayWeekStart, 6);
    const sameMonth = displayWeekStart.getMonth() === weekEnd.getMonth();
    const monthStart = displayWeekStart.toLocaleDateString("en-US", { month: "short" });
    const monthEnd = weekEnd.toLocaleDateString("en-US", { month: "short" });
    const dayStart = displayWeekStart.getDate();
    const dayEnd = weekEnd.getDate();
    return sameMonth
      ? `${monthStart} ${dayStart} - ${dayEnd}, ${displayWeekStart.getFullYear()}`
      : `${monthStart} ${dayStart} - ${monthEnd} ${dayEnd}, ${weekEnd.getFullYear()}`;
  }, [displayWeekStart]);
  const isViewingCurrentWeek = displayWeekStartKey === localDateStr(getStartOfWeek(new Date()));
  const selectedScheduledHabits = selectedEntry?.scheduled ?? [];
  const selectedDoneHabits = selectedEntry?.done ?? [];
  const selectedMissedHabits = selectedEntry?.missed ?? [];

  if (loading) {
    return (
      <>
        <ToastContainer />
        <LoadingShell title="Opening habitly" subtitle="Checking your session and waking up Lizzo..." imageSrc="/mascot/mascot_idle_default.png" />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <ToastContainer />
        {hasDismissedSplash ? (
          <Login />
        ) : (
          <SplashScreen onComplete={() => setHasDismissedSplash(true)} />
        )}
      </>
    );
  }

  if (bootStatus === "loading" && !shouldUseCachedDashboard) {
    return (
      <>
        <ToastContainer />
        <LoadingShell title="Syncing your dashboard" subtitle="Pulling in habits, streaks, and your saved progress." imageSrc="/mascot/mascot_progress_good.png" />
      </>
    );
  }

  if (bootStatus === "error" && errorState && !shouldUseCachedDashboard) {
    return (
      <>
        <ToastContainer />
        <ErrorShell
          title="We hit a sync problem"
          message={errorState.message}
          actionLabel={errorState.retryAction ?? "Try again"}
          onRetry={retryBootstrap}
        />
      </>
    );
  }

  const today = todayStr();
  const scheduledToday = activeState.habits.filter(
    (habit) => isScheduledToday(habit.daysOfWeek) && habitWasActiveOnDate(habit, today),
  );
  const sortedHabits = [...scheduledToday].sort((a, b) => {
    const aDone = a.lastCompleted === today ? 1 : 0;
    const bDone = b.lastCompleted === today ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return b.totalDone - a.totalDone;
  });

  const editingHabit = editingId ? activeState.habits.find((habit) => habit.id === editingId) || null : null;
  const isEditingHabitSaving = Boolean(editingId && pendingMutations.editingIds.includes(editingId));
  const isEditingHabitDeleting = Boolean(editingId && pendingMutations.deletingIds.includes(editingId));
  const isReadOnlyMode = isOffline;
  const isBusy =
    pendingMutations.adding ||
    pendingMutations.naming ||
    pendingMutations.editingIds.length > 0 ||
    pendingMutations.deletingIds.length > 0 ||
    pendingMutations.togglingIds.length > 0;
  const totalCompleted = activeState.habits.reduce((sum, habit) => sum + habit.totalDone, 0);
  const longestStreak = activeState.player.longestStreak || 0;
  const currentBestStreak = activeState.player.streak || 0;
  const daysActive = Object.keys(activeState.completionHistory).length;
  const completionRate =
    scheduledToday.length === 0
      ? 0
      : Math.round((sortedHabits.filter((habit) => habit.lastCompleted === today).length / scheduledToday.length) * 100);
  const selectedCount = selectedEntry
    ? selectedEntry.isFuture
      ? selectedScheduledHabits.length
      : selectedDoneHabits.length + selectedMissedHabits.length
    : 0;
  const analytics: ProfileAnalyticsData = (() => {
    const buildDateKeys = (count: number) =>
      Array.from({ length: count }, (_, index) => localDateStr(addDays(todayDate, -(count - 1 - index))));

    const summarizeDate = (dateKey: string) => {
      const scheduled = getHabitsScheduledForDate(activeState.habits, dateKey);
      const completedIds = new Set(activeState.completionHistory[dateKey] || []);
      const done = scheduled.filter((habit) => completedIds.has(habit.id)).length;
      const total = scheduled.length;
      return {
        dateKey,
        done,
        total,
        rate: total > 0 ? done / total : 0,
      };
    };

    const trend = buildDateKeys(14).map((dateKey) => {
      const summary = summarizeDate(dateKey);
      const date = parseDateKey(dateKey);
      return {
        ...summary,
        label: date.toLocaleDateString("en-US", { day: "numeric" }),
      };
    });

    const lastThirty = buildDateKeys(30).map(summarizeDate);
    const scheduledLastThirty = lastThirty.filter((day) => day.total > 0);
    const doneLastThirty = scheduledLastThirty.reduce((sum, day) => sum + day.done, 0);
    const totalLastThirty = scheduledLastThirty.reduce((sum, day) => sum + day.total, 0);
    const perfectDays = scheduledLastThirty.filter((day) => day.done === day.total).length;
    const activeDays = scheduledLastThirty.filter((day) => day.done > 0).length;

    const weekdayWindow = buildDateKeys(56).map(summarizeDate);
    const weekday = [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
      const entries = weekdayWindow.filter((entry) => parseDateKey(entry.dateKey).getDay() === dayOfWeek && entry.total > 0);
      const done = entries.reduce((sum, day) => sum + day.done, 0);
      const total = entries.reduce((sum, day) => sum + day.total, 0);
      return {
        label: DAY_LABELS[dayOfWeek],
        done,
        total,
        rate: total > 0 ? done / total : 0,
      };
    });

    const heatmap = buildDateKeys(70).map((dateKey) => {
      const summary = summarizeDate(dateKey);
      const level = summary.total === 0 ? 0 : summary.rate >= 1 ? 3 : summary.rate >= 0.66 ? 2 : 1;
      return {
        dateKey,
        label: parseDateKey(dateKey).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        level: level as 0 | 1 | 2 | 3,
        done: summary.done,
        total: summary.total,
        isToday: dateKey === todayKey,
      };
    });

    const habitSnapshots = activeState.habits.map((habit) => {
      const recentScheduled = lastThirty.filter((day) =>
        getHabitsScheduledForDate([habit], day.dateKey).length > 0,
      );
      const recentDone = recentScheduled.filter((day) =>
        (activeState.completionHistory[day.dateKey] || []).includes(habit.id),
      ).length;

      return {
        habit,
        scheduled: recentScheduled.length,
        done: recentDone,
        rate: recentScheduled.length > 0 ? recentDone / recentScheduled.length : 0,
      };
    });

    const topHabit = [...activeState.habits].sort((a, b) => b.totalDone - a.totalDone)[0] ?? null;
    const mostReliable = [...habitSnapshots]
      .filter((entry) => entry.scheduled > 0)
      .sort((a, b) => b.rate - a.rate || b.done - a.done)[0] ?? null;
    const needsAttention = [...habitSnapshots]
      .filter((entry) => entry.scheduled >= 2)
      .sort((a, b) => a.rate - b.rate || b.scheduled - a.scheduled)[0] ?? null;
    const strongestWeekday = [...weekday]
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.rate - a.rate || b.done - a.done)[0] ?? null;

    return {
      overview: [
        {
          label: "30-day completion",
          value: totalLastThirty > 0 ? `${Math.round((doneLastThirty / totalLastThirty) * 100)}%` : "—",
          helper: totalLastThirty > 0 ? `${doneLastThirty} of ${totalLastThirty} scheduled check-ins` : "No scheduled check-ins yet",
          tone: "sage",
        },
        {
          label: "Perfect days",
          value: String(perfectDays),
          helper: "Days where every scheduled habit got done",
          tone: "sun",
        },
        {
          label: "Active days",
          value: String(activeDays),
          helper: "Days in the last month with at least one completion",
          tone: "sky",
        },
        {
          label: "Longest run",
          value: `${activeState.player.longestStreak} days`,
          helper: "Best global streak so far",
          tone: "rose",
        },
      ],
      trend,
      weekday,
      heatmap,
      insights: [
        {
          label: "Top habit",
          value: topHabit ? `${topHabit.emoji} ${topHabit.name}` : "No data yet",
          helper: topHabit ? `${topHabit.totalDone} total completions so far` : "Add a few habits to unlock this view",
        },
        {
          label: "Most reliable",
          value: mostReliable ? `${mostReliable.habit.emoji} ${mostReliable.habit.name}` : "No data yet",
          helper: mostReliable ? `${Math.round(mostReliable.rate * 100)}% hit rate over the last 30 days` : "We need a bit more history first",
        },
        {
          label: "Needs attention",
          value: needsAttention ? `${needsAttention.habit.emoji} ${needsAttention.habit.name}` : "Everything looks steady",
          helper: needsAttention ? `${Math.round(needsAttention.rate * 100)}% completion across recent scheduled days` : strongestWeekday ? `${strongestWeekday.label} is your strongest day right now` : "No weak spots yet",
        },
      ],
    };
  })();
  const selectedSectionTitle = selectedEntry
    ? selectedEntry.isToday
      ? "Today's Habits"
      : `${selectedEntry.label}, ${selectedEntry.date}`
    : "Day view";

  const profileStats = [
    { label: "Current streak", value: `${currentBestStreak} days`, tone: "sage" as const },
    { label: "Longest streak", value: `${longestStreak} days`, tone: "sun" as const },
    { label: "Habits completed", value: `${totalCompleted}`, tone: "sky" as const },
    { label: "Days active", value: `${daysActive}`, tone: "rose" as const },
    { label: "Habits in rotation", value: `${activeState.habits.length}`, tone: "sage" as const },
    { label: "Today done", value: `${completionRate}%`, tone: "sun" as const },
  ];

  const showOfflineMutationMessage = () => {
    showToast("Off", "You are offline. Changes will be available when the connection returns.", "warning");
  };

  const handleSaveHabit = (id: string | null, updates: Partial<Habit>) => {
    if (isReadOnlyMode) {
      showOfflineMutationMessage();
      return;
    }

    if (id) {
      setIsAddOpen(false);
      setEditingId(null);
      void editHabit(id, updates);
      return;
    }

    setIsAddOpen(false);
    setEditingId(null);
    void addHabit(updates as HabitDraft);
  };

  const handleDeleteHabit = (id: string) => {
    if (isReadOnlyMode) {
      showOfflineMutationMessage();
      return;
    }
    void deleteHabit(id).then((deleted) => {
      if (deleted) {
        setEditingId(null);
        setIsAddOpen(false);
      }
    });
  };

  const handleEditHabit = (id: string) => {
    if (isReadOnlyMode) {
      showOfflineMutationMessage();
      return;
    }
    setEditingId(id);
    setIsAddOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (!user || isDeletingAccount) return;
    if (isReadOnlyMode) {
      showOfflineMutationMessage();
      return;
    }

    const signedInAt = user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : 0;
    const recentlySignedIn = signedInAt > 0 && Date.now() - signedInAt < 5 * 60 * 1000;

    if (!recentlySignedIn) {
      showToast("!", "For safety, please log out and sign in again before deleting your account.", "warning");
      return;
    }

    const confirmed = window.confirm("Delete your account and all habits permanently? This cannot be undone.");
    if (!confirmed) return;

    setIsDeletingAccount(true);
    const deletionKey = `${ACCOUNT_DELETION_PREFIX}${user.uid}`;

    try {
      window.sessionStorage.setItem(deletionKey, "1");
      const habitsRef = collection(db, "users", user.uid, "habits");
      const devicesRef = collection(db, "users", user.uid, "devices");
      const reminderDispatchesRef = collection(db, "users", user.uid, "reminderDispatches");
      await deleteCollectionInBatches(habitsRef);
      await deleteCollectionInBatches(devicesRef);
      await deleteCollectionInBatches(reminderDispatchesRef);
      await deleteDoc(doc(db, "users", user.uid));
      clearDeletedUserClientData(user.uid);
      await deleteCurrentUserAccount();
      showToast("✓", "Your account was deleted.", "success");
    } catch (error) {
      window.sessionStorage.removeItem(deletionKey);
      console.error("Failed to delete account:", error);
      showToast("!", error instanceof Error ? error.message : "Could not delete your account.", "error");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <>
      <ToastContainer />
      <ConfettiCanvas trigger={triggerConfetti} />

      <div className="app">
        <Header
          name={activeState.name}
          player={activeState.player}
          streak={currentBestStreak}
          weekLabel={weekLabel}
          pickerDateValue={pickerDateValue}
          showCurrentWeekButton={!isViewingCurrentWeek}
          onPickerDateChange={(value) => {
            if (!value) return;
            updateDisplayedWeek(parseDateKey(value));
          }}
          onCurrentWeek={() => {
            const currentWeekStart = getStartOfWeek(new Date());
            setDisplayWeekStartKey(localDateStr(currentWeekStart));
            setSelectedDateKey(todayKey);
          }}
          syncStatus={syncStatus}
        />
        <WeekStrip
          days={weekDays}
          selectedDateKey={selectedDateKey}
          onSelectDate={(dateKey) => setSelectedDateKey(dateKey)}
        />
        {selectedEntry?.isToday ? (
          <MascotArea habits={activeState.habits} globalStreak={activeState.player.streak || 0} syncStatus={syncStatus} errorState={errorState} />
        ) : null}
        {isOffline ? <OfflineBanner hasCachedDashboard={hasCachedDashboard} /> : null}

        <div className="section-header">
          <div>
            <div className="section-title" style={{ padding: 0 }}>{selectedSectionTitle}</div>
          </div>
          <div className="section-count">{selectedCount}</div>
        </div>

        {syncStatus === "error" && errorState?.scope === "mutation" ? (
          <div className="inline-error">
            <div>{errorState.message}</div>
            <button className="inline-link" onClick={retryBootstrap}>Refresh data</button>
          </div>
        ) : null}

        <div className="habits-list" ref={habitsListRef}>
          {activeState.habits.length === 0 ? (
            <div className="empty-state rich-empty">
              <div className="empty-title">Your garden is ready for its first habit</div>
              <div className="empty-copy">Add a routine and habitly will start tracking streaks, XP, and level-ups automatically.</div>
            </div>
          ) : !selectedEntry ? null : selectedEntry.isFuture ? (
            selectedScheduledHabits.length === 0 ? (
              <div className="empty-state rich-empty">
                <div className="empty-title">Nothing is planned for this day</div>
                <div className="empty-copy">Add a habit or adjust its active days if you want this day to carry more momentum.</div>
              </div>
            ) : (
              selectedScheduledHabits.map((habit, index) => (
                <div
                  key={`${selectedEntry.dateKey}-${habit.id}-future`}
                  className="habit-card future-card"
                  style={{ animationDelay: `${index * 0.07}s` }}
                >
                  <div className="habit-icon" style={{ background: `${habit.color}22` }}>
                    <span>{habit.emoji}</span>
                  </div>
                  <div className="habit-info">
                    <div className="habit-name">{habit.name}</div>
                    <div className="habit-meta">
                      <span className="badge rest">Scheduled</span>
                    </div>
                  </div>
                  <div className="habit-right">
                    <div className="habit-duration">
                      {habit.reminderTime ? (
                        <>
                          <ClockIcon className="inline-meta-icon" />
                          {formatTime(habit.reminderTime)}
                        </>
                      ) : "—"}
                    </div>
                    <button
                      className="edit-btn inline-edit-btn"
                      onClick={() => handleEditHabit(habit.id)}
                      aria-label={`Edit ${habit.name}`}
                      disabled={isReadOnlyMode || pendingMutations.editingIds.includes(habit.id) || pendingMutations.deletingIds.includes(habit.id)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))
            )
          ) : selectedEntry.isToday ? (
            sortedHabits.length === 0 ? (
              <div className="empty-state rich-empty">
                <div className="empty-title">Nothing is scheduled for today</div>
                <div className="empty-copy">Enjoy the lighter day, or add a habit if you want more momentum.</div>
              </div>
            ) : (
              sortedHabits.map((habit, index) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  index={index}
                  onToggle={() => { void toggleComplete(habit.id); }}
                  onEdit={handleEditHabit}
                  isSaving={pendingMutations.togglingIds.includes(habit.id)}
                  isEditing={pendingMutations.editingIds.includes(habit.id)}
                  isDeleting={pendingMutations.deletingIds.includes(habit.id)}
                  disabled={isReadOnlyMode}
                  isHighlighted={selectedEntry.isToday && focusedReminderSlot === habit.reminderTime}
                />
              ))
            )
          ) : selectedDoneHabits.length === 0 && selectedMissedHabits.length === 0 ? (
            <div className="empty-state rich-empty">
              <div className="empty-title">Nothing was scheduled on this day</div>
              <div className="empty-copy">This day had no habits lined up, so there was nothing to complete or miss.</div>
            </div>
          ) : (
            <div className="day-breakdown">
              <div className="day-column">
                <div className="day-column-title">Done</div>
                {selectedDoneHabits.length === 0 ? (
                  <div className="history-empty small">No completions logged.</div>
                ) : (
                  selectedDoneHabits.map((habit) => (
                    <div key={`${selectedEntry.dateKey}-${habit.id}-done`} className="history-item success inline-history-item">
                      <span>{habit.emoji}</span>
                      <span>{habit.name}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="day-column">
                <div className="day-column-title">Missed</div>
                {selectedMissedHabits.length === 0 ? (
                  <div className="history-empty small">Nothing missed.</div>
                ) : (
                  selectedMissedHabits.map((habit) => (
                    <div key={`${selectedEntry.dateKey}-${habit.id}-missed`} className="history-item warning inline-history-item">
                      <span>{habit.emoji}</span>
                      <span>{habit.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomBar
        onAdd={() => {
          if (isReadOnlyMode) {
            showOfflineMutationMessage();
            return;
          }
          setEditingId(null);
          setIsAddOpen(true);
        }}
        onStats={() => {
          const currentWeekStart = getStartOfWeek(new Date());
          setDisplayWeekStartKey(localDateStr(currentWeekStart));
          setSelectedDateKey(todayKey);
        }}
        onProfile={() => setIsProfileOpen(true)}
        disableAdd={isBusy || isReadOnlyMode}
      />

      <AddHabitModal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setEditingId(null);
        }}
        onSave={handleSaveHabit}
        onDelete={handleDeleteHabit}
        editData={editingHabit}
        isSaving={editingHabit ? isEditingHabitSaving : pendingMutations.adding}
        isDeleting={isEditingHabitDeleting}
      />

      <NameModal
        isOpen={isNameOpen}
        currentName={activeState.name}
        disabled={isReadOnlyMode}
        onClose={() => setIsNameOpen(false)}
        onSave={(name) => {
          if (isReadOnlyMode) {
            showOfflineMutationMessage();
            return;
          }
          void updateName(name).then((saved) => {
            if (saved) {
              setIsNameOpen(false);
            }
          });
        }}
      />

      <CompleteOverlay data={completeOverlayData} onClose={closeCompleteOverlay} />
      <LevelUpOverlay level={levelUpData} onClose={closeLevelUpOverlay} />
      <ProfilePage
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onEditName={() => {
          setIsProfileOpen(false);
          setIsNameOpen(true);
        }}
        onDeleteAccount={() => { void handleDeleteAccount(); }}
        onEnableNotifications={() => { void enableNotifications(); }}
        onDisableNotifications={() => { void disableNotifications(); }}
        onEnableEmailNotifications={() => { void enableEmailNotifications(); }}
        onDisableEmailNotifications={() => { void disableEmailNotifications(); }}
        name={activeState.name}
        email={activeState.email}
        photoURL={activeState.photoURL}
        level={activeState.player.level}
        levelXp={activeState.player.xp}
        totalXp={activeState.player.totalXp}
        stats={profileStats}
        analytics={analytics}
        isDeletingAccount={isDeletingAccount}
        readOnly={isReadOnlyMode}
        notificationsSupported={notificationsSupported}
        notificationsEnabled={notificationSettings.enabled}
        notificationPermission={notificationPermission}
        notificationTimezone={notificationSettings.timezone}
        emailNotificationsEnabled={Boolean(notificationSettings.emailEnabled)}
        emailNotificationAddress={notificationSettings.emailAddress || activeState.email}
        emailNotificationsAvailable={false}
        quietHoursEnabled={Boolean(notificationSettings.quietHoursEnabled)}
        quietHoursStart={notificationSettings.quietHoursStart || "22:00"}
        quietHoursEnd={notificationSettings.quietHoursEnd || "07:00"}
        onUpdateQuietHours={(nextQuietHours) => {
          if (isReadOnlyMode) {
            showOfflineMutationMessage();
            return;
          }
          void updateQuietHours(nextQuietHours);
        }}
        notificationBusy={notificationBusy}
        notificationError={notificationError}
      />
      <LocalMigrationPrompt
        open={migrationOpen}
        habitCount={migrationHabitCount}
        onConfirm={() => { void migrateLocalData(); }}
        onSkip={() => { void dismissLocalMigration(); }}
        isMigrating={migrationBusy}
        error={migrationError}
      />
    </>
  );
}
