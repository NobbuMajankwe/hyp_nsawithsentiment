/**
 * DataPrepCard — shows dataset readiness summary on the Dashboard.
 */
import { Alert, Card, CardContent, Chip, Stack, Typography } from '@mui/material';

const BG     = '#050816';
//const BG2    = '#020617';
const BORDER = '1px solid rgba(34,211,238,0.2)';
const MONO   = 'monospace';

interface DataPrepCardProps {
  selfCount:     number;
  evalCount:     number;
  analysisCount: number;
  totalDatasets: number;
}

export function DataPrepCard({
  selfCount,
  evalCount,
  analysisCount,
  totalDatasets,
}: DataPrepCardProps) {
  return (
    <Card sx={{ bgcolor: BG, border: BORDER }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1.5 }}>
          Data preparation
        </Typography>
        <Stack spacing={1.5}>
          <Typography sx={{ color: '#94a3b8', fontFamily: MONO, fontSize: '0.9rem' }}>
            Use a SELF corpus for training and a separate labelled evaluation dataset to measure
            performance.
          </Typography>
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
            {[
              `SELF corpus: ${selfCount ? 'available' : 'not found'}`,
              `Evaluation datasets: ${evalCount}`,
              `Analysis datasets: ${analysisCount}`,
            ].map((label) => (
              <Chip
                key={label}
                label={label}
                size="small"
                sx={{
                  fontFamily: MONO,
                  bgcolor: 'rgba(34,211,238,0.08)',
                  color: '#67e8f9',
                  border: '1px solid rgba(34,211,238,0.3)',
                }}
              />
            ))}
          </Stack>
          {totalDatasets === 0 && (
            <Alert severity="info">
              Start by uploading your training and evaluation datasets.
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
