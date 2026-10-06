/**
 * ExperimentHistoryCard — searchable, filterable, paginated experiment table
 * extracted from Dashboard.tsx.
 */
import {
  type ChangeEvent,
  type MouseEvent,
  useMemo,
  useState,
} from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import type { Experiment } from '../../services/api';

const BG2  = '#020617';
const MONO = 'monospace';

// ─── helpers ─────────────────────────────────────────────────────────────────
function numeric(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (typeof value !== 'string' && typeof value !== 'number') return 'N/A';
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : 'N/A';
}
function formatDate(value: unknown): string {
  if (typeof value !== 'string') return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
}
function statusColor(status: string): 'success' | 'error' | 'info' | 'default' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED')    return 'error';
  if (status === 'RUNNING')   return 'info';
  return 'default';
}

const FIELD_SX = {
  '& .MuiOutlinedInput-root': { color: '#e2e8f0' },
  '& .MuiInputLabel-root': { color: '#94a3b8' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(34,211,238,0.25)' },
  '& .MuiSvgIcon-root': { color: '#22d3ee' },
};

interface ExperimentHistoryCardProps {
  experiments: Experiment[];
}

export function ExperimentHistoryCard({ experiments }: ExperimentHistoryCardProps) {
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('ALL');
  const [page,     setPage]     = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(
    () =>
      experiments.filter((e) => {
        const q = search.trim().toLowerCase();
        return (
          (status === 'ALL' || e.status === status) &&
          (!q ||
            (e.experiment_name || '').toLowerCase().includes(q) ||
            String(e.experiment_id).includes(q))
        );
      }),
    [experiments, search, status],
  );

  return (
    <Card sx={{ bgcolor: '#050816', border: '1px solid rgba(34,211,238,0.2)', overflow: 'hidden' }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc', mb: 2 }}>
          Experiment history
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Search name or ID"
            size="small"
            value={search}
            fullWidth
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            sx={FIELD_SX}
          />
          <TextField
            select
            label="Status"
            size="small"
            value={status}
            sx={{ minWidth: 180, ...FIELD_SX }}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            {['ALL', 'COMPLETED', 'RUNNING', 'FAILED'].map((v) => (
              <MenuItem key={v} value={v}>
                {v === 'ALL' ? 'All statuses' : v}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Typography
          variant="caption"
          sx={{ color: '#64748b', fontFamily: MONO, mt: 1, display: 'block' }}
        >
          Metrics shown as ratios. N/A = no value returned.
        </Typography>
      </CardContent>

      {filtered.length === 0 ? (
        <Typography sx={{ px: 3, pb: 3, color: '#64748b', fontFamily: MONO }}>
          {experiments.length
            ? '$ no experiments match these filters.'
            : '$ no experiments yet. run your first experiment to see it here.'}
        </Typography>
      ) : (
        <>
          <TableContainer>
            <Table size="small" aria-label="Experiment history" sx={{ bgcolor: BG2 }}>
              <TableHead>
                <TableRow>
                  {['Experiment', 'Status', 'Created', 'Accuracy', 'Precision', 'Recall', 'F1', 'Results'].map(
                    (label) => (
                      <TableCell
                        key={label}
                        sx={{
                          color: '#94a3b8',
                          fontWeight: 700,
                          fontFamily: MONO,
                          borderBottom: '1px solid rgba(148,163,184,0.18)',
                        }}
                      >
                        {label}
                      </TableCell>
                    ),
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.slice(page * pageSize, (page + 1) * pageSize).map((exp) => (
                  <TableRow
                    key={exp.experiment_id}
                    sx={{
                      '&:hover': { bgcolor: 'rgba(34,211,238,0.04)' },
                      borderBottom: '1px solid rgba(148,163,184,0.1)',
                    }}
                  >
                    <TableCell sx={{ minWidth: 180, borderBottom: 'none' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                        {exp.experiment_name || `Experiment #${exp.experiment_id}`}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', fontFamily: MONO }}>
                        #{exp.experiment_id}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ borderBottom: 'none' }}>
                      <Chip
                        size="small"
                        label={exp.status || 'Unknown'}
                        color={statusColor(exp.status)}
                        sx={{ fontFamily: MONO, fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell
                      sx={{ minWidth: 150, color: '#94a3b8', fontFamily: MONO, fontSize: '0.8rem', borderBottom: 'none' }}
                    >
                      {formatDate(exp.created_at)}
                    </TableCell>
                    {[exp.accuracy, exp.precision_score, exp.recall_score, exp.f1_score].map((v, i) => (
                      <TableCell key={i} sx={{ color: '#67e8f9', fontFamily: MONO, borderBottom: 'none' }}>
                        {numeric(v)}
                      </TableCell>
                    ))}
                    <TableCell sx={{ borderBottom: 'none' }}>
                      <Button
                        component={Link}
                        to={`/experiments/${exp.experiment_id}`}
                        size="small"
                        sx={{ color: '#22d3ee', fontFamily: MONO, fontWeight: 700 }}
                        aria-label={`View experiment ${exp.experiment_id}`}
                      >
                        View →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[10, 25, 50]}
            sx={{
              bgcolor: BG2,
              color: '#94a3b8',
              fontFamily: MONO,
              '& .MuiSvgIcon-root': { color: '#22d3ee' },
              '& .MuiIconButton-root': { color: '#22d3ee' },
              '& .Mui-disabled': { color: '#475569 !important' },
            }}
            onPageChange={(_: MouseEvent<HTMLButtonElement> | null, next: number) => setPage(next)}
            onRowsPerPageChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
          />
        </>
      )}
    </Card>
  );
}
