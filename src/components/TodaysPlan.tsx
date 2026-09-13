import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarRange, PartyPopper, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ScheduledTask {
  id: string;
  schedule_date: string;
  subject: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  reason: string | null;
  position: number;
  completed: boolean;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const TodaysPlan = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("scheduled_tasks")
      .select("id, schedule_date, subject, start_time, end_time, duration_minutes, reason, position, completed")
      .eq("schedule_date", todayISO())
      .order("position", { ascending: true });
    setTasks((data ?? []) as ScheduledTask[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (t: ScheduledTask, next: boolean) => {
    setTasks((arr) => arr.map((x) => (x.id === t.id ? { ...x, completed: next } : x)));
    const { error } = await supabase
      .from("scheduled_tasks")
      .update({ completed: next, completed_at: next ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) {
      toast.error("Couldn't update task");
      setTasks((arr) => arr.map((x) => (x.id === t.id ? { ...x, completed: !next } : x)));
    }
  };

  const clearToday = async () => {
    const ids = tasks.map((t) => t.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from("scheduled_tasks").delete().in("id", ids);
    if (error) {
      toast.error("Couldn't clear plan");
      return;
    }
    setTasks([]);
    toast.success("Today's plan cleared");
  };

  const allDone = tasks.length > 0 && tasks.every((t) => t.completed);
  const doneCount = tasks.filter((t) => t.completed).length;

  return (
    <section className="glass-card p-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">Today's plan</h2>
          {tasks.length > 0 && (
            <Badge variant="secondary">
              {doneCount}/{tasks.length} done
            </Badge>
          )}
        </div>
        {tasks.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearToday}>
            <Trash2 className="h-4 w-4 mr-2" /> Clear
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-14 rounded-lg bg-secondary/60 animate-pulse" />
          <div className="h-14 rounded-lg bg-secondary/60 animate-pulse" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No plan for today.{" "}
          <Link to="/scheduler" className="text-primary underline-offset-4 hover:underline">
            Generate one in the Scheduler
          </Link>
          .
        </div>
      ) : (
        <>
          {allDone && (
            <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 p-4 flex items-center gap-3">
              <PartyPopper className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="font-display font-semibold">Good work — schedule completed!</div>
                <div className="text-xs text-muted-foreground">
                  Every block is checked off. Take a real break before the next one.
                </div>
              </div>
            </div>
          )}
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li
                key={t.id}
                className={`flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/40 p-3 transition-opacity ${
                  t.completed ? "opacity-60" : ""
                }`}
              >
                <Checkbox
                  checked={t.completed}
                  onCheckedChange={(v) => toggle(t, !!v)}
                  aria-label={`Mark ${t.subject} ${t.completed ? "incomplete" : "complete"}`}
                />
                <div className="font-display font-bold text-primary tabular-nums text-sm w-16 shrink-0">
                  {t.start_time}
                  <div className="text-xs text-muted-foreground font-sans font-normal">{t.end_time}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold truncate ${t.completed ? "line-through" : ""}`}>{t.subject}</div>
                  {t.reason && <div className="text-xs text-muted-foreground truncate">{t.reason}</div>}
                </div>
                <Badge variant="outline" className="shrink-0">
                  {t.duration_minutes}m
                </Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

export default TodaysPlan;
