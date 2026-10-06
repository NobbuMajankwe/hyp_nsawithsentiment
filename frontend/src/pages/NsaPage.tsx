/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { FlaskConical, Settings2, Terminal } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PageHero } from "../components/PageHero";
import { buildSteps } from "../data/pipelineSteps";
import { PipelineTracker } from "../components/PipelineTracker";
import {
  listDatasets,
  runExperiment,
  type Dataset,
  type RunRequest,
} from "../services/api";

// ─── tokens ──────────────────────────────────────────────────────────────────
const BG    = "#050816";
const BG2   = "#020617";
const BORDER = "1px solid rgba(34,211,238,0.2)";
const MONO  = "monospace";
const FIELD_SX = {
  "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(34,211,238,0.25)" },
  "& .MuiSvgIcon-root": { color: "#22d3ee" },
  "& .MuiFormHelperText-root": { color: "#64748b" },
};

// ─── form defaults ────────────────────────────────────────────────────────────
const defaults: RunRequest = {
  datasetId: 0,
  experimentName: "",
  experimentDescription: "",
  detectorCount: 200,
  detectorRadius: 0.4,
  selfMatchThreshold: 0.75,
  maxAttempts: 10000,
  randomSeed: 42,
};
const parameters = [
  { key: "detectorCount",      label: "Detector count",       min: 1,     max: 5000,    step: 1     },
  { key: "detectorRadius",     label: "Detector radius",      min: 0.001, max: 2,       step: 0.001 },
  { key: "selfMatchThreshold", label: "Self match threshold", min: 0.001, max: 2,       step: 0.001 },
  { key: "maxAttempts",        label: "Maximum attempts",     min: 1,     max: 1000000, step: 1     },
] as const;
type NumericField = (typeof parameters)[number]["key"] | "datasetId" | "randomSeed";

function validate(form: RunRequest, candidates: Dataset[], hasSelf: boolean): string | null {
  if (!hasSelf) return "Upload a SELF_CORPUS dataset before running an experiment.";
  if (!candidates.some((d) => d.id === form.datasetId)) return "Choose an evaluation or analysis dataset.";
  if (!form.experimentName.trim()) return "Enter an experiment name.";
  for (const { key, label, min, max, step } of parameters) {
    const v = form[key];
    if (!Number.isFinite(v) || v < min || v > max || (step === 1 && !Number.isInteger(v)))
      return `${label} must be ${step === 1 ? "a whole number " : ""}between ${min} and ${max}.`;
  }
  if (!Number.isSafeInteger(form.randomSeed)) return "Random seed must be a whole number.";
  return null;
}

