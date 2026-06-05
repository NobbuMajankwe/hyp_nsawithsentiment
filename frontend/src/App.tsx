import { useState } from 'react';
import { Alert, Box, Chip, Container, Paper, Snackbar, Stack, Typography } from '@mui/material';

import { Header } from './components/Header';
import { WorkflowRail } from './components/WorkflowRail';
import { InputPanel } from './components/InputPanel';
import { FeedbackCanvas } from './components/FeedbackCanvas';
import { FindingsPanel } from './components/FindingsPanel';
import { LoginPage, RegisterPage } from './pages/LoginPage';
import { SentimentPage } from './pages/SentimentPage';
import { InsightStoryPage } from './pages/InsightStoryPage';

import { SAMPLE_TEXT } from './data/mockFeedback';
import { runNsaAnalysis, type AnalyseResponse } from './services/api';
import { useAuth } from './context/AuthContext';
import type { AnalysisResult } from './types';
import { PipelineTracker } from './components/PipelineTracker';
import { buildSteps } from './data/pipelineSteps';

// Exported so Header can import it without a circular dependency
export type Page = 'nsa' | 'sentiment' | 'insight';

// ---------------------------------------------------------------------------
// Root — auth gate
// ---------------------------------------------------------------------------

export default function App() {
  const { isAuthenticated } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  if (!isAuthenticated) {
    return authView === 'login' ? (
      <LoginPage onSwitchToRegister={() => setAuthView('register')} />
    ) : (
      <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  return <Dashboard />;
}

// ---------------------------------------------------------------------------
// Dashboard — page shell + router
// ---------------------------------------------------------------------------

function Dashboard() {
  const [page, setPage] = useState<Page>('nsa');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f6f3ee' }}>
      <Header currentPage={page} onNavigate={setPage} />

      {page === 'nsa' && <NsaPage />}
      {page === 'sentiment' && <SentimentPage />}
      {page === 'insight' && <InsightStoryPage />}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// NSA page (the main analysis view)
// ---------------------------------------------------------------------------

function NsaPage() {
  const { token } = useAuth();
  const [datasetText, setDatasetText] = useState(SAMPLE_TEXT);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [summary, setSummary] = useState<AnalyseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    const lines = datasetText.split('\n').filter((l) => l.trim());
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
          : 'Could not reach the backend. Is uvicorn running on port 8000?',
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

        {/* ── Hero banner ── */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            mb: 4,
            borderRadius: 5,
            background: 'linear-gradient(135deg, #111827 0%, #312e81 55%, #7c2d12 100%)',
            color: 'white',
            overflow: 'hidden',
          }}
        >
          <Chip
            label="Deliverable 04 — Preliminary Prototype"
            size="small"
            sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.14)', color: 'white', letterSpacing: 1, textTransform: 'uppercase' }}
          />
          <Typography
            variant="h2"
            sx={{ fontWeight: 800, fontSize: { xs: '2.2rem', md: '3.5rem' }, lineHeight: 1, mb: 2 }}
          >
            NSA Feedback Filter
          </Typography>
          <Typography variant="h6" sx={{ maxWidth: 680, color: 'rgba(255,255,255,0.78)', fontWeight: 400 }}>
            Negative Selection Algorithm pre-processes feedback records, blocking suspicious
            entries before they reach sentiment analysis in the next phase.
          </Typography>
        </Paper>
{/* ── Pipeline context ── */}
        {results.length === 0?<PipelineTracker
          subtitle="Step 1 of 4 — Load Dataset"
          steps={buildSteps(0)}
          activeColor="#6366f1"
        />:<PipelineTracker
          subtitle="Step 2 of 4 — Negative Selection Filter"
          steps={buildSteps(1)}
          activeColor="#6366f1"
        />}
        {/* ── Three-column layout ── */}
        <Box
          component="main"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '240px minmax(0,1fr) 340px' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <WorkflowRail />

          <Stack spacing={3}>
            <InputPanel
              value={datasetText}
              onChange={setDatasetText}
              onRun={handleRun}
              onReset={handleReset}
              loading={loading}
            />
            <FeedbackCanvas results={results} />
          </Stack>

          <FindingsPanel summary={summary} results={results} />
        </Box>
      </Container>

      <Snackbar
        open={!!error}
        autoHideDuration={8000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
