// Insights + Scheduler edge function
// All ML wrapped in try/catch with rule-based fallback so the API never fails.
// Uses Lovable AI Gateway (gemini-2.5-flash) to rephrase rule/ML insights more
// conversationally; if the AI call fails, the original phrasing is used.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SessionRow {
  id: string;
  subject: string;
  duration_minutes: number;
  start_time: string;
  focus_score: number;
  distraction_count?: number;
  break_minutes?: number;
  session_type?: string;
}

interface GoalRow {
  subject: string;
  weekly_target_minutes: number;
}

interface Insight {
  title: string;
  body: string;
  kind: "ml" | "rule" | "goal";
}

// ---------- Math helpers ----------
function linearRegression(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 2) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: meanY - slope * meanX };
}

function kmeans1D(values: number[], k: number, iters = 20) {
  if (values.length === 0) return [];
  const k_ = Math.min(k, values.length);
  const sorted = [...values].sort((a, b) => a - b);
  const centroids: number[] = [];
  for (let i = 0; i < k_; i++) centroids.push(sorted[Math.floor((i * sorted.length) / k_)]);
  for (let it = 0; it < iters; it++) {
    const buckets: number[][] = Array.from({ length: k_ }, () => []);
    for (const v of values) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k_; c++) {
        const d = Math.abs(v - centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      buckets[best].push(v);
    }
    for (let c = 0; c < k_; c++) {
      if (buckets[c].length > 0) {
        centroids[c] = buckets[c].reduce((a, b) => a + b, 0) / buckets[c].length;
      }
    }
  }
  return centroids.sort((a, b) => a - b);
}

function partOfDay(hour: number): string {
  if (hour < 5) return "late night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function bestHourFromSessions(sessions: SessionRow[]): number | null {
  if (sessions.length === 0) return null;
  const buckets: number[] = Array(24).fill(0);
  for (const s of sessions) {
    const h = new Date(s.start_time).getHours();
    buckets[h] += s.duration_minutes * (s.focus_score / 10);
  }
  let best = 0;
  for (let i = 1; i < 24; i++) if (buckets[i] > buckets[best]) best = i;
  return buckets[best] === 0 ? null : best;
}

function recommendedLength(sessions: SessionRow[]): number {
  if (sessions.length < 3) return 50;
  const buckets = [
    { lo: 0, hi: 25, mid: 20, sum: 0, n: 0 },
    { lo: 25, hi: 50, mid: 40, sum: 0, n: 0 },
    { lo: 50, hi: 90, mid: 70, sum: 0, n: 0 },
    { lo: 90, hi: 1e9, mid: 110, sum: 0, n: 0 },
  ];
  for (const s of sessions) {
    const b = buckets.find((x) => s.duration_minutes >= x.lo && s.duration_minutes < x.hi)!;
    b.sum += s.focus_score;
    b.n += 1;
  }
  const ranked = buckets.filter((b) => b.n > 0).sort((a, b) => b.sum / b.n - a.sum / a.n);
  return ranked[0]?.mid ?? 50;
}

// ---------- Goals: at-risk insight ----------
function goalAtRiskInsight(sessions: SessionRow[], goals: GoalRow[]): Insight | null {
  if (goals.length === 0) return null;
  const now = new Date();
  const day = now.getDay(); // 0 Sun
  // Week starts Monday
  const daysSinceMon = (day + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysSinceMon);
  weekStart.setHours(0, 0, 0, 0);

  const weekTotals: Record<string, number> = {};
  for (const s of sessions) {
    const t = new Date(s.start_time);
    if (t >= weekStart && t <= now) {
      weekTotals[s.subject] = (weekTotals[s.subject] || 0) + s.duration_minutes;
    }
  }

  // Fraction of the week elapsed (Mon 00:00 → next Mon 00:00)
  const elapsedMs = now.getTime() - weekStart.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const elapsedFrac = Math.max(0.05, Math.min(1, elapsedMs / weekMs));

  // A goal is "at risk" if you're behind expected pace by 25%+
  const risks: { subject: string; done: number; target: number; expected: number }[] = [];
  for (const g of goals) {
    const done = weekTotals[g.subject] || 0;
    const expected = g.weekly_target_minutes * elapsedFrac;
    if (done < expected * 0.75 && done < g.weekly_target_minutes) {
      risks.push({ subject: g.subject, done, target: g.weekly_target_minutes, expected });
    }
  }
  if (risks.length === 0) return null;
  risks.sort((a, b) => (a.done / a.target) - (b.done / b.target));
  const r = risks[0];
  const remaining = Math.max(0, r.target - r.done);
  const others = risks.length > 1 ? ` (+${risks.length - 1} more)` : "";
  return {
    kind: "goal",
    title: `Goal at risk: ${r.subject}${others}`,
    body: `You've logged ${Math.round(r.done)}/${r.target} min this week. ${Math.round(remaining)} min left to hit your target.`,
  };
}

