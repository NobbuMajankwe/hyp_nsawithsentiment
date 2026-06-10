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
  <Box
    sx={{
      minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
      py: { xs: 3, md: 6 },
      background: `
        radial-gradient(circle at top left, rgba(99,102,241,0.16), transparent 30%),
        radial-gradient(circle at bottom right, rgba(236,72,153,0.12), transparent 28%),
        #f8f5ef
      `,
    }}
  >
    <Container maxWidth="xl">
      {/* Creative intro section */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.1fr 0.9fr' },
          gap: 4,
          alignItems: 'center',
          mb: 5,
        }}
      >
        <Box>
          <Chip
            label="Negative Selection Prototype"
            sx={{
              mb: 2,
              bgcolor: '#111827',
              color: '#fff',
              fontWeight: 700,
              borderRadius: 999,
            }}
          />

          <Typography
            sx={{
              fontSize: { xs: '2.4rem', md: '4rem' },
              fontWeight: 950,
              lineHeight: 0.95,
              letterSpacing: '-0.06em',
              color: '#111827',
              maxWidth: 760,
            }}
          >
            Let the AI inspect your feedback before sentiment analysis begins.
          </Typography>

          <Typography
            sx={{
              mt: 3,
              maxWidth: 680,
              fontSize: '1.05rem',
              color: '#6b7280',
              lineHeight: 1.8,
            }}
          >
            This prototype uses a Negative Selection Algorithm to separate normal
            feedback from suspicious or noisy records, then prepares the clean data
            for the next stage of analysis.
          </Typography>

          <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 3, flexWrap: 'wrap', gap: 1 }}
          >
            {['Load feedback', 'Detect anomalies', 'Protect sentiment flow'].map((item) => (
              <Chip
                key={item}
                label={item}
                sx={{
                  bgcolor: '#fff',
                  border: '1px solid #e5e7eb',
                  fontWeight: 700,
                }}
              />
            ))}
          </Stack>
        </Box>

        {/* Visual story card instead of dashboard banner */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 6,
            bgcolor: '#111827',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            minHeight: 300,
            boxShadow: '0 30px 80px rgba(17,24,39,0.22)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: '50%',
              bgcolor: 'rgba(99,102,241,0.35)',
              top: -70,
              right: -60,
              filter: 'blur(8px)',
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography sx={{ fontWeight: 800, mb: 3 }}>
              Feedback Journey
            </Typography>

            {[
              ['01', 'Raw comments arrive'],
              ['02', 'NSA scans for abnormal patterns'],
              ['03', 'Clean feedback continues to sentiment'],
              ['04', 'Insights become a readable story'],
            ].map(([num, text]) => (
              <Stack
                key={num}
                direction="row"
                spacing={2}
                sx={{
                  p: 1.5,
                  mb: 1.5,
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  alignItems:"center"
                }}
              >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: '#fff',
                    color: '#111827',
                    fontWeight: 900,
                  }}
                >
                  {num}
                </Box>
                <Typography sx={{ fontWeight: 700 }}>{text}</Typography>
              </Stack>
            ))}
          </Box>
        </Paper>
      </Box>

      {/* Pipeline tracker */}
      <PipelineTracker
        subtitle={
          results.length === 0
            ? 'Start by loading or editing the feedback dataset'
            : 'NSA scan complete — review detected records'
        }
        steps={buildSteps(results.length === 0 ? 0 : 1)}
        activeColor="#6366f1"
      />

      {/* Workspace layout */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 380px' },
          gap: 3,
          alignItems: 'start',
          mt: 3,
        }}
      >
        <Stack spacing={3}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 5,
              bgcolor: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(229,231,235,0.8)',
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
            position: { xl: 'sticky' },
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
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="error" onClose={() => setError(null)} sx={{ width: '100%' }}>
        {error}
      </Alert>
    </Snackbar>
  </Box>
);
}
