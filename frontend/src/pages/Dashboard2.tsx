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
    status: 'Coming soon',
    statusColor: '#f59e0b',
    statusBg: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.30)',
    icon: <Sparkles size={18} />,
    iconColor: '#f59e0b',
  },
  {
    num: '04',
    label: 'Insight Story',
    status: 'Coming soon',
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
//const DONUT_COLORS = ['#6366f1', '#f43f5e'];

const STATUS_PILLS = [
  { dot: '#22c55e', label: 'Backend API', status: 'Online' },
  { dot: '#22c55e', label: 'NSA Engine', status: 'Ready' },
  { dot: '#f59e0b', label: 'Sentiment Model', status: 'Not yet available' },
];

// ─── component ────────────────────────────────────────────────────────────────

export default function Dashboard2() {
  const { user } = useAuth();

  const greeting = getGreeting();

  const roleLabel =
    user?.role === 'SYSTEM_ADMIN'
      ? 'System Admin'
      : 'Event Organiser';

  const roleColor =
    user?.role === 'SYSTEM_ADMIN'
      ? '#a78bfa'
      : '#22d3ee';

  return (
    <Box
      sx={{
        minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
        bgcolor: '#020617',
        color: '#e5e7eb',
        pb: 6,
//display:'none',
        backgroundImage: `
          radial-gradient(
            circle at 15% 10%,
            rgba(34,211,238,0.09),
            transparent 30%
          ),
          radial-gradient(
            circle at 90% 65%,
            rgba(139,92,246,0.08),
            transparent 28%
          ),
          linear-gradient(
            rgba(34,211,238,0.018) 1px,
            transparent 1px
          ),
          linear-gradient(
            90deg,
            rgba(34,211,238,0.018) 1px,
            transparent 1px
          )
        `,

        backgroundSize: 'auto, auto, 32px 32px, 32px 32px',
      }}
    >
      {/* Hero console */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',

          px: { xs: 3, md: 6 },
          py: { xs: 4, md: 5 },

          bgcolor: '#050816',

          borderBottom:
            '1px solid rgba(34,211,238,0.16)',

          boxShadow:
            '0 20px 70px rgba(0,0,0,0.35)',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,

            backgroundImage: `
              radial-gradient(
                circle at 85% 20%,
                rgba(34,211,238,0.14),
                transparent 28%
              ),
              radial-gradient(
                circle at 8% 100%,
                rgba(139,92,246,0.10),
                transparent 30%
              )
            `,

            pointerEvents: 'none',
          }}
        />

        <Box
          sx={{
            position: 'absolute',
            inset: 0,

            opacity: 0.12,

            backgroundImage:
              'linear-gradient(rgba(34,211,238,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.12) 1px, transparent 1px)',

            backgroundSize: '34px 34px',

            pointerEvents: 'none',
          }}
        />

        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 1050,
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
              flexWrap: 'wrap',
              mb: 2,
            }}
          >
            <Chip
              label={`$ role --${roleLabel
                .toLowerCase()
                .replaceAll(' ', '-')}`}
              size="small"
              sx={{
                bgcolor: `${roleColor}14`,
                color: roleColor,
                border: `1px solid ${roleColor}45`,
                fontWeight: 800,
                fontFamily: 'monospace',
              }}
            />

          
          </Stack>

          <Typography
            sx={{
              color: '#22d3ee',
              fontFamily: 'monospace',
              fontWeight: 800,
              fontSize: '0.76rem',
              letterSpacing: 1,
              mb: 1,
            }}
          >
            ~/eventsense-ai/dashboard
          </Typography>

          <Typography
            sx={{
              fontSize: {
                xs: '2rem',
                md: '3rem',
              },

              fontWeight: 900,

              color: '#f8fafc',

              lineHeight: 1.1,

              fontFamily: 'monospace',
            }}
          >
            &gt; {greeting.toLowerCase().replaceAll(' ', '_')},{' '}
            <Box
              component="span"
              sx={{ color: '#67e8f9' }}
            >
              {user?.fullName?.split(' ')[0] ?? 'user'}
            </Box>
            <Box
              component="span"
              sx={{ color: '#22d3ee' }}
            >
              .
            </Box>
          </Typography>

          <Typography
            sx={{
              mt: 1.5,

              maxWidth: 760,

              color: '#94a3b8',

              fontFamily: 'monospace',

              lineHeight: 1.8,
            }}
          >
            Hybrid NSA and sentiment-analysis operations console.
            Monitor datasets, anomaly scans, pipeline execution and
            generated intelligence from one workspace.
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ mt: 3 }}
          >
            {[
              'system.boot()',
              'nsa.status("ready")',
              'sentiment.status("pending")',
            ].map((command) => (
              <Chip
                key={command}
                label={command}
                size="small"
                sx={{
                  bgcolor: '#020617',
                  color: '#bbf7d0',
                  border:
                    '1px solid rgba(34,197,94,0.22)',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                }}
              />
            ))}
          </Stack>
        </Box>
      </Box>

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        {/* Metric cards */}
        <Box
          sx={{
            display: 'grid',

            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              lg: 'repeat(4, 1fr)',
            },

            gap: 2,
            mb: 4,
          }}
        >
          {STAT_CARDS.map((card, index) => (
            <MetricCard
              key={card.label}
              {...card}
              command={`metric_${String(index + 1).padStart(2, '0')}`}
            />
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
          <Box
            sx={{
              display: 'grid',

              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: 'repeat(4, 1fr)',
              },

              gap: 2,
            }}
          >
            {PIPELINE_STAGES.map((stage) => (
              <PipelineStageCard
                key={stage.num}
                {...stage}
              />
            ))}
          </Box>
        </ConsolePanel>

        {/* Lower content */}
        <Box
          sx={{
            display: 'grid',

            gridTemplateColumns: {
              xs: '1fr',
              lg: '1.6fr 1fr',
            },

            gap: 3,
            mb: 4,
          }}
        >
          {/* Activity feed */}
          <ConsolePanel
            command="$ tail -f system_activity.log"
            subtitle="Live events generated by platform processes."
            icon={<Activity size={18} />}
            accent="#22d3ee"
          >
            <Stack spacing={0}>
              {ACTIVITY.map((item, index) => (
                <Box key={`${item.title}-${index}`}>
                  <Stack
                    direction="row"
                    spacing={2}
                    sx={{
                      py: 1.8,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box
                      sx={{
                        width: 34,
                        height: 34,

                        borderRadius: 2,

                        bgcolor: `${item.iconBg}18`,

                        color: item.iconBg,

                        border:
                          `1px solid ${item.iconBg}40`,

                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',

                        flexShrink: 0,

                        boxShadow:
                          `0 0 15px ${item.iconBg}15`,
                      }}
                    >
                      {item.icon}
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        sx={{
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 1,
                        }}
                      >
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            color: '#e5e7eb',
                            fontFamily: 'monospace',
                          }}
                        >
                          {`> ${item.title}`}
                        </Typography>

                        <Typography
                          sx={{
                            fontSize: '0.68rem',
                            color: '#64748b',
                            fontFamily: 'monospace',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.time}
                        </Typography>
                      </Stack>

                      <Typography
                        sx={{
                          mt: 0.4,
                          fontSize: '0.78rem',
                          color: '#94a3b8',
                          lineHeight: 1.65,
                          fontFamily: 'monospace',
                        }}
                      >
                        {item.desc}
                      </Typography>
                    </Box>
                  </Stack>

                  {index < ACTIVITY.length - 1 && (
                    <Divider
                      sx={{
                        borderColor:
                          'rgba(148,163,184,0.10)',
                      }}
                    />
                  )}
                </Box>
              ))}
            </Stack>
          </ConsolePanel>

          <Stack spacing={3}>
            {/* Donut chart */}
            <ConsolePanel
              command="$ nsa.breakdown()"
              subtitle="Valid and blocked feedback distribution."
              icon={<ShieldCheck size={18} />}
              accent="#22d3ee"
            >
              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <PieChart width={260} height={230}>
                  <Pie
                    data={DONUT_DATA}
                    cx={130}
                    cy={100}
                    innerRadius={58}
                    outerRadius={84}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {DONUT_DATA.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          index === 0
                            ? '#22d3ee'
                            : '#f87171'
                        }
                      />
                    ))}
                  </Pie>

                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#020617',
                      border:
                        '1px solid rgba(34,211,238,0.26)',
                      borderRadius: 10,
                      color: '#e5e7eb',
                      fontFamily: 'monospace',
                      fontSize: '0.78rem',
                    }}
                  />

                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{
                      color: '#94a3b8',
                      fontFamily: 'monospace',
                      fontSize: '0.72rem',
                    }}
                  />
                </PieChart>

                <Box
                  sx={{
                    position: 'absolute',
                    top: 68,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    textAlign: 'center',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '1.8rem',
                      fontWeight: 900,
                      color: '#f8fafc',
                      fontFamily: 'monospace',
                    }}
                  >
                    8
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: '0.64rem',
                      color: '#64748b',
                      fontFamily: 'monospace',
                    }}
                  >
                    records
                  </Typography>
                </Box>
              </Box>
            </ConsolePanel>

            {/* Quick actions */}
            <ConsolePanel
              command="$ actions.available"
              subtitle="Run or inspect platform processes."
              icon={<Zap size={18} />}
              accent="#a78bfa"
            >
              <Stack spacing={1.5}>
                <Button
                  variant="contained"
                  startIcon={<Play size={15} />}
                  fullWidth
                  sx={{
                    py: 1.25,

                    borderRadius: 2,

                    bgcolor: '#22d3ee',

                    color: '#020617',

                    fontWeight: 900,

                    fontFamily: 'monospace',

                    textTransform: 'none',

                    boxShadow:
                      '0 0 24px rgba(34,211,238,0.24)',

                    '&:hover': {
                      bgcolor: '#67e8f9',

                      boxShadow:
                        '0 0 34px rgba(34,211,238,0.35)',
                    },
                  }}
                >
                  ./run_nsa_analysis
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<FileBarChart2 size={15} />}
                  fullWidth
                  sx={{
                    py: 1.15,
                    borderRadius: 2,
                    borderColor:
                      'rgba(139,92,246,0.4)',
                    color: '#c4b5fd',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    textTransform: 'none',

                    '&:hover': {
                      borderColor: '#a78bfa',
                      bgcolor:
                        'rgba(139,92,246,0.08)',
                    },
                  }}
                >
                  view --scan-results
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<FileBarChart2 size={15} />}
                  fullWidth
                  disabled
                  sx={{
                    py: 1.15,
                    borderRadius: 2,
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    textTransform: 'none',
                  }}
                >
                  generate --report
                </Button>
              </Stack>
            </ConsolePanel>
          </Stack>
        </Box>

        {/* System status */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,

            borderRadius: 3,

            bgcolor: '#050816',

            border:
              '1px solid rgba(34,211,238,0.16)',

            boxShadow:
              '0 0 30px rgba(34,211,238,0.05)',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              alignItems: {
                xs: 'flex-start',
                md: 'center',
              },

              flexWrap: 'wrap',
            }}
          >
            <Typography
              sx={{
                color: '#22d3ee',
                fontWeight: 900,
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                mr: 1,
              }}
            >
              $ system.status
            </Typography>

            {STATUS_PILLS.map((pill) => {
              const warning = pill.dot === '#f59e0b';

              return (
                <Box
                  key={pill.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,

                    px: 1.6,
                    py: 0.75,

                    borderRadius: 2,

                    bgcolor: '#020617',

                    border:
                      '1px solid rgba(148,163,184,0.15)',
                  }}
                >
                  <Box
                    sx={{
                      width: 7,
                      height: 7,

                      borderRadius: '50%',

                      bgcolor: pill.dot,

                      boxShadow: `0 0 10px ${pill.dot}`,
                    }}
                  />

                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      color: '#cbd5e1',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                    }}
                  >
                    {pill.label.toLowerCase().replaceAll(' ', '_')}
                  </Typography>

                  <Typography
                    sx={{
                      color: '#475569',
                      fontFamily: 'monospace',
                    }}
                  >
                    :
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      color: warning
                        ? '#fbbf24'
                        : '#4ade80',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                    }}
                  >
                    {pill.status.toLowerCase().replaceAll(' ', '_')}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}

