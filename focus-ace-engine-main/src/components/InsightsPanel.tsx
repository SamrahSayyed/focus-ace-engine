import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Insight {
  title: string;
  body: string;
  kind: "ml" | "rule" | "goal";
}

const InsightsPanel = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);
  const [aiRephrased, setAiRephrased] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("compute-insights");
      if (error) throw error;
      setInsights(data?.insights ?? []);
      setUsedFallback(!!data?.usedFallback);
      setAiRephrased(!!data?.aiRephrased);
    } catch (e) {
      setInsights([
        {
          kind: "rule",
          title: "Insights unavailable",
          body: "We'll retry shortly. Your sessions are still saved.",
        },
      ]);
      setUsedFallback(true);
      setAiRephrased(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">Insights</h2>
          {usedFallback ? (
            <Badge variant="secondary" className="ml-2">Heuristic</Badge>
          ) : (
            <Badge className="ml-2 bg-gradient-primary text-primary-foreground border-0">ML</Badge>
          )}
          {aiRephrased && (
            <Badge variant="outline" className="ml-1">AI</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {loading && insights.length === 0 ? (
          <>
            <div className="h-24 rounded-lg bg-secondary/60 animate-pulse" />
            <div className="h-24 rounded-lg bg-secondary/60 animate-pulse" />
          </>
        ) : (
          insights.map((i, idx) => (
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
  );
};

export default InsightsPanel;
