import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

import { Mail, User, Shield, LogOut, Terminal } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          bgcolor: '#050816',
          color: '#94a3b8',
          fontFamily: 'monospace',
        }}
      >
        <Typography>No profile available</Typography>
      </Box>
    );
  }

  const initials = user.fullName
    .split(' ')
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: { xs: 2.5, md: 4 },
        bgcolor: '#050816',
        backgroundImage: `
          radial-gradient(circle at top right, rgba(34,211,238,0.12), transparent 30%),
          radial-gradient(circle at bottom left, rgba(139,92,246,0.1), transparent 35%)
        `,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 680,
          p: { xs: 3, md: 5 },
          borderRadius: 4,
          bgcolor: '#020617',
          color: '#e5e7eb',
          border: '1px solid rgba(34,211,238,0.22)',
          boxShadow: '0 0 45px rgba(34,211,238,0.08)',
          fontFamily: 'monospace',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.12,
            backgroundImage:
              'linear-gradient(rgba(34,211,238,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.14) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            pointerEvents: 'none',
          }}
        />

        <Stack spacing={4} sx={{ position: 'relative', zIndex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Terminal size={16} color="#22d3ee" />
            <Typography
              variant="caption"
              sx={{
                color: '#22d3ee',
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontWeight: 900,
                fontFamily: 'monospace',
              }}
            >
              ~/eventsense-ai/session/profile
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: 'center' }}>
            <Avatar
              sx={{
                width: 92,
                height: 92,
                bgcolor: '#050816',
                color: '#67e8f9',
                fontSize: 34,
                fontWeight: 900,
                fontFamily: 'monospace',
                border: '1px solid rgba(34,211,238,0.45)',
                boxShadow: '0 0 28px rgba(34,211,238,0.25)',
              }}
            >
              {initials}
            </Avatar>

            <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
              <Chip
                label="$ authenticated_user"
                size="small"
                sx={{
                  mb: 1,
                  bgcolor: 'rgba(34,211,238,0.1)',
                  color: '#67e8f9',
                  border: '1px solid rgba(34,211,238,0.3)',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                }}
              />

              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: 30, md: 38 },
                  color: '#f8fafc',
                  fontFamily: 'monospace',
                  lineHeight: 1,
                }}
              >
                {user.fullName}
              </Typography>

              <Typography sx={{ mt: 1, color: '#94a3b8', fontFamily: 'monospace' }}>
                role: {user.role.replace('_', ' ')}
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ borderColor: 'rgba(148,163,184,0.16)' }} />

          <Stack spacing={2}>
            <ProfileRow icon={<Mail size={18} />} label="email" value={user.email} />
            <ProfileRow icon={<Shield size={18} />} label="role" value={user.role.replace('_', ' ')} />
            <ProfileRow icon={<User size={18} />} label="user_id" value={String(user.id)} />
          </Stack>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              bgcolor: '#050816',
              borderRadius: 3,
              border: '1px solid rgba(34,211,238,0.16)',
            }}
          >
            <Typography
              sx={{
                fontWeight: 900,
                mb: 1,
                color: '#f8fafc',
                fontFamily: 'monospace',
              }}
            >
              &gt; eventsense_account.permissions
            </Typography>

            <Typography
              sx={{
                color: '#94a3b8',
                lineHeight: 1.8,
                fontFamily: 'monospace',
              }}
            >
              This account manages datasets, NSA anomaly scans, sentiment reports,
              insight generation, and system configuration.
            </Typography>
          </Paper>

          <Button
            fullWidth
            size="large"
            variant="contained"
            startIcon={<LogOut size={18} />}
            onClick={logout}
            sx={{
              py: 1.6,
              borderRadius: 2,
              bgcolor: 'rgba(248,113,113,0.14)',
              color: '#fca5a5',
              border: '1px solid rgba(248,113,113,0.35)',
              fontWeight: 900,
              fontFamily: 'monospace',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: 'rgba(248,113,113,0.22)',
                boxShadow: '0 0 24px rgba(248,113,113,0.18)',
              },
            }}
          >
            logout --session
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

interface RowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function ProfileRow({ icon, label, value }: RowProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.2,
        borderRadius: 3,
        bgcolor: '#050816',
        border: '1px solid rgba(148,163,184,0.16)',
        display: 'flex',
        gap: 2,
        alignItems: 'center',
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: 2.5,
          bgcolor: 'rgba(34,211,238,0.08)',
          color: '#22d3ee',
          border: '1px solid rgba(34,211,238,0.2)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            color: '#64748b',
            fontFamily: 'monospace',
            fontWeight: 800,
          }}
        >
          {label}
        </Typography>

        <Typography
          sx={{
            fontWeight: 800,
            color: '#e5e7eb',
            fontFamily: 'monospace',
            wordBreak: 'break-word',
          }}
        >
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}