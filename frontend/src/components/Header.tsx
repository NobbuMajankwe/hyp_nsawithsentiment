import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { Activity, LogOut, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Page } from '../App';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Header({ currentPage, onNavigate }: Props) {
  const { user, logout } = useAuth();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const initials =
    user?.fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '?';

  const roleLabel = user?.role === 'system_admin' ? 'System Admin' : 'Event Organiser';
  const roleColor = user?.role === 'system_admin' ? '#7c3aed' : '#0891b2';

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        top: 0,
        zIndex: 1100,
        bgcolor: '#0f172a',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1600 }}>
        <Toolbar disableGutters sx={{ minHeight: { xs: 56, md: 64 }, gap: 2 }}>

          {/* ── Logo ── */}
          <Box
            onClick={() => onNavigate('nsa')}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mr: 4, cursor: 'pointer' }}
          >
            <Box
              sx={{
                width: 32, height: 32, borderRadius: 2,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <Activity size={17} color="white" />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'white', letterSpacing: '-0.3px' }}>
              SignalCheck AI
            </Typography>
          </Box>

          {/* ── Nav links ── */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5 }}>
            <NavLink active={currentPage === 'nsa'} onClick={() => onNavigate('nsa')}>
              NSA Analysis
            </NavLink>
            <NavLink active={currentPage === 'sentiment'} onClick={() => onNavigate('sentiment')}>
              Sentiment
            </NavLink>
            <NavLink active={currentPage === 'insight'} onClick={() => onNavigate('insight')}>
              Insight Story
            </NavLink>
          </Box>

          {/* ── Spacer ── */}
          <Box sx={{ flex: 1 }} />

          {/* ── Status badge ── */}
          <Chip
            icon={<ShieldCheck size={13} />}
            label="NSA Active"
            size="small"
            sx={{
              display: { xs: 'none', sm: 'flex' },
              bgcolor: 'rgba(34,197,94,0.12)',
              color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.25)',
              fontWeight: 600,
              fontSize: '0.72rem',
              '& .MuiChip-icon': { color: '#22c55e' },
            }}
          />

          {/* ── Avatar ── */}
          <Tooltip title="Account">
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ p: 0.5 }}>
              <Avatar
                sx={{
                  width: 34, height: 34, fontSize: '0.78rem', fontWeight: 800,
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  border: '2px solid rgba(255,255,255,0.15)',
                }}
              >
                {initials}
              </Avatar>
            </IconButton>
          </Tooltip>

          {/* ── Dropdown ── */}
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1, minWidth: 220, borderRadius: 3,
                  border: '1px solid', borderColor: 'grey.200',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }} noWrap>{user?.fullName}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{user?.email}</Typography>
              <Chip
                label={roleLabel}
                size="small"
                sx={{
                  mt: 0.75, height: 20, fontSize: '0.68rem', fontWeight: 700,
                  bgcolor: `${roleColor}18`, color: roleColor, border: `1px solid ${roleColor}30`,
                }}
              />
            </Box>

            <Divider />

            <MenuItem onClick={() => setMenuAnchor(null)} sx={{ gap: 1.5, py: 1.25, color: 'text.secondary' }} disabled>
              <ListItemIcon sx={{ minWidth: 'unset' }}><User size={16} /></ListItemIcon>
              Profile (coming soon)
            </MenuItem>

            <Divider />

            <MenuItem onClick={() => { setMenuAnchor(null); logout(); }} sx={{ gap: 1.5, py: 1.25, color: 'error.main' }}>
              <ListItemIcon sx={{ minWidth: 'unset', color: 'error.main' }}><LogOut size={16} /></ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>

        </Toolbar>
      </Container>
    </AppBar>
  );
}

// ---------------------------------------------------------------------------
// Nav link button
// ---------------------------------------------------------------------------

function NavLink({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      size="small"
      onClick={onClick}
      sx={{
        px: 1.5, py: 0.5, borderRadius: 2,
        fontSize: '0.82rem',
        fontWeight: active ? 700 : 500,
        color: active ? 'white' : 'rgba(255,255,255,0.55)',
        bgcolor: active ? 'rgba(99,102,241,0.2)' : 'transparent',
        border: active ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
        textTransform: 'none',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.85)' },
      }}
    >
      {children}
    </Button>
  );
}
