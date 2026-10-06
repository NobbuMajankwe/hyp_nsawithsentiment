import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  ThumbsDown,
  ThumbsUp,
  Minus,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageHero } from '../components/PageHero';
import { PipelineTracker } from '../components/PipelineTracker';
import { buildSteps } from '../data/pipelineSteps';
import {
  listExperiments,
  getResults,
  getSummary,
  runSentimentAnalysis,
  type Experiment,
  type ExperimentResult,
  type ResearchSummary,
  type SentimentAnalysisResponse,
  type SentimentLabel,
} from '../services/api';

// ─── helpers ────────────────────────────────────────────────────────────────

function errMsg(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function pct(n: number, total: number) {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ─── narrative generator ────────────────────────────────────────────────────

interface NarrativeInput {
  experimentName: string;
  total: number;
  self: number;
  nonSelf: number;
  oov: number;
  positive: number;
  negative: number;
  neutral: number;
  anomalyRate: number; // 0–1
  sentimentTotal: number;
}

interface NarrativeSection {
  title: string;
  icon: React.ReactNode;
  color: string;
  body: string;
}

function buildNarrative(d: NarrativeInput): NarrativeSection[] {
  const healthScore = Math.round((1 - d.anomalyRate) * 100);
  const dominantLabel: SentimentLabel =
    d.positive >= d.negative && d.positive >= d.neutral
      ? 'Positive'
      : d.negative >= d.positive && d.negative >= d.neutral
      ? 'Negative'
      : 'Neutral';

  const sections: NarrativeSection[] = [];

  // — Overall health
  const healthColor = healthScore >= 75 ? '#22c55e' : healthScore >= 50 ? '#f59e0b' : '#ef4444';
  sections.push({
    title: 'Event feedback health',
    icon: healthScore >= 75 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />,
    color: healthColor,
    body:
      `The NSA scan processed ${d.total} feedback record${d.total !== 1 ? 's' : ''} from ` +
      `experiment "${d.experimentName}". ` +
      `${d.self} ${d.self === 1 ? 'record was' : 'records were'} classified as SELF ` +
      `(genuine event feedback) — a pass rate of ${pct(d.self, d.total)}. ` +
      `${d.nonSelf} ${d.nonSelf === 1 ? 'record was' : 'records were'} flagged as anomalous (NON_SELF)` +
      (d.oov > 0 ? ` and ${d.oov} fell outside the vocabulary (OOV)` : '') +
      `. Overall health score: ${healthScore}/100.`,
  });

  // — Anomaly signal
  if (d.nonSelf > 0 || d.oov > 0) {
    const flagged = d.nonSelf + d.oov;
    sections.push({
      title: 'Anomaly signal',
      icon: <AlertTriangle size={18} />,
      color: '#f59e0b',
      body:
        `${flagged} record${flagged !== 1 ? 's' : ''} were excluded from sentiment classification ` +
        `(${pct(flagged, d.total)} of total). ` +
        (d.anomalyRate > 0.3
          ? 'The anomaly rate exceeds 30%. Consider reviewing your SELF corpus or tightening your detector parameters — a high exclusion rate can indicate the corpus does not adequately represent normal feedback patterns.'
          : d.anomalyRate > 0.1
          ? 'The anomaly rate is moderate. Spot-check the excluded records to confirm the NSA is drawing the right boundary.'
          : 'The anomaly rate is low, which suggests the detector population is well-calibrated to your feedback corpus.'),
    });
  } else {
    sections.push({
      title: 'Anomaly signal',
      icon: <CheckCircle2 size={18} />,
      color: '#22c55e',
      body:
        'No anomalous records were detected. Every submission passed the NSA filter and was included in the sentiment analysis. This indicates a clean, consistent feedback corpus.',
    });
  }

  // — Sentiment
  if (d.sentimentTotal > 0) {
    const sentimentColor =
      dominantLabel === 'Positive' ? '#22c55e' : dominantLabel === 'Negative' ? '#ef4444' : '#f59e0b';
    const sentimentIcon =
      dominantLabel === 'Positive' ? (
        <ThumbsUp size={18} />
      ) : dominantLabel === 'Negative' ? (
        <ThumbsDown size={18} />
      ) : (
        <Minus size={18} />
      );

    sections.push({
      title: 'Sentiment distribution',
      icon: sentimentIcon,
      color: sentimentColor,
      body:
        `Sentiment was classified across ${d.sentimentTotal} valid record${d.sentimentTotal !== 1 ? 's' : ''}. ` +
        `Positive: ${d.positive} (${pct(d.positive, d.sentimentTotal)}), ` +
        `Negative: ${d.negative} (${pct(d.negative, d.sentimentTotal)}), ` +
        `Neutral: ${d.neutral} (${pct(d.neutral, d.sentimentTotal)}). ` +
        `The dominant sentiment is ${dominantLabel.toLowerCase()}.`,
    });

    // — Recommendation
    let recommendation: string;
    if (dominantLabel === 'Positive' && d.anomalyRate < 0.1) {
      recommendation =
        'Feedback is overwhelmingly positive with minimal anomalies. No immediate action required. Consider sharing highlights with stakeholders and using this dataset as a SELF corpus benchmark for future events.';
    } else if (dominantLabel === 'Negative') {
      recommendation =
        `Negative sentiment dominates ${pct(d.negative, d.sentimentTotal)} of valid feedback. Review the negative records individually to identify recurring themes. Prioritise addressing the most common pain points before the next event.`;
    } else if (d.anomalyRate > 0.3) {
      recommendation =
        'High anomaly rate combined with mixed sentiment suggests data quality issues. Audit the excluded records for spam, duplicate submissions, or off-topic content before drawing conclusions from the sentiment scores.';
    } else {
      recommendation =
        `Sentiment is ${dominantLabel.toLowerCase()} with a moderate anomaly rate. Monitor trends across future events to establish a baseline. No urgent action required, but continue refining the SELF corpus as new feedback arrives.`;
    }

    sections.push({
      title: 'Recommendation',
      icon: <BarChart2 size={18} />,
      color: '#22d3ee',
      body: recommendation,
    });
  }

  return sections;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, bgcolor: '#050816', borderColor: 'rgba(34,211,238,0.2)' }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
        {label}
      </Typography>
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, color: accent ?? '#f8fafc', fontFamily: 'monospace' }}
      >
        {value}
      </Typography>
    </Paper>
  );
}

