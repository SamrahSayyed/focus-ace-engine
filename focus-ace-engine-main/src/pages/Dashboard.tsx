import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { Clock, Target, Flame, Plus, AlertTriangle, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import InsightsPanel from "@/components/InsightsPanel";
import TodaysPlan from "@/components/TodaysPlan";
import GoalsSummary from "@/components/GoalsSummary";
import {
  SessionRow,
  avgFocus,
  bestHour,
  currentStreak,
  dailySeries,
  totalDistractions,
  totalMinutes,
} from "@/lib/analytics";

const Dashboard = () => {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Dashboard — FocusLab";
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("id, subject, duration_minutes, start_time, focus_score, distraction_count, break_minutes, session_type")
        .order("start_time", { ascending: false });
      setSessions((data ?? []) as SessionRow[]);
      setLoading(false);
    })();
  }, []);

  const total = totalMinutes(sessions);
  const focus = avgFocus(sessions);
  const series = dailySeries(sessions, 7);
  const streak = currentStreak(sessions);
  const distractions = totalDistractions(sessions);
  const peak = bestHour(sessions);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Welcome to <span className="text-gradient">FocusLab</span>
          </h1>
          <p className="text-muted-foreground mt-1">Your study intelligence at a glance.</p>
        </div>
        <Button asChild className="bg-gradient-primary text-primary-foreground glow-ring hover:opacity-90">
          <Link to="/tracker"><Plus className="h-4 w-4 mr-2" /> Log a session</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<Clock className="h-5 w-5" />} label="Total minutes" value={total.toString()} hint={`${sessions.length} sessions`} />
        <StatCard icon={<Target className="h-5 w-5" />} label="Avg focus" value={focus ? focus.toFixed(1) : "—"} hint="out of 10" />
        <StatCard icon={<Flame className="h-5 w-5" />} label="Day streak" value={streak.toString()} hint={streak === 1 ? "day" : "days"} />
        <StatCard
          icon={<Sun className="h-5 w-5" />}
          label="Best time"
          value={peak !== null ? `${String(peak).padStart(2, "0")}:00` : "—"}
          hint="Peak focus hour"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Distractions"
          value={distractions.toString()}
          hint="all-time total"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Last 7 days · minutes</h2>
          <div className="h-64">
            {loading ? (
              <div className="h-full bg-secondary/40 rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="minutes" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="glass-card p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Last 7 days · focus</h2>
          <div className="h-64">
            {loading ? (
              <div className="h-full bg-secondary/40 rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="focus" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TodaysPlan />
        <GoalsSummary sessions={sessions} />
      </div>

      <InsightsPanel />
    </div>
  );
};

const StatCard = ({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) => (
  <div className="glass-card p-5">
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary grid place-items-center">{icon}</div>
    </div>
    <div className="font-display text-3xl font-bold">{value}</div>
    {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
  </div>
);

export default Dashboard;
