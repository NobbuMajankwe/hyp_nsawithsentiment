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
  Download,
  FileText,
  Minus,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
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

// ─── design tokens ────────────────────────────────────────────────────────────
const BG   = '#050816';
const BG2  = '#020617';
const MONO = 'monospace';

// ─── helpers ─────────────────────────────────────────────────────────────────
function errMsg(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}
function pct(n: number, total: number) {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}
function pctNum(n: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ─── narrative generator ──────────────────────────────────────────────────────
interface NarrativeInput {
  experimentName: string;
  total: number;
  self: number;
  nonSelf: number;
  oov: number;
  positive: number;
  negative: number;
  neutral: number;
  anomalyRate: number;
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
    d.positive >= d.negative && d.positive >= d.neutral ? 'Positive'
    : d.negative >= d.positive && d.negative >= d.neutral ? 'Negative'
    : 'Neutral';
  const sections: NarrativeSection[] = [];

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
          ? 'The anomaly rate exceeds 30%. Consider reviewing your SELF corpus or tightening detector parameters — a high exclusion rate can indicate the corpus does not adequately represent normal feedback patterns.'
          : d.anomalyRate > 0.1
          ? 'The anomaly rate is moderate. Spot-check the excluded records to confirm the NSA is drawing the right boundary.'
          : 'The anomaly rate is low, which suggests the detector population is well-calibrated to your feedback corpus.'),
    });
  } else {
    sections.push({
      title: 'Anomaly signal',
      icon: <CheckCircle2 size={18} />,
      color: '#22c55e',
      body: 'No anomalous records were detected. Every submission passed the NSA filter and was included in the sentiment analysis. This indicates a clean, consistent feedback corpus.',
    });
  }

  if (d.sentimentTotal > 0) {
    const sentimentColor =
      dominantLabel === 'Positive' ? '#22c55e' : dominantLabel === 'Negative' ? '#ef4444' : '#f59e0b';
    sections.push({
      title: 'Sentiment distribution',
      icon: dominantLabel === 'Positive' ? <ThumbsUp size={18} />
            : dominantLabel === 'Negative' ? <ThumbsDown size={18} />
            : <Minus size={18} />,
      color: sentimentColor,
      body:
        `Sentiment was classified across ${d.sentimentTotal} valid record${d.sentimentTotal !== 1 ? 's' : ''}. ` +
        `Positive: ${d.positive} (${pct(d.positive, d.sentimentTotal)}), ` +
        `Negative: ${d.negative} (${pct(d.negative, d.sentimentTotal)}), ` +
        `Neutral: ${d.neutral} (${pct(d.neutral, d.sentimentTotal)}). ` +
        `The dominant sentiment is ${dominantLabel.toLowerCase()}.`,
    });

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
    sections.push({ title: 'Recommendation', icon: <BarChart2 size={18} />, color: '#22d3ee', body: recommendation });
  }

  return sections;
}

// ─── sub-components ───────────────────────────────────────────────────────────

/** Simple KPI card */
function KpiCard({ label, value, accent, sub }: { label: string; value: string | number; accent?: string; sub?: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, bgcolor: BG, borderColor: 'rgba(34,211,238,0.15)', borderRadius: 3 }}
    >
      <Typography variant="body2" sx={{ color: '#64748b', fontFamily: MONO, mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 900, color: accent ?? '#f8fafc', fontFamily: MONO, lineHeight: 1 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ color: '#475569', fontFamily: MONO, mt: 0.5, display: 'block' }}>
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

