import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { AlertTriangle, CheckCircle2, BarChart2 } from 'lucide-react';
import type { AnalysisResult } from '../types';
import type { AnalyseResponse } from '../services/api';

interface Props {
  summary: AnalyseResponse | null;
  results: AnalysisResult[];
}

export function FindingsPanel({ summary, results }: Props) {
  const total = summary?.totalRecords ?? results.length;
  const suspicious = summary?.suspiciousRecords ?? results.filter((r) => r.nsaStatus === 'Suspicious').length;
  const valid = summary?.validRecords ?? total - suspicious;

  // Pick the first suspicious record to surface its reason as the main pattern
  const topAnomaly = results.find((r) => r.nsaStatus === 'Suspicious');

  return (
    <Paper
      component="aside"
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 5,
        bgcolor: 'white',
        border: '1px solid',
        borderColor: 'grey.200',
        position: { lg: 'sticky' },
        top: 24,
        height: 'fit-content',
      }}
    >
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'primary.main',
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontWeight: 700,
          }}
        >
          NSA Findings
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Signal summary
        </Typography>
      </Stack>

      {/* Suspicious count hero */}
      <Box
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 4,
          bgcolor: suspicious > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
          border: '1px solid',
          borderColor: suspicious > 0 ? 'error.light' : 'success.light',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {suspicious > 0 ? (
          <AlertTriangle size={28} color="#ef4444" />
        ) : (
          <CheckCircle2 size={28} color="#22c55e" />
        )}
        <Box>
          <Typography
            sx={{
              fontSize: '2.4rem',
              fontWeight: 900,
              lineHeight: 1,
              color: suspicious > 0 ? 'error.main' : 'success.main',
            }}
          >
            {suspicious}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            suspicious record{suspicious !== 1 ? 's' : ''} detected
          </Typography>
        </Box>
      </Box>

      {/* Stat grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1.5,
          mb: 3,
        }}
      >
        <MiniStat label="Total records" value={total} color="#6366f1" />
        <MiniStat label="Valid" value={valid} color="#22c55e" />
        <MiniStat label="Suspicious" value={suspicious} color="#ef4444" />
        <MiniStat label="Pass rate" value={total > 0 ? `${Math.round((valid / total) * 100)}%` : '—'} color="#8b5cf6" />
      </Box>

      {/* Main anomaly pattern */}
      <InsightBox icon={<BarChart2 size={14} />} title="Main anomaly pattern">
        {topAnomaly
          ? topAnomaly.anomalyReason
          : results.length === 0
            ? 'Run analysis to surface anomaly patterns.'
            : 'No suspicious patterns detected in this dataset.'}
      </InsightBox>

      {/* NSA pipeline note */}
      <InsightBox icon={<CheckCircle2 size={14} />} title="Pipeline status">
        {results.length === 0
          ? 'Awaiting first dataset scan.'
          : `${valid} record${valid !== 1 ? 's' : ''} cleared for sentiment analysis. ${suspicious > 0 ? `${suspicious} blocked by NSA filter.` : 'All records valid.'}`}
      </InsightBox>
    </Paper>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        bgcolor: 'grey.50',
        border: '1px solid',
        borderColor: 'grey.200',
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 800, color }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

function InsightBox({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        p: 2.5,
        mt: 2,
        borderRadius: 4,
        bgcolor: 'grey.50',
        border: '1px solid',
        borderColor: 'grey.200',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
        <Chip label="Insight" size="small" />
        <Typography sx={{ fontWeight: 800, fontSize: '0.88rem' }}>{title}</Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
        {children}
      </Typography>
    </Box>
  );
}
