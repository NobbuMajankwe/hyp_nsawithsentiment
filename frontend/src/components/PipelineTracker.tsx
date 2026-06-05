import { Box, Paper, Stack, Typography } from '@mui/material';
import { CheckCircle2, Clock } from 'lucide-react';
import type { PipelineStep } from '../data/pipelineSteps';

interface Props {
  subtitle: string;
  steps: PipelineStep[];
  activeColor?: string;
}

export function PipelineTracker({ subtitle, steps, activeColor = '#6366f1' }: Props) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 3, md: 4 },
        mb: 3,
        borderRadius: 5,
        bgcolor: 'white',
        border: '1px solid',
        borderColor: 'grey.200',
      }}
    >
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1 }}
      >
        Pipeline position
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, mb: 3 }}>
        {subtitle}
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        {steps.map((item, i) => {
          const borderColor = item.active ? activeColor : item.done ? 'success.light' : 'grey.200';
          const bgcolor = item.active
            ? `${activeColor}0a`
            : item.done
            ? 'rgba(34,197,94,0.04)'
            : 'grey.50';
          const labelColor = item.active ? activeColor : item.done ? '#22c55e' : undefined;

          return (
            <Box key={i} sx={{ flex: 1 }}>
              <Paper
                elevation={0}
                sx={{ p: 2.5, borderRadius: 4, height: '70%', border: '2px solid', borderColor, bgcolor, transition: '0.2s' }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: labelColor ?? 'text.disabled' }}>
                    {item.step}
                  </Typography>
                  {item.done && <CheckCircle2 size={14} color="#22c55e" />}
                  {item.active && <Clock size={14} color={activeColor} />}
                </Stack>
                <Typography sx={{ fontWeight: 700 }}>{item.label}</Typography>
                <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
              </Paper>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
