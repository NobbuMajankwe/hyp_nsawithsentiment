import { Box, Paper, Stack, Typography } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalysisResult } from '../types';

interface Props {
  results: AnalysisResult[];
}

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------
const VALID_COLOR      = '#22c55e';
const SUSPICIOUS_COLOR = '#ef4444';
const SCORE_COLOR      = '#6366f1';
const TOKEN_COLOR      = '#8b5cf6';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnalyticsCharts({ results }: Props) {
  if (results.length === 0) return null;

  // ── Donut data ──
  const valid      = results.filter((r) => r.nsaStatus === 'Valid').length;
  const suspicious = results.filter((r) => r.nsaStatus === 'Suspicious').length;
  const donutData  = [
    { name: 'Valid',      value: valid,      color: VALID_COLOR },
    { name: 'Suspicious', value: suspicious, color: SUSPICIOUS_COLOR },
  ];

  // ── Anomaly score bar data ──
  const scoreData = results.map((r) => ({
    name:   `#${r.id}`,
    score:  r.anomalyScore,
    status: r.nsaStatus,
  }));

  // ── Token frequency data (top 12 tokens across all records) ──
  const tokenFreq: Record<string, number> = {};
  results.forEach((r) => {
    r.tokens.forEach((t) => {
      tokenFreq[t] = (tokenFreq[t] ?? 0) + 1;
    });
  });
  const tokenData = Object.entries(tokenFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([token, count]) => ({ token, count }));

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 5,
        bgcolor: 'white',
        border: '1px solid',
        borderColor: 'grey.200',
      }}
    >
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography
          variant="caption"
          sx={{ color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}
        >
          Analytics
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          NSA scan visualisations
        </Typography>
      </Stack>

      <Stack spacing={4}>
        {/* ── Row 1: Donut + Score bar side by side ── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
          }}
        >
          {/* Donut */}
          <ChartCard title="Valid vs Suspicious">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) =>
                    percent !== undefined ? `${name} ${(percent * 100).toFixed(0)}%` : name
                  }
                  labelLine={false}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} records`, '']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Anomaly scores */}
          <ChartCard title="Anomaly score per record">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip
                  formatter={(v) => [`${v}%`, 'Anomaly score']}
                  cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {scoreData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.status === 'Suspicious' ? SUSPICIOUS_COLOR : SCORE_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Box>

        {/* ── Row 2: Token frequency full-width ── */}
        {tokenData.length > 0 && (
          <ChartCard title="Top token frequency">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tokenData} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="token"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'occurrences', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: '#9ca3af' } }}
                />
                <Tooltip
                  formatter={(v) => [`${v} record${Number(v) !== 1 ? 's' : ''}`, 'Appears in']}
                  cursor={{ fill: 'rgba(139,92,246,0.06)' }}
                />
                <Bar dataKey="count" fill={TOKEN_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </Stack>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Inner wrapper card for each chart
// ---------------------------------------------------------------------------

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'grey.100',
        bgcolor: '#fafafa',
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, mb: 1.5, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}
