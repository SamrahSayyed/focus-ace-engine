import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, ArrowRight } from "lucide-react";
import { computeGoalProgress, Goal } from "@/lib/goals";
import { SessionRow } from "@/lib/analytics";

const GoalsSummary = ({ sessions }: { sessions: SessionRow[] }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("goals")
        .select("id, subject, weekly_target_minutes")
        .order("subject");
      setGoals((data ?? []) as Goal[]);
      setLoading(false);
    })();
  }, []);

  const progress = computeGoalProgress(goals, sessions).slice(0, 5);

  return (
    <section className="glass-card p-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">Weekly goals</h2>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/goals">
            Manage <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-12 rounded-lg bg-secondary/60 animate-pulse" />
          <div className="h-12 rounded-lg bg-secondary/60 animate-pulse" />
        </div>
      ) : progress.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No goals yet.{" "}
          <Link to="/goals" className="text-primary underline-offset-4 hover:underline">
            Set a weekly target
          </Link>{" "}
          to track progress.
        </div>
      ) : (
        <ul className="space-y-3">
          {progress.map((g) => (
            <li key={g.id}>
              <div className="flex items-center justify-between text-sm mb-1 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{g.subject}</span>
                  {g.pct >= 100 ? (
                    <Badge className="bg-gradient-primary text-primary-foreground border-0 text-[10px] px-1.5 py-0">
                      Hit
                    </Badge>
                  ) : g.atRisk ? (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      At risk
                    </Badge>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {Math.round(g.doneMinutes)}/{g.weekly_target_minutes} min
                </span>
              </div>
              <Progress value={g.pct} className="h-2" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default GoalsSummary;
