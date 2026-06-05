import {
  Box,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

import {
  Database,
  ShieldCheck,
  BrainCircuit,
  FileText,
} from 'lucide-react';

const steps = [
  {
    icon: Database,
    title: '01 Load Dataset',
    text: 'Public/API feedback records',
  },
  {
    icon: ShieldCheck,
    title: '02 NSA Scan',
    text: 'Detect suspicious feedback',
  },
  {
    icon: BrainCircuit,
    title: '03 Sentiment',
    text: 'Classify valid feedback only',
  },
  {
    icon: FileText,
    title: '04 Insight Story',
    text: 'Summarise decision insights',
  },
];

export function WorkflowRail() {
  return (
    <Paper
      component="aside"
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 5,
        bgcolor: 'white',
        border: '1px solid',
        borderColor: 'grey.200',
        height: 'fit-content',
        position: {
          lg: 'sticky',
        },
        top: 24,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mb: 3,
          color: 'primary.main',
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        Analysis Flow
      </Typography>

      <Stack spacing={2}>
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <Box
              key={step.title}
              sx={{
                position: 'relative',
                
              }}
            >
              {index < steps.length - 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 22,
                    top: 52,
                    width: 2,
                    height: 40,
                    bgcolor: 'grey.300',
                    backgroundColor: 'pink',
                  }}
                />
              )}

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 4,
                  border: '1px solid',
                  borderColor:
                    index === 1
                      ? 'primary.main'
                      : 'grey.200',

                  bgcolor:
                    index === 1
                      ? 'rgba(99,102,241,0.05)'
                      : 'grey.50',

                  transition: '0.25s',

                  '&:hover': {
                    transform: 'translateX(6px)',
                    boxShadow: 2,
                  },
                }}
              >
                <Stack
                  direction="row"
                  spacing={2}
                 sx={{ alignItems:"center"}}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',

                      bgcolor:
                        index === 1
                          ? 'primary.main'
                          : 'grey.200',

                      color:
                        index === 1
                          ? 'white'
                          : 'text.primary',
                    }}
                  >
                    <Icon size={18} />
                  </Box>

                  <Box>
                    <Typography
                      sx={{fontWeight:700,
                      fontSize:"0.95rem"}}
                    >
                      {step.title}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      {step.text}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}