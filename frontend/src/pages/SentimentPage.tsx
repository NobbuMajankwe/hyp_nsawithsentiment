import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import {
  getLatestValidFeedback,
  runSentimentAnalysis,
  type LatestValidFeedbackResponse,
  type SentimentAnalysisResponse,
  type SentimentLabel,
} from '../services/api';

const tone: Record<SentimentLabel, 'success' | 'error' | 'warning'> = {
  Positive: 'success', Negative: 'error', Neutral: 'warning',
};

export default function SentimentPage() {
  const { token } = useAuth();
  const [source, setSource] = useState<LatestValidFeedbackResponse | null>(null);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<SentimentAnalysisResponse | null>(null);

  const loadSource = useCallback(async () => {
    if (!token) return;
    setSourceLoading(true);
    setError('');
    try {
      setSource(await getLatestValidFeedback(token));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load validated feedback.');
    } finally {
      setSourceLoading(false);
    }
  }, [token]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadSource(); }, [loadSource]);

  const records = source?.records ?? [];
  const model = useMemo(() => analysis?.results[0]?.model ?? '', [analysis]);

  async function handleRun() {
    if (!token || records.length === 0 || running) return;
    setRunning(true);
    setError('');
    try {
      setAnalysis(await runSentimentAnalysis(token, records.map(record => record.text)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sentiment analysis failed.');
    } finally {
      setRunning(false);
    }
  }

  const lastRun = source?.sessionInfo?.createdAt
    ? new Date(source.sessionInfo.createdAt).toLocaleString()
    : null;

  return <Stack spacing={3}>
    <Box>
      <Typography variant="h4" sx={{fontWeight:700}}>Sentiment analysis</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        Classify feedback retained by the latest NSA run. Only records marked valid are sent to the sentiment endpoint.
      </Typography>
    </Box>

    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{justifyContent:"space-between", gap:2}} >
            <Box>
              <Typography variant="h6" sx={{fontWeight:700}}>NSA validated feedback</Typography>
              <Typography color="text.secondary" variant="body2">
                {lastRun ? `Latest NSA scan: ${lastRun}` : 'Source: latest NSA scan'}
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => void loadSource()} disabled={sourceLoading || running}>
              Refresh source
            </Button>
          </Stack>

          {sourceLoading ? <Stack direction="row" sx={{alignItems:"center", gap:1.5}}>
            <CircularProgress size={20} /><Typography color="text.secondary">Loading validated feedback…</Typography>
          </Stack> : source?.found && source.records.length > 0 ? <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
              <Metric label="Records in scan" value={source.sessionInfo?.totalRecords ?? '—'} />
              <Metric label="Validated for analysis" value={source.sessionInfo?.validRecords ?? source.records.length} />
              <Metric label="Flagged by NSA" value={source.sessionInfo?.suspiciousRecords ?? '—'} />
            </Box>
            <Alert severity="info">
              {records.length} validated {records.length === 1 ? 'record is' : 'records are'} ready. NSA flags are anomaly signals; they do not establish that feedback is fraudulent.
            </Alert>
          </> : <Alert severity="warning">
            No validated records were returned. Run an NSA analysis first, then refresh this page.
          </Alert>}

          <Button variant="contained" size="large" onClick={() => void handleRun()}
            disabled={sourceLoading || running || records.length === 0}>
            {running ? 'Classifying feedback…' : analysis ? 'Run again' : 'Run sentiment analysis'}
          </Button>
          {running && <LinearProgress />}
          {running && <Typography variant="body2" color="text.secondary">
            The first run may take longer while the backend loads the model.
          </Typography>}
        </Stack>
      </CardContent>
    </Card>

    {analysis && <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        <Metric label="Classified" value={analysis.totalRecords} />
        <Metric label="Positive" value={analysis.positiveCount} accent="#22c55e" />
        <Metric label="Negative" value={analysis.negativeCount} accent="#ef4444" />
        <Metric label="Neutral" value={analysis.neutralCount} accent="#f59e0b" />
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" sx={{fontWeight:700}}>Classified feedback</Typography>
              {model && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Model checkpoint: <Box component="span" sx={{ overflowWrap: 'anywhere' }}>{model}</Box>
              </Typography>}
            </Box>
            <Divider />
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" aria-label="Sentiment classification results">
                <TableHead><TableRow>
                  <TableCell width={72}>Record</TableCell><TableCell>Feedback</TableCell>
                  <TableCell width={120}>Sentiment</TableCell><TableCell width={140}>Confidence</TableCell>
                </TableRow></TableHead>
                <TableBody>{analysis.results.map(result => <TableRow key={result.id} hover>
                  <TableCell>{result.id}</TableCell>
                  <TableCell sx={{ minWidth: 220, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{result.originalText}</TableCell>
                  <TableCell><Chip size="small" label={result.label} color={tone[result.label]} /></TableCell>
                  <TableCell>{result.confidence.toFixed(2)}%</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary">
              Confidence is the model’s softmax score for its selected class; it is not a calibrated probability of correctness.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </>}
  </Stack>;
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return <Paper variant="outlined" sx={{ p: 2 }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="h5" sx={ accent ? { color: accent , fontWeight:700 } : {fontWeight:700 }}>{value}</Typography>
  </Paper>;
}
