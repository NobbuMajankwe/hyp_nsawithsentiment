import { Box, Chip, Container, Divider, Paper, Stack, Typography } from '@mui/material';
import { BrainCircuit, CheckCircle2, Clock, Filter, Layers, Zap } from 'lucide-react';
import { PipelineTracker } from '../components/PipelineTracker';
import { buildSteps } from '../data/pipelineSteps';

export function SentimentPage() {
  return (
    <Box sx={{ py: 4 }}>
      <Container maxWidth={false} sx={{ maxWidth: 1600 }}>

        {/* ── Hero ── */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            mb: 4,
            borderRadius: 5,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative blobs */}
          <Box sx={{
            position: 'absolute', top: -60, right: -60,
            width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 3 }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: 3,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BrainCircuit size={24} color="white" />
            </Box>
            <Box>
              <Chip
                label="Coming in Part 2"
                size="small"
                icon={<Clock size={11} />}
                sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', mb: 0.5 }}
              />
              <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1, fontSize: { xs: '1.9rem', md: '2.8rem' } }}>
                Sentiment Analysis
              </Typography>
            </Box>
          </Stack>

          <Typography variant="h6" sx={{ maxWidth: 640, color: 'rgba(255,255,255,0.75)', fontWeight: 400, lineHeight: 1.7 }}>
            DistilBERT-powered sentiment classification that processes only the valid feedback
            records that pass through the NSA anomaly filter.
          </Typography>
        </Paper>

        {/* ── Pipeline context ── */}
        <PipelineTracker
          subtitle="Step 3 of 4 — after NSA filter"
          steps={buildSteps(2)}
          activeColor="#6366f1"
        />

        {/* ── Feature cards ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
          <FeatureCard
            icon={<Filter size={22} />}
            title="NSA Pre-filtered Input"
            color="#6366f1"
            items={[
              'Only Valid records from Stage 1 reach this stage',
              'Suspicious records are permanently excluded',
              'Clean signal improves model accuracy',
            ]}
          />
          <FeatureCard
            icon={<BrainCircuit size={22} />}
            title="DistilBERT Classifier"
            color="#8b5cf6"
            items={[
              'Lightweight transformer fine-tuned for sentiment',
              'Labels: Positive, Negative, Neutral',
              'Returns confidence score per record',
            ]}
          />
          <FeatureCard
            icon={<Layers size={22} />}
            title="Output Format"
            color="#0891b2"
            items={[
              'Sentiment label per valid record',
              'Confidence percentage (0–100)',
              'Feeds directly into Insight Story stage',
            ]}
          />
        </Box>

        {/* ── Placeholder preview ── */}
        <Paper elevation={0} sx={{ mt: 3, p: { xs: 3, md: 4 }, borderRadius: 5, bgcolor: 'white', border: '1px dashed', borderColor: 'grey.300' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 3 }}>
            <Zap size={20} color="#6366f1" />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Preview — Sentiment result cards</Typography>
            <Chip label="Placeholder" size="small" sx={{ bgcolor: 'grey.100' }} />
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {MOCK_CARDS.map((card) => (
              <SentimentMockCard key={card.id} {...card} />
            ))}
          </Box>
        </Paper>

      </Container>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeatureCard({ icon, title, color, items }: { icon: React.ReactNode; title: string; color: string; items: string[] }) {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: 'white', border: '1px solid', borderColor: 'grey.200' }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, color }}>
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 700, mb: 1.5 }}>{title}</Typography>
      <Divider sx={{ mb: 1.5 }} />
      <Stack spacing={1}>
        {items.map((item) => (
          <Stack key={item} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <CheckCircle2 size={14} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">{item}</Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function SentimentMockCard({ text, label, confidence }: { id: number; text: string; label: string; confidence: number }) {
  const colors: Record<string, string> = { Positive: '#22c55e', Negative: '#ef4444', Neutral: '#f59e0b' };
  const bgColors: Record<string, string> = { Positive: 'rgba(34,197,94,0.06)', Negative: 'rgba(239,68,68,0.06)', Neutral: 'rgba(245,158,11,0.06)' };
  const color = colors[label] ?? '#6b7280';

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 4, border: '1px solid', borderColor: 'grey.200', bgcolor: bgColors[label] ?? 'grey.50', opacity: 0.7 }}>
      <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 2, lineHeight: 1.7 }}>"{text}"</Typography>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip label={label} size="small" sx={{ fontWeight: 700, bgcolor: `${color}18`, color, border: `1px solid ${color}30` }} />
        <Typography variant="caption" sx={{ fontWeight: 700, color }}>
          {confidence}% confidence
        </Typography>
      </Stack>
    </Paper>
  );
}

const MOCK_CARDS = [
  { id: 1, text: 'The event was well organised and the speakers were informative.', label: 'Positive', confidence: 94 },
  { id: 2, text: 'I enjoyed the networking session and the venue was comfortable.', label: 'Positive', confidence: 88 },
  { id: 3, text: 'The session started late but the information was clear.', label: 'Neutral', confidence: 71 },
  { id: 4, text: 'The workshop was useful and the registration process was smooth.', label: 'Positive', confidence: 91 },
  { id: 5, text: 'The panel discussion was helpful and the staff were friendly.', label: 'Positive', confidence: 89 },
  { id: 6, text: 'Content was relevant but the schedule could be better managed.', label: 'Neutral', confidence: 65 },
];
