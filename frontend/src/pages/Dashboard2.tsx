import { useEffect, useState } from 'react';
import {
  Box, Button, Chip, CircularProgress, Container,
  Divider, Paper, Stack, Typography,
} from '@mui/material';
import {
  Activity, BrainCircuit, CheckCircle2, Database,
  FileBarChart2, Play, ShieldCheck,
  Sparkles, UserCheck, XCircle, Zap,
} from 'lucide-react';
import type { Page } from '../App';
import { Cell, Legend, Pie, PieChart, Tooltip as RechartsTooltip } from 'recharts';

import { HEADER_HEIGHT } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { fetchDashboardSummary, type DashboardSummary, type DashboardActivity } from '../services/api';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'recently';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// ─── activity icon mapping ─────────────────────────────────────────────────

function activityMeta(item: DashboardActivity): {
  icon: React.ReactNode; iconBg: string; desc: string;
} {
  switch (item.eventType) {
    case 'nsa_scan':
      return {
        icon: <ShieldCheck size={15} />,
        iconBg: '#6366f1',
        desc: `${item.detail} records processed by the Negative Selection Algorithm`,
      };
    case 'dataset_loaded':
      return {
        icon: <Database size={15} />,
        iconBg: '#22c55e',
        desc: `Dataset "${item.detail}" imported into the analysis pipeline`,
      };
    case 'account_created':
      return {
        icon: <UserCheck size={15} />,
        iconBg: '#0891b2',
        desc: `Account registered for ${item.detail}`,
      };
    default:
      return {
        icon: <Zap size={15} />,
        iconBg: '#7c3aed',
        desc: item.detail,
      };
  }
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Dashboard2({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { user, token } = useAuth();
  const greeting = getGreeting();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchDashboardSummary(token)
      .then((data) => { if (!cancelled) { setSummary(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError('Could not load dashboard data.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [token]);

  const roleLabel = user?.role === 'SYSTEM_ADMIN' ? 'System Admin' : 'Event Organiser';
  const roleColor = user?.role === 'SYSTEM_ADMIN' ? '#a78bfa' : '#22d3ee';

  // ── derived stat cards from live data ──────────────────────────────────────
  const statCards = summary
    ? [
        {
          label: 'Total Feedback Records',
          value: String(summary.totalFeedback),
          trend: `across ${summary.datasetCount} dataset${summary.datasetCount !== 1 ? 's' : ''}`,
          icon: <Database size={22} />,
          accent: '#6366f1',
          command: 'metric_01',
        },
        {
          label: 'Valid (NSA Cleared)',
          value: String(summary.nsaValidRecords),
          trend: summary.nsaTotalRecords > 0
            ? `${summary.nsaPassRate}% pass rate`
            : 'No scans yet',
          icon: <CheckCircle2 size={22} />,
          accent: '#22c55e',
          command: 'metric_02',
        },
        {
          label: 'Suspicious (Blocked)',
          value: String(summary.nsaSuspiciousRecords),
          trend: summary.nsaTotalRecords > 0
            ? `${100 - summary.nsaPassRate}% flagged`
            : 'No scans yet',
          icon: <XCircle size={22} />,
          accent: '#f43f5e',
          command: 'metric_03',
        },
        {
          label: 'NSA Pass Rate',
          value: summary.nsaTotalRecords > 0 ? `${summary.nsaPassRate}%` : 'N/A',
          trend: summary.nsaRunAt ? `Last scan ${timeAgo(summary.nsaRunAt)}` : 'Run NSA to populate',
          icon: <ShieldCheck size={22} />,
          accent: '#f59e0b',
          command: 'metric_04',
        },
      ]
    : [];

  // ── pipeline stages from live data ─────────────────────────────────────────
  const pipelineStages = summary
    ? [
        {
          num: '01',
          label: 'Load Dataset',
          status: summary.pipeline.datasetLoaded ? 'Active' : 'Pending',
          statusColor: summary.pipeline.datasetLoaded ? '#22c55e' : '#94a3b8',
          borderColor: summary.pipeline.datasetLoaded ? 'rgba(34,197,94,0.30)' : 'rgba(148,163,184,0.25)',
          icon: <Database size={18} />,
          iconColor: summary.pipeline.datasetLoaded ? '#22c55e' : '#94a3b8',
        },
        {
          num: '02',
          label: 'NSA Scan',
          status: summary.pipeline.nsaRun ? 'Active' : 'Pending',
          statusColor: summary.pipeline.nsaRun ? '#22c55e' : '#94a3b8',
          borderColor: summary.pipeline.nsaRun ? 'rgba(34,197,94,0.30)' : 'rgba(148,163,184,0.25)',
          icon: <ShieldCheck size={18} />,
          iconColor: summary.pipeline.nsaRun ? '#22c55e' : '#94a3b8',
        },
        {
          num: '03',
          label: 'Sentiment Analysis',
          status: summary.pipeline.sentimentRun ? 'Active' : 'Pending',
          statusColor: summary.pipeline.sentimentRun ? '#22c55e' : '#f59e0b',
          borderColor: summary.pipeline.sentimentRun ? 'rgba(34,197,94,0.30)' : 'rgba(245,158,11,0.30)',
          icon: <Sparkles size={18} />,
          iconColor: summary.pipeline.sentimentRun ? '#22c55e' : '#f59e0b',
        },
        {
          num: '04',
          label: 'Insight Story',
          status: summary.pipeline.sentimentRun ? 'Ready' : 'Waiting',
          statusColor: summary.pipeline.sentimentRun ? '#22c55e' : '#94a3b8',
          borderColor: summary.pipeline.sentimentRun ? 'rgba(34,197,94,0.30)' : 'rgba(148,163,184,0.25)',
          icon: <FileBarChart2 size={18} />,
          iconColor: summary.pipeline.sentimentRun ? '#22c55e' : '#94a3b8',
        },
      ]
    : [];

  // ── system status pills ────────────────────────────────────────────────────
  const statusPills = [
    { label: 'Backend API',      dot: '#22c55e', status: 'Online' },
    { label: 'NSA Engine',       dot: '#22c55e', status: 'Ready' },
    {
      label: 'Sentiment Model',
      dot: summary?.pipeline.sentimentRun ? '#22c55e' : '#f59e0b',
      status: summary?.pipeline.sentimentRun ? 'Active' : 'Standby',
    },
    {
      label: 'Datasets Loaded',
      dot: (summary?.datasetCount ?? 0) > 0 ? '#22c55e' : '#94a3b8',
      status: summary ? String(summary.datasetCount) : '0',
    },
  ];

  return (
    <Box
      sx={{
        minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
        bgcolor: '#020617',
        color: '#e5e7eb',
        pb: 6,
        backgroundImage: `
          radial-gradient(circle at 15% 10%, rgba(34,211,238,0.09), transparent 30%),
          radial-gradient(circle at 90% 65%, rgba(139,92,246,0.08), transparent 28%),
          linear-gradient(rgba(34,211,238,0.018) 1px, transparent 1px),
          linear-gradient(90deg, rgba(34,211,238,0.018) 1px, transparent 1px)
        `,
        backgroundSize: 'auto, auto, 32px 32px, 32px 32px',
      }}
    >
      {/* Hero console */}
      <Box sx={{
        position: 'relative', overflow: 'hidden',
        px: { xs: 3, md: 6 }, py: { xs: 4, md: 5 },
        bgcolor: '#050816',
        borderBottom: '1px solid rgba(34,211,238,0.16)',
        boxShadow: '0 20px 70px rgba(0,0,0,0.35)',
      }}>
        <Box sx={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            radial-gradient(circle at 85% 20%, rgba(34,211,238,0.14), transparent 28%),
            radial-gradient(circle at 8% 100%, rgba(139,92,246,0.10), transparent 30%)
          `,
          pointerEvents: 'none',
        }} />
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.12,
          backgroundImage: 'linear-gradient(rgba(34,211,238,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.12) 1px, transparent 1px)',
          backgroundSize: '34px 34px', pointerEvents: 'none',
        }} />

        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 1050 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
            <Chip
              label={`$ role --${roleLabel.toLowerCase().replaceAll(' ', '-')}`}
              size="small"
              sx={{
                bgcolor: `${roleColor}14`, color: roleColor,
                border: `1px solid ${roleColor}45`,
                fontWeight: 800, fontFamily: 'monospace',
              }}
            />
          </Stack>

          <Typography sx={{ color: '#22d3ee', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.76rem', letterSpacing: 1, mb: 1 }}>
            ~/eventsense-ai/dashboard
          </Typography>

          <Typography sx={{ fontSize: { xs: '2rem', md: '3rem' }, fontWeight: 900, color: '#f8fafc', lineHeight: 1.1, fontFamily: 'monospace' }}>
            &gt; {greeting.toLowerCase().replaceAll(' ', '_')},{' '}
            <Box component="span" sx={{ color: '#67e8f9' }}>{user?.fullName?.split(' ')[0] ?? 'user'}</Box>
            <Box component="span" sx={{ color: '#22d3ee' }}>.</Box>
          </Typography>

          <Typography sx={{ mt: 1.5, maxWidth: 760, color: '#94a3b8', fontFamily: 'monospace', lineHeight: 1.8 }}>
            Hybrid NSA and sentiment-analysis operations console.
            Monitor datasets, anomaly scans, pipeline execution and
            generated intelligence from one workspace.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
            {[
              'system.boot()',
              `nsa.sessions(${summary?.nsaSessionCount ?? '…'})`,
              `datasets.count(${summary?.datasetCount ?? '…'})`,
            ].map((command) => (
              <Chip key={command} label={command} size="small"
                sx={{ bgcolor: '#020617', color: '#bbf7d0', border: '1px solid rgba(34,197,94,0.22)', fontFamily: 'monospace', fontWeight: 700 }}
              />
            ))}
          </Stack>
        </Box>
      </Box>

      <Container maxWidth="xl" sx={{ mt: 4 }}>

        {/* Loading state */}
        {loading && (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'center', py: 10 }}>
            <CircularProgress size={22} sx={{ color: '#22d3ee' }} />
            <Typography sx={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              fetching_dashboard_data...
            </Typography>
          </Stack>
        )}

        {/* Error state */}
        {!loading && error && (
          <Box sx={{ p: 3, borderRadius: 3, bgcolor: '#050816', border: '1px solid rgba(244,63,94,0.30)', mb: 4 }}>
            <Typography sx={{ color: '#f87171', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              ✗ {error}
            </Typography>
          </Box>
        )}

        {!loading && summary && (
          <>
            {/* Metric cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
              {statCards.map((card) => (
                <MetricCard key={card.label} {...card} />
              ))}
            </Box>

            {/* Pipeline */}
            <ConsolePanel
              command="$ pipeline.inspect()"
              subtitle="Execution state across the EventSense AI processing stages."
              icon={<Activity size={18} />}
              accent="#22d3ee"
              sx={{ mb: 4 }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
                {pipelineStages.map((stage) => (
                  <PipelineStageCard key={stage.num} {...stage} />
                ))}
              </Box>
            </ConsolePanel>

            {/* Lower content */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' }, gap: 3, mb: 4 }}>

              {/* Activity feed */}
              <ConsolePanel
                command="$ tail -f system_activity.log"
                subtitle="Live events generated by platform processes."
                icon={<Activity size={18} />}
                accent="#22d3ee"
              >
                {summary.activity.length === 0 ? (
                  <Typography sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.8rem', py: 2 }}>
                    // no activity yet — upload a dataset or run a scan
                  </Typography>
                ) : (
                  <Stack spacing={0}>
                    {summary.activity.map((item, index) => {
                      const meta = activityMeta(item);
                      return (
                        <Box key={`${item.eventType}-${index}`}>
                          <Stack direction="row" spacing={2} sx={{ py: 1.8, alignItems: 'flex-start' }}>
                            <Box sx={{
                              width: 34, height: 34, borderRadius: 2,
                              bgcolor: `${meta.iconBg}18`, color: meta.iconBg,
                              border: `1px solid ${meta.iconBg}40`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, boxShadow: `0 0 15px ${meta.iconBg}15`,
                            }}>
                              {meta.icon}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                                <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: '#e5e7eb', fontFamily: 'monospace' }}>
                                  {`> ${item.title}`}
                                </Typography>
                                <Typography sx={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                  {timeAgo(item.createdAt)}
                                </Typography>
                              </Stack>
                              <Typography sx={{ mt: 0.4, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.65, fontFamily: 'monospace' }}>
                                {meta.desc}
                              </Typography>
                            </Box>
                          </Stack>
                          {index < summary.activity.length - 1 && (
                            <Divider sx={{ borderColor: 'rgba(148,163,184,0.10)' }} />
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </ConsolePanel>

              <Stack spacing={3}>
                {/* Donut chart */}
                <ConsolePanel
                  command="$ nsa.breakdown()"
                  subtitle="Valid and blocked feedback distribution."
                  icon={<ShieldCheck size={18} />}
                  accent="#22d3ee"
                >
                  {summary.nsaTotalRecords === 0 ? (
                    <Typography sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.8rem', py: 2, textAlign: 'center' }}>
                      // run NSA analysis to see breakdown
                    </Typography>
                  ) : (
                    <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                      <PieChart width={260} height={230}>
                        <Pie
                          data={summary.donutData}
                          cx={130} cy={100}
                          innerRadius={58} outerRadius={84}
                          paddingAngle={4} dataKey="value" stroke="none"
                        >
                          {summary.donutData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#22d3ee' : '#f87171'} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: '#020617',
                            border: '1px solid rgba(34,211,238,0.26)',
                            borderRadius: 10, color: '#e5e7eb',
                            fontFamily: 'monospace', fontSize: '0.78rem',
                          }}
                        />
                        <Legend iconType="circle" iconSize={8}
                          wrapperStyle={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.72rem' }}
                        />
                      </PieChart>
                      <Box sx={{ position: 'absolute', top: 68, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
                        <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>
                          {summary.nsaTotalRecords}
                        </Typography>
                        <Typography sx={{ fontSize: '0.64rem', color: '#64748b', fontFamily: 'monospace' }}>
                          records
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </ConsolePanel>

                {/* Quick actions */}
                <ConsolePanel
                  command="$ actions.available"
                  subtitle="Run or inspect platform processes."
                  icon={<Zap size={18} />}
                  accent="#a78bfa"
                >
                  <Stack spacing={1.5}>
                    <Button variant="contained" startIcon={<Play size={15} />} fullWidth
                      onClick={() => onNavigate('nsa')}
                      sx={{
                        py: 1.25, borderRadius: 2, bgcolor: '#22d3ee', color: '#020617',
                        fontWeight: 900, fontFamily: 'monospace', textTransform: 'none',
                        boxShadow: '0 0 24px rgba(34,211,238,0.24)',
                        '&:hover': { bgcolor: '#67e8f9', boxShadow: '0 0 34px rgba(34,211,238,0.35)' },
                      }}>
                      ./run_nsa_analysis
                    </Button>
                    <Button variant="outlined" startIcon={<BrainCircuit size={15} />} fullWidth
                      onClick={() => onNavigate('sentiment')}
                      sx={{
                        py: 1.15, borderRadius: 2, borderColor: 'rgba(139,92,246,0.4)',
                        color: '#c4b5fd', fontWeight: 800, fontFamily: 'monospace', textTransform: 'none',
                        '&:hover': { borderColor: '#a78bfa', bgcolor: 'rgba(139,92,246,0.08)' },
                      }}>
                      ./run_sentiment_analysis
                    </Button>
                    <Button variant="outlined" startIcon={<FileBarChart2 size={15} />} fullWidth
                      onClick={() => onNavigate('insight')}
                      disabled={!summary.pipeline.sentimentRun}
                      sx={{
                        py: 1.15, borderRadius: 2, fontWeight: 800,
                        fontFamily: 'monospace', textTransform: 'none',
                        borderColor: 'rgba(148,163,184,0.3)', color: '#94a3b8',
                        '&:not(:disabled):hover': { borderColor: '#64748b', bgcolor: 'rgba(148,163,184,0.06)' },
                      }}>
                      view_insight_story
                    </Button>
                  </Stack>
                </ConsolePanel>
              </Stack>
            </Box>

            {/* System status */}
            <Paper elevation={0} sx={{
              p: 2.5, borderRadius: 3, bgcolor: '#050816',
              border: '1px solid rgba(34,211,238,0.16)',
              boxShadow: '0 0 30px rgba(34,211,238,0.05)',
            }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}
                sx={{ alignItems: { xs: 'flex-start', md: 'center' }, flexWrap: 'wrap' }}>
                <Typography sx={{ color: '#22d3ee', fontWeight: 900, fontSize: '0.75rem', fontFamily: 'monospace', mr: 1 }}>
                  $ system.status
                </Typography>
                {statusPills.map((pill) => {
                  const warning = pill.dot === '#f59e0b';
                  return (
                    <Box key={pill.label} sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      px: 1.6, py: 0.75, borderRadius: 2, bgcolor: '#020617',
                      border: '1px solid rgba(148,163,184,0.15)',
                    }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: pill.dot, boxShadow: `0 0 10px ${pill.dot}` }} />
                      <Typography sx={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 800, fontFamily: 'monospace' }}>
                        {pill.label.toLowerCase().replaceAll(' ', '_')}
                      </Typography>
                      <Typography sx={{ color: '#475569', fontFamily: 'monospace' }}>:</Typography>
                      <Typography sx={{
                        fontSize: '0.72rem', fontWeight: 800, fontFamily: 'monospace',
                        color: warning ? '#fbbf24' : '#4ade80',
                      }}>
                        {pill.status.toLowerCase().replaceAll(' ', '_')}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </Paper>
          </>
        )}
      </Container>
    </Box>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

interface MetricCardProps {
  command: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
  accent: string;
}

function MetricCard({ command, icon, label, value, trend, accent }: MetricCardProps) {
  return (
    <Paper elevation={0} sx={{
      position: 'relative', overflow: 'hidden', p: 2.5, borderRadius: 3,
      bgcolor: '#050816', border: `1px solid ${accent}30`,
      boxShadow: `0 0 25px ${accent}10`, transition: '0.2s',
      '&:hover': { transform: 'translateY(-4px)', borderColor: `${accent}65`, boxShadow: `0 0 35px ${accent}1f` },
      '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2, bgcolor: accent, boxShadow: `0 0 14px ${accent}` },
    }}>
      <Typography sx={{ mb: 2, color: '#64748b', fontSize: '0.67rem', fontWeight: 800, fontFamily: 'monospace' }}>
        $ {command}
      </Typography>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{
          width: 42, height: 42, borderRadius: 2, bgcolor: `${accent}12`, color: accent,
          border: `1px solid ${accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 16px ${accent}18`,
        }}>
          {icon}
        </Box>
        <Typography sx={{ color: accent, fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 800 }}>LIVE</Typography>
      </Stack>
      <Typography sx={{ fontSize: '2rem', fontWeight: 900, color: '#f8fafc', lineHeight: 1, fontFamily: 'monospace' }}>
        {value}
      </Typography>
      <Typography sx={{ mt: 0.7, color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, fontFamily: 'monospace' }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.9, color: accent, fontSize: '0.68rem', fontFamily: 'monospace' }}>
        {`> ${trend}`}
      </Typography>
    </Paper>
  );
}

interface PipelineStageCardProps {
  num: string;
  label: string;
  status: string;
  statusColor: string;
  borderColor: string;
  icon: React.ReactNode;
  iconColor: string;
}

function PipelineStageCard({ num, label, status, statusColor, borderColor, icon, iconColor }: PipelineStageCardProps) {
  return (
    <Box sx={{
      position: 'relative', p: 2.2, minHeight: 150, borderRadius: 3,
      bgcolor: '#020617', border: `1px solid ${borderColor}`,
      boxShadow: `0 0 18px ${statusColor}0e`, transition: '0.2s',
      '&:hover': { transform: 'translateY(-3px)', borderColor: statusColor },
    }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ color: statusColor, fontWeight: 900, fontFamily: 'monospace', fontSize: '0.78rem' }}>
          {num}
        </Typography>
        <Box sx={{ color: iconColor, display: 'flex' }}>{icon}</Box>
      </Stack>
      <Typography sx={{ color: '#f8fafc', fontWeight: 900, fontFamily: 'monospace', fontSize: '0.85rem', mb: 1.5 }}>
        {label.replaceAll(' ', '_').toLowerCase()}()
      </Typography>
      <Chip
        label={`$ ${status.toLowerCase().replaceAll(' ', '_')}`}
        size="small"
        sx={{
          bgcolor: `${statusColor}12`, color: statusColor,
          border: `1px solid ${statusColor}35`,
          fontFamily: 'monospace', fontWeight: 800, fontSize: '0.64rem',
        }}
      />
    </Box>
  );
}

interface ConsolePanelProps {
  command: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
  sx?: object;
}

function ConsolePanel({ command, subtitle, icon, accent, children, sx }: ConsolePanelProps) {
  return (
    <Paper elevation={0} sx={{
      p: 3, borderRadius: 3, bgcolor: '#050816',
      border: `1px solid ${accent}25`,
      boxShadow: `0 0 30px ${accent}0b`,
      ...sx,
    }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.7 }}>
        <Box sx={{ color: accent, display: 'flex' }}>{icon}</Box>
        <Typography sx={{ color: '#f8fafc', fontWeight: 900, fontFamily: 'monospace', fontSize: '0.88rem' }}>
          {command}
        </Typography>
      </Stack>
      <Typography sx={{ color: '#64748b', fontSize: '0.73rem', fontFamily: 'monospace', mb: 2.5 }}>
        {subtitle}
      </Typography>
      {children}
    </Paper>
  );
}
