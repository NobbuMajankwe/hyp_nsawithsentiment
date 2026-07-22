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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  CloudDownload,
  FileText,
  Link,
  RotateCcw,
  Upload,
  Zap,
} from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onReset: () => void;
  loading: boolean;
}

type InputMethod = "api" | "file";

const TEXT_KEYS = [
  "text",
  "body",
  "feedback",
  "comment",
  "response",
  "review",
  "message",
  "content",
  "description",
];

const ARRAY_KEYS = [
  "feedback",
  "comments",
  "reviews",
  "records",
  "data",
  "items",
  "results",
  "products",
];

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseTxt(text: string): string {
  return text
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean)
    .join("\n");
}

function detectDelimiter(headerLine: string): "," | ";" {
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;

  return semicolonCount > commaCount ? ";" : ",";
}

function splitCsvLine(line: string, delimiter: "," | ";"): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCsv(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return "";

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map((header) =>
    header.toLowerCase().replace(/^"|"$/g, "").trim(),
  );

  let columnIndex = headers.findIndex((header) =>
    TEXT_KEYS.some(
      (keyword) =>
        header === keyword ||
        header.startsWith(`${keyword}_`) ||
        header.endsWith(`_${keyword}`) ||
        header.includes(keyword),
    ),
  );

  if (columnIndex === -1) {
    columnIndex = 0;
  }

  return lines
    .slice(1)
    .map((line) => {
      const columns = splitCsvLine(line, delimiter);
      return cleanText((columns[columnIndex] ?? "").replace(/^"|"$/g, ""));
    })
    .filter(Boolean)
    .join("\n");
}

function extractFeedback(value: unknown): string[] {
  if (typeof value === "string") {
    const text = cleanText(value);
    return text ? [text] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractFeedback);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const objectValue = value as Record<string, unknown>;
  const records: string[] = [];

  for (const [key, itemValue] of Object.entries(objectValue)) {
    const normalizedKey = key.toLowerCase();

    if (
      typeof itemValue === "string" &&
      TEXT_KEYS.some((textKey) => normalizedKey.includes(textKey))
    ) {
      const text = cleanText(itemValue);
      if (text) records.push(text);
    }
  }

  if (records.length > 0) {
    return records;
  }

  for (const key of ARRAY_KEYS) {
    const matchingKey = Object.keys(objectValue).find(
      (objectKey) => objectKey.toLowerCase() === key,
    );

    if (matchingKey) {
      records.push(...extractFeedback(objectValue[matchingKey]));
    }
  }

  return records;
}

function parseJsonValue(value: unknown): string {
  return [...new Set(extractFeedback(value))].join("\n");
}

function parseJson(text: string): string {
  return parseJsonValue(JSON.parse(text));
}

function parseFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const raw = String(event.target?.result ?? "");
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith(".json")) {
          resolve(parseJson(raw));
        } else if (fileName.endsWith(".csv")) {
          resolve(parseCsv(raw));
        } else {
          resolve(parseTxt(raw));
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsText(file);
  });
}

async function fetchApiFeedback(apiUrl: string): Promise<string> {
  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data: unknown = await response.json();
    return parseJsonValue(data);
  }

  const text = await response.text();
  return parseTxt(text);
}

