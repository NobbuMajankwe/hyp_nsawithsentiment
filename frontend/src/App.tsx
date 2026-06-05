import { useState } from 'react';
import { Alert, Box, Button, Chip, Container, Paper, Snackbar, Stack, Typography } from '@mui/material';
import { LogOut, UserCircle } from 'lucide-react';

import { WorkflowRail } from './components/WorkflowRail';
import { InputPanel } from './components/InputPanel';
import { FeedbackCanvas } from './components/FeedbackCanvas';
import { FindingsPanel } from './components/FindingsPanel';
import { LoginPage, RegisterPage } from './pages/LoginPage';

import { SAMPLE_TEXT } from './data/mockFeedback';
import { runNsaAnalysis, type AnalyseResponse } from './services/api';
import { useAuth } from './context/AuthContext';
import type { AnalysisResult } from './types';

// ---------------------------------------------------------------------------
// Root — handles auth gate
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
// Dashboard — shown once authenticated
// ---------------------------------------------------------------------------

function Dashboard() {
  const { user, token, logout } = useAuth();
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
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not reach the backend. Is uvicorn running on port 8000?';
      setError(msg);
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

  const roleLabel =
    user?.role === 'system_admin' ? 'System Admin' : 'Event Organiser';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f6f3ee', py: 4 }}>
      <Container maxWidth={false} sx={{ maxWidth: 1600 }}>

        {/* ── Hero header ── */}
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
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={4}
            sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}
          >
            <Box>
              <Chip
                label="Deliverable 04 — Preliminary Prototype"
                size="small"
                sx={{
                  mb: 2,
                  bgcolor: 'rgba(255,255,255,0.14)',
                  color: 'white',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              />
              <Typography
                variant="h2"
                sx={{ fontWeight: 800, fontSize: { xs: '2.3rem', md: '4rem' }, lineHeight: 1, mb: 2 }}
              >
                SignalCheck AI
              </Typography>
              <Typography variant="h6" sx={{ maxWidth: 720, color: 'rgba(255,255,255,0.82)', fontWeight: 400 }}>
                Negative Selection Algorithm filter for feedback analysis. Suspicious records are
                blocked before sentiment classification in the next phase.
              </Typography>
            </Box>

            {/* User card + logout */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                width: { xs: '100%', md: 340 },
                borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.22)',
                backdropFilter: 'blur(14px)',
                color: 'white',
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
                <UserCircle size={28} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }} noWrap>
                    {user?.fullName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }} noWrap>
                    {user?.email}
                  </Typography>
                </Box>
              </Stack>

              <Chip
                label={roleLabel}
                size="small"
                sx={{
                  mb: 2,
                  bgcolor: 'rgba(255,255,255,0.18)',
                  color: 'white',
                  fontWeight: 700,
                }}
              />

              <Button
                variant="outlined"
                fullWidth
                onClick={logout}
                startIcon={<LogOut size={15} />}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.4)',
                  borderRadius: 999,
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.08)' },
                }}
              >
                Sign out
              </Button>
            </Paper>
          </Stack>
        </Paper>

        {/* ── Main grid ── */}
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
