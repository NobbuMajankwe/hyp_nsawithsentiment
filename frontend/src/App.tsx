import { useState } from "react";
import {
  Alert,
  Box,
  Chip,
  Container,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";

import {
  Header,
  SIDENAV_WIDTH,
  SIDENAV_COLLAPSED_WIDTH,
  HEADER_HEIGHT,
} from "./components/Header";
import { InputPanel } from "./components/InputPanel";
import { FeedbackCanvas } from "./components/FeedbackCanvas";
import { FindingsPanel } from "./components/FindingsPanel";
import { AnalyticsCharts } from "./components/AnalyticsCharts";
import { LoginPage, RegisterPage, ResetPasswordPage } from "./pages/LoginPage";
import { SentimentPage } from "./pages/SentimentPage";
import { InsightStoryPage } from "./pages/InsightStoryPage";
import { PipelineTracker } from "./components/PipelineTracker";

import { SAMPLE_TEXT } from "./data/mockFeedback";
import { buildSteps } from "./data/pipelineSteps";
import { runNsaAnalysis, type AnalyseResponse } from "./services/api";
import { useAuth } from "./context/AuthContext";
import type { AnalysisResult } from "./types";
import ProfilePage from "./pages/ProfilePage";
import Dashboard2 from "./pages/Dashboard2";
import { Activity, ShieldCheck } from "lucide-react";
//import ResetPasswordPage from './pages/ResetPasswordPage';

export type Page =
  | "profile"
  | "nsa"
  | "sentiment"
  | "insight"
  | "settings"
  | "dashboard"
  | "analytics";

// ---------------------------------------------------------------------------
// Root — auth gate
// ---------------------------------------------------------------------------

export default function App() {
  const { isAuthenticated } = useAuth();
  const [authView, setAuthView] = useState<"login" | "reset" | "register">(
    "login",
  );

  if (!isAuthenticated) {
    switch (authView) {
      case "register":
        return <RegisterPage onSwitchToLogin={() => setAuthView("login")} />;

      case "reset":
        return <ResetPasswordPage onBackToLogin={() => setAuthView("login")} />;

      case "login":
      default:
        return (
          <LoginPage
            onSwitchToRegister={() => setAuthView("register")}
            onSwitchToReset={() => setAuthView("reset")}
          />
        );
    }
  }

  return <Box sx={{maxHeight: "90vh", bgcolor: "rgba(99,102,241,0.15)", mr: -1, my: -1 }}>
    <Dashboard />;
  </Box>
}

// ---------------------------------------------------------------------------
// Dashboard — persistent shell with sidenav
// ---------------------------------------------------------------------------

function Dashboard() {
  const [page, setPage] = useState<Page>("dashboard");
  const [expanded, setExpanded] = useState(true);
  const sideWidth = expanded ? SIDENAV_WIDTH : SIDENAV_COLLAPSED_WIDTH;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "rgba(99,102,241,0.35)" }}>
      {/* Fixed header + attached sidenav */}
      <Header
        currentPage={page}
        onNavigate={setPage}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      />

      {/* Content — pushed right by sidenav width and down by header height */}
      <Box
        sx={{
          ml: { xs: 0, lg: `${sideWidth}px` },
          mt: `${HEADER_HEIGHT}px`,
          transition: "margin-left 0.25s ease",
          minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
        }}
      >
        {page === "profile" && <ProfilePage />}
        {page === "dashboard" && <Dashboard2 />}
        {page === "nsa" && <NsaPage />}
        {page === "sentiment" && <SentimentPage />}
        {page === "insight" && <InsightStoryPage />}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// NSA page
// ---------------------------------------------------------------------------

