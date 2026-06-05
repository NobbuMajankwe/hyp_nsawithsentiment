import { Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { Zap, RotateCcw } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onReset: () => void;
  loading: boolean;
}

export function InputPanel({ value, onChange, onRun, onReset, loading }: Props) {
  const recordCount = value.split('\n').filter((l) => l.trim()).length;

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
          Dataset Input
        </Typography>

        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Paste feedback records
        </Typography>

        <Typography color="text.secondary">
          Each line is treated as one feedback record. The NSA engine will scan
          them for anomalies before sentiment analysis.
        </Typography>
      </Stack>

      <TextField
        multiline
        fullWidth
        minRows={10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        placeholder={`Paste feedback here — one record per line.\n\nExample:\nThe event was well organised and the speakers were informative.\nBUY NOW CLICK FREE MONEY CLICK LINK`}
        sx={{
          mb: 3,
          '& .MuiOutlinedInput-root': {
            borderRadius: 4,
            bgcolor: '#fafafa',
            alignItems: 'start',
            fontFamily: 'monospace',
            '& textarea': {
              fontSize: 14,
              lineHeight: 1.9,
            },
          },
        }}
      />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {recordCount} record{recordCount !== 1 ? 's' : ''} loaded
        </Typography>

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            onClick={onReset}
            disabled={loading}
            startIcon={<RotateCcw size={16} />}
            sx={{ px: 3, borderRadius: 999 }}
          >
            Reset Sample
          </Button>

          <Button
            variant="contained"
            onClick={onRun}
            disabled={loading || recordCount === 0}
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <Zap size={16} />
              )
            }
            sx={{
              px: 4,
              py: 1.4,
              borderRadius: 999,
              background: 'linear-gradient(135deg,#312e81,#6d28d9)',
              '&:hover': { opacity: 0.92 },
            }}
          >
            {loading ? 'Scanning…' : 'Run NSA Analysis'}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
