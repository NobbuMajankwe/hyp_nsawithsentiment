import { Box, Chip, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { ShieldCheck, ShieldAlert, Tag } from 'lucide-react';
import type { AnalysisResult } from '../types';

interface Props {
  results: AnalysisResult[];
}

export function FeedbackCanvas({ results }: Props) {
  if (results.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6,
          borderRadius: 5,
          bgcolor: 'white',
          border: '1px solid',
          borderColor: 'grey.200',
          textAlign: 'center',
        }}
      >
        <Typography color="text.secondary" sx={{ fontSize: '1.05rem' }}>
          Paste feedback above and click <strong>Run NSA Analysis</strong> to see results.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        borderRadius: 5,
        bgcolor: 'white',
        border: '1px solid',
        borderColor: 'grey.200',
      }}
    >
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'primary.main',
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontWeight: 700,
          }}
        >
          Feedback Canvas
        </Typography>

        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Records analysed by NSA engine
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 3,
        }}
      >
        {results.map((item) => (
          <RecordCard key={item.id} item={item} />
        ))}
      </Box>
    </Paper>
  );
}

function RecordCard({ item }: { item: AnalysisResult }) {
  const suspicious = item.nsaStatus === 'Suspicious';

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 4,
        bgcolor: suspicious ? 'rgba(239,68,68,0.04)' : 'rgba(34,197,94,0.03)',
        border: '1px solid',
        borderColor: suspicious ? 'error.light' : 'grey.200',
        transition: '0.25s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
      }}
    >
      {/* Header row — all layout props in sx for MUI v9 */}
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
          Record #{item.id}
        </Typography>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {suspicious ? (
            <ShieldAlert size={16} color="#ef4444" />
          ) : (
            <ShieldCheck size={16} color="#22c55e" />
          )}
          <Chip
            label={item.nsaStatus}
            size="small"
            sx={{
              fontWeight: 700,
              bgcolor: suspicious ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
              color: suspicious ? 'error.main' : 'success.main',
              border: '1px solid',
              borderColor: suspicious ? 'error.light' : 'success.light',
            }}
          />
        </Stack>
      </Stack>

      {/* Original text */}
      <Typography
        sx={{
          fontSize: '0.97rem',
          lineHeight: 1.8,
          mb: 2.5,
          fontStyle: 'italic',
          color: 'text.primary',
        }}
      >
        "{item.originalText}"
      </Typography>

      {/* Cleaned text */}
      <Box
        sx={{
          p: 1.5,
          mb: 2.5,
          borderRadius: 2,
          bgcolor: 'grey.50',
          border: '1px solid',
          borderColor: 'grey.200',
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}
        >
          Cleaned text
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
          {item.cleanedText || '—'}
        </Typography>
      </Box>

      {/* Tokens — use Box with flexWrap so layout props stay in sx */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 0.75,
          alignItems: 'center',
          mb: 2.5,
        }}
      >
        <Tag size={14} style={{ flexShrink: 0, color: '#6b7280' }} />
        {item.tokens.length > 0 ? (
          item.tokens.map((token) => (
            <Chip
              key={token}
              label={token}
              size="small"
              sx={{ bgcolor: 'grey.100', color: 'text.secondary', fontSize: '0.72rem' }}
            />
          ))
        ) : (
          <Typography variant="caption" color="text.disabled">
            no meaningful tokens
          </Typography>
        )}
      </Box>

      {/* Anomaly score bar */}
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Anomaly Score
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {item.anomalyScore}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={item.anomalyScore}
          color={suspicious ? 'error' : 'success'}
          sx={{ height: 8, borderRadius: 99 }}
        />
      </Stack>

      {/* Reason */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: suspicious ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.06)',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {item.anomalyReason}
        </Typography>
      </Box>
    </Paper>
  );
}