// ---------- Insights ----------
function ruleBasedInsights(sessions: SessionRow[]): Insight[] {
  if (sessions.length === 0) {
    return [
      { kind: "rule", title: "Log your first session", body: "Start tracking to unlock personalized insights." },
    ];
  }
  const totalMin = sessions.reduce((a, s) => a + s.duration_minutes, 0);
  const avg = sessions.reduce((a, s) => a + s.focus_score, 0) / sessions.length;
  const avgDur = totalMin / sessions.length;

  const buckets: Record<string, number> = {};
  for (const s of sessions) {
    const p = partOfDay(new Date(s.start_time).getHours());
    buckets[p] = (buckets[p] || 0) + s.duration_minutes;
  }
  const bestPart = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "evening";

  const totalDistract = sessions.reduce((a, s) => a + (s.distraction_count ?? 0), 0);
  const distractRate = totalDistract / Math.max(1, sessions.length);

  const insights: Insight[] = [
    {
      kind: "rule",
      title: `You study best in the ${bestPart}`,
      body: `Most focused minutes happen during the ${bestPart}. Schedule deep work then.`,
    },
    {
      kind: "rule",
      title: `Average focus: ${avg.toFixed(1)} / 10`,
      body: avg >= 7
        ? "Strong concentration — keep your routine."
        : "Try shorter, distraction-free sessions to boost focus.",
    },
    {
      kind: "rule",
      title: `Typical session: ${Math.round(avgDur)} min`,
      body: avgDur > 90
        ? "Consider breaking long sessions into 50-min blocks with short breaks."
        : "Healthy session length — consistent reps compound.",
    },
  ];
  if (distractRate >= 1.5) {
    insights.push({
      kind: "rule",
      title: "High distraction sessions detected",
      body: `Avg ${distractRate.toFixed(1)} distractions/session. Try airplane mode and a closed-tab rule.`,
    });
  }
  return insights;
}

function mlInsights(sessions: SessionRow[]): Insight[] {
  if (sessions.length < 4) throw new Error("Not enough data for ML");
  const insights: Insight[] = [];

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );
  const xs = sorted.map((_, i) => i);
  const ys = sorted.map((s) => s.focus_score);
  const reg = linearRegression(xs, ys);
  if (reg) {
    const trend = reg.slope;
    if (trend > 0.05) {
      insights.push({ kind: "ml", title: "Your focus is trending up 📈", body: `Linear regression: +${trend.toFixed(2)} pts/session. Keep going.` });
    } else if (trend < -0.05) {
      insights.push({ kind: "ml", title: "Focus is dipping", body: `Trend ${trend.toFixed(2)} pts/session. Review sleep, breaks, and environment.` });
    } else {
      insights.push({ kind: "ml", title: "Focus is stable", body: "Concentration holds steady. Try a fresh subject mix to push higher." });
    }
  }

  const hours: number[] = [];
  for (const s of sessions) {
    const h = new Date(s.start_time).getHours();
    const w = Math.max(1, Math.round(s.focus_score / 2));
    for (let i = 0; i < w; i++) hours.push(h);
  }
  const k = Math.min(3, new Set(hours).size);
  const centers = kmeans1D(hours, k);
  if (centers.length > 0) {
    const labels = centers.map((c) => `${Math.round(c).toString().padStart(2, "0")}:00`).join(", ");
    insights.push({ kind: "ml", title: "Your peak focus windows", body: `K-means clustered your high-focus sessions around ${labels}. Block those slots.` });
  }

  const bySub: Record<string, { sum: number; n: number }> = {};
  for (const s of sessions) {
    bySub[s.subject] ??= { sum: 0, n: 0 };
    bySub[s.subject].sum += s.focus_score;
    bySub[s.subject].n += 1;
  }
  const ranked = Object.entries(bySub)
    .map(([sub, v]) => ({ sub, avg: v.sum / v.n, n: v.n }))
    .filter((r) => r.n >= 2)
    .sort((a, b) => b.avg - a.avg);
  if (ranked.length >= 2) {
    insights.push({
      kind: "ml",
      title: `${ranked[0].sub} is your strongest subject`,
      body: `Avg focus ${ranked[0].avg.toFixed(1)}/10 vs ${ranked[ranked.length - 1].sub} at ${ranked[ranked.length - 1].avg.toFixed(1)}/10. Pair them in alternating blocks.`,
    });
  }

  const recLen = recommendedLength(sessions);
  insights.push({
    kind: "ml",
    title: `Aim for ~${recLen} min blocks`,
    body: `Your highest-focus sessions cluster around this length. Use it as your default Pomodoro.`,
  });

  const withDistract = sessions.filter((s) => (s.distraction_count ?? 0) > 0);
  if (withDistract.length >= 3) {
    const dxs = sessions.map((s) => s.distraction_count ?? 0);
    const dys = sessions.map((s) => s.focus_score);
    const dreg = linearRegression(dxs, dys);
    if (dreg && dreg.slope < -0.1) {
      insights.push({
        kind: "ml",
        title: "Distractions hurt your focus",
        body: `Each extra distraction drops focus by ~${Math.abs(dreg.slope).toFixed(2)} pts. Mute notifications next session.`,
      });
    }
  }

  return insights;
}