/** Animated gauge ring for the health score */
function HealthGauge({ score }: { score: number }) {
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Box sx={{ position: 'relative', width: 110, height: 110 }}>
        <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="9" />
          <circle
            cx="55" cy="55" r={r} fill="none"
            stroke={color} strokeWidth="9"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}80)`, transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <Box
          sx={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Typography sx={{ fontWeight: 900, fontSize: '1.6rem', color, fontFamily: MONO, lineHeight: 1 }}>
            {score}
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', color: '#64748b', fontFamily: MONO }}>/100</Typography>
        </Box>
      </Box>
      <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: MONO }}>
        health score
      </Typography>
    </Box>
  );
}

/** Horizontal sentiment bar */
function SentimentBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pctVal = pctNum(count, total);
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: MONO }}>{label}</Typography>
        <Typography variant="caption" sx={{ color, fontFamily: MONO, fontWeight: 700 }}>
          {count} · {pctVal}%
        </Typography>
      </Stack>
      <Box sx={{ height: 6, bgcolor: 'rgba(148,163,184,0.1)', borderRadius: 3, overflow: 'hidden' }}>
        <Box
          sx={{
            height: '100%',
            width: `${pctVal}%`,
            bgcolor: color,
            borderRadius: 3,
            boxShadow: `0 0 8px ${color}60`,
            transition: 'width 0.6s ease',
          }}
        />
      </Box>
    </Box>
  );
}

/** Anomaly breakdown card */
function AnomalyBreakdown({
  total, self, nonSelf, oov,
}: { total: number; self: number; nonSelf: number; oov: number }) {
  return (
    <Card sx={{ bgcolor: BG, border: '1px solid rgba(245,158,11,0.2)', borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <Shield size={16} color="#f59e0b" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#f8fafc', fontFamily: MONO }}>
            NSA Anomaly Breakdown
          </Typography>
        </Stack>
        <Stack spacing={1.5}>
          <SentimentBar label="SELF (valid)" count={self}    total={total} color="#22c55e" />
          <SentimentBar label="NON_SELF (flagged)" count={nonSelf} total={total} color="#ef4444" />
          {oov > 0 && <SentimentBar label="OOV (out of vocab)" count={oov} total={total} color="#f59e0b" />}
        </Stack>
        <Box sx={{ mt: 2, p: 1.5, bgcolor: BG2, borderRadius: 2, border: '1px solid rgba(148,163,184,0.1)' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontFamily: MONO }}>
            pass_rate: <Box component="span" sx={{ color: '#22c55e' }}>{pct(self, total)}</Box>
            {'  '}
            exclusion_rate: <Box component="span" sx={{ color: '#ef4444' }}>{pct(nonSelf + oov, total)}</Box>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

/** Sentiment distribution card with bars */
function SentimentBreakdown({
  total, positive, negative, neutral,
}: { total: number; positive: number; negative: number; neutral: number }) {
  const dominant: SentimentLabel =
    positive >= negative && positive >= neutral ? 'Positive'
    : negative >= positive && negative >= neutral ? 'Negative'
    : 'Neutral';
  const dominantColor = dominant === 'Positive' ? '#22c55e' : dominant === 'Negative' ? '#ef4444' : '#f59e0b';

  return (
    <Card sx={{ bgcolor: BG, border: '1px solid rgba(167,139,250,0.2)', borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <TrendingUp size={16} color="#a78bfa" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#f8fafc', fontFamily: MONO }}>
            Sentiment Distribution
          </Typography>
          <Chip
            label={dominant}
            size="small"
            sx={{ ml: 'auto', bgcolor: `${dominantColor}18`, color: dominantColor, border: `1px solid ${dominantColor}40`, fontFamily: MONO, fontWeight: 800 }}
          />
        </Stack>
        <Stack spacing={1.5}>
          <SentimentBar label="Positive" count={positive} total={total} color="#22c55e" />
          <SentimentBar label="Negative" count={negative} total={total} color="#ef4444" />
          <SentimentBar label="Neutral"  count={neutral}  total={total} color="#f59e0b" />
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Signal quality card */
function SignalQualityCard({
  healthScore, anomalyRate, passRate,
}: { healthScore: number; anomalyRate: number; passRate: number }) {
  const color = healthScore >= 75 ? '#22c55e' : healthScore >= 50 ? '#f59e0b' : '#ef4444';
  const signal = healthScore >= 75 ? 'STRONG' : healthScore >= 50 ? 'MODERATE' : 'WEAK';

  return (
    <Card sx={{ bgcolor: BG, border: `1px solid ${color}30`, borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2.5 }}>
          <Zap size={16} color={color} />
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#f8fafc', fontFamily: MONO }}>
            Signal Quality
          </Typography>
          <Chip
            label={signal}
            size="small"
            sx={{ ml: 'auto', bgcolor: `${color}18`, color, border: `1px solid ${color}40`, fontFamily: MONO, fontWeight: 800 }}
          />
        </Stack>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <HealthGauge score={healthScore} />
          <Stack spacing={1.5} sx={{ flex: 1 }}>
            {[
              { label: 'pass_rate',     value: `${passRate}%`,     color: '#22c55e' },
              { label: 'anomaly_rate',  value: `${anomalyRate}%`,  color: '#ef4444' },
              { label: 'health_score',  value: `${healthScore}/100`, color },
            ].map(({ label, value, color: c }) => (
              <Box key={label} sx={{ p: 1.5, bgcolor: BG2, borderRadius: 2, border: '1px solid rgba(148,163,184,0.1)' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontFamily: MONO, display: 'block' }}>
                  {label}
                </Typography>
                <Typography sx={{ fontWeight: 900, color: c, fontFamily: MONO }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Per-record sentiment list */
const SENTIMENT_TONE: Record<SentimentLabel, 'success' | 'error' | 'warning'> = {
  Positive: 'success',
  Negative: 'error',
  Neutral: 'warning',
};

function ClassifiedRecords({ results }: { results: SentimentAnalysisResponse['results'] }) {
  return (
    <Card sx={{ bgcolor: BG, border: '1px solid rgba(34,211,238,0.15)', borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <FileText size={16} color="#22d3ee" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#f8fafc', fontFamily: MONO }}>
            Classified Records
          </Typography>
          <Chip
            label={`${results.length} records`}
            size="small"
            sx={{ ml: 'auto', bgcolor: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)', fontFamily: MONO }}
          />
        </Stack>
        <Stack spacing={1}>
          {results.map((item) => (
            <Box
              key={item.id}
              sx={{
                p: 1.5, borderRadius: 2, bgcolor: BG2,
                border: '1px solid rgba(148,163,184,0.1)',
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr auto auto' },
                gap: 1, alignItems: 'center',
              }}
            >
              <Typography variant="body2" sx={{ color: '#cbd5e1', overflowWrap: 'anywhere', fontFamily: MONO }}>
                {item.originalText}
              </Typography>
              <Chip size="small" label={item.label} color={SENTIMENT_TONE[item.label]} sx={{ fontFamily: MONO, fontWeight: 700 }} />
              <Typography variant="caption" sx={{ color: '#64748b', fontFamily: MONO, textAlign: 'right' }}>
                {item.confidence.toFixed(1)}%
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Export / share card */
function ExportCard({
  experimentName, generatedAt, totalRecords, healthScore,
}: { experimentName: string; generatedAt: string; totalRecords: number; healthScore: number }) {
  function handlePrint() {
    window.print();
  }

  function handleCopyText(narrative: string) {
    void navigator.clipboard.writeText(narrative);
  }

  const summaryText =
    `EventSense AI — Insight Report\n` +
    `Experiment: ${experimentName}\n` +
    `Generated: ${generatedAt}\n` +
    `Records analysed: ${totalRecords}\n` +
    `Health score: ${healthScore}/100\n`;

  return (
    <Card sx={{ bgcolor: BG, border: '1px solid rgba(34,211,238,0.2)', borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <Sparkles size={16} color="#22d3ee" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#f8fafc', fontFamily: MONO }}>
            Export Report
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: '#64748b', fontFamily: MONO, mb: 2 }}>
          Save or share this insight report.
        </Typography>
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Download size={14} />}
            onClick={handlePrint}
            sx={{ fontFamily: MONO, borderColor: 'rgba(34,211,238,0.35)', color: '#22d3ee', '&:hover': { borderColor: '#22d3ee', bgcolor: 'rgba(34,211,238,0.06)' } }}
          >
            Print / Save PDF
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileText size={14} />}
            onClick={() => handleCopyText(summaryText)}
            sx={{ fontFamily: MONO, borderColor: 'rgba(148,163,184,0.3)', color: '#94a3b8', '&:hover': { borderColor: '#94a3b8', bgcolor: 'rgba(148,163,184,0.06)' } }}
          >
            Copy summary
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export function InsightStoryPage() {
  const { token } = useAuth();
  const location = useLocation();

  const incomingId = (location.state as { experimentId?: number } | null)?.experimentId ?? '';

  // Step 1 — experiments list
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

  const selfRecords = useMemo(
    () => nsaResults.filter((r) => r.predicted_class === 'SELF'),
    [nsaResults],
  );

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

  const pipelineStep = sentimentResult ? 3 : selectedId !== '' && !nsaLoading ? 2 : 1;

  // ── derived metrics ────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!summary || !sentimentResult) return null;
    const total   = num(summary.classification.total);
    const self    = num(summary.classification.self);
    const nonSelf = num(summary.classification.nonSelf);
    const oov     = num(summary.classification.oov);
    const anomalyRate = total > 0 ? (nonSelf + oov) / total : 0;
    const healthScore = Math.round((1 - anomalyRate) * 100);
    const passRate    = pctNum(self, total);
    const selectedExp = experiments.find((e) => e.experiment_id === selectedId);
    return { total, self, nonSelf, oov, anomalyRate, healthScore, passRate, selectedExp };
  }, [summary, sentimentResult, experiments, selectedId]);

  const narrative = useMemo(() => {
    if (!sentimentResult || !summary || !metrics) return null;
    const selectedExp = experiments.find((e) => e.experiment_id === selectedId);
    return buildNarrative({
      experimentName: selectedExp?.experiment_name ?? `#${selectedId}`,
      total:    metrics.total,
      self:     metrics.self,
      nonSelf:  metrics.nonSelf,
      oov:      metrics.oov,
      positive: sentimentResult.positiveCount,
      negative: sentimentResult.negativeCount,
      neutral:  sentimentResult.neutralCount,
      anomalyRate:    metrics.anomalyRate,
      sentimentTotal: sentimentResult.totalRecords,
    });
  }, [sentimentResult, summary, metrics, experiments, selectedId]);

  const selectedExp = experiments.find((e) => e.experiment_id === selectedId);
  const generatedAt = new Date().toLocaleString();

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ py: 1 }}>
      <Stack spacing={3}>

        {/* Hero */}
        <PageHero
          icon={<FileText size={28} color="#fb923c" />}
          iconColor="#fb923c"
          badge="$ insight_story --active"
          badgeIcon={<BookOpen size={11} />}
          title={<>&gt; Insight_Story<span style={{ color: '#f97316' }}>.</span></>}
          description="Run the full pipeline — select a completed NSA experiment, classify valid feedback by sentiment, and generate a rich narrative report from the results."
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

        {/* Pipeline tracker */}
        <PipelineTracker
          subtitle={
            pipelineStep === 3 ? 'Step 4 of 4 — report ready'
            : pipelineStep === 2 ? 'Step 3 of 4 — ready to classify'
            : 'Step 2 of 4 — awaiting experiment'
          }
          steps={buildSteps(pipelineStep)}
          activeColor="#ea580c"
        />

        {/* ── Step 1: Pick experiment ──────────────────────────────────────── */}
        <Card sx={{ bgcolor: BG, border: '1px solid rgba(251,146,60,0.25)', borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip label="01" size="small" sx={{ fontFamily: MONO, fontWeight: 900, bgcolor: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)' }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>Select experiment</Typography>
              </Stack>

              {experimentsError && <Alert severity="error" onClose={() => setExperimentsError('')}>{experimentsError}</Alert>}

              {experimentsLoading ? (
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={20} />
                  <Typography color="text.secondary">Loading experiments…</Typography>
                </Stack>
              ) : experiments.length === 0 ? (
                <Alert severity="warning">No completed experiments found. Run an NSA experiment first.</Alert>
              ) : (
                <FormControl fullWidth size="small">
                  <InputLabel id="insight-exp-label">Completed experiment</InputLabel>
                  <Select
                    labelId="insight-exp-label"
                    label="Completed experiment"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value as number)}
                    sx={{ fontFamily: MONO }}
                  >
                    {experiments.map((exp) => (
                      <MenuItem key={exp.experiment_id} value={exp.experiment_id}>
                        #{exp.experiment_id} — {exp.experiment_name}
                        {exp.created_at ? ` (${new Date(exp.created_at).toLocaleDateString()})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* ── Step 2: NSA summary ──────────────────────────────────────────── */}
        {selectedId !== '' && (
          <Card sx={{ bgcolor: BG, border: '1px solid rgba(34,211,238,0.2)', borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip label="02" size="small" sx={{ fontFamily: MONO, fontWeight: 900, bgcolor: 'rgba(34,211,238,0.12)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.4)' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>NSA classification</Typography>
                  {selectedExp && <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>{selectedExp.experiment_name}</Typography>}
                </Stack>

                {nsaError && <Alert severity="error">{nsaError}</Alert>}

                {nsaLoading ? (
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                    <CircularProgress size={20} />
                    <Typography color="text.secondary">Loading results…</Typography>
                  </Stack>
                ) : !nsaError && summary ? (
                  <>
                    {/* KPI row */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
                      <KpiCard label="Total records"      value={num(summary.classification.total)}   />
                      <KpiCard label="SELF (valid)"       value={num(summary.classification.self)}    accent="#22c55e" />
                      <KpiCard label="NON_SELF (flagged)" value={num(summary.classification.nonSelf)} accent="#ef4444" />
                      <KpiCard label="OOV"                value={num(summary.classification.oov)}     accent="#f59e0b" />
                    </Box>
                    {selfRecords.length === 0 ? (
                      <Alert severity="warning">No SELF-classified records. Choose a different experiment.</Alert>
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

        {/* ── Step 3: Run sentiment ────────────────────────────────────────── */}
        {selectedId !== '' && !nsaLoading && !nsaError && selfRecords.length > 0 && (
          <Card sx={{ bgcolor: BG, border: '1px solid rgba(167,139,250,0.25)', borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip label="03" size="small" sx={{ fontFamily: MONO, fontWeight: 900, bgcolor: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>Sentiment classification</Typography>
                </Stack>

                {runError && <Alert severity="error" onClose={() => setRunError('')}>{runError}</Alert>}

                {sentimentResult && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
                    <KpiCard label="Classified" value={sentimentResult.totalRecords} />
                    <KpiCard label="Positive"   value={sentimentResult.positiveCount} accent="#22c55e" />
                    <KpiCard label="Negative"   value={sentimentResult.negativeCount} accent="#ef4444" />
                    <KpiCard label="Neutral"    value={sentimentResult.neutralCount}  accent="#f59e0b" />
                  </Box>
                )}

                <Button
                  variant="contained" size="large"
                  onClick={() => void handleRunSentiment()}
                  disabled={running}
                  sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' }, alignSelf: 'flex-start', fontFamily: MONO }}
                >
                  {running ? 'Classifying…' : sentimentResult ? 'Re-run sentiment' : 'Run sentiment analysis'}
                </Button>
                {running && (
                  <>
                    <LinearProgress sx={{ '& .MuiLinearProgress-bar': { bgcolor: '#a78bfa' } }} />
                    <Typography variant="body2" color="text.secondary">First run may take longer while the model loads.</Typography>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Full insight report ──────────────────────────────────── */}
        {narrative && sentimentResult && summary && metrics && (
          <>
            {/* Report header */}
            <Card sx={{ bgcolor: BG, border: '1px solid rgba(249,115,22,0.35)', borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Chip label="04" size="small" sx={{ fontFamily: MONO, fontWeight: 900, bgcolor: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.4)' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>Insight report</Typography>
                    <Chip
                      label="$ report --generated"
                      size="small"
                      icon={<Clock size={11} />}
                      sx={{ fontFamily: MONO, bgcolor: 'rgba(249,115,22,0.1)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}
                    />
                  </Stack>

                  {selectedExp && (
                    <Box sx={{ p: 2, bgcolor: BG2, borderRadius: 2, border: '1px solid rgba(148,163,184,0.15)' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: MONO }}>
                        experiment: <Box component="span" sx={{ color: '#f8fafc' }}>{selectedExp.experiment_name}</Box>
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: MONO }}>
                        generated: <Box component="span" sx={{ color: '#f8fafc' }}>{generatedAt}</Box>
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: MONO }}>
                        records_analysed: <Box component="span" sx={{ color: '#f8fafc' }}>{sentimentResult.totalRecords}</Box>
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* ── Metrics dashboard row ──────────────────────────────────── */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
              <KpiCard
                label="health_score"
                value={`${metrics.healthScore}/100`}
                accent={metrics.healthScore >= 75 ? '#22c55e' : metrics.healthScore >= 50 ? '#f59e0b' : '#ef4444'}
                sub="NSA pass rate quality"
              />
              <KpiCard
                label="records_analysed"
                value={sentimentResult.totalRecords}
                accent="#22d3ee"
                sub="passed NSA filter"
              />
              <KpiCard
                label="dominant_sentiment"
                value={
                  sentimentResult.positiveCount >= sentimentResult.negativeCount &&
                  sentimentResult.positiveCount >= sentimentResult.neutralCount
                    ? 'Positive'
                    : sentimentResult.negativeCount >= sentimentResult.positiveCount &&
                      sentimentResult.negativeCount >= sentimentResult.neutralCount
                    ? 'Negative'
                    : 'Neutral'
                }
                accent={
                  sentimentResult.positiveCount >= sentimentResult.negativeCount &&
                  sentimentResult.positiveCount >= sentimentResult.neutralCount
                    ? '#22c55e'
                    : sentimentResult.negativeCount >= sentimentResult.positiveCount &&
                      sentimentResult.negativeCount >= sentimentResult.neutralCount
                    ? '#ef4444'
                    : '#f59e0b'
                }
                sub="of classified feedback"
              />
            </Box>

            {/* ── Visual breakdown row ───────────────────────────────────── */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <SignalQualityCard
                healthScore={metrics.healthScore}
                anomalyRate={pctNum(metrics.nonSelf + metrics.oov, metrics.total)}
                passRate={metrics.passRate}
              />
              <Stack spacing={2}>
                <AnomalyBreakdown
                  total={metrics.total}
                  self={metrics.self}
                  nonSelf={metrics.nonSelf}
                  oov={metrics.oov}
                />
                <SentimentBreakdown
                  total={sentimentResult.totalRecords}
                  positive={sentimentResult.positiveCount}
                  negative={sentimentResult.negativeCount}
                  neutral={sentimentResult.neutralCount}
                />
              </Stack>
            </Box>

            {/* ── Narrative sections ─────────────────────────────────────── */}
            <Card sx={{ bgcolor: BG, border: '1px solid rgba(249,115,22,0.2)', borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2.5 }}>
                  <BookOpen size={16} color="#fb923c" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#f8fafc', fontFamily: MONO }}>
                    Narrative Analysis
                  </Typography>
                </Stack>
                <Divider sx={{ borderColor: 'rgba(249,115,22,0.15)', mb: 2.5 }} />
                <Stack spacing={2}>
                  {narrative.map((section) => (
                    <Box
                      key={section.title}
                      sx={{
                        p: 2.5, borderRadius: 3, bgcolor: BG2,
                        border: `1px solid ${section.color}30`,
                        boxShadow: `0 0 20px ${section.color}0a`,
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
                        <Box sx={{ color: section.color, display: 'flex' }}>{section.icon}</Box>
                        <Typography variant="body2" sx={{ fontWeight: 900, color: section.color, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {section.title}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ color: '#cbd5e1', lineHeight: 1.8, fontFamily: MONO }}>
                        {section.body}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            {/* ── Classified records ─────────────────────────────────────── */}
            <ClassifiedRecords results={sentimentResult.results} />

            {/* ── Export ────────────────────────────────────────────────── */}
            <ExportCard
              experimentName={selectedExp?.experiment_name ?? `#${selectedId}`}
              generatedAt={generatedAt}
              totalRecords={sentimentResult.totalRecords}
              healthScore={metrics.healthScore}
            />
          </>
        )}
      </Stack>
    </Box>
  );
}
