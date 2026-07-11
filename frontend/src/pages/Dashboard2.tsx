import { Box, Button, Chip, Container, Divider, Paper, Stack, Typography } from '@mui/material';
import {
  Activity,
  CheckCircle2,
  Database,
  FileBarChart2,
  Layers,
  Play,
  ShieldCheck,
  ShieldX,
  Sparkles,
  UserCheck,
  XCircle,
  Zap,
} from 'lucide-react';
import { Cell, Legend, Pie, PieChart, Tooltip as RechartsTooltip } from 'recharts';

import { HEADER_HEIGHT } from '../components/Header';
import { useAuth } from '../context/AuthContext';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// ─── static data ──────────────────────────────────────────────────────────────

const STAT_CARDS = [
  {
    label: 'Total Feedback Records',
    value: '8',
    trend: '+8 since last session',
    icon: <Database size={22} />,
    accent: '#6366f1',
    bg: 'rgba(99,102,241,0.08)',
  },
  {
    label: 'Valid (NSA Cleared)',
    value: '5',
    trend: '62.5% pass rate',
    icon: <CheckCircle2 size={22} />,
    accent: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
  },
  {
    label: 'Suspicious (Blocked)',
    value: '3',
    trend: '37.5% flagged',
    icon: <XCircle size={22} />,
    accent: '#f43f5e',
    bg: 'rgba(244,63,94,0.08)',
  },
  {
    label: 'NSA Pass Rate',
    value: '62%',
    trend: 'Prototype baseline',
    icon: <ShieldCheck size={22} />,
    accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
  },
];

const PIPELINE_STAGES = [
  {
    num: '01',
    label: 'Load Dataset',
    status: 'Active',
    statusColor: '#22c55e',
    statusBg: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.30)',
    icon: <Database size={18} />,
    iconColor: '#22c55e',
  },
  {
    num: '02',
    label: 'NSA Scan',
    status: 'Active',
    statusColor: '#22c55e',
    statusBg: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.30)',
    icon: <ShieldCheck size={18} />,
    iconColor: '#22c55e',
  },
  {
    num: '03',
    label: 'Sentiment Analysis',
    status: 'Coming in Part 2',
    statusColor: '#f59e0b',
    statusBg: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.30)',
    icon: <Sparkles size={18} />,
    iconColor: '#f59e0b',
  },
  {
    num: '04',
    label: 'Insight Story',
    status: 'Coming in Part 3',
    statusColor: '#94a3b8',
    statusBg: 'rgba(148,163,184,0.10)',
    borderColor: 'rgba(148,163,184,0.25)',
    icon: <FileBarChart2 size={18} />,
    iconColor: '#94a3b8',
  },
];

interface ActivityItem {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  time: string;
}

const ACTIVITY: ActivityItem[] = [
  {
    icon: <ShieldCheck size={15} />,
    iconBg: '#6366f1',
    title: 'NSA scan completed',
    desc: '8 records processed by the Negative Selection Algorithm',
    time: '2 mins ago',
  },
  {
    icon: <ShieldX size={15} />,
    iconBg: '#f43f5e',
    title: '3 suspicious records blocked',
    desc: 'Anomalous patterns detected and removed by NSA filter',
    time: '2 mins ago',
  },
  {
    icon: <Database size={15} />,
    iconBg: '#22c55e',
    title: 'Sample dataset loaded',
    desc: '8 feedback lines imported into the analysis pipeline',
    time: 'Today',
  },
  {
    icon: <UserCheck size={15} />,
    iconBg: '#0891b2',
    title: 'User account created',
    desc: 'Account successfully registered and authenticated',
    time: 'Today',
  },
  {
    icon: <Zap size={15} />,
    iconBg: '#7c3aed',
    title: 'System initialised',
    desc: 'SignalCheck AI platform loaded and ready',
    time: 'Today',
  },
  {
    icon: <Layers size={15} />,
    iconBg: '#64748b',
    title: 'Database schema ready',
    desc: 'Backend tables verified and migration complete',
    time: 'Today',
  },
];

