import { SessionRow } from "./analytics";

export interface Goal {
  id: string;
  subject: string;
  weekly_target_minutes: number;
}

export interface GoalProgress extends Goal {
  doneMinutes: number;
  pct: number; // 0..100
  expectedPct: number; // pace expected by now
  atRisk: boolean;
}

/** Monday 00:00 of the current week (local time). */
export function startOfThisWeek(now = new Date()): Date {
  const d = new Date(now);
  const day = d.getDay(); // 0 Sun..6 Sat
  const back = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - back);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeGoalProgress(goals: Goal[], sessions: SessionRow[]): GoalProgress[] {
  const weekStart = startOfThisWeek();
  const now = new Date();
  const totals: Record<string, number> = {};
  for (const s of sessions) {
    const t = new Date(s.start_time);
    if (t >= weekStart && t <= now) {
      totals[s.subject] = (totals[s.subject] || 0) + s.duration_minutes;
    }
  }
  const elapsedFrac = Math.max(
    0.05,
    Math.min(1, (now.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)),
  );
  return goals.map((g) => {
    const done = totals[g.subject] || 0;
    const pct = Math.min(100, (done / g.weekly_target_minutes) * 100);
    const expectedPct = elapsedFrac * 100;
    const atRisk = pct < expectedPct * 0.75 && pct < 100;
    return { ...g, doneMinutes: done, pct, expectedPct, atRisk };
  });
}
