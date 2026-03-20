"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { Header } from "../components/Header";
import { WeekStrip } from "../components/WeekStrip";
import { MascotArea } from "../components/MascotArea";
import { HabitCard } from "../components/HabitCard";
import { BottomBar } from "../components/BottomBar";
import { AddHabitModal } from "../components/AddHabitModal";
import { NameModal } from "../components/NameModal";
import { ProfilePage } from "../components/ProfilePage";
import { CompleteOverlay } from "../components/CompleteOverlay";
import { LevelUpOverlay } from "../components/LevelUpOverlay";
import { ConfettiCanvas } from "../components/ConfettiCanvas";
import { LocalMigrationPrompt } from "../components/LocalMigrationPrompt";
import { ToastContainer } from "../components/ToastContainer";
import { useHabits, todayStr, isScheduledToday, Habit, formatTime } from "../lib/useHabits";
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

function LoadingShell({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="app-shell state-shell">
      <div className="state-card">
        <div className="state-mascot">
          <Image src="/mascot/mascot_syncing_working.png" alt="Syncing mascot" width={160} height={160} priority />
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

function formatHistoryLabel(date: Date, offset: number) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function habitWasActiveOnDate(habit: Habit, dateKey: string) {
  if (!habit.createdAt) return true;
  return habit.createdAt <= dateKey;
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
  } = useNotifications();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isNameOpen, setIsNameOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [displayWeekStartKey, setDisplayWeekStartKey] = useState(localDateStr(getStartOfWeek(new Date())));
  const [selectedDateKey, setSelectedDateKey] = useState(todayStr());
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [hasDismissedSplash, setHasDismissedSplash] = useState(false);

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

  const todayKey = todayStr();
  const todayDate = useMemo(() => parseDateKey(todayKey), [todayKey]);
  const displayWeekStart = useMemo(() => parseDateKey(displayWeekStartKey), [displayWeekStartKey]);

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
      const completedIds = new Set(state.completionHistory[dateKey] || []);
      const scheduled = state.habits.filter(
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
  }, [displayWeekStart, state.completionHistory, state.habits, todayDate, todayKey]);

  const weekDays = useMemo(() => {
    return stripEntries.map((entry) => ({
      label: entry.label,
      num: entry.dayNum,
      hasDots: entry.scheduled.length > 0,
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
        <LoadingShell title="Opening habitly" subtitle="Checking your session and waking up Moe..." />
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

  if (bootStatus === "loading") {
    return (
      <>
        <ToastContainer />
        <LoadingShell title="Syncing your dashboard" subtitle="Pulling in habits, streaks, and your saved progress." />
      </>
    );
  }

  if (bootStatus === "error" && errorState) {
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
  const scheduledToday = state.habits.filter((habit) => isScheduledToday(habit.daysOfWeek));
  const sortedHabits = [...scheduledToday].sort((a, b) => {
    const aDone = a.lastCompleted === today ? 1 : 0;
    const bDone = b.lastCompleted === today ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return b.streak - a.streak;
  });

  const editingHabit = editingId ? state.habits.find((habit) => habit.id === editingId) || null : null;
  const isEditingHabitSaving = Boolean(editingId && pendingMutations.editingIds.includes(editingId));
  const isEditingHabitDeleting = Boolean(editingId && pendingMutations.deletingIds.includes(editingId));
  const isBusy =
    pendingMutations.adding ||
    pendingMutations.naming ||
    pendingMutations.editingIds.length > 0 ||
    pendingMutations.deletingIds.length > 0 ||
    pendingMutations.togglingIds.length > 0;
  const totalCompleted = state.habits.reduce((sum, habit) => sum + habit.totalDone, 0);
  const longestStreak = Math.max(0, ...state.habits.map((habit) => habit.longestStreak || 0));
  const currentBestStreak = Math.max(0, ...state.habits.map((habit) => habit.streak || 0));
  const daysActive = Object.keys(state.completionHistory).length;
  const completionRate =
    scheduledToday.length === 0
      ? 0
      : Math.round((sortedHabits.filter((habit) => habit.lastCompleted === today).length / scheduledToday.length) * 100);
  const selectedCount = selectedEntry
    ? selectedEntry.isFuture
      ? selectedScheduledHabits.length
      : selectedDoneHabits.length + selectedMissedHabits.length
    : 0;
  const selectedSectionTitle = selectedEntry
    ? selectedEntry.isToday
      ? "Today's Habits"
      : `${selectedEntry.label}, ${selectedEntry.date}`
    : "Day view";

  const profileStats = [
    { label: "Current best streak", value: `${currentBestStreak} days`, tone: "sage" as const },
    { label: "Longest streak", value: `${longestStreak} days`, tone: "sun" as const },
    { label: "Habits completed", value: `${totalCompleted}`, tone: "sky" as const },
    { label: "Days active", value: `${daysActive}`, tone: "rose" as const },
    { label: "Habits in rotation", value: `${state.habits.length}`, tone: "sage" as const },
    { label: "Today done", value: `${completionRate}%`, tone: "sun" as const },
  ];

  const handleSaveHabit = (id: string | null, updates: Partial<Habit>) => {
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
    void deleteHabit(id).then((deleted) => {
      if (deleted) {
        setEditingId(null);
        setIsAddOpen(false);
      }
    });
  };

  const handleEditHabit = (id: string) => {
    setEditingId(id);
    setIsAddOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (!user || isDeletingAccount) return;

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
      const habitsSnapshot = await getDocs(habitsRef);
      const devicesSnapshot = await getDocs(devicesRef);
      const reminderDispatchesSnapshot = await getDocs(reminderDispatchesRef);
      const batch = writeBatch(db);

      habitsSnapshot.forEach((habitDoc) => {
        batch.delete(habitDoc.ref);
      });

      devicesSnapshot.forEach((deviceDoc) => {
        batch.delete(deviceDoc.ref);
      });

      reminderDispatchesSnapshot.forEach((dispatchDoc) => {
        batch.delete(dispatchDoc.ref);
      });

      batch.delete(doc(db, "users", user.uid));
      await batch.commit();
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
          name={state.name}
          player={state.player}
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
          <MascotArea habits={state.habits} syncStatus={syncStatus} errorState={errorState} />
        ) : null}

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

        <div className="habits-list">
          {state.habits.length === 0 ? (
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
                    <div className="habit-duration">{habit.reminderTime ? `⏱ ${formatTime(habit.reminderTime)}` : "—"}</div>
                    <button
                      className="edit-btn inline-edit-btn"
                      onClick={() => handleEditHabit(habit.id)}
                      aria-label={`Edit ${habit.name}`}
                      disabled={pendingMutations.editingIds.includes(habit.id) || pendingMutations.deletingIds.includes(habit.id)}
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
          setEditingId(null);
          setIsAddOpen(true);
        }}
        onStats={() => {
          const currentWeekStart = getStartOfWeek(new Date());
          setDisplayWeekStartKey(localDateStr(currentWeekStart));
          setSelectedDateKey(todayKey);
        }}
        onProfile={() => setIsProfileOpen(true)}
        disabled={isBusy}
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
        currentName={state.name}
        onClose={() => setIsNameOpen(false)}
        onSave={(name) => {
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
        name={state.name}
        email={state.email}
        photoURL={state.photoURL}
        level={state.player.level}
        levelXp={state.player.xp}
        totalXp={state.player.totalXp}
        stats={profileStats}
        isDeletingAccount={isDeletingAccount}
        notificationsSupported={notificationsSupported}
        notificationsEnabled={notificationSettings.enabled}
        notificationPermission={notificationPermission}
        notificationTimezone={notificationSettings.timezone}
        emailNotificationsEnabled={Boolean(notificationSettings.emailEnabled)}
        emailNotificationAddress={notificationSettings.emailAddress || state.email}
        emailNotificationsAvailable={false}
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