const DONUT_DATA = [
  { name: 'Valid (NSA Cleared)', value: 5 },
  { name: 'Suspicious (Blocked)', value: 3 },
];
const DONUT_COLORS = ['#6366f1', '#f43f5e'];

const STATUS_PILLS = [
  { dot: '#22c55e', label: 'Backend API', status: 'Online' },
  { dot: '#22c55e', label: 'NSA Engine', status: 'Ready' },
  { dot: '#f59e0b', label: 'Sentiment Model', status: 'Not yet available' },
];

// ─── component ────────────────────────────────────────────────────────────────

export default function Dashboard2() {
  const { user } = useAuth();
  const greeting = getGreeting();
  const roleLabel = user?.role === 'SYSTEM_ADMIN' ? 'System Admin' : 'Event Organiser';
  const roleColor = user?.role === 'SYSTEM_ADMIN' ? '#7c3aed' : '#0891b2';

  return (
    <Box
      sx={{
        minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
        background: `
          radial-gradient(circle at 15% 20%, rgba(99,102,241,0.10), transparent 35%),
          radial-gradient(circle at 85% 75%, rgba(244,63,94,0.07), transparent 32%),
          #f8f5ef
        `,
        pb: 6,
      }}
    >
      {/* ── 1. Hero strip ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          background: 'linear-gradient(120deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
          px: { xs: 3, md: 6 },
          py: { xs: 4, md: 5 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.25), transparent 70%)', top: -80, right: '10%', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,63,94,0.15), transparent 70%)', bottom: -60, left: '5%', pointerEvents: 'none' }} />

        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 900 }}>
          <Stack sx={{ flexDirection: 'row', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip
              label={roleLabel}
              size="small"
              sx={{
                bgcolor: `${roleColor}22`,
                color: roleColor === '#7c3aed' ? '#c4b5fd' : '#67e8f9',
                border: `1px solid ${roleColor}44`,
                fontWeight: 700,
                fontSize: '0.72rem',
              }}
            />
            <Chip
              label="Deliverable 04 — Prototype"
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.12)', fontWeight: 600, fontSize: '0.72rem' }}
            />
          </Stack>

          <Typography sx={{ fontSize: { xs: '1.6rem', md: '2.2rem' }, fontWeight: 800, color: '#f8fafc', lineHeight: 1.2, letterSpacing: '-0.03em' }}>
            {greeting}, {user?.fullName ?? 'User'} 👋
          </Typography>
          <Typography sx={{ mt: 1, fontSize: { xs: '0.9rem', md: '1rem' }, color: 'rgba(248,250,252,0.55)', fontWeight: 500 }}>
            Hybrid NSA + Sentiment Analysis Platform
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="xl" sx={{ mt: 4 }}>

        {/* ── 2. Stat cards ───────────────────────────────────────────────── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
          {STAT_CARDS.map((card) => (
            <Paper key={card.label} elevation={0} sx={{ p: 2.5, borderRadius: 4, border: '1px solid', borderColor: 'grey.200', bgcolor: '#fff', position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: card.accent, borderRadius: '4px 4px 0 0' }} />
              <Box sx={{ width: 42, height: 42, borderRadius: 3, bgcolor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.accent, mb: 2 }}>
                {card.icon}
              </Box>
              <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{card.value}</Typography>
              <Typography sx={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, mt: 0.5 }}>{card.label}</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: card.accent, fontWeight: 600, mt: 0.75 }}>{card.trend}</Typography>
            </Paper>
          ))}
        </Box>

        {/* ── 3. Pipeline stages ─────────────────────────────────────────── */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'grey.200', bgcolor: '#fff', mb: 4 }}>
          <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, mb: 2.5 }}>
            <Activity size={18} color="#6366f1" />
            <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>Pipeline Stage Status</Typography>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            {PIPELINE_STAGES.map((stage) => (
              <Box key={stage.num} sx={{ p: 2, borderRadius: 3, border: `1px solid ${stage.borderColor}`, bgcolor: stage.statusBg }}>
                <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{ color: stage.iconColor, display: 'flex' }}>{stage.icon}</Box>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.06em' }}>{stage.num}</Typography>
                </Stack>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', mb: 0.75 }}>{stage.label}</Typography>
                <Chip label={stage.status} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: stage.statusBg, color: stage.statusColor, border: `1px solid ${stage.borderColor}` }} />
              </Box>
            ))}
          </Box>
        </Paper>

        {/* ── 4. Two-column lower section ────────────────────────────────── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.65fr 1fr' }, gap: 3, mb: 4 }}>

          {/* Activity feed */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'grey.200', bgcolor: '#fff' }}>
            <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <Activity size={18} color="#6366f1" />
              <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>Recent Activity</Typography>
            </Stack>
            <Stack sx={{ gap: 0 }}>
              {ACTIVITY.map((item, idx) => (
                <Box key={idx}>
                  <Stack sx={{ flexDirection: 'row', gap: 2, py: 1.75, alignItems: 'flex-start' }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: item.iconBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
                      {item.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{item.title}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{item.time}</Typography>
                      </Stack>
                      <Typography sx={{ fontSize: '0.8rem', color: '#64748b', mt: 0.25 }}>{item.desc}</Typography>
                    </Box>
                  </Stack>
                  {idx < ACTIVITY.length - 1 && <Divider sx={{ borderColor: 'grey.100' }} />}
                </Box>
              ))}
            </Stack>
          </Paper>

          {/* Right column */}
          <Stack sx={{ gap: 3 }}>
            {/* Donut chart */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'grey.200', bgcolor: '#fff' }}>
              <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, mb: 2 }}>
                <ShieldCheck size={18} color="#6366f1" />
                <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>NSA Scan Breakdown</Typography>
              </Stack>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <PieChart width={220} height={200}>
                  <Pie data={DONUT_DATA} cx={110} cy={90} innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value" stroke="none">
                    {DONUT_DATA.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={DONUT_COLORS[index]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.8rem' }} />
                  <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: '0.78rem', paddingTop: 4 }} />
                </PieChart>
              </Box>
            </Paper>

            {/* Quick actions */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'grey.200', bgcolor: '#fff' }}>
              <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, mb: 2 }}>
                <Zap size={18} color="#6366f1" />
                <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>Quick Actions</Typography>
              </Stack>
              <Stack sx={{ gap: 1.5 }}>
                <Button variant="contained" startIcon={<Play size={15} />} fullWidth sx={{ bgcolor: '#6366f1', color: '#fff', borderRadius: 2.5, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#4f46e5' } }}>
                  Run NSA Analysis
                </Button>
                <Button variant="outlined" startIcon={<FileBarChart2 size={15} />} fullWidth sx={{ borderColor: '#6366f1', color: '#6366f1', borderRadius: 2.5, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: 'rgba(99,102,241,0.05)' } }}>
                  View Results
                </Button>
                <Button variant="outlined" startIcon={<FileBarChart2 size={15} />} fullWidth disabled sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none' }}>
                  Generate Report
                </Button>
              </Stack>
            </Paper>
          </Stack>
        </Box>

        {/* ── 5. System status footer ────────────────────────────────────── */}
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 4, border: '1px solid', borderColor: 'grey.200', bgcolor: '#fff' }}>
          <Stack sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'center' }, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#64748b', mr: 1 }}>SYSTEM STATUS</Typography>
            {STATUS_PILLS.map((pill) => (
              <Box key={pill.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, borderRadius: 999, border: '1px solid', borderColor: 'grey.200', bgcolor: '#f8fafc' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: pill.dot, flexShrink: 0, boxShadow: `0 0 6px ${pill.dot}` }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>{pill.label}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>—</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: pill.dot === '#f59e0b' ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>{pill.status}</Typography>
              </Box>
            ))}
          </Stack>
        </Paper>

      </Container>
    </Box>
  );
}
