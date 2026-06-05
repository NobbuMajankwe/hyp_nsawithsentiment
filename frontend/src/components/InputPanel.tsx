import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FileText, RotateCcw, Upload, Zap } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onReset: () => void;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// File parsing helpers
// ---------------------------------------------------------------------------

/** Parse a plain-text file — one feedback record per line. */
function parseTxt(text: string): string {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Parse a CSV file.
 * Tries to detect which column contains feedback text by looking for a header
 * whose name contains "feedback", "text", "comment", or "response".
 * Falls back to the first column if no match is found.
 */
function parseCsv(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';

  // Split a CSV line respecting quoted fields
  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/"/g, ''));
  const feedbackKeywords = ['feedback', 'text', 'comment', 'response', 'review', 'message'];
  let colIndex = headers.findIndex((h) => feedbackKeywords.some((kw) => h.includes(kw)));
  if (colIndex === -1) colIndex = 0; // fallback to first column

  const dataLines = lines.slice(1); // skip header row
  return dataLines
    .map((line) => {
      const cols = splitLine(line);
      return (cols[colIndex] ?? '').replace(/^"|"$/g, '').trim();
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Parse a JSON file.
 * Accepts:
 *   - Array of strings: ["feedback 1", "feedback 2"]
 *   - Array of objects with a text/feedback/comment key: [{text: "..."}, ...]
 *   - Object with a "feedback" or "records" array key
 */
function parseJson(text: string): string {
  const data = JSON.parse(text);

  let items: unknown[] = [];

  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === 'object') {
    // look for a known array key
    const arrayKey = ['feedback', 'records', 'data', 'items', 'results'].find(
      (k) => Array.isArray((data as Record<string, unknown>)[k]),
    );
    if (arrayKey) items = (data as Record<string, unknown[]>)[arrayKey];
  }

  const textKeys = ['text', 'feedback', 'comment', 'response', 'review', 'message', 'content'];

  return items
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const key = textKeys.find((k) => typeof (item as Record<string, unknown>)[k] === 'string');
        if (key) return ((item as Record<string, string>)[key]).trim();
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function parseFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = (e.target?.result as string) ?? '';
        const name = file.name.toLowerCase();

        if (name.endsWith('.json')) {
          resolve(parseJson(raw));
        } else if (name.endsWith('.csv')) {
          resolve(parseCsv(raw));
        } else {
          // .txt or any other plain-text file
          resolve(parseTxt(raw));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InputPanel({ value, onChange, onRun, onReset, loading }: Props) {
  const recordCount = value.split('\n').filter((l) => l.trim()).length;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFileError(null);
    const allowed = ['.txt', '.csv', '.json'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setFileError(`Unsupported file type "${ext}". Please upload a .txt, .csv, or .json file.`);
      return;
    }
    try {
      const parsed = await parseFile(file);
      if (!parsed.trim()) {
        setFileError('No feedback records found in the file. Check the format and try again.');
        return;
      }
      onChange(parsed);
      setFileName(file.name);
    } catch {
      setFileError('Failed to parse the file. Check that it is a valid .txt, .csv, or .json.');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so the same file can be re-selected
    e.target.value = '';
  }

  return (
    <Paper
      elevation={0}
      sx={{ p: 4, borderRadius: 5, bgcolor: 'white', border: '1px solid', borderColor: 'grey.200' }}
    >
      {/* Header */}
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography
          variant="caption"
          sx={{ color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}
        >
          Dataset Input
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Load feedback records
        </Typography>
        <Typography color="text.secondary">
          Upload a file or paste records directly. Each line is one feedback entry.
        </Typography>
      </Stack>

      {/* ── Upload zone ── */}
      <Box
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        sx={{
          mb: 2.5,
          p: 3,
          borderRadius: 4,
          border: '2px dashed',
          borderColor: dragging ? 'primary.main' : 'grey.300',
          bgcolor: dragging ? 'rgba(99,102,241,0.04)' : 'grey.50',
          cursor: 'pointer',
          textAlign: 'center',
          transition: '0.2s',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(99,102,241,0.04)' },
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,.json"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        <Box
          sx={{
            width: 44, height: 44, borderRadius: 3, mx: 'auto', mb: 1.5,
            background: dragging
              ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
              : 'linear-gradient(135deg,#e0e7ff,#ede9fe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: '0.2s',
          }}
        >
          <Upload size={20} color={dragging ? 'white' : '#6366f1'} />
        </Box>

        {fileName ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={15} color="#6366f1" />
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {fileName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              — {recordCount} records loaded
            </Typography>
          </Stack>
        ) : (
          <>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
              Drop a file here or click to browse
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supported formats: <strong>.txt</strong> (one line per record) ·{' '}
              <strong>.csv</strong> (feedback/text column) · <strong>.json</strong> (array of strings or objects)
            </Typography>
          </>
        )}
      </Box>

      {/* File parse error */}
      <Collapse in={!!fileError}>
        <Alert severity="error" onClose={() => setFileError(null)} sx={{ mb: 2, borderRadius: 2 }}>
          {fileError}
        </Alert>
      </Collapse>

      {/* Divider with label */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
        <Box sx={{ flex: 1, height: '1px', bgcolor: 'grey.200' }} />
        <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          or paste directly
        </Typography>
        <Box sx={{ flex: 1, height: '1px', bgcolor: 'grey.200' }} />
      </Stack>

      {/* ── Textarea ── */}
      <TextField
        multiline
        fullWidth
        minRows={8}
        value={value}
        onChange={(e) => { onChange(e.target.value); setFileName(null); }}
        disabled={loading}
        placeholder={`Paste feedback here — one record per line.\n\nExample:\nThe event was well organised and the speakers were informative.\nBUY NOW CLICK FREE MONEY CLICK LINK`}
        sx={{
          mb: 3,
          '& .MuiOutlinedInput-root': {
            borderRadius: 4,
            bgcolor: '#fafafa',
            alignItems: 'start',
            fontFamily: 'monospace',
            '& textarea': { fontSize: 14, lineHeight: 1.9 },
          },
        }}
      />

      {/* ── Footer row ── */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {recordCount} record{recordCount !== 1 ? 's' : ''} loaded
        </Typography>

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            onClick={() => { onReset(); setFileName(null); setFileError(null); }}
            disabled={loading}
            startIcon={<RotateCcw size={16} />}
            sx={{ px: 3, borderRadius: 999 }}
          >
            Reset Sample
          </Button>

          <Button
            variant="contained"
            onClick={onRun}
            disabled={loading || recordCount === 0}
            startIcon={
              loading
                ? <CircularProgress size={16} color="inherit" />
                : <Zap size={16} />
            }
            sx={{
              px: 4, py: 1.4, borderRadius: 999,
              background: 'linear-gradient(135deg,#312e81,#6d28d9)',
              '&:hover': { opacity: 0.92 },
            }}
          >
            {loading ? 'Scanning…' : 'Run NSA Analysis'}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