const SENTIMENT_TONE: Record<SentimentLabel, 'success' | 'error' | 'warning'> = {
  Positive: 'success',
  Negative: 'error',
  Neutral: 'warning',
};

// ─── page ────────────────────────────────────────────────────────────────────

export function InsightStoryPage() {
  const { token } = useAuth();
  const location = useLocation();

  // Honour an experimentId passed via navigate(..., { state }) from SentimentPage.
  const incomingId =
    (location.state as { experimentId?: number } | null)?.experimentId ?? '';

  // Step 1 — experiments
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [experimentsLoading, setExperimentsLoading] = useState(true);
  const [experimentsError, setExperimentsError] = useState('');

  // Step 2 — selected experiment data
  const [selectedId, setSelectedId] = useState<number | ''>(
    typeof incomingId === 'number' ? incomingId : '',
  );
  const [nsaResults, setNsaResults] = useState<ExperimentResult[]>([]);
  const [summary, setSummary] = useState<ResearchSummary | null>(null);
  const [nsaLoading, setNsaLoading] = useState(false);
  const [nsaError, setNsaError] = useState('');

  // Step 3 — sentiment
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [sentimentResult, setSentimentResult] = useState<SentimentAnalysisResponse | null>(null);

  // ── load experiments ───────────────────────────────────────────────────────
  const loadExperiments = useCallback(async () => {
    if (!token) return;
    setExperimentsLoading(true);
    setExperimentsError('');
    try {
      const { experiments: list } = await listExperiments(token, { limit: 100 });
      setExperiments(list.filter((e) => e.status === 'COMPLETED'));
    } catch (cause) {
      setExperimentsError(errMsg(cause, 'Could not load experiments.'));
    } finally {
      setExperimentsLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadExperiments(); }, [loadExperiments]);

  // ── load NSA results when experiment is picked ─────────────────────────────
  useEffect(() => {
    if (!token || selectedId === '') return;
    let active = true;
    setNsaLoading(true);
    setNsaError('');
    setNsaResults([]);
    setSummary(null);
    setSentimentResult(null);
    setRunError('');

    Promise.allSettled([
      getResults(token, selectedId as number),
      getSummary(token, selectedId as number),
    ]).then(([resultsRes, summaryRes]) => {
      if (!active) return;
      if (resultsRes.status === 'fulfilled') setNsaResults(resultsRes.value.results);
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
      if (resultsRes.status === 'rejected')
        setNsaError(errMsg(resultsRes.reason, 'Could not load experiment results.'));
      setNsaLoading(false);
    });

    return () => { active = false; };
  }, [token, selectedId]);

  // ── SELF records = non-anomalous feedback ready for sentiment ──────────────
  const selfRecords = useMemo(
    () => nsaResults.filter((r) => r.predicted_class === 'SELF'),
    [nsaResults],
  );

  // ── run sentiment ──────────────────────────────────────────────────────────
  async function handleRunSentiment() {
    if (!token || selfRecords.length === 0 || running) return;
    setRunning(true);
    setRunError('');
    setSentimentResult(null);
    try {
      const texts = selfRecords.map((r) => r.original_text as string);
      setSentimentResult(await runSentimentAnalysis(token, texts));
    } catch (cause) {
      setRunError(errMsg(cause, 'Sentiment analysis failed.'));
    } finally {
      setRunning(false);
    }
  }

  // ── derive pipeline step ───────────────────────────────────────────────────
  const pipelineStep = sentimentResult ? 3 : selectedId !== '' && !nsaLoading ? 2 : 1;

  // ── narrative ──────────────────────────────────────────────────────────────
  const narrative = useMemo(() => {
    if (!sentimentResult || !summary) return null;
    const total = num(summary.classification.total);
    const selfCount = num(summary.classification.self);
    const nonSelf = num(summary.classification.nonSelf);
    const oov = num(summary.classification.oov);
    const selectedExp = experiments.find((e) => e.experiment_id === selectedId);
    return buildNarrative({
      experimentName: selectedExp?.experiment_name ?? `#${selectedId}`,
      total,
      self: selfCount,
      nonSelf,
      oov,
      positive: sentimentResult.positiveCount,
      negative: sentimentResult.negativeCount,
      neutral: sentimentResult.neutralCount,
      anomalyRate: total > 0 ? (nonSelf + oov) / total : 0,
      sentimentTotal: sentimentResult.totalRecords,
    });
  }, [sentimentResult, summary, experiments, selectedId]);

  const selectedExp = experiments.find((e) => e.experiment_id === selectedId);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ py: 2 }}>
      <Stack spacing={3}>
        <PageHero
          icon={<FileText size={28} color="#fb923c" />}
          iconColor="#fb923c"
          badge="$ insight_story --active"
          badgeIcon={<BookOpen size={11} />}
          title={<>&gt; Insight_Story<span style={{ color: '#f97316' }}>.</span></>}
          description="Run the full pipeline — select a completed NSA experiment, classify valid feedback by sentiment, and generate a narrative report from the results."
          chips={['load_experiment()', 'run_sentiment()', 'build_story()']}
          statusLine={
            sentimentResult
              ? 'STATUS -> report generated successfully.'
              : running
              ? 'STATUS -> classifying feedback...'
              : selectedId !== ''
              ? 'STATUS -> experiment loaded. ready to classify.'
              : 'STATUS -> awaiting experiment selection...'
          }
        />

        <PipelineTracker
          subtitle={
            pipelineStep === 3
              ? 'Step 4 of 4 — report ready'
              : pipelineStep === 2
              ? 'Step 3 of 4 — ready to classify'
              : 'Step 2 of 4 — awaiting experiment'
          }
          steps={buildSteps(pipelineStep)}
          activeColor="#ea580c"
        />

        {/* ── Step 1: Pick experiment ─────────────────────────────────── */}
        <Card sx={{ bgcolor: '#050816', border: '1px solid rgba(251,146,60,0.25)' }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip
                  label="01"
                  size="small"
                  sx={{ fontFamily: 'monospace', fontWeight: 900, bgcolor: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)' }}
                />
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                  Select experiment
                </Typography>
              </Stack>

              {experimentsError && (
                <Alert severity="error" onClose={() => setExperimentsError('')}>
                  {experimentsError}
                </Alert>
              )}

              {experimentsLoading ? (
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={20} />
                  <Typography color="text.secondary">Loading experiments…</Typography>
                </Stack>
              ) : experiments.length === 0 ? (
                <Alert severity="warning">
                  No completed experiments found. Run an NSA experiment first.
                </Alert>
              ) : (
                <FormControl fullWidth size="small">
                  <InputLabel id="insight-exp-label">Completed experiment</InputLabel>
                  <Select
                    labelId="insight-exp-label"
                    label="Completed experiment"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value as number)}
                    sx={{ fontFamily: 'monospace' }}
                  >
                    {experiments.map((exp) => (
                      <MenuItem key={exp.experiment_id} value={exp.experiment_id}>
                        #{exp.experiment_id} — {exp.experiment_name}
                        {exp.created_at
                          ? ` (${new Date(exp.created_at).toLocaleDateString()})`
                          : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* ── Step 2: NSA summary ─────────────────────────────────────── */}
        {selectedId !== '' && (
          <Card sx={{ bgcolor: '#050816', border: '1px solid rgba(34,211,238,0.2)' }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip
                    label="02"
                    size="small"
                    sx={{ fontFamily: 'monospace', fontWeight: 900, bgcolor: 'rgba(34,211,238,0.12)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.4)' }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                    NSA classification
                  </Typography>
                  {selectedExp && (
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      {selectedExp.experiment_name}
                    </Typography>
                  )}
                </Stack>

                {nsaError && <Alert severity="error">{nsaError}</Alert>}

                {nsaLoading ? (
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                    <CircularProgress size={20} />
                    <Typography color="text.secondary">Loading results…</Typography>
                  </Stack>
                ) : !nsaError && summary ? (
                  <>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                        gap: 1.5,
                      }}
                    >
                      <StatCard label="Total records" value={num(summary.classification.total)} />
                      <StatCard label="SELF (valid)" value={num(summary.classification.self)} accent="#22c55e" />
                      <StatCard label="NON_SELF (flagged)" value={num(summary.classification.nonSelf)} accent="#ef4444" />
                      <StatCard label="OOV" value={num(summary.classification.oov)} accent="#f59e0b" />
                    </Box>

                    {selfRecords.length === 0 ? (
                      <Alert severity="warning">
                        No SELF-classified records. Choose a different experiment.
                      </Alert>
                    ) : (
                      <Alert severity="info" icon={<CheckCircle2 size={16} />}>
                        {selfRecords.length} SELF {selfRecords.length === 1 ? 'record' : 'records'} ready for sentiment classification.
                      </Alert>
                    )}
                  </>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Sentiment ───────────────────────────────────────── */}
        {selectedId !== '' && !nsaLoading && !nsaError && selfRecords.length > 0 && (
          <Card sx={{ bgcolor: '#050816', border: '1px solid rgba(167,139,250,0.25)' }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip
                    label="03"
                    size="small"
                    sx={{ fontFamily: 'monospace', fontWeight: 900, bgcolor: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)' }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                    Sentiment classification
                  </Typography>
                </Stack>

                {runError && (
                  <Alert severity="error" onClose={() => setRunError('')}>{runError}</Alert>
                )}

                {sentimentResult ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                      gap: 1.5,
                    }}
                  >
                    <StatCard label="Classified" value={sentimentResult.totalRecords} />
                    <StatCard label="Positive" value={sentimentResult.positiveCount} accent="#22c55e" />
                    <StatCard label="Negative" value={sentimentResult.negativeCount} accent="#ef4444" />
                    <StatCard label="Neutral" value={sentimentResult.neutralCount} accent="#f59e0b" />
                  </Box>
                ) : null}

                <Button
                  variant="contained"
                  size="large"
                  onClick={() => void handleRunSentiment()}
                  disabled={running}
                  sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' }, alignSelf: 'flex-start' }}
                >
                  {running ? 'Classifying…' : sentimentResult ? 'Re-run sentiment' : 'Run sentiment analysis'}
                </Button>
                {running && (
                  <>
                    <LinearProgress sx={{ '& .MuiLinearProgress-bar': { bgcolor: '#a78bfa' } }} />
                    <Typography variant="body2" color="text.secondary">
                      First run may take longer while the model loads.
                    </Typography>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Narrative report ────────────────────────────────── */}
        {narrative && sentimentResult && (
          <Card sx={{ bgcolor: '#050816', border: '1px solid rgba(249,115,22,0.35)' }}>
            <CardContent>
              <Stack spacing={3}>
                {/* Report header */}
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Chip
                    label="04"
                    size="small"
                    sx={{ fontFamily: 'monospace', fontWeight: 900, bgcolor: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.4)' }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                    Insight report
                  </Typography>
                  <Chip
                    label="$ report --generated"
                    size="small"
                    icon={<Clock size={11} />}
                    sx={{ fontFamily: 'monospace', bgcolor: 'rgba(249,115,22,0.1)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}
                  />
                </Stack>

                {selectedExp && (
                  <Box sx={{ p: 2, bgcolor: '#020617', borderRadius: 2, border: '1px solid rgba(148,163,184,0.15)' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      experiment: <Box component="span" sx={{ color: '#f8fafc' }}>{selectedExp.experiment_name}</Box>
                    </Typography>
                    {selectedExp.created_at && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        generated: <Box component="span" sx={{ color: '#f8fafc' }}>{new Date().toLocaleString()}</Box>
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      records_analysed: <Box component="span" sx={{ color: '#f8fafc' }}>{sentimentResult.totalRecords}</Box>
                    </Typography>
                  </Box>
                )}

                <Divider sx={{ borderColor: 'rgba(249,115,22,0.2)' }} />

                {/* Narrative sections */}
                <Stack spacing={2}>
                  {narrative.map((section) => (
                    <Box
                      key={section.title}
                      sx={{
                        p: 2.5,
                        borderRadius: 3,
                        bgcolor: '#020617',
                        border: `1px solid ${section.color}30`,
                        boxShadow: `0 0 20px ${section.color}0a`,
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
                        <Box sx={{ color: section.color, display: 'flex' }}>{section.icon}</Box>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 900, color: section.color, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 0.5 }}
                        >
                          {section.title}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ color: '#cbd5e1', lineHeight: 1.8, fontFamily: 'monospace' }}
                      >
                        {section.body}
                      </Typography>
                    </Box>
                  ))}
                </Stack>

                <Divider sx={{ borderColor: 'rgba(249,115,22,0.2)' }} />

                {/* Individual sentiment results */}
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#94a3b8', fontFamily: 'monospace', mb: 1.5 }}>
                    $ classified_records ({sentimentResult.totalRecords})
                  </Typography>
                  <Stack spacing={1}>
                    {sentimentResult.results.map((item) => (
                      <Box
                        key={item.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: '#050816',
                          border: '1px solid rgba(148,163,184,0.12)',
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr auto auto' },
                          gap: 1,
                          alignItems: 'center',
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ color: '#cbd5e1', overflowWrap: 'anywhere', fontFamily: 'monospace' }}
                        >
                          {item.originalText}
                        </Typography>
                        <Chip
                          size="small"
                          label={item.label}
                          color={SENTIMENT_TONE[item.label]}
                          sx={{ fontFamily: 'monospace', fontWeight: 700 }}
                        />
                        <Typography
                          variant="caption"
                          sx={{ color: '#64748b', fontFamily: 'monospace', textAlign: 'right' }}
                        >
                          {item.confidence.toFixed(1)}%
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
}
