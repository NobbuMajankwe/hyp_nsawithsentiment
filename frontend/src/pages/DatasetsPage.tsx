import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { Database, FlaskConical, Terminal, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PageHero } from "../components/PageHero";
import {
  listDatasets,
  uploadDataset,
  uploadLabelledDataset,
  type Dataset,
} from "../services/api";

// ─── tokens ──────────────────────────────────────────────────────────────────
const BG   = "#050816";
const BG2  = "#020617";
const BORDER = "1px solid rgba(34,211,238,0.2)";
const MONO = "monospace";
const FIELD_SX = {
  "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(34,211,238,0.25)" },
  "& .MuiSvgIcon-root": { color: "#22d3ee" },
  "& .MuiFormHelperText-root": { color: "#64748b" },
};

type UploadRole = "SELF_CORPUS" | "EVALUATION" | "ANALYSIS";
const LIMIT_BYTES = 100 * 1024 * 1024;
const roleHelp: Record<UploadRole, string> = {
  SELF_CORPUS:  "Normal feedback used to define the self space and train detectors. CSV or JSON; no labels.",
  EVALUATION:   "Held-out feedback with known SELF or NON_SELF labels. Upload a CSV with text and label columns.",
  ANALYSIS:     "Unlabelled feedback for predictions. Evaluation metrics need labelled data.",
};
const roleChipColor: Record<UploadRole, string> = {
  SELF_CORPUS: "#22d3ee",
  EVALUATION:  "#a78bfa",
  ANALYSIS:    "#f59e0b",
};

function validateFile(file: File | null, role: UploadRole): string | null {
  if (!file) return "Choose a file.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > LIMIT_BYTES) return "The maximum file size is 100 MB.";
  const ext = file.name.toLowerCase().split(".").pop();
  if (role === "EVALUATION" && ext !== "csv")
    return "Labelled evaluation uploads require a CSV file.";
  if (ext !== "csv" && ext !== "json") return "Upload a CSV or JSON file.";
  return null;
}