interface MetricCardProps {
  command: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
  accent: string;
  bg: string;
}

function MetricCard({
  command,
  icon,
  label,
  value,
  trend,
  accent,
}: MetricCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',

        p: 2.5,

        borderRadius: 3,

        bgcolor: '#050816',

        border: `1px solid ${accent}30`,

        boxShadow:
          `0 0 25px ${accent}10`,

        transition: '0.2s',

        '&:hover': {
          transform: 'translateY(-4px)',

          borderColor: `${accent}65`,

          boxShadow:
            `0 0 35px ${accent}1f`,
        },

        '&::after': {
          content: '""',

          position: 'absolute',

          top: 0,
          left: 0,
          right: 0,

          height: 2,

          bgcolor: accent,

          boxShadow:
            `0 0 14px ${accent}`,
        },
      }}
    >
      <Typography
        sx={{
          mb: 2,

          color: '#64748b',

          fontSize: '0.67rem',

          fontWeight: 800,

          fontFamily: 'monospace',
        }}
      >
        $ {command}
      </Typography>

      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 2,
        }}
      >
        <Box
          sx={{
            width: 42,
            height: 42,

            borderRadius: 2,

            bgcolor: `${accent}12`,

            color: accent,

            border: `1px solid ${accent}35`,

            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',

            boxShadow:
              `0 0 16px ${accent}18`,
          }}
        >
          {icon}
        </Box>

        <Typography
          sx={{
            color: accent,
            fontFamily: 'monospace',
            fontSize: '0.68rem',
            fontWeight: 800,
          }}
        >
          ONLINE
        </Typography>
      </Stack>

      <Typography
        sx={{
          fontSize: '2rem',

          fontWeight: 900,

          color: '#f8fafc',

          lineHeight: 1,

          fontFamily: 'monospace',
        }}
      >
        {value}
      </Typography>

      <Typography
        sx={{
          mt: 0.7,

          color: '#cbd5e1',

          fontSize: '0.78rem',

          fontWeight: 800,

          fontFamily: 'monospace',
        }}
      >
        {label}
      </Typography>

      <Typography
        sx={{
          mt: 0.9,

          color: accent,

          fontSize: '0.68rem',

          fontFamily: 'monospace',
        }}
      >
        {`> ${trend}`}
      </Typography>
    </Paper>
  );
}

