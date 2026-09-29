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
import { useAuth } from "../context/AuthContext";
import {
  listDatasets,
  uploadDataset,
  uploadLabelledDataset,
  type Dataset,
} from "../services/api";

type UploadRole = "SELF_CORPUS" | "EVALUATION" | "ANALYSIS";
const LIMIT_BYTES = 100 * 1024 * 1024;
const roleHelp: Record<UploadRole, string> = {
  SELF_CORPUS:
    "Normal feedback used to define the self space and train detectors. CSV or JSON; no labels.",
  EVALUATION:
    "Held-out feedback with known SELF or NON_SELF labels. Upload a CSV with text and label columns.",
  ANALYSIS:
    "Unlabelled feedback for predictions. Evaluation metrics need labelled data.",
};

function validateFile(file: File | null, role: UploadRole): string | null {
  if (!file) return "Choose a file.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > LIMIT_BYTES) return "The maximum file size is 10 MB.";
  const extension = file.name.toLowerCase().split(".").pop();
  if (role === "EVALUATION" && extension !== "csv")
    return "Labelled evaluation uploads require a CSV file.";
  if (extension !== "csv" && extension !== "json")
    return "Upload a CSV or JSON file.";
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

  async function refresh(currentToken: string) {
    const response = await listDatasets(currentToken);
    setDatasets(response.datasets);
  }
  useEffect(() => {
    if (!token) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listDatasets(token)
      .then((response) => {
        if (active) setDatasets(response.datasets);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load datasets.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  function changeRole(next: UploadRole) {
    setRole(next);
    setFile(null);
    setError("");
    setSuccess("");
    if (fileInput.current) fileInput.current.value = "";
  }
  function changeFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] || null);
    setError("");
    setSuccess("");
  }
  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy) return;
    const problem = validateFile(file, role);
    if (problem) {
      setError(problem);
      return;
    }
    // The validation above ensures a file is present.
    const selectedFile = file as File;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result =
        role === "EVALUATION"
          ? await uploadLabelledDataset(
              token,
              selectedFile,
              name.trim() || undefined,
            )
          : await uploadDataset(
              token,
              selectedFile,
              role,
              name.trim() || undefined,
            );
      await refresh(token);
      setSuccess(`Dataset #${result.datasetId} uploaded successfully.`);
      setFile(null);
      setName("");
      if (fileInput.current) fileInput.current.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const selfCount = datasets.filter(
    (dataset) => dataset.researchRole === "SELF_CORPUS",
  ).length;
  const evaluationCount = datasets.filter(
    (dataset) => dataset.researchRole === "EVALUATION",
  ).length;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{fontWeight:700}}>
          Research datasets
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Upload normal feedback for training, then labelled feedback for
          evaluation or unlabelled feedback for analysis.
        </Typography>
      </Box>
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Card component="form" onSubmit={handleUpload}>
        <CardContent>
          <Stack spacing={2.5}>
            <Typography variant="h6">Upload a dataset</Typography>
            <TextField
              select
              label="Research role"
              value={role}
              onChange={(event) => changeRole(event.target.value as UploadRole)}
            >
              <MenuItem value="SELF_CORPUS">SELF corpus · training</MenuItem>
              <MenuItem value="EVALUATION">Evaluation · labelled</MenuItem>
              <MenuItem value="ANALYSIS">Analysis · unlabelled</MenuItem>
            </TextField>
            <Alert severity="info">{roleHelp[role]}</Alert>
            <TextField
              label="Dataset name (optional)"
              value={name}
              sx={{ maxLength: 255 }}
              onChange={(event) => setName(event.target.value)}
            />
            <Box>
              <Typography
                component="label"
                htmlFor="dataset-file"
                variant="body2"
              >
                Dataset file
              </Typography>
              <Box
                id="dataset-file"
                component="input"
                ref={fileInput}
                type="file"
                accept={
                  role === "EVALUATION"
                    ? ".csv,text/csv"
                    : ".csv,.json,text/csv,application/json"
                }
                onChange={changeFile}
                sx={{ display: "block", mt: 1 }}
              />
              {file && (
                <Typography variant="caption" color="text.secondary">
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </Typography>
              )}
            </Box>
            {role === "EVALUATION" && (
              <Typography variant="body2" color="text.secondary">
                Example CSV: <code>text,label</code> with each label set to{" "}
                <code>SELF</code> or <code>NON_SELF</code>.
              </Typography>
            )}
            <Button
              type="submit"
              variant="contained"
              disabled={!file || busy}
              sx={{ alignSelf: "flex-start" }}
            >
              {busy ? "Uploading…" : "Upload dataset"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Chip label={`${selfCount} SELF corpus datasets`} />
        <Chip label={`${evaluationCount} evaluation datasets`} />
        <Button
          component={Link}
          to="/nsa"
          variant="outlined"
          disabled={
            selfCount === 0 ||
            datasets.every(
              (dataset) =>
                dataset.researchRole !== "EVALUATION" &&
                dataset.researchRole !== "ANALYSIS",
            )
          }
        >
          Run an experiment
        </Button>
      </Stack>
      <Typography variant="h6">Uploaded datasets</Typography>
      {loading ? (
        <CircularProgress aria-label="Loading datasets" />
      ) : datasets.length === 0 ? (
        <Alert severity="info">
          No datasets uploaded yet. Start with a SELF corpus.
        </Alert>
      ) : (
        <TableContainer component={Card}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="right">Records</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Uploaded</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {datasets.map((dataset) => (
                <TableRow key={dataset.id}>
                  <TableCell>{dataset.name}</TableCell>
                  <TableCell>{dataset.researchRole}</TableCell>
                  <TableCell align="right">{dataset.totalRecords}</TableCell>
                  <TableCell>{dataset.status}</TableCell>
                  <TableCell>
                    {dataset.uploadedAt
                      ? new Date(dataset.uploadedAt).toLocaleString() 
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
