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
    position: 'relative',
    p: { xs: 3, md: 5 },
    mb: 4,
    borderRadius: 4,
    bgcolor: '#050816',
    color: '#e5e7eb',
    overflow: 'hidden',
    border: '1px solid rgba(34,211,238,0.25)',
    boxShadow: '0 0 45px rgba(34,211,238,0.1)',
    fontFamily: 'monospace',
    backgroundImage: `
      radial-gradient(circle at top right, rgba(34,211,238,0.18), transparent 32%),
      linear-gradient(135deg, #050816 0%, #020617 55%, #111827 100%)
    `,
  }}
>
  <Box
    sx={{
      position: 'absolute',
      inset: 0,
      opacity: 0.18,
      backgroundImage:
        'linear-gradient(rgba(34,211,238,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.15) 1px, transparent 1px)',
      backgroundSize: '32px 32px',
      pointerEvents: 'none',
    }}
  />

  <Box sx={{ position: 'relative', zIndex: 1 }}>
    <Chip
      label="$ deliverable_04 --prototype"
      size="small"
      sx={{
        mb: 2,
        bgcolor: 'rgba(34,211,238,0.1)',
        color: '#67e8f9',
        border: '1px solid rgba(34,211,238,0.35)',
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontWeight: 800,
        fontFamily: 'monospace',
      }}
    />

    <Typography
      variant="h2"
      sx={{
        fontWeight: 900,
        fontSize: { xs: '2.2rem', md: '3.6rem' },
        lineHeight: 1,
        mb: 2,
        color: '#f8fafc',
        fontFamily: 'monospace',
      }}
    >
      &gt; NSA_Feedback_Filter<span style={{ color: '#22d3ee' }}>.</span>
    </Typography>

    <Typography
      variant="h6"
      sx={{
        maxWidth: 760,
        color: '#94a3b8',
        fontWeight: 400,
        lineHeight: 1.7,
        fontFamily: 'monospace',
      }}
    >
      Negative Selection Algorithm preprocesses feedback records, blocks suspicious
      entries, and protects the sentiment analysis pipeline from noisy or malicious input.
    </Typography>

    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      sx={{ mt: 3, flexWrap: 'wrap' }}
    >
      {['input.scan()', 'nsa.detect()', 'sentiment.safe_queue()'].map((cmd) => (
        <Chip
          key={cmd}
          label={cmd}
          size="small"
          sx={{
            bgcolor: '#020617',
            color: '#bbf7d0',
            border: '1px solid rgba(34,197,94,0.25)',
            fontFamily: 'monospace',
            fontWeight: 700,
          }}
        />
      ))}
    </Stack>
  </Box>
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
