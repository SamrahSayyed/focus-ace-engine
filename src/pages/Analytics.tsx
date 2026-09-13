import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { SessionRow, dailySeries, subjectBreakdown } from "@/lib/analytics";
import InsightsPanel from "@/components/InsightsPanel";

const COLORS = [
  "hsl(252 87% 67%)",
  "hsl(268 90% 70%)",
  "hsl(188 92% 60%)",
  "hsl(152 70% 50%)",
  "hsl(38 95% 60%)",
  "hsl(0 75% 60%)",
];

const Analytics = () => {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Analytics — FocusLab";
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("id, subject, duration_minutes, start_time, focus_score")
        .order("start_time", { ascending: false });
      setSessions((data ?? []) as SessionRow[]);
      setLoading(false);
    })();
  }, []);

  const week = dailySeries(sessions, 7);
  const month = dailySeries(sessions, 30);
  const subjects = subjectBreakdown(sessions);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Spot trends across your study habits.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Minutes — last 7 days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass-card p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Focus trend — 30 days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={month}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={3} />
                <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Line type="monotone" dataKey="focus" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass-card p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold mb-4">Subject mix</h2>
          {subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Log sessions to see your subject breakdown.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subjects}
                    dataKey="minutes"
                    nameKey="subject"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={55}
                    paddingAngle={2}
                  >
                    {subjects.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <InsightsPanel />

      {!loading && sessions.length === 0 && (
        <p className="text-center text-muted-foreground">Log your first session to populate analytics.</p>
      )}
    </div>
  );
};

export default Analytics;