export default function DatasetsPage() {
  const { token } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [role, setRole] = useState<UploadRole>("SELF_CORPUS");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh(t: string) {
    const r = await listDatasets(t);
    setDatasets(r.datasets);
  }
  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    listDatasets(token)
      .then((r) => { if (active) setDatasets(r.datasets); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Could not load datasets."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  function changeRole(next: UploadRole) {
    setRole(next); setFile(null); setError(""); setSuccess("");
    if (fileInput.current) fileInput.current.value = "";
  }
  function changeFile(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] || null); setError(""); setSuccess("");
  }
  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || busy) return;
    const problem = validateFile(file, role);
    if (problem) { setError(problem); return; }
    const f = file as File;
    setBusy(true); setError(""); setSuccess("");
    try {
      const result = role === "EVALUATION"
        ? await uploadLabelledDataset(token, f, name.trim() || undefined)
        : await uploadDataset(token, f, role, name.trim() || undefined);
      await refresh(token);
      setSuccess(`Dataset #${result.datasetId} uploaded successfully.`);
      setFile(null); setName("");
      if (fileInput.current) fileInput.current.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const selfCount = datasets.filter((d) => d.researchRole === "SELF_CORPUS").length;
  const evalCount = datasets.filter((d) => d.researchRole === "EVALUATION").length;

  return (
    <Stack spacing={3}>
      <PageHero
        icon={<Database size={28} color="#a78bfa" />}
        iconColor="#a78bfa"
        badge="$ datasets --manage"
        badgeIcon={<Upload size={11} />}
        title={<>&gt; Research_Datasets<span style={{ color: "#a78bfa" }}>.</span></>}
        description="Upload normal feedback for training, labelled feedback for evaluation, or unlabelled feedback for analysis."
        chips={["upload_self_corpus()", "upload_evaluation()", "upload_analysis()"]}
        statusLine={
          loading
            ? "STATUS -> loading datasets..."
            : `STATUS -> ${datasets.length} dataset(s) available.`
        }
      />

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}

      {/* Upload form */}
      <Card component="form" onSubmit={handleUpload} sx={{ bgcolor: BG, border: BORDER }}>
        <CardContent>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Terminal size={16} color="#a78bfa" />
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#f8fafc" }}>
                Upload a dataset
              </Typography>
            </Stack>

            <TextField
              select label="Research role" value={role}
              onChange={(e) => changeRole(e.target.value as UploadRole)}
              sx={FIELD_SX}
            >
              <MenuItem value="SELF_CORPUS">SELF corpus · training</MenuItem>
              <MenuItem value="EVALUATION">Evaluation · labelled</MenuItem>
              <MenuItem value="ANALYSIS">Analysis · unlabelled</MenuItem>
            </TextField>

            <Box
              sx={{
                p: 2, borderRadius: 2, bgcolor: BG2,
                border: `1px solid ${roleChipColor[role]}40`,
              }}
            >
              <Typography variant="body2" sx={{ color: "#94a3b8", fontFamily: MONO }}>
                {roleHelp[role]}
              </Typography>
            </Box>

            <TextField
              label="Dataset name (optional)" value={name}
              onChange={(e) => setName(e.target.value)}
              sx={FIELD_SX}
            />

            <Box>
              <Typography
                component="label" htmlFor="dataset-file"
                variant="body2" sx={{ color: "#94a3b8", fontFamily: MONO }}
              >
                Dataset file
              </Typography>
              <Box
                id="dataset-file" component="input" ref={fileInput}
                type="file"
                accept={role === "EVALUATION" ? ".csv,text/csv" : ".csv,.json,text/csv,application/json"}
                onChange={changeFile}
                sx={{
                  display: "block", mt: 1, color: "#e2e8f0",
                  "::file-selector-button": {
                    mr: 2, py: 1, px: 2, borderRadius: 1,
                    bgcolor: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.35)",
                    color: "#67e8f9", cursor: "pointer", fontFamily: MONO,
                  },
                }}
              />
              {file && (
                <Typography variant="caption" sx={{ color: "#64748b", fontFamily: MONO }}>
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </Typography>
              )}
            </Box>

            {role === "EVALUATION" && (
              <Typography variant="body2" sx={{ color: "#64748b", fontFamily: MONO }}>
                Example CSV: <code>text,label</code> with each label set to{" "}
                <code>SELF</code> or <code>NON_SELF</code>.
              </Typography>
            )}

            <Button
              type="submit" variant="contained" disabled={!file || busy}
              sx={{
                alignSelf: "flex-start", fontFamily: MONO, fontWeight: 700,
                bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" },
              }}
            >
              {busy ? "Uploading…" : "$ upload_dataset()"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Summary chips + CTA */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
        {[
          { label: `${selfCount} SELF corpus datasets`, color: "#22d3ee" },
          { label: `${evalCount} evaluation datasets`, color: "#a78bfa" },
        ].map(({ label, color }) => (
          <Chip
            key={label} label={label} size="small"
            sx={{ fontFamily: MONO, bgcolor: `${color}12`, color, border: `1px solid ${color}40` }}
          />
        ))}
        <Button
          component={Link} to="/nsa" variant="outlined"
          startIcon={<FlaskConical size={14} />}
          disabled={selfCount === 0 || datasets.every((d) => d.researchRole !== "EVALUATION" && d.researchRole !== "ANALYSIS")}
          sx={{ fontFamily: MONO, borderColor: "rgba(34,211,238,0.4)", color: "#22d3ee" }}
        >
          Run an experiment
        </Button>
      </Stack>

      {/* Dataset table */}
      <Typography variant="h6" sx={{ fontWeight: 700, color: "#f8fafc" }}>
        Uploaded datasets
      </Typography>

      {loading ? (
        <CircularProgress aria-label="Loading datasets" sx={{ color: "#22d3ee" }} />
      ) : datasets.length === 0 ? (
        <Alert severity="info">No datasets uploaded yet. Start with a SELF corpus.</Alert>
      ) : (
        <Card sx={{ bgcolor: BG, border: BORDER, overflow: "hidden" }}>
          <TableContainer>
            <Table size="small" sx={{ bgcolor: BG2 }}>
              <TableHead>
                <TableRow>
                  {["Name", "Role", "Records", "Status", "Uploaded"].map((h) => (
                    <TableCell
                      key={h}
                      sx={{ color: "#94a3b8", fontWeight: 700, fontFamily: MONO, borderBottom: "1px solid rgba(148,163,184,0.18)" }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {datasets.map((d) => (
                  <TableRow
                    key={d.id}
                    sx={{ "&:hover": { bgcolor: "rgba(34,211,238,0.04)" } }}
                  >
                    <TableCell sx={{ color: "#f8fafc", fontWeight: 600, borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                      {d.name}
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                      <Chip
                        size="small" label={d.researchRole}
                        sx={{
                          fontFamily: MONO, fontWeight: 700, fontSize: "0.72rem",
                          bgcolor: `${roleChipColor[d.researchRole as UploadRole] ?? "#94a3b8"}18`,
                          color: roleChipColor[d.researchRole as UploadRole] ?? "#94a3b8",
                          border: `1px solid ${roleChipColor[d.researchRole as UploadRole] ?? "#94a3b8"}40`,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: "#67e8f9", fontFamily: MONO, borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                      {d.totalRecords}
                    </TableCell>
                    <TableCell sx={{ color: "#94a3b8", fontFamily: MONO, fontSize: "0.8rem", borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                      {d.status}
                    </TableCell>
                    <TableCell sx={{ color: "#64748b", fontFamily: MONO, fontSize: "0.8rem", borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                      {d.uploadedAt ? new Date(d.uploadedAt).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Stack>
  );
}
