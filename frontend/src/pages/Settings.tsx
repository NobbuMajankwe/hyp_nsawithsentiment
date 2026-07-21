import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider,
  IconButton, InputAdornment, Paper, Slider, Snackbar,
  Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Activity, BookOpen, Check, ChevronRight, Circle,
  Cloud, Copy, Eye, EyeOff, FlaskConical, Key,
  KeyRound, Link2, Plug, RefreshCw, Shield, Trash2,
  Webhook, Zap,
} from 'lucide-react';

import { HEADER_HEIGHT } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import {
  fetchSettings, saveSettings,
  generateApiKey, revokeApiKey,
  testExternalConnection,
  type IntegrationSettings,
  type ConnectionTestResult,
} from '../services/api';

// ─── constants ────────────────────────────────────────────────────────────────

const DARK    = '#020617';
const SURFACE = '#050816';
const BORDER  = 'rgba(34,211,238,0.14)';
const CYAN    = '#22d3ee';
const PURPLE  = '#a78bfa';
const GREEN   = '#22c55e';
const RED     = '#f87171';
const AMBER   = '#fbbf24';

const EMPTY: IntegrationSettings = {
  extApiUrl: null, extApiToken: null, extDataPath: null,
  extTextField: 'text', extIdField: 'id',
  webhookUrl: null, webhookSecret: null, webhookEnabled: false,
  nsaThreshold: 0.8, nsaDetectorCount: 100,
  apiKey: null, apiKeyLabel: null, apiKeyCreatedAt: null, updatedAt: null,
};

// ─── small helpers ────────────────────────────────────────────────────────────

function ConsoleCard({
  title, subtitle, accent = CYAN, icon, children, sx,
}: {
  title: string; subtitle?: string; accent?: string;
  icon: React.ReactNode; children: React.ReactNode; sx?: object;
}) {
  return (
    <Paper elevation={0} sx={{
      p: 3, borderRadius: 3, bgcolor: SURFACE,
      border: `1px solid ${accent}22`,
      boxShadow: `0 0 30px ${accent}08`,
      position: 'relative', overflow: 'hidden',
      '&::after': {
        content: '""', position: 'absolute',
        top: 0, left: 0, right: 0, height: 2,
        bgcolor: accent, boxShadow: `0 0 12px ${accent}`,
      },
      ...sx,
    }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: subtitle ? 0.5 : 2 }}>
        <Box sx={{ color: accent, display: 'flex' }}>{icon}</Box>
        <Typography sx={{ fontWeight: 900, fontFamily: 'monospace', color: '#f8fafc', fontSize: '0.9rem' }}>
          {title}
        </Typography>
      </Stack>
      {subtitle && (
        <Typography sx={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.72rem', mb: 2.5 }}>
          {subtitle}
        </Typography>
      )}
      {children}
    </Paper>
  );
}

function DarkField({
  label, value, onChange, type = 'text', placeholder, helper, multiline, rows, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; helper?: string;
  multiline?: boolean; rows?: number; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <TextField
      label={label} fullWidth value={value}
      onChange={(e) => onChange(e.target.value)}
      type={isPassword && !show ? 'password' : 'text'}
      placeholder={placeholder} helperText={helper}
      multiline={multiline} rows={rows} disabled={disabled}
      slotProps={isPassword ? {
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setShow((s) => !s)}
                sx={{ color: '#64748b', '&:hover': { color: '#94a3b8' } }}>
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </IconButton>
            </InputAdornment>
          ),
        },
      } : undefined}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 2, bgcolor: DARK, fontFamily: 'monospace', fontSize: '0.85rem',
          '& fieldset': { borderColor: BORDER },
          '&:hover fieldset': { borderColor: `${CYAN}50` },
          '&.Mui-focused fieldset': { borderColor: CYAN },
        },
        '& .MuiInputLabel-root': { color: '#64748b', fontFamily: 'monospace', fontSize: '0.82rem' },
        '& .MuiInputLabel-root.Mui-focused': { color: CYAN },
        '& .MuiFormHelperText-root': { color: '#475569', fontFamily: 'monospace', fontSize: '0.68rem' },
        '& .MuiInputBase-input': { color: '#e2e8f0' },
        '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#475569' },
      }}
    />
  );
}