export function NsaPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [form, setForm] = useState<RunRequest>(defaults);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    listDatasets(token)
      .then((r: any) => { if (active) setDatasets(r.datasets); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Could not load datasets."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const candidates = useMemo(
    () => datasets.filter((d) => d.researchRole === "EVALUATION" || d.researchRole === "ANALYSIS"),
    [datasets],
  );
  const hasSelf = datasets.some((d) => d.researchRole === "SELF_CORPUS");
  const selected = candidates.find((d) => d.id === form.datasetId);
  const issue = validate(form, candidates, hasSelf);

  function setNumber(key: NumericField, raw: string) {
    setForm((p: any) => ({ ...p, [key]: raw === "" ? NaN : Number(raw) }));
  }

  async function handleRun(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || running) return;
    const problem = validate(form, candidates, hasSelf);
    if (problem) { setError(problem); return; }
    setRunning(true); setError("");
    try {
      const result = await runExperiment(token, {
        ...form,
        experimentName: form.experimentName.trim(),
        experimentDescription: form.experimentDescription?.trim(),
      });
      navigate(`/experiments/${result.experimentId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Experiment could not run.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Stack spacing={3}>
      <PageHero
        icon={<FlaskConical size={28} color="#22d3ee" />}
        iconColor="#22d3ee"
        badge="$ nsa_engine --configure"
        badgeIcon={<Settings2 size={11} />}
        title={<>&gt; Run_NSA_Experiment<span style={{ color: "#22d3ee" }}>.</span></>}
        description="Choose feedback, configure detector parameters, and save a reproducible NSA experiment run."
        chips={["select_dataset()", "configure_detectors()", "run_experiment()"]}
        statusLine={
          running
            ? "STATUS -> experiment running..."
            : loading
            ? "STATUS -> loading datasets..."
            : hasSelf
            ? `STATUS -> ${candidates.length} candidate dataset(s) available.`
            : "STATUS -> no SELF corpus found. upload one to continue."
        }
      />

      <PipelineTracker
        subtitle="Step 2 of 4 — NSA scan"
        steps={buildSteps(1)}
        activeColor="#22d3ee"
      />

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

      {loading ? (
        <CircularProgress aria-label="Loading datasets" sx={{ color: "#22d3ee" }} />
      ) : (
        <>
          {!hasSelf && (
            <Alert
              severity="warning"
              action={
                <Button component={Link} to="/datasets" color="inherit" sx={{ fontFamily: MONO }}>
                  Upload
                </Button>
              }
            >
              A SELF_CORPUS dataset is required for training.
            </Alert>
          )}
          {candidates.length === 0 && (
            <Alert
              severity="info"
              action={
                <Button component={Link} to="/datasets" color="inherit" sx={{ fontFamily: MONO }}>
                  Upload
                </Button>
              }
            >
              Upload a labelled EVALUATION dataset or an unlabelled ANALYSIS dataset.
            </Alert>
          )}

          <Card component="form" onSubmit={handleRun} sx={{ bgcolor: BG, border: BORDER }}>
            <CardContent>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                  <Terminal size={16} color="#22d3ee" />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#f8fafc" }}>
                    Experiment configuration
                  </Typography>
                </Stack>

                <TextField
                  select required fullWidth label="Dataset to classify"
                  value={form.datasetId || ""}
                  onChange={(e) => setNumber("datasetId", e.target.value)}
                  sx={FIELD_SX}
                >
                  {candidates.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name} · {d.researchRole} · {d.totalRecords} records
                    </MenuItem>
                  ))}
                </TextField>

                {selected?.researchRole === "ANALYSIS" && (
                  <Alert severity="info">
                    This dataset has no ground-truth labels. Precision, recall, and F1 will be unavailable.
                  </Alert>
                )}

                <TextField
                  required label="Experiment name" value={form.experimentName}
                  onChange={(e) => setForm((p: any) => ({ ...p, experimentName: e.target.value }))}
                  sx={FIELD_SX}
                />
                <TextField
                  label="Description (optional)" multiline minRows={2}
                  value={form.experimentDescription || ""}
                  onChange={(e) => setForm((p: any) => ({ ...p, experimentDescription: e.target.value }))}
                  sx={FIELD_SX}
                />

                {/* Parameter grid */}
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: "#94a3b8", fontFamily: MONO, mb: 1.5 }}
                  >
                    $ detector_parameters
                  </Typography>
                  <Box
                    sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}
                  >
                    {parameters.map(({ key, label, min, max, step }) => (
                      <TextField
                        key={key} label={label} type="number"
                        value={Number.isNaN(form[key]) ? "" : form[key]}
                        sx={{ ...FIELD_SX, input: { min, max, step } }}
                        onChange={(e) => setNumber(key, e.target.value)}
                      />
                    ))}
                    <TextField
                      label="Random seed" type="number"
                      value={Number.isNaN(form.randomSeed) ? "" : form.randomSeed}
                      sx={FIELD_SX}
                      onChange={(e) => setNumber("randomSeed", e.target.value)}
                      helperText="Use the same seed to reproduce detector generation."
                    />
                  </Box>
                </Box>

                <Box sx={{ p: 2, bgcolor: BG2, borderRadius: 2, border: "1px solid rgba(34,211,238,0.15)" }}>
                  <Typography variant="body2" sx={{ color: "#64748b", fontFamily: MONO }}>
                    $ detector_count={form.detectorCount}{"  "}
                    radius={form.detectorRadius}{"  "}
                    threshold={form.selfMatchThreshold}{"  "}
                    max_attempts={form.maxAttempts}{"  "}
                    seed={form.randomSeed}
                  </Typography>
                </Box>

                <Button
                  type="submit" variant="contained" size="large"
                  disabled={running || Boolean(issue)}
                  sx={{
                    fontFamily: MONO, fontWeight: 700,
                    bgcolor: "#0e7490", "&:hover": { bgcolor: "#0891b2" },
                    "&.Mui-disabled": { bgcolor: "rgba(14,116,144,0.3)", color: "#475569" },
                  }}
                >
                  {running ? "$ running experiment..." : "$ run_experiment()"}
                </Button>
                {issue && (
                  <Typography variant="body2" sx={{ color: "#f87171", fontFamily: MONO }}>
                    error: {issue}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  );
}
