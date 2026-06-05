import { useState } from 'react';
import { Alert, Box, Chip, Container, Paper, Snackbar, Stack, Typography } from '@mui/material';

import { Header, SIDENAV_WIDTH, SIDENAV_COLLAPSED_WIDTH, HEADER_HEIGHT } from './components/Header';
import { InputPanel } from './components/InputPanel';
import { FeedbackCanvas } from './components/FeedbackCanvas';
import { FindingsPanel } from './components/FindingsPanel';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { LoginPage, RegisterPage } from './pages/LoginPage';
import { SentimentPage } from './pages/SentimentPage';
import { InsightStoryPage } from './pages/InsightStoryPage';
import { PipelineTracker } from './components/PipelineTracker';

import { SAMPLE_TEXT } from './data/mockFeedback';
import { buildSteps } from './data/pipelineSteps';
import { runNsaAnalysis, type AnalyseResponse } from './services/api';
import { useAuth } from './context/AuthContext';
import type { AnalysisResult } from './types';

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
// Dashboard — persistent shell with sidenav
// ---------------------------------------------------------------------------

function Dashboard() {
  const [page, setPage]         = useState<Page>('nsa');
  const [expanded, setExpanded] = useState(true);
  const sideWidth = expanded ? SIDENAV_WIDTH : SIDENAV_COLLAPSED_WIDTH;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f6f3ee' }}>
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
          transition: 'margin-left 0.25s ease',
          minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
        }}
      >
        {page === 'nsa'       && <NsaPage />}
        {page === 'sentiment' && <SentimentPage />}
        {page === 'insight'   && <InsightStoryPage />}
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
  const [results, setResults]         = useState<AnalysisResult[]>([]);
  const [summary, setSummary]         = useState<AnalyseResponse | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

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
      <Container maxWidth={false} sx={{ maxWidth: 1400 }}>

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

        {/* ── Pipeline tracker ── */}
        <PipelineTracker
          subtitle={results.length === 0 ? 'Step 1 of 4 — Load Dataset' : 'Step 2 of 4 — Negative Selection Filter'}
          steps={buildSteps(results.length === 0 ? 0 : 1)}
          activeColor="#6366f1"
        />

        {/* ── Main two-column grid ── */}
        <Box
          component="main"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0,1fr) 340px' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          {/* Left: input + record cards + charts */}
          <Stack spacing={3}>
            <InputPanel
              value={datasetText}
              onChange={setDatasetText}
              onRun={handleRun}
              onReset={handleReset}
              loading={loading}
            />
            <FeedbackCanvas results={results} />
            <AnalyticsCharts results={results} />
          </Stack>

          {/* Right: findings summary */}
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
