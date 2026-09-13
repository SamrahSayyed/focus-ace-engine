import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trash2, Target, Plus } from "lucide-react";
import { toast } from "sonner";
import { computeGoalProgress, Goal, GoalProgress } from "@/lib/goals";
import { SessionRow } from "@/lib/analytics";

const Goals = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [subject, setSubject] = useState("");
  const [target, setTarget] = useState<number>(180);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Goals — FocusLab";
  }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: g }, { data: s }] = await Promise.all([
      supabase.from("goals").select("id, subject, weekly_target_minutes").order("subject"),
      supabase
        .from("study_sessions")
        .select("id, subject, duration_minutes, start_time, focus_score, distraction_count, break_minutes, session_type"),
    ]);
    setGoals((g ?? []) as Goal[]);
    setSessions((s ?? []) as SessionRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addGoal = async () => {
    if (!user) return;
    const sub = subject.trim();
    if (!sub) {
      toast.error("Subject is required");
      return;
    }
    if (!target || target < 1) {
      toast.error("Target must be at least 1 minute");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("goals").upsert(
      { user_id: user.id, subject: sub, weekly_target_minutes: target },
      { onConflict: "user_id,subject" },
    );
    setSaving(false);
    if (error) {
      toast.error("Couldn't save goal");
      return;
    }
    toast.success("Goal saved");
    setSubject("");
    setTarget(180);
    load();
  };

  const removeGoal = async (id: string) => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't delete");
      return;
    }
    setGoals((arr) => arr.filter((g) => g.id !== id));
  };

  const progress: GoalProgress[] = computeGoalProgress(goals, sessions);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold">Weekly goals</h1>
        <p className="text-muted-foreground mt-1">
          Set a minute target per subject. Progress resets every Monday.
        </p>
      </div>

      <section className="glass-card p-6 space-y-4">
        <div className="grid sm:grid-cols-[2fr,1fr,auto] gap-3 items-end">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Mathematics"
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target">Weekly target (minutes)</Label>
            <Input
              id="target"
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value) || 0)}
            />
          </div>
          <Button
            onClick={addGoal}
            disabled={saving}
            className="bg-gradient-primary text-primary-foreground glow-ring hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-2" /> Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Saving a goal for an existing subject updates the target.
        </p>
      </section>

      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">This week's progress</h2>
        </div>
        {loading ? (
          <div className="space-y-3">
            <div className="h-16 rounded-lg bg-secondary/60 animate-pulse" />
            <div className="h-16 rounded-lg bg-secondary/60 animate-pulse" />
          </div>
        ) : progress.length === 0 ? (
          <p className="text-sm text-muted-foreground">No goals yet — add one above to start tracking.</p>
        ) : (
          <ul className="space-y-4">
            {progress.map((g) => (
              <li key={g.id} className="rounded-lg border border-border/60 bg-secondary/40 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold truncate">{g.subject}</span>
                    {g.pct >= 100 ? (
                      <Badge className="bg-gradient-primary text-primary-foreground border-0">Hit</Badge>
                    ) : g.atRisk ? (
                      <Badge variant="destructive">At risk</Badge>
                    ) : (
                      <Badge variant="secondary">On pace</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeGoal(g.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Progress value={g.pct} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>
                    {Math.round(g.doneMinutes)} / {g.weekly_target_minutes} min ({Math.round(g.pct)}%)
                  </span>
                  <span>Expected by now: {Math.round(g.expectedPct)}%</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Goals;
