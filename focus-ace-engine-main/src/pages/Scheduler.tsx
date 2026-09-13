import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarRange, Plus, X, Sparkles, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

interface ScheduleBlock {
  subject: string;
  start: string;
  end: string;
  durationMin: number;
  reason: string;
}

interface ScheduleResponse {
  schedule: ScheduleBlock[];
  bestHour: number | null;
  recommendedLength: number;
  usedFallback: boolean;
  notes?: string[];
}

const Scheduler = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<string[]>([""]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ScheduleResponse | null>(null);

  useEffect(() => {
    document.title = "Smart Scheduler — FocusLab";
  }, []);

  const updateSubject = (i: number, v: string) => {
    setSubjects((arr) => arr.map((s, idx) => (idx === i ? v : s)));
  };
  const addSubject = () => setSubjects((arr) => [...arr, ""]);
  const removeSubject = (i: number) =>
    setSubjects((arr) => (arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i)));

  const generate = async () => {
    const cleaned = subjects.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      toast.error("Add at least one subject");
      return;
    }
    if (startTime >= endTime) {
      toast.error("End time must be after start time");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("compute-insights", {
        body: {
          mode: "schedule",
          subjects: cleaned,
          date,
          slot: { start: startTime, end: endTime },
        },
      });
      if (error) throw error;
      setResult(data as ScheduleResponse);
    } catch (e: any) {
      toast.error("Couldn't generate schedule, using fallback");
      // Local fallback so UI never breaks
      setResult(localFallback(cleaned, date, startTime, endTime));
    } finally {
      setLoading(false);
    }
  };

  const saveToDashboard = async () => {
    if (!user || !result || result.schedule.length === 0) return;
    setSaving(true);
    // Replace any existing plan for this date
    const { error: delErr } = await supabase
      .from("scheduled_tasks")
      .delete()
      .eq("user_id", user.id)
      .eq("schedule_date", date);
    if (delErr) {
      setSaving(false);
      toast.error("Couldn't replace existing plan");
      return;
    }
    const rows = result.schedule.map((b, i) => ({
      user_id: user.id,
      schedule_date: date,
      subject: b.subject,
      start_time: b.start,
      end_time: b.end,
      duration_minutes: b.durationMin,
      reason: b.reason,
      position: i,
    }));
    const { error } = await supabase.from("scheduled_tasks").insert(rows);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save plan");
      return;
    }
    toast.success("Saved to your dashboard");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold">Smart scheduler</h1>
        <p className="text-muted-foreground mt-1">
          Generate a focus-optimized study plan based on your past sessions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,1.4fr]">
        <section className="glass-card p-6 space-y-5">
          <div>
            <Label className="mb-2 block">Subjects</Label>
            <div className="space-y-2">
              {subjects.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={s}
                    onChange={(e) => updateSubject(i, e.target.value)}
                    placeholder={`Subject ${i + 1}`}
                    maxLength={80}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeSubject(i)} aria-label="Remove">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addSubject}>
                <Plus className="h-4 w-4 mr-2" /> Add subject
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">Available from</Label>
              <Input id="start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Until</Label>
              <Input id="end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <Button
            onClick={generate}
            disabled={loading}
            className="w-full bg-gradient-primary text-primary-foreground glow-ring hover:opacity-90"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {result ? "Regenerate schedule" : "Generate schedule"}
          </Button>
        </section>

        <section className="glass-card p-6">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">Your plan</h2>
              {result && (result.usedFallback ? (
                <Badge variant="secondary">Heuristic</Badge>
              ) : (
                <Badge className="bg-gradient-primary text-primary-foreground border-0">ML</Badge>
              ))}
            </div>
            {result && result.schedule.length > 0 && (
              <Button size="sm" onClick={saveToDashboard} disabled={saving} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
                {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save to dashboard
              </Button>
            )}
          </div>

          {!result ? (
            <p className="text-sm text-muted-foreground">
              Add subjects and a time window, then generate a plan.
            </p>
          ) : result.schedule.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocks could be scheduled in that window.</p>
          ) : (
            <>
              <div className="text-xs text-muted-foreground mb-3">
                {result.bestHour !== null && (
                  <>Peak hour from your history: <strong>{String(result.bestHour).padStart(2, "0")}:00</strong> · </>
                )}
                Recommended block length: <strong>{result.recommendedLength} min</strong>
              </div>
              <ol className="space-y-2">
                {result.schedule.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-4 rounded-lg border border-border/60 bg-secondary/40 p-4"
                  >
                    <div className="font-display font-bold text-primary text-lg tabular-nums">
                      {b.start}
                      <div className="text-xs text-muted-foreground font-sans font-normal">{b.end}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{b.subject}</div>
                      <div className="text-xs text-muted-foreground">{b.reason}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0">{b.durationMin} min</Badge>
                  </li>
                ))}
              </ol>
              {result.notes && result.notes.length > 0 && (
                <div className="mt-4 text-xs text-muted-foreground space-y-1">
                  {result.notes.map((n, i) => <div key={i}>• {n}</div>)}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

// Last-resort client-side fallback so UI never crashes
function localFallback(subjects: string[], date: string, start: string, end: string): ScheduleResponse {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const totalMin = (eh * 60 + em) - (sh * 60 + sm);
  const blockLen = 50;
  const breakLen = 10;
  const blocks: ScheduleBlock[] = [];
  let cur = sh * 60 + sm;
  let i = 0;
  while (cur + blockLen <= eh * 60 + em && i < subjects.length * 4) {
    const subject = subjects[i % subjects.length];
    const startH = Math.floor(cur / 60);
    const startM = cur % 60;
    const endMin = cur + blockLen;
    const endH = Math.floor(endMin / 60);
    const endMM = endMin % 60;
    blocks.push({
      subject,
      start: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
      end: `${String(endH).padStart(2, "0")}:${String(endMM).padStart(2, "0")}`,
      durationMin: blockLen,
      reason: "Default rotation (offline fallback)",
    });
    cur = endMin + breakLen;
    i++;
  }
  return {
    schedule: blocks,
    bestHour: null,
    recommendedLength: blockLen,
    usedFallback: true,
    notes: ["Offline fallback used — rotated subjects in 50/10 Pomodoros."],
  };
}

export default Scheduler;
