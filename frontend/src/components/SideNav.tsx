import { Box, Divider, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import {
  BarChart2,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import logo from '../assets/logo.png';
import { useState } from 'react';
import type { Page } from '../App';

interface NavItem {
  page: Page;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    page: 'nsa',
    icon: <ShieldCheck size={20} />,
    label: 'NSA Analysis',
    sublabel: 'Anomaly detection',
  },
  {
    page: 'sentiment',
    icon: <BrainCircuit size={20} />,
    label: 'Sentiment',
    sublabel: 'Coming in Part 2',
    comingSoon: true,
  },
  {
    page: 'insight',
    icon: <FileText size={20} />,
    label: 'Insight Story',
    sublabel: 'Coming in Part 3',
    comingSoon: true,
  },
];

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function SideNav({ currentPage, onNavigate }: Props) {
  const [expanded, setExpanded] = useState(true);
  const width = expanded ? 220 : 64;

  return (
    <Paper
      component="nav"
      elevation={0}
      sx={{
        width,
        minWidth: width,
        flexShrink: 0,
        borderRadius: 5,
        bgcolor: 'white',
        border: '1px solid',
        borderColor: 'grey.200',
        position: 'sticky',
        top: 24,
        height: 'fit-content',
        overflow: 'hidden',
        transition: 'width 0.25s ease, min-width 0.25s ease',
      }}
    >
      {/* Logo row */}
      <Box
        sx={{
          px: expanded ? 2.5 : 1.5,
          pt: 2.5,
          pb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: expanded ? 'space-between' : 'center',
          gap: 1,
        }}
      >
        {expanded && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="img"
              src={logo}
              alt="EventSense AI logo"
              sx={{ width: 26, height: 26, flexShrink: 0 }}
            />
            <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', color: '#111827', whiteSpace: 'nowrap' }}>
              EventSense AI
            </Typography>
          </Box>
        )}

        <IconButton
          size="small"
          onClick={() => setExpanded((e) => !e)}
          sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'grey.100' } }}
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </IconButton>
      </Box>

      <Divider sx={{ mx: expanded ? 2 : 1 }} />

      {/* Nav items */}
      <Box sx={{ px: expanded ? 1.5 : 1, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.page === currentPage;
          return (
            <Tooltip
              key={item.page}
              title={!expanded ? item.label : ''}
              placement="right"
              arrow
            >
              <Box
                onClick={() => onNavigate(item.page)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: expanded ? 1.5 : 1,
                  py: 1.25,
                  borderRadius: 3,
                  cursor: 'pointer',
                  transition: '0.18s',
                  bgcolor: active ? 'rgba(99,102,241,0.08)' : 'transparent',
                  border: '1px solid',
                  borderColor: active ? 'rgba(99,102,241,0.2)' : 'transparent',
                  '&:hover': {
                    bgcolor: active ? 'rgba(99,102,241,0.1)' : 'grey.50',
                  },
                  justifyContent: expanded ? 'flex-start' : 'center',
                  minHeight: 44,
                }}
              >
                {/* Icon */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: active ? 'primary.main' : item.comingSoon ? 'text.disabled' : 'text.secondary',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </Box>

                {/* Label */}
                {expanded && (
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography
                      sx={{
                        fontWeight: active ? 700 : 500,
                        fontSize: '0.85rem',
                        color: active ? 'primary.main' : item.comingSoon ? 'text.disabled' : 'text.primary',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.disabled',
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.sublabel}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      <Divider sx={{ mx: expanded ? 2 : 1 }} />

      {/* Bottom: analytics shortcut */}
      <Box sx={{ px: expanded ? 1.5 : 1, py: 1.5 }}>
        <Tooltip title={!expanded ? 'Analytics' : ''} placement="right" arrow>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: expanded ? 1.5 : 1,
              py: 1.25,
              borderRadius: 3,
              color: 'text.disabled',
              justifyContent: expanded ? 'flex-start' : 'center',
            }}
          >
            <BarChart2 size={20} />
            {expanded && (
              <Typography sx={{ fontSize: '0.85rem', color: 'text.disabled', whiteSpace: 'nowrap' }}>
                Analytics
              </Typography>
            )}
          </Box>
        </Tooltip>
      </Box>
    </Paper>
  );
}
