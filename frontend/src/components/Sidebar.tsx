/**
 * Sidebar — vertical navigation for EventSense AI.
 *
 * Renders a fixed-width sidebar with:
 *  - Logo + brand name at the top
 *  - Nav links in the middle
 *  - Sign-out at the bottom
 */

import { NavLink } from 'react-router-dom';
import {
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  BarChart2,
  BookOpen,
  BrainCircuit,
  Database,
  FlaskConical,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoSvg from '../assets/eventsense_ai_logo.svg';

export const SIDEBAR_WIDTH = 240;

const NAV_LINKS = [
  { label: 'Dashboard',     path: '/dashboard', Icon: BarChart2    },
  { label: 'Datasets',      path: '/datasets',  Icon: Database     },
  { label: 'Run Experiment',path: '/nsa',        Icon: FlaskConical },
  { label: 'Sentiment',     path: '/sentiment',  Icon: BrainCircuit },
  { label: 'Insight Story', path: '/insight',    Icon: BookOpen     },
  { label: 'Profile',       path: '/profile',    Icon: User         },
] as const;

/** The actual drawer content — shared by mobile + desktop. */
function SidebarContent() {
  const { user, logout } = useAuth();

  const initials =
    user?.fullName
      ? user.fullName.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
      : '?';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: '#0a0f1e',
        borderRight: '1px solid rgba(34,211,238,0.12)',
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <Box
        sx={{
          px: 2.5,
          pt: 3,
          pb: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid rgba(34,211,238,0.10)',
        }}
      >
        <Box
          component="img"
          src={logoSvg}
          alt="EventSense AI logo"
          sx={{ width: 36, height: 36, flexShrink: 0 }}
        />
        <Box>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 900,
              color: '#f8fafc',
              fontFamily: 'monospace',
              lineHeight: 1.1,
              letterSpacing: '-0.3px',
            }}
          >
            EventSense AI
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#22d3ee',
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '0.5px',
            }}
          >
            NSA Platform
          </Typography>
        </Box>
      </Box>

      {/* ── Nav links ─────────────────────────────────────────────────── */}
      <Box component="nav" sx={{ flex: 1, px: 1.5, pt: 2, overflowY: 'auto' }}>
        <Stack spacing={0.5}>
          {NAV_LINKS.map(({ label, path, Icon }) => (
            <Box
              key={path}
              component={NavLink}
              to={path}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1.1,
                borderRadius: 2,
                textDecoration: 'none',
                color: '#94a3b8',
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: '0.875rem',
                transition: 'background 0.15s, color 0.15s',
                '&:hover': {
                  bgcolor: 'rgba(34,211,238,0.08)',
                  color: '#e2e8f0',
                },
                '&.active': {
                  bgcolor: 'rgba(34,211,238,0.13)',
                  color: '#22d3ee',
                  boxShadow: 'inset 3px 0 0 #22d3ee',
                },
              }}
            >
              <Icon size={17} />
              {label}
            </Box>
          ))}
        </Stack>
      </Box>

      <Divider sx={{ borderColor: 'rgba(34,211,238,0.10)', mx: 1.5 }} />

      {/* ── User + sign-out ───────────────────────────────────────────── */}
      <Box sx={{ px: 2, py: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: 'rgba(34,211,238,0.12)',
              color: '#67e8f9',
              fontSize: '0.8rem',
              fontWeight: 700,
              fontFamily: 'monospace',
              border: '1px solid rgba(34,211,238,0.3)',
              flexShrink: 0,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: '#f8fafc',
                fontFamily: 'monospace',
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.fullName ?? 'User'}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: '#475569',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.7rem',
              }}
            >
              {user?.email ?? ''}
            </Typography>
          </Box>
          <Tooltip title="Sign out" placement="top">
            <IconButton
              onClick={logout}
              size="small"
              aria-label="Sign out"
              sx={{ color: '#64748b', '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.08)' } }}
            >
              <LogOut size={16} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
}

/**
 * Sidebar component.
 * Always rendered as a permanent `Drawer` — no toggle needed on desktop.
 * On mobile it renders as a `temporary` drawer (pass `open` + `onClose`).
 */
export function Sidebar() {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTH,
          boxSizing: 'border-box',
          bgcolor: '#0a0f1e',
          border: 'none',
        },
      }}
    >
      <SidebarContent />
    </Drawer>
  );
}
