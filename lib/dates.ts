export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

export function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTime(timeStr?: string): string {
  if (!timeStr) return '';
  const [hh, mm] = timeStr.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

// 0=Sun, 6=Sat
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isScheduledToday(daysOfWeek?: number[]): boolean {
  return (daysOfWeek || ALL_DAYS).includes(new Date().getDay());
}

export function lastScheduledDayBefore(daysOfWeek: number[] | undefined, dateStr: string): string | null {
  const days = daysOfWeek || ALL_DAYS;
  if (days.length === 0) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const cursor = new Date(y, m - 1, d);
  cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 14; i++) {
    if (days.includes(cursor.getDay())) return localDateStr(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }
  return null;
}