function PipelineStageCard({
  num,
  label,
  status,
  statusColor,
  borderColor,
  icon,
  iconColor,
}: (typeof PIPELINE_STAGES)[number]) {
  return (
    <Box
      sx={{
        position: 'relative',

        p: 2.2,

        minHeight: 150,

        borderRadius: 3,

        bgcolor: '#020617',

        border: `1px solid ${borderColor}`,

        boxShadow:
          `0 0 18px ${statusColor}0e`,

        transition: '0.2s',

        '&:hover': {
          transform: 'translateY(-3px)',
          borderColor: statusColor,
        },
      }}
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography
          sx={{
            color: statusColor,

            fontWeight: 900,

            fontFamily: 'monospace',

            fontSize: '0.78rem',
          }}
        >
          {num}
        </Typography>

        <Box
          sx={{
            color: iconColor,
            display: 'flex',
          }}
        >
          {icon}
        </Box>
      </Stack>

      <Typography
        sx={{
          color: '#f8fafc',

          fontWeight: 900,

          fontFamily: 'monospace',

          fontSize: '0.85rem',

          mb: 1.5,
        }}
      >
        {label.replaceAll(' ', '_').toLowerCase()}()
      </Typography>

      <Chip
        label={`$ ${status.toLowerCase().replaceAll(' ', '_')}`}
        size="small"
        sx={{
          bgcolor: `${statusColor}12`,
          color: statusColor,
          border: `1px solid ${statusColor}35`,
          fontFamily: 'monospace',
          fontWeight: 800,
          fontSize: '0.64rem',
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

function ConsolePanel({
  command,
  subtitle,
  icon,
  accent,
  children,
  sx,
}: ConsolePanelProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,

        borderRadius: 3,

        bgcolor: '#050816',

        border: `1px solid ${accent}25`,

        boxShadow:
          `0 0 30px ${accent}0b`,

        ...sx,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          mb: 0.7,
        }}
      >
        <Box
          sx={{
            color: accent,
            display: 'flex',
          }}
        >
          {icon}
        </Box>

        <Typography
          sx={{
            color: '#f8fafc',

            fontWeight: 900,

            fontFamily: 'monospace',

            fontSize: '0.88rem',
          }}
        >
          {command}
        </Typography>
      </Stack>

      <Typography
        sx={{
          color: '#64748b',

          fontSize: '0.73rem',

          fontFamily: 'monospace',

          mb: 2.5,
        }}
      >
        {subtitle}
      </Typography>

      {children}
    </Paper>
  );
}