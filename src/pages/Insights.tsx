import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ZAxis,
  BarChart,
  Bar,
} from "recharts";
import {
  SessionRow,
  bestHour,
  focusBySubject,
  focusVsDuration,
  heatmap,
  currentStreak,
} from "@/lib/analytics";
import { Sparkles, Clock, Target, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AIInsight {
  title: string;
  body: string;
  kind: "ml" | "rule";
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const Insights = () => {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiFallback, setAiFallback] = useState(false);

  useEffect(() => {
    document.title = "Focus Insights — FocusLab";
  }, []);

  const loadSessions = async () => {
    const { data } = await supabase
      .from("study_sessions")
      .select("id, subject, duration_minutes, start_time, focus_score, distraction_count, break_minutes, session_type")
      .order("start_time", { ascending: false });
    setSessions((data ?? []) as SessionRow[]);
    setLoading(false);
  };

  const loadAI = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("compute-insights");
      if (error) throw error;
      setAiInsights(data?.insights ?? []);
      setAiFallback(!!data?.usedFallback);
    } catch {
      setAiInsights([
        { kind: "rule", title: "Insights warming up", body: "Log a few sessions to unlock recommendations." },
      ]);
      setAiFallback(true);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    loadAI();
  }, []);

  const grid = useMemo(() => heatmap(sessions), [sessions]);
  const maxCell = useMemo(() => Math.max(1, ...grid.flat()), [grid]);
  const subjectFocus = useMemo(() => focusBySubject(sessions), [sessions]);
  const scatter = useMemo(() => focusVsDuration(sessions), [sessions]);
  const peak = bestHour(sessions);
  const streak = currentStreak(sessions);
  const avgLen = sessions.length
    ? Math.round(sessions.reduce((a, x) => a + x.duration_minutes, 0) / sessions.length)
    : 0;
  const recommendedLen = (() => {
    // Pick the duration bucket with highest avg focus
    if (sessions.length < 3) return null;
    const buckets: Record<string, { sum: number; n: number; mid: number }> = {
      "<25": { sum: 0, n: 0, mid: 20 },
      "25-50": { sum: 0, n: 0, mid: 40 },
      "50-90": { sum: 0, n: 0, mid: 70 },
      ">90": { sum: 0, n: 0, mid: 110 },
    };
    for (const s of sessions) {
      const k = s.duration_minutes < 25 ? "<25" : s.duration_minutes < 50 ? "25-50" : s.duration_minutes < 90 ? "50-90" : ">90";
      buckets[k].sum += s.focus_score;
      buckets[k].n += 1;
    }
    const best = Object.values(buckets)
      .filter((b) => b.n > 0)
      .sort((a, b) => b.sum / b.n - a.sum / a.n)[0];
    return best ? best.mid : null;
  })();

  const hourLabel = (h: number) => `${h.toString().padStart(2, "0")}:00`;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">Focus Insights</h1>
          <p className="text-muted-foreground mt-1">When you study best, and how to study smarter.</p>
        </div>
        <Button variant="ghost" onClick={loadAI} disabled={aiLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${aiLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Top KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KPI
          icon={<Clock className="h-5 w-5" />}
          label="Best time to study"
          value={peak !== null ? hourLabel(peak) : "—"}
          hint="Highest focus × minutes"
        />
        <KPI
          icon={<Target className="h-5 w-5" />}
          label="Recommended length"
          value={recommendedLen ? `${recommendedLen} min` : "—"}
          hint="Where your focus peaks"
        />
        <KPI
          icon={<Calendar className="h-5 w-5" />}
          label="Consistency streak"
          value={`${streak} ${streak === 1 ? "day" : "days"}`}
          hint={streak >= 3 ? "Strong rhythm" : "Build momentum"}
        />
      </div>

      {/* AI / Heuristic recommendations */}
      <section className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold">Recommendations</h2>
            {aiFallback ? (
              <Badge variant="secondary">Heuristic</Badge>
            ) : (
              <Badge className="bg-gradient-primary text-primary-foreground border-0">ML</Badge>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {aiLoading && aiInsights.length === 0 ? (
            <>
              <div className="h-24 rounded-lg bg-secondary/60 animate-pulse" />
              <div className="h-24 rounded-lg bg-secondary/60 animate-pulse" />
            </>
          ) : (
            aiInsights.map((i, idx) => (
              <article
                key={idx}
                className="rounded-lg border border-border/60 bg-secondary/40 p-4 hover:border-primary/40 transition-colors"
              >
                <h3 className="font-display font-semibold mb-1">{i.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{i.body}</p>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Heatmap */}
      <section className="glass-card p-6">
        <h2 className="font-display text-xl font-semibold mb-1">Productivity heatmap</h2>
        <p className="text-sm text-muted-foreground mb-4">Total minutes by day-of-week and hour. Darker = more focus time.</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Log sessions to populate the heatmap.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex">
                <div className="w-10" />
                <div className="flex flex-1 gap-[2px]">
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="flex-1 text-[9px] text-muted-foreground text-center">
                      {h % 3 === 0 ? h : ""}
                    </div>
                  ))}
                </div>
              </div>
              {grid.map((row, d) => (
                <div key={d} className="flex items-center mt-[2px]">
                  <div className="w-10 text-xs text-muted-foreground">{DAYS[d]}</div>
                  <div className="flex flex-1 gap-[2px]">
                    {row.map((v, h) => {
                      const intensity = v / maxCell;
                      return (
                        <div
                          key={h}
                          className="heat-cell flex-1 aspect-square rounded-sm border border-border/40"
                          style={{
                            backgroundColor: v === 0
                              ? "hsl(var(--secondary))"
                              : `hsl(var(--primary) / ${0.15 + intensity * 0.85})`,
                          }}
                          title={`${DAYS[d]} ${hourLabel(h)} · ${v} min`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Focus by subject + scatter */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Avg focus by subject</h2>
          <div className="h-64">
            {subjectFocus.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                No subject data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectFocus.slice(0, 8)} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="subject" stroke="hsl(var(--muted-foreground))" fontSize={12} width={90} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Bar dataKey="focus" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="glass-card p-6">
          <h2 className="font-display text-lg font-semibold mb-1">Focus vs duration</h2>
          <p className="text-xs text-muted-foreground mb-3">Do longer sessions help or hurt your focus?</p>
          <div className="h-64">
            {scatter.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                Not enough data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="minutes" name="Minutes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="focus" name="Focus" domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <ZAxis range={[60, 60]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                  />
                  <Scatter data={scatter} fill="hsl(var(--accent))" />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {!loading && sessions.length === 0 && (
        <p className="text-center text-muted-foreground">Log a session in the Tracker to start seeing insights.</p>
      )}
    </div>
  );
};

const KPI = ({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) => (
  <div className="glass-card p-5">
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary grid place-items-center">{icon}</div>
    </div>
    <div className="font-display text-3xl font-bold">{value}</div>
    {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
  </div>
);

export default Insights;