// ---------- AI rephrase via Lovable AI Gateway ----------
async function rephraseInsights(insights: Insight[]): Promise<Insight[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || insights.length === 0) return insights;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are FocusLab's study coach. Rewrite each insight to feel warm, encouraging, and conversational — like a friendly mentor speaking to one student. Keep titles ≤ 8 words and bodies ≤ 30 words. Preserve every number and subject name exactly. Never invent facts. Reply ONLY by calling the rewrite_insights tool.",
          },
          {
            role: "user",
            content: JSON.stringify({ insights: insights.map((i) => ({ title: i.title, body: i.body })) }),
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "rewrite_insights",
              description: "Return the rephrased insight cards in the same order.",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        body: { type: "string" },
                      },
                      required: ["title", "body"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["insights"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "rewrite_insights" } },
      }),
    });

    if (!resp.ok) {
      console.warn("AI rephrase non-200:", resp.status);
      return insights;
    }
    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = call?.function?.arguments;
    if (!argsStr) return insights;
    const parsed = JSON.parse(argsStr);
    const arr = parsed?.insights;
    if (!Array.isArray(arr) || arr.length !== insights.length) return insights;
    return insights.map((orig, i) => ({
      kind: orig.kind,
      title: typeof arr[i]?.title === "string" && arr[i].title.length > 0 ? arr[i].title : orig.title,
      body: typeof arr[i]?.body === "string" && arr[i].body.length > 0 ? arr[i].body : orig.body,
    }));
  } catch (e) {
    console.warn("AI rephrase failed, using original:", e);
    return insights;
  }
}

// ---------- Scheduler ----------
interface ScheduleBlock {
  subject: string;
  start: string;
  end: string;
  durationMin: number;
  reason: string;
}

