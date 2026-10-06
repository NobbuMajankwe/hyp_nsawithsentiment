/**
 * DashboardStatCards — four KPI tiles shown at the top of the Dashboard.
 */
import { Box, Card, CardContent, Typography } from '@mui/material';

const BG     = '#050816';
const BORDER = '1px solid rgba(34,211,238,0.2)';
const MONO   = 'monospace';

interface StatCardProps {
  label: string;
  value: string | number;
  accent?: string;
}

function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <Card sx={{ bgcolor: BG, border: BORDER, boxShadow: '0 0 24px rgba(34,211,238,0.06)' }}>
      <CardContent>
        <Typography variant="body2" sx={{ color: '#94a3b8', fontFamily: MONO, mb: 0.5 }}>
          {label}
        </Typography>
        <Typography
          variant="h4"
          sx={{ mt: 0.5, fontWeight: 900, color: accent ?? '#22d3ee', fontFamily: MONO }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

interface DashboardStatCardsProps {
  selfCorpora:     number;
  evaluationData:  number;
  completed:       number;
  failed:          number;
  hasDatasetError: boolean;
  hasExperimentError: boolean;
}

export function DashboardStatCards({
  selfCorpora,
  evaluationData,
  completed,
  failed,
  hasDatasetError,
  hasExperimentError,
}: DashboardStatCardsProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
        gap: 2,
      }}
    >
      <StatCard label="SELF corpora"          value={hasDatasetError    ? 'N/A' : selfCorpora}    accent="#22d3ee" />
      <StatCard label="Evaluation datasets"   value={hasDatasetError    ? 'N/A' : evaluationData}  accent="#a78bfa" />
      <StatCard label="Completed experiments" value={hasExperimentError ? 'N/A' : completed}       accent="#22c55e" />
      <StatCard label="Failed experiments"    value={hasExperimentError ? 'N/A' : failed}          accent="#f87171" />
    </Box>
  );
}
