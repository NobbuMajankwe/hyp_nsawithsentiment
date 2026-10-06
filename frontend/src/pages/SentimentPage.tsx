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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import {
  listExperiments,
  getResults,
  runSentimentAnalysis,
  type Experiment,
  type ExperimentResult,
  type SentimentLabel,
  type SentimentAnalysisResponse,
} from '../services/api';

// ─── helpers ────────────────────────────────────────────────────────────────

const TONE: Record<SentimentLabel, 'success' | 'error' | 'warning'> = {
  Positive: 'success',
  Negative: 'error',
  Neutral: 'warning',
};

function errMsg(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="h5"
        sx={accent ? { color: accent, fontWeight: 700 } : { fontWeight: 700 }}
      >
        {value}
      </Typography>
    </Paper>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function SentimentPage() {
  const { token } = useAuth();

  // Experiment list
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [experimentsLoading, setExperimentsLoading] = useState(true);
  const [experimentsError, setExperimentsError] = useState('');

  // Selected experiment + its NSA results
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [nsaResults, setNsaResults] = useState<ExperimentResult[]>([]);
  const [nsaLoading, setNsaLoading] = useState(false);
  const [nsaError, setNsaError] = useState('');

  // Sentiment run
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [analysis, setAnalysis] = useState<SentimentAnalysisResponse | null>(null);

  // ── load experiment list on mount ──────────────────────────────────────────
  const loadExperiments = useCallback(async () => {
    if (!token) return;
    setExperimentsLoading(true);
    setExperimentsError('');
    try {
      const { experiments: list } = await listExperiments(token, { limit: 100 });
      // Only show completed experiments — they're the ones with results
      setExperiments(list.filter((e) => e.status === 'COMPLETED'));
    } catch (cause) {
      setExperimentsError(errMsg(cause, 'Could not load experiments.'));
    } finally {
      setExperimentsLoading(false);
    }
  }, [token]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadExperiments(); }, [loadExperiments]);

  // ── load NSA results when user picks an experiment ─────────────────────────
  useEffect(() => {
    if (!token || selectedId === '') return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNsaLoading(true);
    setNsaError('');
    setNsaResults([]);
    setAnalysis(null);
    setRunError('');

    getResults(token, selectedId as number)
      .then(({ results }) => {
        if (!active) return;
        setNsaResults(results);
      })
      .catch((cause) => {
        if (!active) return;
        setNsaError(errMsg(cause, 'Could not load experiment results.'));
      })
      .finally(() => {
        if (active) setNsaLoading(false);
      });

    return () => { active = false; };
  }, [token, selectedId]);

  // ── records classified as SELF (i.e. valid, non-anomalous feedback) ────────
  const selfRecords = useMemo(
    () => nsaResults.filter((r) => r.predicted_class === 'SELF'),
    [nsaResults],
  );

  // ── run sentiment analysis ─────────────────────────────────────────────────
  async function handleRun() {
    if (!token || selfRecords.length === 0 || running) return;
    setRunning(true);
    setRunError('');
    setAnalysis(null);
    try {
      const texts = selfRecords.map((r) => r.original_text as string);
      setAnalysis(await runSentimentAnalysis(token, texts));
    } catch (cause) {
      setRunError(errMsg(cause, 'Sentiment analysis failed.'));
    } finally {
      setRunning(false);
    }
  }

  const selectedExperiment = experiments.find(
    (e) => e.experiment_id === selectedId,
  );
  const model = analysis?.results[0]?.model ?? '';

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Sentiment analysis
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Select a completed NSA experiment. Feedback classified as{' '}
          <Box component="code" sx={{ fontSize: '0.875em' }}>SELF</Box>{' '}
          (non-anomalous) will be sent for sentiment classification.
        </Typography>
      </Box>

      {/* Experiment picker */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              1 — Choose an experiment
            </Typography>

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
                <InputLabel id="experiment-select-label">Experiment</InputLabel>
                <Select
                  labelId="experiment-select-label"
                  label="Experiment"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value as number)}
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

      {/* NSA results summary */}
      {selectedId !== '' && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                2 — NSA classification summary
              </Typography>

              {nsaError && (
                <Alert severity="error" onClose={() => setNsaError('')}>
                  {nsaError}
                </Alert>
              )}

              {nsaLoading ? (
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={20} />
                  <Typography color="text.secondary">
                    Loading results for experiment #{selectedId}…
                  </Typography>
                </Stack>
              ) : !nsaError && (
                <>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                      gap: 1.5,
                    }}
                  >
                    <Metric label="Total records" value={nsaResults.length} />
                    <Metric
                      label="SELF (valid for analysis)"
                      value={selfRecords.length}
                      accent="#22c55e"
                    />
                    <Metric
                      label="NON_SELF / OOV (excluded)"
                      value={nsaResults.length - selfRecords.length}
                      accent="#ef4444"
                    />
                  </Box>

                  {selectedExperiment && (
                    <Typography variant="body2" color="text.secondary">
                      Experiment: <strong>{selectedExperiment.experiment_name}</strong>
                      {selectedExperiment.created_at
                        ? ` · Run on ${new Date(selectedExperiment.created_at).toLocaleString()}`
                        : ''}
                    </Typography>
                  )}

                  {selfRecords.length === 0 ? (
                    <Alert severity="warning">
                      No SELF-classified records in this experiment. Choose a different
                      experiment or check your NSA configuration.
                    </Alert>
                  ) : (
                    <Alert severity="info">
                      {selfRecords.length} SELF{' '}
                      {selfRecords.length === 1 ? 'record is' : 'records are'} ready
                      for sentiment classification.
                    </Alert>
                  )}
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Run button */}
      {selectedId !== '' && !nsaLoading && !nsaError && selfRecords.length > 0 && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                3 — Run sentiment analysis
              </Typography>

              {runError && (
                <Alert severity="error" onClose={() => setRunError('')}>
                  {runError}
                </Alert>
              )}

              <Button
                variant="contained"
                size="large"
                onClick={() => void handleRun()}
                disabled={running}
              >
                {running
                  ? 'Classifying…'
                  : analysis
                  ? 'Run again'
                  : 'Run sentiment analysis'}
              </Button>

              {running && (
                <>
                  <LinearProgress />
                  <Typography variant="body2" color="text.secondary">
                    The first run may take longer while the backend loads the model.
                  </Typography>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {analysis && (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' },
              gap: 1.5,
            }}
          >
            <Metric label="Classified" value={analysis.totalRecords} />
            <Metric label="Positive" value={analysis.positiveCount} accent="#22c55e" />
            <Metric label="Negative" value={analysis.negativeCount} accent="#ef4444" />
            <Metric label="Neutral" value={analysis.neutralCount} accent="#f59e0b" />
          </Box>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Classified feedback
                  </Typography>
                  {model && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      Model:{' '}
                      <Box
                        component="span"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {model}
                      </Box>
                    </Typography>
                  )}
                </Box>
                <Divider />
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" aria-label="Sentiment classification results">
                    <TableHead>
                      <TableRow>
                        <TableCell width={72}>#</TableCell>
                        <TableCell>Feedback</TableCell>
                        <TableCell width={120}>Sentiment</TableCell>
                        <TableCell width={140}>Confidence</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analysis.results.map((result) => (
                        <TableRow key={result.id} hover>
                          <TableCell>{result.id}</TableCell>
                          <TableCell
                            sx={{
                              minWidth: 220,
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {result.originalText}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={result.label}
                              color={TONE[result.label]}
                            />
                          </TableCell>
                          <TableCell>{result.confidence.toFixed(2)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography variant="caption" color="text.secondary">
                  Confidence is the model's softmax score for its selected class;
                  it is not a calibrated probability of correctness.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  );
}
