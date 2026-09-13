import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Square, Save, AlertTriangle, Coffee, Eye } from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import { SessionRow, SESSION_TYPE_LABEL, SessionType } from "@/lib/analytics";

const fmtClock = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const IDLE_THRESHOLD_SEC = 60;

const Tracker = () => {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [focus, setFocus] = useState<number[]>([7]);
  const [notes, setNotes] = useState("");
  const [sessionType, setSessionType] = useState<SessionType>("deep_work");
  const [breakMin, setBreakMin] = useState("0");
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recent, setRecent] = useState<SessionRow[]>([]);
  const [manualMin, setManualMin] = useState("");
  const [distractions, setDistractions] = useState(0);
  const [autoTabBlur, setAutoTabBlur] = useState(0);
  const [autoIdle, setAutoIdle] = useState(0);
  const tick = useRef<number | null>(null);
  const lastActivity = useRef<number>(Date.now());
  const idleFlagged = useRef<boolean>(false);

  useEffect(() => {
    document.title = "Tracker — FocusLab";
  }, []);

  const loadRecent = async () => {
    const { data } = await supabase
      .from("study_sessions")
      .select("id, subject, duration_minutes, start_time, focus_score, distraction_count, session_type, break_minutes")
      .order("start_time", { ascending: false })
      .limit(8);
    setRecent((data ?? []) as SessionRow[]);
  };

  useEffect(() => {
    loadRecent();
  }, []);

  // Stopwatch tick
  useEffect(() => {
    if (running) {
      tick.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [running]);

  // Distraction auto-detection (visibility + idle)
  useEffect(() => {
    if (!running) return;
    const onVis = () => {
      if (document.hidden) {
        setAutoTabBlur((n) => n + 1);
      }
    };
    const bumpActivity = () => {
      lastActivity.current = Date.now();
      idleFlagged.current = false;
    };
    const idleCheck = window.setInterval(() => {
      const idleSec = (Date.now() - lastActivity.current) / 1000;
      if (idleSec >= IDLE_THRESHOLD_SEC && !idleFlagged.current) {
        idleFlagged.current = true;
        setAutoIdle((n) => n + 1);
      }
    }, 5000);

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("mousemove", bumpActivity);
    window.addEventListener("keydown", bumpActivity);
    window.addEventListener("touchstart", bumpActivity);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("mousemove", bumpActivity);
      window.removeEventListener("keydown", bumpActivity);
      window.removeEventListener("touchstart", bumpActivity);
      window.clearInterval(idleCheck);
    };
  }, [running]);

  const start = () => {
    if (!subject.trim()) {
      toast.error("Add a subject first");
      return;
    }
    setStartedAt(new Date());
    setElapsed(0);
    setDistractions(0);
    setAutoTabBlur(0);
    setAutoIdle(0);
    lastActivity.current = Date.now();
    idleFlagged.current = false;
    setRunning(true);
  };

  const stop = async () => {
    setRunning(false);
    if (!startedAt || !user) return;
    const minutes = Math.max(1, Math.round(elapsed / 60));
    const totalDistract = distractions + autoTabBlur + autoIdle;
    await save(minutes, startedAt, totalDistract);
  };

  const saveManual = async () => {
    if (!user) return;
    if (!subject.trim()) return toast.error("Add a subject first");
    const m = parseInt(manualMin, 10);
    if (!m || m <= 0) return toast.error("Enter valid minutes");
    await save(m, new Date(Date.now() - m * 60_000), distractions);
    setManualMin("");
  };

  const save = async (minutes: number, start: Date, distractCount: number) => {
    const breakNum = Math.max(0, parseInt(breakMin, 10) || 0);
    const { error } = await supabase.from("study_sessions").insert({
      user_id: user!.id,
      subject: subject.trim(),
      duration_minutes: minutes,
      start_time: start.toISOString(),
      focus_score: focus[0],
      notes: notes.trim() || null,
      distraction_count: distractCount,
      break_minutes: breakNum,
      session_type: sessionType,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Saved ${minutes} min of ${subject} (${distractCount} distractions)`);
    setNotes("");
    setElapsed(0);
    setStartedAt(null);
    setDistractions(0);
    setAutoTabBlur(0);
    setAutoIdle(0);
    setBreakMin("0");
    loadRecent();
  };

  const liveDistractions = distractions + autoTabBlur + autoIdle;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold">Study tracker</h1>
        <p className="text-muted-foreground mt-1">Time your session, log distractions, classify the work.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <section className="glass-card p-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Linear algebra, French vocab…"
                disabled={running}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Session type</Label>
              <Select value={sessionType} onValueChange={(v) => setSessionType(v as SessionType)} disabled={running}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deep_work">{SESSION_TYPE_LABEL.deep_work}</SelectItem>
                  <SelectItem value="revision">{SESSION_TYPE_LABEL.revision}</SelectItem>
                  <SelectItem value="casual">{SESSION_TYPE_LABEL.casual}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Focus score</Label>
              <span className="text-sm text-primary font-semibold">{focus[0]} / 10</span>
            </div>
            <Slider min={1} max={10} step={1} value={focus} onValueChange={setFocus} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="break">
                <Coffee className="h-3.5 w-3.5 inline mr-1" />
                Break minutes
              </Label>
              <Input
                id="break"
                type="number"
                min={0}
                max={240}
                value={breakMin}
                onChange={(e) => setBreakMin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </div>
          </div>

          <div className="rounded-xl bg-secondary/60 p-6 text-center space-y-3">
            <div className="font-display text-5xl font-bold tabular-nums">{fmtClock(elapsed)}</div>
            <div className="text-xs text-muted-foreground">
              {running ? "Recording…" : "Ready"}
            </div>

            {running && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {liveDistractions} distractions
                </Badge>
                <Badge variant="outline" className="gap-1 text-xs">
                  <Eye className="h-3 w-3" /> {autoTabBlur} tab-switch · {autoIdle} idle
                </Badge>
              </div>
            )}

            <div className="flex gap-2 justify-center pt-1">
              {!running ? (
                <Button onClick={start} className="bg-gradient-primary text-primary-foreground glow-ring hover:opacity-90">
                  <Play className="h-4 w-4 mr-2" /> Start session
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => setDistractions((n) => n + 1)}
                    variant="outline"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" /> +1 distraction
                  </Button>
                  <Button onClick={stop} variant="destructive">
                    <Square className="h-4 w-4 mr-2" /> Stop & save
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="manual">Or log past minutes</Label>
              <Input
                id="manual"
                type="number"
                min={1}
                value={manualMin}
                onChange={(e) => setManualMin(e.target.value)}
                placeholder="e.g. 45"
              />
            </div>
            <Button onClick={saveManual} variant="secondary">
              <Save className="h-4 w-4 mr-2" /> Save
            </Button>
          </div>
        </section>

        <section className="glass-card p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Recent sessions</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {recent.map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {s.subject}
                      {s.session_type && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                          {SESSION_TYPE_LABEL[s.session_type]}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(s.start_time), "MMM d · HH:mm")} ·{" "}
                      {formatDistanceStrict(0, s.duration_minutes * 60_000)}
                      {(s.distraction_count ?? 0) > 0 && (
                        <> · {s.distraction_count} distractions</>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-primary">{s.focus_score}/10</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default Tracker;
