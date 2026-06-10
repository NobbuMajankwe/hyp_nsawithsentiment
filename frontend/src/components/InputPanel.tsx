import { useRef, useState } from "react";
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
} from "@mui/material";
import { FileText, RotateCcw, Upload, Zap } from "lucide-react";

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
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Parse a CSV file.
 * Tries to detect which column contains feedback text by looking for a header
 * whose name contains "feedback", "text", "comment", or "response".
 * Falls back to the first column if no match is found.
 */
function parseCsv(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";

  // Split a CSV line respecting quoted fields
  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/"/g, ""),
  );
  const feedbackKeywords = [
    "feedback",
    "text",
    "comment",
    "response",
    "review",
    "message",
  ];
  let colIndex = headers.findIndex((h) =>
    feedbackKeywords.some((kw) => h.includes(kw)),
  );
  if (colIndex === -1) colIndex = 0; // fallback to first column

  const dataLines = lines.slice(1); // skip header row
  return dataLines
    .map((line) => {
      const cols = splitLine(line);
      return (cols[colIndex] ?? "").replace(/^"|"$/g, "").trim();
    })
    .filter(Boolean)
    .join("\n");
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
  } else if (data && typeof data === "object") {
    // look for a known array key
    const arrayKey = ["feedback", "records", "data", "items", "results"].find(
      (k) => Array.isArray((data as Record<string, unknown>)[k]),
    );
    if (arrayKey) items = (data as Record<string, unknown[]>)[arrayKey];
  }

  const textKeys = [
    "text",
    "feedback",
    "comment",
    "response",
    "review",
    "message",
    "content",
  ];

  return items
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const key = textKeys.find(
          (k) => typeof (item as Record<string, unknown>)[k] === "string",
        );
        if (key) return (item as Record<string, string>)[key].trim();
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function parseFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = (e.target?.result as string) ?? "";
        const name = file.name.toLowerCase();

        if (name.endsWith(".json")) {
          resolve(parseJson(raw));
        } else if (name.endsWith(".csv")) {
          resolve(parseCsv(raw));
        } else {
          // .txt or any other plain-text file
          resolve(parseTxt(raw));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InputPanel({
  value,
  onChange,
  onRun,
  onReset,
  loading,
}: Props) {
  const recordCount = value.split("\n").filter((l) => l.trim()).length;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFileError(null);
    const allowed = [".txt", ".csv", ".json"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setFileError(
        `Unsupported file type "${ext}". Please upload a .txt, .csv, or .json file.`,
      );
      return;
    }
    try {
      const parsed = await parseFile(file);
      if (!parsed.trim()) {
        setFileError(
          "No feedback records found in the file. Check the format and try again.",
        );
        return;
      }
      onChange(parsed);
      setFileName(file.name);
    } catch {
      setFileError(
        "Failed to parse the file. Check that it is a valid .txt, .csv, or .json.",
      );
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
    e.target.value = "";
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 4 },
        borderRadius: 4,
        bgcolor: "#050816",
        color: "#e5e7eb",
        border: "1px solid rgba(34, 211, 238, 0.25)",
        boxShadow: "0 0 40px rgba(34, 211, 238, 0.08)",
        fontFamily: "monospace",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at top right, rgba(34,211,238,0.12), transparent 35%)",
          pointerEvents: "none",
        }}
      />

      {/* Terminal Header */}
      <Stack spacing={1.5} sx={{ mb: 3, position: "relative" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: "#ef4444",
            }}
          />
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: "#f59e0b",
            }}
          />
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: "#22c55e",
            }}
          />

          <Typography
            variant="caption"
            sx={{
              ml: 1,
              color: "#67e8f9",
              letterSpacing: 1,
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            ~/eventsense-ai/input-terminal
          </Typography>
        </Stack>

        <Typography
          variant="h4"
          sx={{
            fontWeight: 900,
            color: "#f8fafc",
            fontFamily: "monospace",
          }}
        >
          &gt; load_feedback_records<span style={{ color: "#22d3ee" }}>()</span>
        </Typography>

        <Typography sx={{ color: "#94a3b8" }}>
          Upload or paste feedback records for NSA anomaly scanning and
          sentiment analysis.
        </Typography>
      </Stack>

      {/* Upload Zone */}
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        sx={{
          mb: 2.5,
          p: 3,
          borderRadius: 3,
          border: "1.5px dashed",
          borderColor: dragging ? "#22d3ee" : "rgba(148,163,184,0.35)",
          bgcolor: dragging ? "rgba(34,211,238,0.08)" : "rgba(15,23,42,0.75)",
          cursor: "pointer",
          transition: "0.2s",
          position: "relative",
          "&:hover": {
            borderColor: "#22d3ee",
            bgcolor: "rgba(34,211,238,0.06)",
          },
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,.json"
          style={{ display: "none" }}
          onChange={handleInputChange}
        />

        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: "#020617",
              border: "1px solid rgba(34,211,238,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: dragging ? "0 0 22px rgba(34,211,238,0.45)" : "none",
            }}
          >
            <Upload size={22} color="#22d3ee" />
          </Box>

          <Box>
            {fileName ? (
              <>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <FileText size={16} color="#22d3ee" />
                  <Typography sx={{ fontWeight: 800, color: "#e0f2fe" }}>
                    {fileName}
                  </Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                  {recordCount} records injected into buffer
                </Typography>
              </>
            ) : (
              <>
                <Typography sx={{ fontWeight: 800, color: "#f8fafc" }}>
                  drag_file_here / browse_system
                </Typography>
                <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                  accepts .txt · .csv · .json
                </Typography>
              </>
            )}
          </Box>
        </Stack>
      </Box>

      <Collapse in={!!fileError}>
        <Alert
          severity="error"
          onClose={() => setFileError(null)}
          sx={{
            mb: 2,
            borderRadius: 2,
            bgcolor: "rgba(127,29,29,0.45)",
            color: "#fecaca",
            border: "1px solid rgba(248,113,113,0.35)",
          }}
        >
          {fileError}
        </Alert>
      </Collapse>

      {/* Command Label */}
      <Typography
        variant="caption"
        sx={{
          display: "block",
          mb: 1,
          color: "#22d3ee",
          fontWeight: 800,
          letterSpacing: 0.8,
        }}
      >
        $ nano feedback_buffer.txt
      </Typography>

      <TextField
        multiline
        fullWidth
        minRows={3}
        maxRows={5}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setFileName(null);
        }}
        disabled={loading}
        placeholder={`# one feedback record per line\nThe event was well organised and the speakers were informative.\nBUY NOW CLICK FREE MONEY CLICK LINK`}
        sx={{
          mb: 3,
          "& .MuiOutlinedInput-root": {
            borderRadius: 3,
            bgcolor: "#020617",
            color: "#d1fae5",
            fontFamily: "monospace",
            border: "1px solid rgba(34,211,238,0.22)",
            "& fieldset": { borderColor: "rgba(34,211,238,0.22)" },
            "&:hover fieldset": { borderColor: "#22d3ee" },
            "&.Mui-focused fieldset": {
              borderColor: "#22d3ee",
              boxShadow: "0 0 18px rgba(34,211,238,0.25)",
            },
            "& textarea": {
              fontSize: 14,
              lineHeight: 1.9,
              color: "#bbf7d0",
            },
          },
        }}
      />

      {/* Footer */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          position: "relative",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: "#94a3b8",
            fontFamily: "monospace",
          }}
        >
          status: <span style={{ color: "#22c55e" }}>READY</span> · records:{" "}
          <span style={{ color: "#67e8f9" }}>{recordCount}</span>
        </Typography>

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            onClick={() => {
              onReset();
              setFileName(null);
              setFileError(null);
            }}
            disabled={loading}
            startIcon={<RotateCcw size={16} />}
            sx={{
              px: 3,
              borderRadius: 2,
              color: "#cbd5e1",
              borderColor: "rgba(148,163,184,0.35)",
              fontFamily: "monospace",
              "&:hover": {
                borderColor: "#94a3b8",
                bgcolor: "rgba(148,163,184,0.08)",
              },
            }}
          >
            reset --sample
          </Button>

          <Button
            variant="contained"
            onClick={onRun}
            disabled={loading || recordCount === 0}
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <Zap size={16} />
              )
            }
            sx={{
              px: 4,
              py: 1.35,
              borderRadius: 2,
              color: "#020617",
              fontWeight: 900,
              fontFamily: "monospace",
              background: "linear-gradient(135deg,#22d3ee,#22c55e)",
              boxShadow: "0 0 24px rgba(34,211,238,0.35)",
              "&:hover": {
                background: "linear-gradient(135deg,#67e8f9,#4ade80)",
                boxShadow: "0 0 32px rgba(34,211,238,0.55)",
              },
            }}
          >
            {loading ? "scanning..." : "./run_nsa_scan"}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