function buildSchedule(
  subjects: string[],
  startHHMM: string,
  endHHMM: string,
  sessions: SessionRow[],
): { schedule: ScheduleBlock[]; bestHour: number | null; recommendedLength: number; usedFallback: boolean; notes: string[] } {
  const notes: string[] = [];
  let usedFallback = false;
  let bh: number | null = null;
  let recLen = 50;

  try {
    bh = bestHourFromSessions(sessions);
    recLen = recommendedLength(sessions);
  } catch {
    usedFallback = true;
    notes.push("Couldn't analyze history — used defaults.");
  }
  if (bh === null) {
    usedFallback = true;
    notes.push("No history yet — assuming 09:00 peak.");
  }

  const subjStats: Record<string, { avg: number; n: number }> = {};
  for (const s of sessions) {
    subjStats[s.subject] ??= { avg: 0, n: 0 };
    subjStats[s.subject].avg += s.focus_score;
    subjStats[s.subject].n += 1;
  }
  for (const k of Object.keys(subjStats)) {
    subjStats[k].avg /= subjStats[k].n;
  }
  const prioritized = [...subjects].sort((a, b) => {
    const ax = subjStats[a]?.avg ?? 5.5;
    const bx = subjStats[b]?.avg ?? 5.5;
    return ax - bx;
  });

  const [sh, sm] = startHHMM.split(":").map(Number);
  const [eh, em] = endHHMM.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) {
    return { schedule: [], bestHour: bh, recommendedLength: recLen, usedFallback: true, notes: ["End time must be after start."] };
  }

  const blockLen = Math.max(20, Math.min(120, recLen));
  const breakLen = blockLen >= 60 ? 15 : 10;
  const peakMin = bh !== null ? bh * 60 : startMin;

  const schedule: ScheduleBlock[] = [];
  let cursor = startMin;
  let i = 0;
  while (cursor + blockLen <= endMin && schedule.length < 12) {
    const subject = prioritized[i % prioritized.length];
    const blockEnd = cursor + blockLen;
    const distFromPeak = Math.abs(cursor + blockLen / 2 - peakMin) / 60;
    const reason = distFromPeak < 1
      ? `Inside your peak focus window (${bh !== null ? String(bh).padStart(2, "0") : "—"}:00).`
      : subjStats[subject] && subjStats[subject].avg < 5
      ? `${subject} has low avg focus (${subjStats[subject].avg.toFixed(1)}) — needs work.`
      : `Rotated based on subject priority.`;

    schedule.push({
      subject,
      start: fmtMin(cursor),
      end: fmtMin(blockEnd),
      durationMin: blockLen,
      reason,
    });
    cursor = blockEnd + breakLen;
    i++;
  }

  if (schedule.length === 0) {
    notes.push("Time window is too short for a single block.");
  } else {
    notes.push(`${blockLen}/${breakLen} blocks · weakest subjects scheduled first.`);
  }

  return { schedule, bestHour: bh, recommendedLength: recLen, usedFallback, notes };
}

function fmtMin(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------- Server ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
    }

    const { data: sessions, error } = await supabase
      .from("study_sessions")
      .select("id, subject, duration_minutes, start_time, focus_score, distraction_count, break_minutes, session_type")
      .order("start_time", { ascending: false })
      .limit(300);
    if (error) throw error;
    const list = (sessions ?? []) as SessionRow[];

    if (body.mode === "schedule") {
      const subjects = Array.isArray(body.subjects)
        ? body.subjects.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 12)
        : [];
      const start = typeof body.slot?.start === "string" ? body.slot.start : "09:00";
      const end = typeof body.slot?.end === "string" ? body.slot.end : "17:00";
      if (subjects.length === 0) {
        return new Response(JSON.stringify({ error: "subjects required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = buildSchedule(subjects, start, end, list);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: insights (with goals + AI rephrase)
    const { data: goalsData } = await supabase
      .from("goals")
      .select("subject, weekly_target_minutes");
    const goals = (goalsData ?? []) as GoalRow[];

    let insights: Insight[];
    let usedFallback = false;
    try {
      insights = mlInsights(list);
      insights = [...insights, ...ruleBasedInsights(list).slice(0, 1)];
    } catch (err) {
      console.warn("ML failed, fallback:", err);
      usedFallback = true;
      insights = ruleBasedInsights(list);
    }

    const goalRisk = goalAtRiskInsight(list, goals);
    if (goalRisk) insights = [goalRisk, ...insights];

    // AI rephrasing layer (never replaces — falls back to original on any failure)
    let aiRephrased = false;
    try {
      const before = insights;
      const after = await rephraseInsights(insights);
      aiRephrased = after !== before && after.some((x, i) => x.title !== before[i].title || x.body !== before[i].body);
      insights = after;
    } catch (e) {
      console.warn("rephrase wrapper error:", e);
    }

    return new Response(
      JSON.stringify({ insights, usedFallback, aiRephrased, count: list.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("compute-insights error:", e);
    return new Response(
      JSON.stringify({
        insights: [
          { kind: "rule", title: "Keep going", body: "Insights are warming up. Log a few more sessions to see trends." },
        ],
        usedFallback: true,
        aiRephrased: false,
        count: 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
