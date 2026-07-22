import { useState } from "react";
import { Alert, Box, Snackbar, Stack } from "@mui/material";
import { Activity, ShieldCheck } from "lucide-react";

import { PageLayout } from "../components/PageLayout";
import { PageHero } from "../components/PageHero";
import { InputPanel } from "../components/InputPanel";
import { FeedbackCanvas } from "../components/FeedbackCanvas";
//import { FindingsPanel } from "../components/FindingsPanel";
import { PipelineTracker } from "../components/PipelineTracker";
//import { AnalyticsCharts } from "../components/AnalyticsCharts";

//import { SAMPLE_TEXT } from "../data/mockFeedback";
import { buildSteps } from "../data/pipelineSteps";
import { runNsaAnalysis, type AnalyseResponse } from "../services/api";
import type { AnalysisResult } from "../types";
import { useAuth } from "../context/AuthContext";
import { SignalSummaryPanel } from "../components/SignalSummaryPanel";

export function NsaPage() {
  const { token } = useAuth();
  const [datasetText, setDatasetText] = useState("");
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [summary, setSummary] = useState<AnalyseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    const lines = datasetText.split("\n").filter((l) => l.trim());
    if (lines.length === 0 || !token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await runNsaAnalysis(lines, token);
      setResults(data.results);
      setSummary(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not reach the backend.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setDatasetText("");
    setResults([]);
    setSummary(null);
    setError(null);
  }

  return (
    <PageLayout>
      <PageHero
        icon={<ShieldCheck size={28} color="#22d3ee" />}
        iconColor="#22d3ee"
        badge="$ nsa_engine --active"
        badgeIcon={<Activity size={11} />}
        title={<>&gt; NSA_Feedback_Filter<span style={{ color: "#22d3ee" }}>.</span></>}
        description="The Negative Selection Algorithm preprocesses feedback records, identifies anomalous or suspicious input, and allows only valid records to continue into the sentiment-analysis pipeline."
        chips={["load_feedback_records()", "preprocess_input()", "detect_anomalies()", "queue_valid_records()"]}
        statusLine="STATUS -> NSA engine online and ready for dataset input"
      />

      <PipelineTracker
        subtitle={results.length === 0 ? "Start by loading or editing the feedback dataset" : "NSA scan complete — review detected records"}
        steps={buildSteps(results.length === 0 ? 0 : 1)}
        activeColor="#6366f1"
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 380px" },
          gap: 3,
          alignItems: "start",
          mt: 3,
        }}
      >
        <Stack spacing={3}>
          <Box sx={{ borderRadius: 5, bgcolor: "#111827", border: "1px solid rgba(229,231,235,0.8)", overflow: 'hidden' }}>
            <InputPanel value={datasetText} onChange={setDatasetText} onRun={handleRun} onReset={handleReset} loading={loading} />
          </Box>
          <FeedbackCanvas results={results} />
         {/* {results.length > 1000 && <AnalyticsCharts results={results} />} */}
        </Stack>

        <Box sx={{ position: { xl: "sticky" }, top: 24 }}>
          {/* <FindingsPanel summary={summary} results={results} /> */}
          <SignalSummaryPanel
  mode="nsa"
  summary={summary}
  results={results}
/>
        </Box>
      </Box>

      <Snackbar open={!!error} autoHideDuration={8000} onClose={() => setError(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="error" onClose={() => setError(null)} sx={{ width: "100%" }}>{error}</Alert>
      </Snackbar>
    </PageLayout>
  );
}