function NsaPage() {
  const { token } = useAuth();
  const [datasetText, setDatasetText] = useState(SAMPLE_TEXT);
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
      setError(
        err instanceof Error
          ? err.message
          : "Could not reach the backend. Is uvicorn running on port 8000?",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setDatasetText(SAMPLE_TEXT);
    setResults([]);
    setSummary(null);
    setError(null);
  }

  return (
     <Box sx={{ py: 4 }}>
      <Container maxWidth={false} sx={{ maxWidth: 1600 }}>
        {/* ── NSA Hero ── */}
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            p: { xs: 3, md: 5 },
            mb: 4,
            borderRadius: 4,
            bgcolor: "#050816",
            color: "#e5e7eb",
            overflow: "hidden",
            border: "1px solid rgba(34,211,238,0.25)",
            boxShadow: "0 0 45px rgba(34,211,238,0.1)",
            backgroundImage: `
      radial-gradient(
        circle at top right,
        rgba(34,211,238,0.18),
        transparent 32%
      ),
      linear-gradient(
        135deg,
        #050816 0%,
        #020617 55%,
        #111827 100%
      )
    `,
          }}
        >
          {/* Grid overlay */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              opacity: 0.14,
              backgroundImage:
                "linear-gradient(rgba(34,211,238,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.14) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
              pointerEvents: "none",
            }}
          />

          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Stack
              direction="row"
              spacing={2}
              sx={{
                alignItems: "center",
                mb: 3,
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  bgcolor: "#020617",
                  border: "1px solid rgba(34,211,238,0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 22px rgba(34,211,238,0.28)",
                }}
              >
                <ShieldCheck size={28} color="#22d3ee" />
              </Box>

              <Box>
                <Chip
                  label="$ nsa_engine --active"
                  size="small"
                  icon={<Activity size={11} />}
                  sx={{
                    mb: 1,
                    bgcolor: "rgba(34,211,238,0.12)",
                    color: "#67e8f9",
                    border: "1px solid rgba(34,211,238,0.35)",
                    fontWeight: 800,
                    fontFamily: "monospace",

                    "& .MuiChip-icon": {
                      color: "#22d3ee",
                    },
                  }}
                />

                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 900,
                    lineHeight: 1,
                    color: "#f8fafc",
                    fontFamily: "monospace",
                    fontSize: { xs: "2rem", md: "3rem" },
                  }}
                >
                  &gt; NSA_Feedback_Filter
                  <span style={{ color: "#22d3ee" }}>.</span>
                </Typography>
              </Box>
            </Stack>

            <Typography
              variant="h6"
              sx={{
                maxWidth: 780,
                color: "#94a3b8",
                fontWeight: 400,
                lineHeight: 1.8,
                fontFamily: "monospace",
              }}
            >
              The Negative Selection Algorithm preprocesses feedback records,
              identifies anomalous or suspicious input, and allows only valid
              records to continue into the sentiment-analysis pipeline.
            </Typography>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{
                mt: 3,
                flexWrap: "wrap",
              }}
            >
              {[
                "load_feedback_records()",
                "preprocess_input()",
                "detect_anomalies()",
                "queue_valid_records()",
              ].map((step) => (
                <Chip
                  key={step}
                  label={step}
                  size="small"
                  sx={{
                    bgcolor: "#020617",
                    color: "#cffafe",
                    border: "1px solid rgba(34,211,238,0.28)",
                    fontFamily: "monospace",
                    fontWeight: 700,
                  }}
                />
              ))}
            </Stack>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{
                mt: 4,
                alignItems: { xs: "flex-start", sm: "center" },
              }}
            >
              <Typography
                sx={{
                  color: "rgba(148,163,184,0.55)",
                  fontSize: ".78rem",
                  fontFamily: "monospace",
                }}
              >
                STATUS → NSA engine online and ready for dataset input
              </Typography>

              <Chip
                label="READY"
                size="small"
                sx={{
                  height: 22,
                  bgcolor: "rgba(34,197,94,0.1)",
                  color: "#4ade80",
                  border: "1px solid rgba(34,197,94,0.3)",
                  fontFamily: "monospace",
                  fontWeight: 900,
                  fontSize: ".66rem",
                }}
              />
            </Stack>
          </Box>
        </Paper>

        {/* Pipeline tracker */}
        <PipelineTracker
          subtitle={
            results.length === 0
              ? "Start by loading or editing the feedback dataset"
              : "NSA scan complete — review detected records"
          }
          steps={buildSteps(results.length === 0 ? 0 : 1)}
          activeColor="#6366f1"
        />

        {/* Workspace layout */}
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
            <Paper
              elevation={0}
              sx={{
                p: 0,
                borderRadius: 5,
                bgcolor: "#111827", // "rgba(255,255,255,0.82)", //here
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(229,231,235,0.8)",
              }}
            >
              <InputPanel
                value={datasetText}
                onChange={setDatasetText}
                onRun={handleRun}
                onReset={handleReset}
                loading={loading}
              />
            </Paper>

            <FeedbackCanvas results={results} />

            {results.length > 0 && <AnalyticsCharts results={results} />}
          </Stack>

          <Box
            sx={{
              position: { xl: "sticky" },
              top: 24,
            }}
          >
            <FindingsPanel summary={summary} results={results} />
          </Box>
        </Box>
      </Container>

      <Snackbar
        open={!!error}
        autoHideDuration={8000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ width: "100%" }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