function SaveBar({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <Box sx={{
      position: 'sticky', bottom: 0, zIndex: 10,
      mx: -4, mb: -4, px: 4, py: 2,
      bgcolor: `${DARK}ee`, backdropFilter: 'blur(12px)',
      borderTop: `1px solid ${BORDER}`,
    }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
        {saved && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Check size={14} color={GREEN} />
            <Typography sx={{ color: GREEN, fontFamily: 'monospace', fontSize: '0.75rem' }}>
              settings_saved
            </Typography>
          </Stack>
        )}
        <Button
          variant="contained" onClick={onSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Zap size={14} />}
          sx={{
            bgcolor: CYAN, color: DARK, fontWeight: 900, fontFamily: 'monospace',
            textTransform: 'none', borderRadius: 2, px: 3,
            boxShadow: `0 0 20px ${CYAN}30`,
            '&:hover': { bgcolor: '#67e8f9' },
          }}
        >
          {saving ? 'saving...' : './save_settings'}
        </Button>
      </Stack>
    </Box>
  );
}

// ─── Tab 1 — External Data Source ────────────────────────────────────────────

function ExternalSourceTab({
  form, onChange,
}: {
  form: IntegrationSettings;
  onChange: (patch: Partial<IntegrationSettings>) => void;
}) {
  const { token } = useAuth();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  async function handleTest() {
    if (!token) return;
    setTesting(true); setTestResult(null); setTestError(null);
    try {
      const res = await testExternalConnection(token, form);
      setTestResult(res);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'Connection failed.';
      setTestError(msg);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Stack spacing={3}>
      <ConsoleCard
        title="$ external_data_source.configure()"
        subtitle="Connect an external REST API to pull feedback records directly into the EventSense AI pipeline."
        accent={CYAN}
        icon={<Plug size={18} />}
      >
        <Stack spacing={2}>
          <DarkField
            label="API URL"
            value={form.extApiUrl ?? ''}
            onChange={(v) => onChange({ extApiUrl: v })}
            placeholder="https://your-system.com/api/feedback"
            helper="GET endpoint that returns an array of feedback records."
          />
          <DarkField
            label="Bearer Token"
            value={form.extApiToken ?? ''}
            onChange={(v) => onChange({ extApiToken: v })}
            type="password"
            placeholder="Optional — leave blank for public endpoints"
            helper="Sent as Authorization: Bearer <token> on every request."
          />
          <DarkField
            label="Data Path"
            value={form.extDataPath ?? ''}
            onChange={(v) => onChange({ extDataPath: v })}
            placeholder="data.reviews"
            helper='Dot-notation path to the records array. e.g. for { "data": { "reviews": [] } } enter data.reviews. Leave blank if the root is already an array.'
          />
        </Stack>
      </ConsoleCard>

      <ConsoleCard
        title="$ field_mapping.configure()"
        subtitle="Tell EventSense AI which fields in each record contain the feedback text and record ID."
        accent={PURPLE}
        icon={<BookOpen size={18} />}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <DarkField
            label="Text Field"
            value={form.extTextField ?? 'text'}
            onChange={(v) => onChange({ extTextField: v })}
            placeholder="text"
            helper="Field name that contains the feedback text."
          />
          <DarkField
            label="ID Field"
            value={form.extIdField ?? 'id'}
            onChange={(v) => onChange({ extIdField: v })}
            placeholder="id"
            helper="Field name used as a unique record identifier."
          />
        </Box>
      </ConsoleCard>

      <ConsoleCard
        title="$ connection.test()"
        subtitle="Verify the configuration above by making a live request from the EventSense backend."
        accent={GREEN}
        icon={<FlaskConical size={18} />}
      >
        <Button
          variant="outlined" onClick={handleTest} disabled={testing || !form.extApiUrl}
          startIcon={testing ? <CircularProgress size={13} color="inherit" /> : <Activity size={14} />}
          sx={{
            borderColor: `${GREEN}50`, color: GREEN, fontFamily: 'monospace',
            textTransform: 'none', borderRadius: 2, fontWeight: 800,
            '&:hover': { borderColor: GREEN, bgcolor: `${GREEN}0a` },
          }}
        >
          {testing ? 'testing...' : './test_connection'}
        </Button>

        {testError && (
          <Alert severity="error" sx={{ mt: 2, bgcolor: `${RED}10`, color: RED, border: `1px solid ${RED}30`, borderRadius: 2, fontFamily: 'monospace', fontSize: '0.78rem' }}>
            {testError}
          </Alert>
        )}

        {testResult && (
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
              <Circle size={8} color={GREEN} fill={GREEN} />
              <Typography sx={{ color: GREEN, fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 800 }}>
                connected — {testResult.totalRecords} record{testResult.totalRecords !== 1 ? 's' : ''} found
              </Typography>
            </Stack>
            <Stack spacing={1}>
              {testResult.preview.map((item, i) => (
                <Box key={i} sx={{ p: 1.5, borderRadius: 2, bgcolor: DARK, border: `1px solid ${BORDER}` }}>
                  {item.id != null && (
                    <Typography sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.65rem', mb: 0.5 }}>
                      id: {item.id}
                    </Typography>
                  )}
                  <Typography sx={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                    {item.text || <span style={{ color: '#475569' }}>(empty)</span>}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </ConsoleCard>

      <ConsoleCard
        title="$ integration.how_it_works()"
        subtitle="How EventSense AI uses the external data source."
        accent={AMBER}
        icon={<ChevronRight size={18} />}
      >
        <Stack spacing={1.5}>
          {[
            ['01', 'EventSense fetches records from your API URL using the Bearer token.'],
            ['02', 'Records are extracted from the configured data path and text field.'],
            ['03', 'Fetched records are automatically queued as a new dataset in EventSense.'],
            ['04', 'The NSA engine scans the records and filters suspicious feedback.'],
            ['05', 'Valid records proceed to sentiment analysis and insight generation.'],
          ].map(([num, desc]) => (
            <Stack key={num} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <Typography sx={{ color: AMBER, fontFamily: 'monospace', fontWeight: 900, fontSize: '0.72rem', mt: 0.2, flexShrink: 0 }}>
                {num}
              </Typography>
              <Typography sx={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.7 }}>
                {desc}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </ConsoleCard>
    </Stack>
  );
}

// ─── Tab 2 — Webhooks ────────────────────────────────────────────────────────

function WebhooksTab({
  form, onChange,
}: {
  form: IntegrationSettings;
  onChange: (patch: Partial<IntegrationSettings>) => void;
}) {
  const [copied, setCopied] = useState(false);

  const examplePayload = JSON.stringify({
    event: 'analysis.complete',
    datasetId: 42,
    totalRecords: 120,
    validRecords: 108,
    suspiciousRecords: 12,
    sentimentSummary: { positive: 72, negative: 24, neutral: 12 },
    timestamp: new Date().toISOString(),
  }, null, 2);

  function copyPayload() {
    navigator.clipboard.writeText(examplePayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Stack spacing={3}>
      <ConsoleCard
        title="$ webhook.configure()"
        subtitle="Push analysis results to your existing system the moment EventSense AI completes a pipeline run."
        accent={PURPLE}
        icon={<Webhook size={18} />}
      >
        <Stack spacing={2.5}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ color: '#e2e8f0', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem' }}>
                Enable webhook delivery
              </Typography>
              <Typography sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.7rem', mt: 0.3 }}>
                POST analysis results to your endpoint after every pipeline run
              </Typography>
            </Box>
            <Switch
              checked={form.webhookEnabled}
              onChange={(e) => onChange({ webhookEnabled: e.target.checked })}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: PURPLE },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: PURPLE },
              }}
            />
          </Stack>

          <DarkField
            label="Webhook URL"
            value={form.webhookUrl ?? ''}
            onChange={(v) => onChange({ webhookUrl: v })}
            placeholder="https://your-system.com/webhooks/eventsense"
            helper="EventSense AI will POST a JSON payload to this URL."
            disabled={!form.webhookEnabled}
          />
          <DarkField
            label="Signing Secret"
            value={form.webhookSecret ?? ''}
            onChange={(v) => onChange({ webhookSecret: v })}
            type="password"
            placeholder="Optional — used to sign the X-EventSense-Signature header"
            helper="Your system can verify the signature to confirm the request is from EventSense AI."
            disabled={!form.webhookEnabled}
          />
        </Stack>
      </ConsoleCard>

      <ConsoleCard
        title="$ webhook.payload_schema()"
        subtitle="The JSON body EventSense AI sends to your endpoint on every completed analysis."
        accent={CYAN}
        icon={<Cloud size={18} />}
      >
        <Box sx={{ position: 'relative' }}>
          <Tooltip title={copied ? 'Copied!' : 'Copy payload'}>
            <IconButton
              size="small" onClick={copyPayload}
              sx={{
                position: 'absolute', top: 8, right: 8, zIndex: 1,
                color: copied ? GREEN : '#64748b',
                '&:hover': { color: CYAN, bgcolor: `${CYAN}10` },
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </IconButton>
          </Tooltip>
          <Box sx={{
            p: 2, borderRadius: 2, bgcolor: DARK,
            border: `1px solid ${BORDER}`,
            fontFamily: 'monospace', fontSize: '0.75rem',
            color: '#94a3b8', whiteSpace: 'pre', overflowX: 'auto',
          }}>
            {examplePayload}
          </Box>
        </Box>
      </ConsoleCard>

      <ConsoleCard
        title="$ webhook.verification()"
        subtitle="How to verify incoming webhook requests in your system."
        accent={AMBER}
        icon={<Shield size={18} />}
      >
        <Stack spacing={1.5}>
          {[
            'EventSense AI signs every POST with HMAC-SHA256 using your signing secret.',
            'The signature is sent in the X-EventSense-Signature header as sha256=<hex>.',
            'Compute HMAC-SHA256 of the raw request body with your secret and compare.',
            'Reject any request where the signatures do not match.',
          ].map((step, i) => (
            <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <Typography sx={{ color: AMBER, fontFamily: 'monospace', fontWeight: 900, fontSize: '0.72rem', mt: 0.2, flexShrink: 0 }}>
                {String(i + 1).padStart(2, '0')}
              </Typography>
              <Typography sx={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.7 }}>
                {step}
              </Typography>
            </Stack>
          ))}
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: DARK, border: `1px solid ${BORDER}`, mt: 1 }}>
            <Typography sx={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.68rem', mb: 0.5 }}>
              # Python example
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.73rem', whiteSpace: 'pre' }}>
              {`import hmac, hashlib\nsig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()\nassert f"sha256={sig}" == request.headers["X-EventSense-Signature"]`}
            </Typography>
          </Box>
        </Stack>
      </ConsoleCard>
    </Stack>
  );
}

// ─── Tab 3 — NSA Engine ──────────────────────────────────────────────────────

function NsaEngineTab({
  form, onChange,
}: {
  form: IntegrationSettings;
  onChange: (patch: Partial<IntegrationSettings>) => void;
}) {
  const threshold = form.nsaThreshold ?? 0.8;
  const detectors = form.nsaDetectorCount ?? 100;

  return (
    <Stack spacing={3}>
      <ConsoleCard
        title="$ nsa_engine.configure()"
        subtitle="Tune how aggressively the Negative Selection Algorithm flags suspicious feedback. Changes apply to all future scans."
        accent={CYAN}
        icon={<Shield size={18} />}
      >
        <Stack spacing={4}>
          {/* Threshold */}
          <Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box>
                <Typography sx={{ color: '#e2e8f0', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem' }}>
                  Match Threshold
                </Typography>
                <Typography sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.7rem', mt: 0.2 }}>
                  How similar a record must be to a detector to be flagged (0 = none flagged, 1 = all flagged)
                </Typography>
              </Box>
              <Chip
                label={threshold.toFixed(2)}
                size="small"
                sx={{ bgcolor: `${CYAN}14`, color: CYAN, border: `1px solid ${CYAN}35`, fontFamily: 'monospace', fontWeight: 900 }}
              />
            </Stack>
            <Slider
              value={threshold}
              onChange={(_, v) => onChange({ nsaThreshold: v as number })}
              min={0.1} max={1.0} step={0.05}
              sx={{
                color: CYAN,
                '& .MuiSlider-thumb': { boxShadow: `0 0 14px ${CYAN}` },
                '& .MuiSlider-track': { boxShadow: `0 0 8px ${CYAN}40` },
              }}
            />
            <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.5 }}>
              <Typography sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.65rem' }}>0.1 — lenient</Typography>
              <Typography sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.65rem' }}>1.0 — strict</Typography>
            </Stack>

            {/* Recommendation bands */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
              {[
                { range: '0.1–0.5', label: 'Lenient', color: GREEN, desc: 'Catches only highly anomalous records. Low false positives.' },
                { range: '0.6–0.8', label: 'Balanced ✓', color: CYAN, desc: 'Recommended for most event feedback datasets.' },
                { range: '0.9–1.0', label: 'Strict', color: AMBER, desc: 'Aggressively flags borderline records. Higher false positives.' },
              ].map(({ range, label, color, desc }) => (
                <Box key={range} sx={{
                  flex: 1, p: 1.5, borderRadius: 2, bgcolor: DARK,
                  border: `1px solid ${color}25`,
                }}>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 0.5 }}>
                    <Circle size={7} color={color} fill={color} />
                    <Typography sx={{ color, fontFamily: 'monospace', fontWeight: 800, fontSize: '0.72rem' }}>{label}</Typography>
                    <Typography sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.65rem' }}>({range})</Typography>
                  </Stack>
                  <Typography sx={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.68rem', lineHeight: 1.6 }}>{desc}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Divider sx={{ borderColor: BORDER }} />

          {/* Detector count */}
          <Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box>
                <Typography sx={{ color: '#e2e8f0', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem' }}>
                  Detector Count
                </Typography>
                <Typography sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.7rem', mt: 0.2 }}>
                  Number of NSA detectors generated per dataset. More detectors = higher accuracy, slower scan.
                </Typography>
              </Box>
              <Chip
                label={detectors}
                size="small"
                sx={{ bgcolor: `${PURPLE}14`, color: PURPLE, border: `1px solid ${PURPLE}35`, fontFamily: 'monospace', fontWeight: 900 }}
              />
            </Stack>
            <Slider
              value={detectors}
              onChange={(_, v) => onChange({ nsaDetectorCount: v as number })}
              min={10} max={500} step={10}
              sx={{
                color: PURPLE,
                '& .MuiSlider-thumb': { boxShadow: `0 0 14px ${PURPLE}` },
                '& .MuiSlider-track': { boxShadow: `0 0 8px ${PURPLE}40` },
              }}
            />
            <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.5 }}>
              <Typography sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.65rem' }}>10 — fast</Typography>
              <Typography sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.65rem' }}>500 — thorough</Typography>
            </Stack>
          </Box>
        </Stack>
      </ConsoleCard>

      <ConsoleCard
        title="$ nsa_engine.about()"
        subtitle="How the Negative Selection Algorithm works inside EventSense AI."
        accent={AMBER}
        icon={<BookOpen size={18} />}
      >
        <Stack spacing={1.5}>
          {[
            ['Self corpus', 'A set of "normal" feedback patterns learned from your historical data.'],
            ['Detectors', 'Randomly generated vectors that do not match the self corpus — they represent "non-self" patterns.'],
            ['Matching', 'Each incoming record is compared against every detector. A match above the threshold triggers a suspicious flag.'],
            ['Filtering', 'Only records that pass all detectors (non-matching) are considered valid and forwarded to sentiment analysis.'],
          ].map(([term, desc]) => (
            <Stack key={term as string} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <Typography sx={{ color: AMBER, fontFamily: 'monospace', fontWeight: 900, fontSize: '0.72rem', mt: 0.3, flexShrink: 0, minWidth: 110 }}>
                {term}
              </Typography>
              <Typography sx={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.7 }}>
                {desc}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </ConsoleCard>
    </Stack>
  );
}

// ─── Tab 4 — API Access ──────────────────────────────────────────────────────

function ApiAccessTab({
  form, onSettingsChange,
}: {
  form: IntegrationSettings;
  onSettingsChange: (updated: IntegrationSettings) => void;
}) {
  const { token } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!token) return;
    setGenerating(true); setError(null);
    try {
      const updated = await generateApiKey(token);
      onSettingsChange(updated);
      setShowKey(true);
    } catch {
      setError('Failed to generate API key.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke() {
    if (!token) return;
    setRevoking(true); setError(null);
    try {
      const updated = await revokeApiKey(token);
      onSettingsChange(updated);
      setShowKey(false);
    } catch {
      setError('Failed to revoke API key.');
    } finally {
      setRevoking(false);
    }
  }

  function copyKey() {
    if (form.apiKey) {
      navigator.clipboard.writeText(form.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const maskedKey = form.apiKey
    ? form.apiKey.slice(0, 10) + '•'.repeat(30) + form.apiKey.slice(-6)
    : null;

  return (
    <Stack spacing={3}>
      <ConsoleCard
        title="$ api_key.manage()"
        subtitle="Generate an API key so external systems can call EventSense AI endpoints directly without a user login."
        accent={CYAN}
        icon={<KeyRound size={18} />}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2, bgcolor: `${RED}10`, color: RED, border: `1px solid ${RED}30`, borderRadius: 2, fontFamily: 'monospace', fontSize: '0.78rem' }}>
            {error}
          </Alert>
        )}

        {!form.apiKey ? (
          <Stack spacing={2}>
            <Typography sx={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.7 }}>
              No API key exists for your account. Generate one to allow external systems to authenticate with EventSense AI.
            </Typography>
            <Button
              variant="contained" onClick={handleGenerate} disabled={generating}
              startIcon={generating ? <CircularProgress size={14} color="inherit" /> : <Key size={14} />}
              sx={{
                alignSelf: 'flex-start', bgcolor: CYAN, color: DARK,
                fontWeight: 900, fontFamily: 'monospace', textTransform: 'none',
                borderRadius: 2, boxShadow: `0 0 20px ${CYAN}30`,
                '&:hover': { bgcolor: '#67e8f9' },
              }}
            >
              {generating ? 'generating...' : './generate_api_key'}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Circle size={8} color={GREEN} fill={GREEN} />
              <Typography sx={{ color: GREEN, fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 800 }}>
                api_key_active
              </Typography>
              {form.apiKeyCreatedAt && (
                <Typography sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.68rem' }}>
                  — created {new Date(form.apiKeyCreatedAt).toLocaleDateString()}
                </Typography>
              )}
            </Stack>

            {/* Key display */}
            <Box sx={{
              p: 2, borderRadius: 2, bgcolor: DARK,
              border: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', gap: 1.5,
            }}>
              <Key size={14} color="#475569" style={{ flexShrink: 0 }} />
              <Typography sx={{
                flex: 1, fontFamily: 'monospace', fontSize: '0.78rem',
                color: showKey ? '#22d3ee' : '#64748b',
                wordBreak: 'break-all', letterSpacing: showKey ? 0 : 1,
              }}>
                {showKey ? form.apiKey : maskedKey}
              </Typography>
              <Tooltip title={showKey ? 'Hide key' : 'Reveal key'}>
                <IconButton size="small" onClick={() => setShowKey((s) => !s)}
                  sx={{ color: '#64748b', '&:hover': { color: CYAN } }}>
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </IconButton>
              </Tooltip>
              <Tooltip title={copied ? 'Copied!' : 'Copy key'}>
                <IconButton size="small" onClick={copyKey}
                  sx={{ color: copied ? GREEN : '#64748b', '&:hover': { color: CYAN } }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </IconButton>
              </Tooltip>
            </Box>

            <Alert severity="warning" sx={{
              bgcolor: `${AMBER}0e`, color: AMBER,
              border: `1px solid ${AMBER}30`, borderRadius: 2,
              fontFamily: 'monospace', fontSize: '0.72rem',
              '& .MuiAlert-icon': { color: AMBER },
            }}>
              Store this key securely. EventSense AI will not show the full key again after you close this session.
            </Alert>

            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined" size="small" onClick={handleGenerate} disabled={generating}
                startIcon={<RefreshCw size={13} />}
                sx={{ borderColor: `${CYAN}40`, color: CYAN, fontFamily: 'monospace', textTransform: 'none', borderRadius: 2, fontWeight: 800, '&:hover': { borderColor: CYAN, bgcolor: `${CYAN}0a` } }}
              >
                rotate
              </Button>
              <Button
                variant="outlined" size="small" onClick={handleRevoke} disabled={revoking}
                startIcon={revoking ? <CircularProgress size={12} color="inherit" /> : <Trash2 size={13} />}
                sx={{ borderColor: `${RED}40`, color: RED, fontFamily: 'monospace', textTransform: 'none', borderRadius: 2, fontWeight: 800, '&:hover': { borderColor: RED, bgcolor: `${RED}0a` } }}
              >
                revoke
              </Button>
            </Stack>
          </Stack>
        )}
      </ConsoleCard>

      <ConsoleCard
        title="$ api_key.usage()"
        subtitle="How to use the API key from your external system."
        accent={PURPLE}
        icon={<Link2 size={18} />}
      >
        <Stack spacing={2}>
          {[
            {
              label: 'Authenticate',
              code: 'Authorization: Bearer esa_<your_api_key>',
              desc: 'Pass the key in the Authorization header on every request.',
            },
            {
              label: 'Run NSA analysis',
              code: 'POST /api/nsa/analyse\n{ "feedback": ["text 1", "text 2"] }',
              desc: 'Send an array of feedback strings. Returns valid/suspicious classification for each.',
            },
            {
              label: 'Run sentiment analysis',
              code: 'POST /api/sentiment/analyse\n{ "texts": ["text 1", "text 2"] }',
              desc: 'Send pre-filtered (valid) texts. Returns Positive/Negative/Neutral with confidence.',
            },
            {
              label: 'Get dashboard summary',
              code: 'GET /api/dashboard/summary',
              desc: 'Returns aggregated stats for the key owner: datasets, NSA sessions, pass rate.',
            },
          ].map(({ label, code, desc }) => (
            <Box key={label}>
              <Typography sx={{ color: PURPLE, fontFamily: 'monospace', fontWeight: 800, fontSize: '0.75rem', mb: 0.5 }}>
                {`> ${label}`}
              </Typography>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: DARK, border: `1px solid ${BORDER}`, mb: 0.75 }}>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.73rem', color: '#94a3b8', whiteSpace: 'pre' }}>
                  {code}
                </Typography>
              </Box>
              <Typography sx={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                {desc}
              </Typography>
            </Box>
          ))}
        </Stack>
      </ConsoleCard>
    </Stack>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function Settings() {
  const { token } = useAuth();
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<IntegrationSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  // Load settings on mount
  useEffect(() => {
    if (!token) return;
    fetchSettings(token)
      .then((s) => setForm({ ...EMPTY, ...s }))
      .catch(() => setLoadError('Could not load settings.'))
      .finally(() => setLoading(false));
  }, [token]);

  function patch(p: Partial<IntegrationSettings>) {
    setForm((prev) => ({ ...prev, ...p }));
    setSaved(false);
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await saveSettings(token, form);
      setForm({ ...EMPTY, ...updated });
      setSaved(true);
      setSnack({ msg: 'Settings saved successfully.', severity: 'success' });
    } catch {
      setSnack({ msg: 'Failed to save settings.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const TABS = [
    { label: 'External Source', icon: <Plug size={15} /> },
    { label: 'Webhooks',        icon: <Webhook size={15} /> },
    { label: 'NSA Engine',      icon: <Shield size={15} /> },
    { label: 'API Access',      icon: <Key size={15} /> },
  ];

  return (
    <Box sx={{
      minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
      bgcolor: DARK, color: '#e5e7eb', pb: 10,
      backgroundImage: `
        radial-gradient(circle at 10% 5%, rgba(34,211,238,0.07), transparent 30%),
        radial-gradient(circle at 90% 80%, rgba(139,92,246,0.06), transparent 28%)
      `,
    }}>
      {/* Hero */}
      <Box sx={{
        px: { xs: 3, md: 6 }, py: { xs: 3.5, md: 4.5 },
        bgcolor: SURFACE, borderBottom: `1px solid ${BORDER}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 2,
            bgcolor: `${CYAN}12`, border: `1px solid ${CYAN}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: CYAN,
            boxShadow: `0 0 18px ${CYAN}20`,
          }}>
            <Plug size={20} />
          </Box>
          <Box>
            <Typography sx={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 800, letterSpacing: 1 }}>
              ~/eventsense-ai/settings
            </Typography>
            <Typography sx={{ fontWeight: 900, fontFamily: 'monospace', color: '#f8fafc', fontSize: { xs: '1.4rem', md: '1.8rem' }, lineHeight: 1.1 }}>
              &gt; integration_settings<span style={{ color: CYAN }}>.</span>
            </Typography>
          </Box>
        </Stack>
        <Typography sx={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.82rem', maxWidth: 700, lineHeight: 1.8, mt: 1 }}>
          Connect EventSense AI to your existing systems — pull feedback from external APIs,
          push results via webhooks, tune the NSA engine, and manage programmatic API access.
        </Typography>
      </Box>

      <Box sx={{ px: { xs: 2, md: 4 }, pt: 3, maxWidth: 860, mx: 'auto', position: 'relative' }}>
        {loading && (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'center', py: 10 }}>
            <CircularProgress size={20} sx={{ color: CYAN }} />
            <Typography sx={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.82rem' }}>
              loading_settings...
            </Typography>
          </Stack>
        )}

        {!loading && loadError && (
          <Alert severity="error" sx={{ mb: 3, bgcolor: `${RED}10`, color: RED, border: `1px solid ${RED}30`, borderRadius: 2, fontFamily: 'monospace' }}>
            {loadError}
          </Alert>
        )}

        {!loading && !loadError && (
          <>
            {/* Tabs */}
            <Tabs
              value={tab} onChange={(_, v) => setTab(v)}
              sx={{
                mb: 3,
                '& .MuiTab-root': {
                  fontFamily: 'monospace', fontWeight: 800, textTransform: 'none',
                  fontSize: '0.8rem', color: '#64748b', minHeight: 44,
                  '&.Mui-selected': { color: CYAN },
                },
                '& .MuiTabs-indicator': { bgcolor: CYAN, boxShadow: `0 0 10px ${CYAN}` },
                '& .MuiTabs-root': { borderBottom: `1px solid ${BORDER}` },
              }}
            >
              {TABS.map(({ label, icon }) => (
                <Tab key={label} label={label} icon={icon} iconPosition="start" />
              ))}
            </Tabs>

            {tab === 0 && <ExternalSourceTab form={form} onChange={patch} />}
            {tab === 1 && <WebhooksTab form={form} onChange={patch} />}
            {tab === 2 && <NsaEngineTab form={form} onChange={patch} />}
            {tab === 3 && <ApiAccessTab form={form} onSettingsChange={(u) => setForm({ ...EMPTY, ...u })} />}

            {/* Sticky save bar — not shown on API Access tab (no saveable state there) */}
            {tab !== 3 && <SaveBar saving={saving} saved={saved} onSave={handleSave} />}
          </>
        )}
      </Box>

      <Snackbar
        open={!!snack} autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack?.severity ?? 'success'}
          onClose={() => setSnack(null)}
          sx={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
        >
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
