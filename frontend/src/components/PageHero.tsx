/**
 * PageHero — shared dark-themed hero banner used across NSA, Sentiment,
 * and InsightStory pages.
 *
 * Props:
 *   icon        — lucide icon node shown in the icon box
 *   iconColor   — glow / accent colour for the icon box border + shadow
 *   accentColor — used for the radial gradient blob at top-right
 *   badge       — text shown in the top Chip (e.g. "$ nsa_engine --active")
 *   badgeIcon   — optional icon inside the chip
 *   title       — main heading (rendered verbatim, can include JSX)
 *   description — subtitle paragraph
 *   chips       — optional array of function-call strings shown as code chips
 *   statusLine  — optional status line at the bottom (plain string)
 */

import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export interface PageHeroProps {
  icon: ReactNode;
  iconColor: string;       // e.g. "#22d3ee"
  accentColor?: string;    // radial blob colour, defaults to iconColor
  badge: string;
  badgeIcon?: ReactNode;
  title: ReactNode;        // can be a string or JSX with coloured spans
  description: string;
  chips?: string[];
  statusLine?: string;
}

export function PageHero({
  icon,
  iconColor,
  accentColor,
  badge,
  badgeIcon,
  title,
  description,
  chips = [],
  statusLine,
}: PageHeroProps) {
  const blob = accentColor ?? iconColor;

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        p: { xs: 3, md: 5 },
        mb: 4,
        borderRadius: 4,
        bgcolor: '#050816',
        color: '#e5e7eb',
        overflow: 'hidden',
        border: `1px solid ${iconColor}40`,
        boxShadow: `0 0 45px ${iconColor}18`,
        backgroundImage: `
          radial-gradient(circle at top right, ${blob}28, transparent 32%),
          linear-gradient(135deg, #050816 0%, #020617 55%, #111827 100%)
        `,
      }}
    >
      {/* Subtle grid overlay */}
      <Box
        sx={{
          position: 'absolute', inset: 0, opacity: 0.13, pointerEvents: 'none',
          backgroundImage: `linear-gradient(${iconColor}18 1px, transparent 1px), linear-gradient(90deg, ${iconColor}18 1px, transparent 1px)`,
          backgroundSize: '30px 30px',
        }}
      />

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        {/* Icon + badge + title row */}
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 3 }}>
          <Box
            sx={{
              width: 56, height: 56, borderRadius: 3,
              bgcolor: '#020617',
              border: `1px solid ${iconColor}70`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 22px ${iconColor}40`,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>

          <Box>
            <Chip
              label={badge}
              size="small"
              icon={badgeIcon ? <Box sx={{ display: 'flex', color: iconColor }}>{badgeIcon}</Box> : undefined}
              sx={{
                mb: 1,
                bgcolor: `${iconColor}18`,
                color: iconColor,
                border: `1px solid ${iconColor}50`,
                fontWeight: 800,
                fontFamily: 'monospace',
                '& .MuiChip-icon': { color: iconColor },
              }}
            />
            <Typography
              variant="h3"
              sx={{
                fontWeight: 900, lineHeight: 1, color: '#f8fafc',
                fontFamily: 'monospace',
                fontSize: { xs: '2rem', md: '3rem' },
              }}
            >
              {title}
            </Typography>
          </Box>
        </Stack>

        {/* Description */}
        <Typography
          variant="h6"
          sx={{ maxWidth: 780, color: '#94a3b8', fontWeight: 400, lineHeight: 1.8, fontFamily: 'monospace' }}
        >
          {description}
        </Typography>

        {/* Code chips */}
        {chips.length > 0 && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3, flexWrap: 'wrap' }}>
            {chips.map((chip) => (
              <Chip
                key={chip}
                label={chip}
                size="small"
                sx={{
                  bgcolor: '#020617',
                  color: `${iconColor}dd`,
                  border: `1px solid ${iconColor}40`,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                }}
              />
            ))}
          </Stack>
        )}

        {/* Status line */}
        {statusLine && (
          <Typography
            sx={{ mt: 4, color: 'rgba(148,163,184,0.55)', fontSize: '0.78rem', fontFamily: 'monospace' }}
          >
            {statusLine}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
