/**
 * FeatureCard — dark-themed card listing feature bullet points.
 * Used on InsightStoryPage and SentimentPage (coming-soon sections).
 */

import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { CheckCircle2 } from 'lucide-react';

export interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  color: string;
  items: string[];
}

export function FeatureCard({ icon, title, color, items }: FeatureCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: '#020617',
        border: `1px solid ${color}30`,
        color: '#e5e7eb',
        boxShadow: `0 0 22px ${color}12`,
        transition: '0.2s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 0 35px ${color}22` },
      }}
    >
      <Box
        sx={{
          width: 52, height: 52, borderRadius: 3,
          bgcolor: '#050816',
          border: `1px solid ${color}40`,
          boxShadow: `0 0 18px ${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          mb: 2.5,
          color,
        }}
      >
        {icon}
      </Box>

      <Typography sx={{ fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace', mb: 0.5 }}>
        {title}
      </Typography>

      <Divider sx={{ mb: 1.5, borderColor: 'rgba(255,255,255,0.06)' }} />

      <Stack spacing={1}>
        {items.map((item) => (
          <Stack key={item} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <CheckCircle2 size={14} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ color: '#94a3b8', fontFamily: 'monospace' }}>
              {item}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
