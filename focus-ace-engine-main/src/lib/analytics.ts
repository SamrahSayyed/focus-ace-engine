import { format, startOfDay, subDays } from "date-fns";

export type SessionType = "deep_work" | "revision" | "casual";

export interface SessionRow {
  id: string;
  subject: string;
  duration_minutes: number;
  start_time: string;
  focus_score: number;
  distraction_count?: number;
  break_minutes?: number;
  session_type?: SessionType;
}

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  deep_work: "Deep work",
  revision: "Revision",
  casual: "Casual",
};

export const totalMinutes = (s: SessionRow[]) =>
  s.reduce((a, x) => a + x.duration_minutes, 0);

export const avgFocus = (s: SessionRow[]) =>
  s.length ? s.reduce((a, x) => a + x.focus_score, 0) / s.length : 0;

export const totalDistractions = (s: SessionRow[]) =>
  s.reduce((a, x) => a + (x.distraction_count ?? 0), 0);

export const dailySeries = (s: SessionRow[], days = 7) => {
  const out: { day: string; minutes: number; focus: number }[] = [];
  const today = startOfDay(new Date());
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(today, i);
    const next = subDays(today, i - 1);
    const inDay = s.filter((x) => {
      const t = new Date(x.start_time);
      return t >= d && t < next;
    });
    out.push({
      day: format(d, "EEE"),
      minutes: inDay.reduce((a, x) => a + x.duration_minutes, 0),
      focus: inDay.length
        ? +(inDay.reduce((a, x) => a + x.focus_score, 0) / inDay.length).toFixed(2)
        : 0,
    });
  }
  return out;
};

export const subjectBreakdown = (s: SessionRow[]) => {
  const m: Record<string, number> = {};
  for (const x of s) m[x.subject] = (m[x.subject] || 0) + x.duration_minutes;
  return Object.entries(m)
    .map(([subject, minutes]) => ({ subject, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 6);
};

/** Avg focus per subject (min 1 session). */
export const focusBySubject = (s: SessionRow[]) => {
  const m: Record<string, { sum: number; n: number; min: number }> = {};
  for (const x of s) {
    m[x.subject] ??= { sum: 0, n: 0, min: 0 };
    m[x.subject].sum += x.focus_score;
    m[x.subject].n += 1;
    m[x.subject].min += x.duration_minutes;
  }
  return Object.entries(m)
    .map(([subject, v]) => ({ subject, focus: +(v.sum / v.n).toFixed(2), sessions: v.n, minutes: v.min }))
    .sort((a, b) => b.focus - a.focus);
};

/** 7 (days) x 24 (hours) heatmap of total minutes. */
export const heatmap = (s: SessionRow[]) => {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const x of s) {
    const t = new Date(x.start_time);
    const d = t.getDay(); // 0 = Sun
    const h = t.getHours();
    grid[d][h] += x.duration_minutes;
  }
  return grid;
};

/** Best hour-of-day by total focused minutes (focus * minutes). */
export const bestHour = (s: SessionRow[]): number | null => {
  if (s.length === 0) return null;
  const buckets: number[] = Array(24).fill(0);
  for (const x of s) {
    const h = new Date(x.start_time).getHours();
    buckets[h] += x.duration_minutes * (x.focus_score / 10);
  }
  let best = 0;
  for (let i = 1; i < 24; i++) if (buckets[i] > buckets[best]) best = i;
  return buckets[best] === 0 ? null : best;
};

/** Current consecutive-day streak ending today. */
export const currentStreak = (s: SessionRow[]): number => {
  const days = new Set(s.map((x) => format(new Date(x.start_time), "yyyy-MM-dd")));
  let n = 0;
  const d = new Date();
  while (days.has(format(d, "yyyy-MM-dd"))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
};

/** Focus-vs-duration scatter points. */
export const focusVsDuration = (s: SessionRow[]) =>
  s.map((x) => ({ minutes: x.duration_minutes, focus: x.focus_score, subject: x.subject }));
