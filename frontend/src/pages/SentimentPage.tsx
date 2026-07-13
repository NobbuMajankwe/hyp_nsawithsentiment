import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse,
  Container, Divider, LinearProgress, Paper, Snackbar,
  Stack, TextField, Typography,
} from '@mui/material';
import {
  BrainCircuit, CheckCircle2, ChevronDown, ChevronUp,
  Database, Minus, RotateCcw, ThumbsDown, ThumbsUp, Upload, Zap,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import { HEADER_HEIGHT } from '../components/Header';
import { PipelineTracker } from '../components/PipelineTracker';
import { buildSteps } from '../data/pipelineSteps';
import { fetchLatestValidRecords, runSentimentAnalysis } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { SentimentItem, SentimentLabel } from '../types';

const LABEL_COLORS: Record<SentimentLabel, string> = {
  Positive: '#22c55e', Negative: '#ef4444', Neutral: '#f59e0b',
};
const LABEL_BG: Record<SentimentLabel, string> = {
  Positive: 'rgba(34,197,94,0.08)', Negative: 'rgba(239,68,68,0.08)', Neutral: 'rgba(245,158,11,0.08)',
};
const LABEL_ICONS: Record<SentimentLabel, React.ReactNode> = {
  Positive: <ThumbsUp size={14} />, Negative: <ThumbsDown size={14} />, Neutral: <Minus size={14} />,
};

export function SentimentPage() {
  const { token } = useAuth();

  const [nsaTexts, setNsaTexts]     = useState<string[]>([]);
  const [nsaInfo, setNsaInfo]       = useState<{ totalRecords: number; validRecords: number; suspiciousRecords: number; createdAt: string } | null>(null);
  const [nsaLoading, setNsaLoading] = useState(false);
  const [nsaError, setNsaError]     = useState<string | null>(null);

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideText, setOverrideText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [results, setResults]   = useState<SentimentItem[]>([]);
  const [summary, setSummary]   = useState<{ pos: number; neg: number; neu: number; total: number } | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // NSA records are primary; manual override is secondary
  const activeTexts = nsaTexts.length > 0
    ? nsaTexts
    : overrideText.split('\n').filter((l) => l.trim());

  const usingNsaSource = nsaTexts.length > 0;

  useEffect(() => {
    if (!token) return;
    //setNsaLoading(true);
    fetchLatestValidRecords(token)
      .then((res) => {
        if (res.found && res.records.length > 0) {
          setNsaTexts(res.records.map((r) => r.text));
          setNsaInfo(res.sessionInfo);
        } else {
          setNsaError('No NSA session found. Run NSA Analysis first, or use the manual input below.');
        }
      })
      .catch(() => setNsaError('Could not load NSA results. Run NSA Analysis first.'))
      .finally(() => setNsaLoading(false));
  }, [token]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = (e.target?.result as string) ?? '';
      setOverrideText(raw.split('\n').filter(Boolean).join('\n'));
      setNsaTexts([]);
      setNsaInfo(null);
      setNsaError(null);
    };
    reader.readAsText(file);
  }

  async function handleRun() {
    if (activeTexts.length === 0 || !token) return;
    setLoading(true); setError(null);
    try {
      const data = await runSentimentAnalysis(activeTexts, token);
      setResults(data.results);
      setSummary({ pos: data.positiveCount, neg: data.negativeCount, neu: data.neutralCount, total: data.totalRecords });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Backend unreachable.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResults([]); setSummary(null); setError(null); setOverrideText('');
    if (!token) return;
    setNsaLoading(true);
    fetchLatestValidRecords(token)
      .then((res) => { if (res.found && res.records.length > 0) { setNsaTexts(res.records.map((r) => r.text)); setNsaInfo(res.sessionInfo); } })
      .catch(() => {})
      .finally(() => setNsaLoading(false));
  }

  const pieData = summary ? [
    { name: 'Positive', value: summary.pos, fill: LABEL_COLORS.Positive },
    { name: 'Negative', value: summary.neg, fill: LABEL_COLORS.Negative },
    { name: 'Neutral',  value: summary.neu, fill: LABEL_COLORS.Neutral  },
  ].filter((d) => d.value > 0) : [];

  const barData = results.map((r) => ({ name: `#${r.id}`, confidence: r.confidence, label: r.label }));

  return (
    <Box sx={{ minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`, bgcolor: '#f8f5ef', py: 4 }}>
      <Container maxWidth="xl">

        {/* Hero */}
        <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, mb: 4, borderRadius: 5, background: 'linear-gradient(135deg, #111827 0%, #1e1b4b 55%, #312e81 100%)', color: 'white', overflow: 'hidden', position: 'relative' }}>
          <Box sx={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)', top: -80, right: -50, pointerEvents: 'none' }} />
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 3, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BrainCircuit size={24} color="white" />
            </Box>
            <Box>
              <Chip label="Part 2 — Live" size="small" sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)', fontWeight: 700, mb: 0.5 }} />
              <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1, fontSize: { xs: '1.8rem', md: '2.6rem' } }}>Sentiment Analysis</Typography>
            </Box>
          </Stack>
          <Typography variant="h6" sx={{ maxWidth: 640, color: 'rgba(255,255,255,0.72)', fontWeight: 400, lineHeight: 1.7 }}>
            Automatically classifies the Valid records from your last NSA scan as Positive, Negative, or Neutral using DistilBERT (HuggingFace Inference API).
          </Typography>
        </Paper>

        <PipelineTracker
          subtitle={results.length === 0 ? 'Step 3 of 4 — ready for sentiment classification' : 'Step 3 of 4 — classification complete'}
          steps={buildSteps(2)}
          activeColor="#6366f1"
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0,1fr) 360px' }, gap: 3, alignItems: 'start', mt: 3 }}>
          <Stack spacing={3}>

            {/* Primary: NSA source panel */}
            <Paper elevation={0} sx={{ p: 4, borderRadius: 5, bgcolor: 'white', border: '1px solid', borderColor: 'grey.200' }}>
              <Stack spacing={0.5} sx={{ mb: 3 }}>
                <Typography variant="caption" sx={{ color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Data Source</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>NSA-validated feedback</Typography>
                <Typography variant="body2" color="text.secondary">Loaded automatically from your most recent NSA scan. Only Valid records are used.</Typography>
              </Stack>

              {/* NSA source status */}
              {nsaLoading && (
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', p: 2, borderRadius: 3, bgcolor: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">Loading NSA results…</Typography>
                </Stack>
              )}

              {!nsaLoading && nsaError && (
                <Alert severity="warning" sx={{ borderRadius: 2, mb: 2 }}>{nsaError}</Alert>
              )}

              {!nsaLoading && usingNsaSource && nsaInfo && (
                <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', mb: 3 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
                    <Database size={16} color="#22c55e" />
                    <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#16a34a' }}>NSA session loaded</Typography>
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                    {[
                      { label: 'Total records', value: nsaInfo.totalRecords, color: '#6366f1' },
                      { label: 'Valid (ready)', value: nsaInfo.validRecords, color: '#22c55e' },
                      { label: 'Blocked by NSA', value: nsaInfo.suspiciousRecords, color: '#ef4444' },
                    ].map((s) => (
                      <Box key={s.label} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'white', border: '1px solid', borderColor: 'grey.200', textAlign: 'center' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: s.color, lineHeight: 1 }}>{s.value}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                      </Box>
                    ))}
                  </Box>
                  {nsaInfo.createdAt && (
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 1.5, display: 'block' }}>
                      Session from {new Date(nsaInfo.createdAt).toLocaleString()}
                    </Typography>
                  )}
                </Box>
              )}

              {!nsaLoading && usingNsaSource && (
                <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#fafafa', border: '1px solid', borderColor: 'grey.200', mb: 3, maxHeight: 200, overflowY: 'auto' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>Records queued for classification</Typography>
                  {nsaTexts.map((t, i) => (
                    <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'text.secondary', py: 0.4, borderBottom: '1px solid', borderColor: 'grey.100' }}>
                      {i + 1}. {t}
                    </Typography>
                  ))}
                </Box>
              )}

              {/* Action row */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {activeTexts.length} record{activeTexts.length !== 1 ? 's' : ''} ready · {usingNsaSource ? 'from NSA scan' : 'manual input'}
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Button variant="outlined" onClick={handleReset} disabled={loading} startIcon={<RotateCcw size={15} />} sx={{ borderRadius: 999, px: 3 }}>Reset</Button>
                  <Button variant="contained" onClick={handleRun} disabled={loading || activeTexts.length === 0}
                    startIcon={loading ? <CircularProgress size={15} color="inherit" /> : <Zap size={15} />}
                    sx={{ borderRadius: 999, px: 4, background: 'linear-gradient(135deg,#312e81,#6d28d9)', '&:hover': { opacity: 0.92 } }}>
                    {loading ? 'Classifying…' : 'Run Sentiment Analysis'}
                  </Button>
                </Stack>
              </Box>
            </Paper>

            {/* Secondary: manual override */}
            <Paper elevation={0} sx={{ borderRadius: 5, bgcolor: 'white', border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
              <Button fullWidth onClick={() => setOverrideOpen((o) => !o)} sx={{ p: 2.5, borderRadius: 0, textTransform: 'none', justifyContent: 'space-between', color: 'text.secondary', fontWeight: 600 }}
                endIcon={overrideOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Upload size={16} />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Manual input / file upload (optional override)</Typography>
                </Stack>
              </Button>
              <Collapse in={overrideOpen}>
                <Divider />
                <Box sx={{ p: 3 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Upload a .txt/.csv/.json file or paste text to override the NSA source.</Typography>
                  <input ref={fileRef} type="file" accept=".txt,.csv,.json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                  <Button variant="outlined" onClick={() => fileRef.current?.click()} startIcon={<Upload size={15} />} sx={{ mb: 2, borderRadius: 999 }}>Upload file</Button>
                  <TextField multiline fullWidth minRows={5} value={overrideText} onChange={(e) => { setOverrideText(e.target.value); setNsaTexts([]); setNsaInfo(null); }}
                    placeholder="Or paste feedback here — one record per line"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#fafafa', fontFamily: 'monospace', '& textarea': { fontSize: 13 } } }} />
                </Box>
              </Collapse>
            </Paper>

            {/* Results */}
            {results.length > 0 && (
              <Paper elevation={0} sx={{ p: 4, borderRadius: 5, bgcolor: 'white', border: '1px solid', borderColor: 'grey.200' }}>
                <Stack spacing={1} sx={{ mb: 3 }}>
                  <Typography variant="caption" sx={{ color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Results</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>Classified records</Typography>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2.5 }}>
                  {results.map((item) => <ResultCard key={item.id} item={item} />)}
                </Box>
              </Paper>
            )}

            {/* Charts */}
            {results.length > 0 && summary && (
              <Paper elevation={0} sx={{ p: 4, borderRadius: 5, bgcolor: 'white', border: '1px solid', borderColor: 'grey.200' }}>
                <Stack spacing={1} sx={{ mb: 3 }}>
                  <Typography variant="caption" sx={{ color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Analytics</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>Sentiment distribution</Typography>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                  <Box sx={{ p: 2, borderRadius: 4, border: '1px solid', borderColor: 'grey.100', bgcolor: '#fafafa' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>Label breakdown</Typography>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => percent !== undefined ? `${name} ${(percent * 100).toFixed(0)}%` : name} labelLine={false}>
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ p: 2, borderRadius: 4, border: '1px solid', borderColor: 'grey.100', bgcolor: '#fafafa' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>Confidence per record</Typography>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={barData} barSize={18}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                        <Tooltip formatter={(v) => typeof v === 'number' ? [`${v.toFixed(1)}%`, 'Confidence'] : [String(v), 'Confidence']} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                        <Bar dataKey="confidence" radius={[4, 4, 0, 0]}>
                          {barData.map((entry, i) => <Cell key={i} fill={LABEL_COLORS[entry.label as SentimentLabel] ?? '#6366f1'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              </Paper>
            )}
          </Stack>

          {/* Right: summary */}
          <Box sx={{ position: { xl: 'sticky' }, top: 24 }}>
            <SummaryPanel summary={summary} results={results} />
          </Box>
        </Box>
      </Container>

      <Snackbar open={!!error} autoHideDuration={8000} onClose={() => setError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setError(null)} sx={{ width: '100%' }}>{error}</Alert>
      </Snackbar>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

function ResultCard({ item }: { item: SentimentItem }) {
  const color = LABEL_COLORS[item.label as SentimentLabel] ?? '#6366f1';
  const bg    = LABEL_BG[item.label as SentimentLabel]    ?? 'rgba(99,102,241,0.06)';
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 4, bgcolor: bg, border: '1px solid', borderColor: `${color}30`, transition: '0.2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: 3 } }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>Record #{item.id}</Typography>
        <Chip icon={<Box sx={{ color, display: 'flex' }}>{LABEL_ICONS[item.label as SentimentLabel]}</Box>} label={item.label} size="small"
          sx={{ fontWeight: 700, bgcolor: `${color}15`, color, border: `1px solid ${color}30` }} />
      </Stack>
      <Typography sx={{ fontSize: '0.95rem', lineHeight: 1.8, mb: 2.5, fontStyle: 'italic', color: 'text.primary' }}>
        "{item.originalText}"
      </Typography>
      <Stack spacing={0.75} sx={{ mb: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Confidence</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color }}>{item.confidence.toFixed(1)}%</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={item.confidence} sx={{ height: 7, borderRadius: 99, bgcolor: 'rgba(0,0,0,0.06)', '& .MuiLinearProgress-bar': { bgcolor: color } }} />
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>via {item.model}</Typography>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Summary panel
// ---------------------------------------------------------------------------

function SummaryPanel({ summary, results }: { summary: { pos: number; neg: number; neu: number; total: number } | null; results: SentimentItem[] }) {
  if (!summary || results.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 3, borderRadius: 5, bgcolor: 'white', border: '1px solid', borderColor: 'grey.200' }}>
        <Typography variant="caption" sx={{ color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, display: 'block', mb: 1 }}>Sentiment Summary</Typography>
        <Typography color="text.secondary" variant="body2">Run analysis to see the sentiment breakdown.</Typography>
      </Paper>
    );
  }

  const dominantLabel: SentimentLabel = summary.pos >= summary.neg && summary.pos >= summary.neu ? 'Positive'
    : summary.neg >= summary.pos && summary.neg >= summary.neu ? 'Negative' : 'Neutral';

  const stats = [
    { label: 'Total',    value: summary.total, color: '#6366f1' },
    { label: 'Positive', value: summary.pos,   color: LABEL_COLORS.Positive },
    { label: 'Negative', value: summary.neg,   color: LABEL_COLORS.Negative },
    { label: 'Neutral',  value: summary.neu,   color: LABEL_COLORS.Neutral  },
  ];

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 5, bgcolor: 'white', border: '1px solid', borderColor: 'grey.200' }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="caption" sx={{ color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Sentiment Summary</Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Signal overview</Typography>
      </Stack>

      <Box sx={{ p: 3, mb: 3, borderRadius: 4, bgcolor: `${LABEL_COLORS[dominantLabel]}10`, border: '1px solid', borderColor: `${LABEL_COLORS[dominantLabel]}30`, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ color: LABEL_COLORS[dominantLabel], display: 'flex' }}>{LABEL_ICONS[dominantLabel]}</Box>
        <Box>
          <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: 1, color: LABEL_COLORS[dominantLabel] }}>{dominantLabel}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>dominant sentiment</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 3 }}>
        {stats.map((s) => (
          <Paper key={s.label} elevation={0} sx={{ p: 1.75, borderRadius: 3, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: s.color }}>{s.value}</Typography>
            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
          </Paper>
        ))}
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          <CheckCircle2 size={14} color="#6366f1" />
          <Typography sx={{ fontWeight: 800, fontSize: '0.85rem' }}>Pipeline status</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          {summary.total} record{summary.total !== 1 ? 's' : ''} classified.{' '}
          {summary.pos > 0 && `${summary.pos} positive. `}
          {summary.neg > 0 && `${summary.neg} negative. `}
          {summary.neu > 0 && `${summary.neu} neutral. `}
          Ready for Insight Story stage.
        </Typography>
      </Box>
    </Paper>
  );
}
