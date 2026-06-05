import {
  Avatar,
  Box,
  Chip,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  BarChart2,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  FileText,
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react';
import logo from '../assets/logo.png';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Page } from '../App';

// ── Exported so App.tsx can offset the main content ──────────────────────
export const SIDENAV_WIDTH           = 220;
export const SIDENAV_COLLAPSED_WIDTH = 64;
export const HEADER_HEIGHT           = 56;

// ── Nav items ──────────────────────────────────────────────────────────────
interface NavItem { page: Page; icon: React.ReactNode; label: string; sublabel: string }

const NAV_ITEMS: NavItem[] = [
  { page: 'nsa',       icon: <ShieldCheck size={18} />, label: 'NSA Analysis',  sublabel: 'Anomaly detection'  },
  { page: 'sentiment', icon: <BrainCircuit size={18} />, label: 'Sentiment',    sublabel: 'Coming in Part 2'   },
  { page: 'insight',   icon: <FileText size={18} />,     label: 'Insight Story', sublabel: 'Coming in Part 3'  },
];

// ── Shared dark background ─────────────────────────────────────────────────
const DARK_BG    = '#0f172a';
const BORDER_CLR = 'rgba(255,255,255,0.07)';

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  currentPage: Page;
  onNavigate:  (page: Page) => void;
  expanded:    boolean;
  onToggle:    () => void;
}

// ── Component ──────────────────────────────────────────────────────────────
export function Header({ currentPage, onNavigate, expanded, onToggle }: Props) {
  const { user, logout } = useAuth();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const initials = user?.fullName
    .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  const roleLabel = user?.role === 'system_admin' ? 'System Admin' : 'Event Organiser';
  const roleColor = user?.role === 'system_admin' ? '#7c3aed' : '#0891b2';
  const navWidth  = expanded ? SIDENAV_WIDTH : SIDENAV_COLLAPSED_WIDTH;

  return (
    <>
      {/* ── Top AppBar ─────────────────────────────────────────────────── */}
      <Box
        component="header"
        sx={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: HEADER_HEIGHT,
          zIndex: 1200,
          bgcolor: DARK_BG,
          borderBottom: `1px solid ${BORDER_CLR}`,
          display: 'flex',
          alignItems: 'center',
          px: 2,
          gap: 2,
        }}
      >
        {/* Logo + wordmark — sits in the sidenav column */}
        <Box
          onClick={() => onNavigate('nsa')}
          sx={{
            width: navWidth - 16,
            minWidth: navWidth - 16,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            cursor: 'pointer',
            overflow: 'hidden',
            transition: 'width 0.25s ease, min-width 0.25s ease',
            flexShrink: 0,
          }}
        >
          <Box
            component="img"
            src={logo}
            alt="SignalCheck AI"
            sx={{ width: 30, height: 30, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
          />
          {expanded && (
            <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'white', whiteSpace: 'nowrap', letterSpacing: '-0.3px' }}>
              SignalCheck AI
            </Typography>
          )}
        </Box>

        {/* Vertical divider between sidenav column and content area */}
        <Box sx={{ width: '1px', height: 28, bgcolor: BORDER_CLR, flexShrink: 0 }} />

        {/* Collapse toggle */}
        <IconButton
          size="small"
          onClick={onToggle}
          sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.06)' } }}
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </IconButton>

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* NSA status badge */}
        <Chip
          icon={<ShieldCheck size={12} />}
          label="NSA Active"
          size="small"
          sx={{
            display: { xs: 'none', sm: 'flex' },
            bgcolor: 'rgba(34,197,94,0.12)',
            color: '#22c55e',
            border: '1px solid rgba(34,197,94,0.2)',
            fontWeight: 600,
            fontSize: '0.7rem',
            '& .MuiChip-icon': { color: '#22c55e' },
          }}
        />

        {/* Avatar */}
        <Tooltip title="Account">
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ p: 0.5 }}>
            <Avatar
              sx={{
                width: 32, height: 32, fontSize: '0.75rem', fontWeight: 800,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                border: '2px solid rgba(255,255,255,0.12)',
              }}
            >
              {initials}
            </Avatar>
          </IconButton>
        </Tooltip>

        {/* Account dropdown */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          slotProps={{
            paper: {
              sx: { mt: 1, minWidth: 220, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' },
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }} noWrap>{user?.fullName}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{user?.email}</Typography>
            <Chip label={roleLabel} size="small" sx={{ mt: 0.75, height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: `${roleColor}18`, color: roleColor, border: `1px solid ${roleColor}30` }} />
          </Box>
          <Divider />
          <MenuItem disabled sx={{ gap: 1.5, py: 1.25, color: 'text.secondary' }}>
            <ListItemIcon sx={{ minWidth: 'unset' }}><User size={16} /></ListItemIcon>
            Profile (coming soon)
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setMenuAnchor(null); logout(); }} sx={{ gap: 1.5, py: 1.25, color: 'error.main' }}>
            <ListItemIcon sx={{ minWidth: 'unset', color: 'error.main' }}><LogOut size={16} /></ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>
      </Box>

      {/* ── Left SideNav — fixed, starts directly below AppBar ─────────── */}
      <Box
        component="nav"
        sx={{
          position: 'fixed',
          top: HEADER_HEIGHT,
          left: 0,
          bottom: 0,
          width: navWidth,
          zIndex: 1100,
          bgcolor: DARK_BG,
          borderRight: `1px solid ${BORDER_CLR}`,
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          transition: 'width 0.25s ease',
          overflow: 'hidden',
        }}
      >
        {/* Nav items */}
        <Box sx={{ flex: 1, px: 1, pt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {NAV_ITEMS.map((item) => {
            const active = item.page === currentPage;
            const isComingSoon = item.page !== 'nsa';
            return (
              <Tooltip key={item.page} title={!expanded ? item.label : ''} placement="right" arrow>
                <Box
                  onClick={() => onNavigate(item.page)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: expanded ? 1.5 : 0,
                    py: 1.1,
                    borderRadius: 2,
                    cursor: 'pointer',
                    justifyContent: expanded ? 'flex-start' : 'center',
                    minHeight: 42,
                    transition: '0.15s',
                    bgcolor: active ? 'rgba(99,102,241,0.18)' : 'transparent',
                    border: '1px solid',
                    borderColor: active ? 'rgba(99,102,241,0.35)' : 'transparent',
                    '&:hover': { bgcolor: active ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <Box sx={{ color: active ? '#a5b4fc' : isComingSoon ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)', flexShrink: 0, display: 'flex' }}>
                    {item.icon}
                  </Box>
                  {expanded && (
                    <Box sx={{ overflow: 'hidden' }}>
                      <Typography sx={{ fontWeight: active ? 700 : 400, fontSize: '0.84rem', color: active ? '#e0e7ff' : isComingSoon ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.75)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                        {item.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                        {item.sublabel}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        {/* Bottom analytics row */}
        <Box sx={{ px: 1, pb: 2 }}>
          <Divider sx={{ borderColor: BORDER_CLR, mb: 1.5 }} />
          <Tooltip title={!expanded ? 'Analytics' : ''} placement="right" arrow>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: expanded ? 1.5 : 0, py: 1, borderRadius: 2, justifyContent: expanded ? 'flex-start' : 'center', color: 'rgba(255,255,255,0.2)' }}>
              <BarChart2 size={18} />
              {expanded && <Typography sx={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>Analytics</Typography>}
            </Box>
          </Tooltip>
        </Box>
      </Box>
    </>
  );
}