export function InputPanel({
  value,
  onChange,
  onRun,
  onReset,
  loading,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputMethod, setInputMethod] = useState<InputMethod>("api");
  const [apiUrl, setApiUrl] = useState("");
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const recordCount = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;

  const busy = loading || sourceLoading;

  function resetImportedData() {
    onReset();
    setSourceName(null);
    setInputError(null);
    setApiUrl("");
  }

  async function handleApiImport() {
    setInputError(null);

    const trimmedUrl = apiUrl.trim();

    if (!trimmedUrl) {
      setInputError("Enter an API URL.");
      return;
    }

    try {
      const parsedUrl = new URL(trimmedUrl);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        setInputError("The API URL must use HTTP or HTTPS.");
        return;
      }
    } catch {
      setInputError("Enter a valid API URL.");
      return;
    }

    setSourceLoading(true);

    try {
      const parsed = await fetchApiFeedback(trimmedUrl);

      if (!parsed.trim()) {
        throw new Error(
          "The API response did not contain recognised feedback text.",
        );
      }

      onChange(parsed);
      setSourceName(trimmedUrl);
    } catch (error) {
      setInputError(
        error instanceof Error
          ? error.message
          : "Failed to retrieve feedback from the API.",
      );
    } finally {
      setSourceLoading(false);
    }
  }

  async function handleFile(file: File) {
    setInputError(null);

    const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    const allowedExtensions = [".txt", ".csv", ".json"];

    if (!allowedExtensions.includes(extension)) {
      setInputError("Only .txt, .csv, and .json files are supported.");
      return;
    }

    setSourceLoading(true);

    try {
      const parsed = await parseFile(file);

      if (!parsed.trim()) {
        throw new Error(
          "No recognised feedback records were found in the selected file.",
        );
      }

      onChange(parsed);
      setSourceName(file.name);
    } catch (error) {
      setInputError(
        error instanceof Error
          ? error.message
          : "Failed to parse the selected file.",
      );
    } finally {
      setSourceLoading(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function handleFileInputChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);

    event.target.value = "";
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 4 },
        borderRadius: 4,
        bgcolor: "#050816",
        color: "#e5e7eb",
        border: "1px solid rgba(34,211,238,0.25)",
        boxShadow: "0 0 40px rgba(34,211,238,0.08)",
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

      <Stack spacing={1.5} sx={{ mb: 3, position: "relative" }}>
        <Stack direction="row" spacing={1} sx={{alignItems:"center"}}>
          {["#ef4444", "#f59e0b", "#22c55e"].map((colour) => (
            <Box
              key={colour}
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: colour,
              }}
            />
          ))}

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
          &gt; load_feedback_records
          <span style={{ color: "#22d3ee" }}>()</span>
        </Typography>

        <Typography sx={{ color: "#94a3b8" }}>
          Load feedback using either a GET API URL or a supported file.
        </Typography>
      </Stack>

      <ToggleButtonGroup
        exclusive
        fullWidth
        value={inputMethod}
        onChange={(_, method: InputMethod | null) => {
          if (!method) return;

          setInputMethod(method);
          setInputError(null);
          setSourceName(null);
          onChange("");
        }}
        disabled={busy}
        sx={{
          mb: 2.5,
          position: "relative",
          "& .MuiToggleButton-root": {
            color: "#94a3b8",
            borderColor: "rgba(34,211,238,0.22)",
            fontFamily: "monospace",
            fontWeight: 800,
            textTransform: "none",
          },
          "& .Mui-selected": {
            color: "#020617 !important",
            bgcolor: "#22d3ee !important",
          },
        }}
      >
        <ToggleButton value="api">
          <Link size={17} style={{ marginRight: 8 }} />
          GET API URL
        </ToggleButton>

        <ToggleButton value="file">
          <Upload size={17} style={{ marginRight: 8 }} />
          File upload
        </ToggleButton>
      </ToggleButtonGroup>

      {inputMethod === "api" ? (
        <Box
          sx={{
            mb: 2.5,
            p: 2.5,
            borderRadius: 3,
            bgcolor: "rgba(15,23,42,0.75)",
            border: "1px solid rgba(34,211,238,0.22)",
            position: "relative",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{alignItems:"stretch"}}
          >
            <TextField
              fullWidth
              label="GET API URL"
              value={apiUrl}
              onChange={(event) => setApiUrl(event.target.value)}
              disabled={busy}
              placeholder="https://dummyjson.com/comments?limit=100"
              sx={{
                "& .MuiInputLabel-root": {
                  color: "#94a3b8",
                },
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#020617",
                  color: "#e2e8f0",
                  fontFamily: "monospace",
                  "& fieldset": {
                    borderColor: "rgba(34,211,238,0.25)",
                  },
                  "&:hover fieldset": {
                    borderColor: "#22d3ee",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#22d3ee",
                  },
                },
              }}
            />

            <Button
              variant="outlined"
              onClick={() => void handleApiImport()}
              disabled={busy || !apiUrl.trim()}
              startIcon={
                sourceLoading ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <CloudDownload size={17} />
                )
              }
              sx={{
                minWidth: { xs: "100%", md: 190 },
                px: 2.5,
                borderRadius: 2,
                color: "#67e8f9",
                borderColor: "rgba(34,211,238,0.45)",
                fontFamily: "monospace",
                fontWeight: 800,
                "&:hover": {
                  borderColor: "#22d3ee",
                  bgcolor: "rgba(34,211,238,0.08)",
                },
              }}
            >
              {sourceLoading ? "fetching..." : "GET feedback"}
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box
          onDragOver={(event) => {
            event.preventDefault();
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
            borderColor: dragging
              ? "#22d3ee"
              : "rgba(148,163,184,0.35)",
            bgcolor: dragging
              ? "rgba(34,211,238,0.08)"
              : "rgba(15,23,42,0.75)",
            cursor: busy ? "not-allowed" : "pointer",
            transition: "0.2s",
            position: "relative",
            pointerEvents: busy ? "none" : "auto",
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
            hidden
            onChange={handleFileInputChange}
          />

          <Stack direction="row" spacing={2} sx={{alignItems:"center"}}>
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
                boxShadow: dragging
                  ? "0 0 22px rgba(34,211,238,0.45)"
                  : "none",
              }}
            >
              {sourceLoading ? (
                <CircularProgress size={22} sx={{ color: "#22d3ee" }} />
              ) : (
                <Upload size={22} color="#22d3ee" />
              )}
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 800, color: "#f8fafc" }}>
                drag_file_here / browse_system
              </Typography>

              <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                accepts .txt · .csv · .json
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}

      <Collapse in={Boolean(inputError)}>
        <Alert
          severity="error"
          onClose={() => setInputError(null)}
          sx={{
            mb: 2,
            borderRadius: 2,
            bgcolor: "rgba(127,29,29,0.45)",
            color: "#fecaca",
            border: "1px solid rgba(248,113,113,0.35)",
          }}
        >
          {inputError}
        </Alert>
      </Collapse>

      {sourceName && (
        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 2,
            bgcolor: "rgba(2,6,23,0.8)",
            border: "1px solid rgba(34,211,238,0.2)",
            position: "relative",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{alignItems:"center"}}>
            <FileText size={17} color="#22d3ee" />

            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  color: "#e0f2fe",
                  fontWeight: 800,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {sourceName}
              </Typography>

              <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                {recordCount} feedback records loaded
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}

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
          sx={{ color: "#94a3b8", fontFamily: "monospace" }}
        >
          status:{" "}
          <span style={{ color: recordCount > 0 ? "#22c55e" : "#f59e0b" }}>
            {recordCount > 0 ? "READY" : "WAITING"}
          </span>{" "}
          · records: <span style={{ color: "#67e8f9" }}>{recordCount}</span>
        </Typography>

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            onClick={resetImportedData}
            disabled={busy}
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
            reset
          </Button>

          <Button
            variant="contained"
            onClick={onRun}
            disabled={busy || recordCount === 0}
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
