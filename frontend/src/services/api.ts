import axios, { AxiosHeaders } from "axios";
import type { AuthUser } from "../types/auth";

// VITE_API_URL is the backend origin (without /api). Empty uses the Vite proxy.
const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const apiClient = axios.create({ baseURL: BASE_URL, timeout: 30000 });

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// Preserve the Axios error/response for existing callers, while giving the new
// pages an actionable Error.message, including FastAPI validation errors.
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError<{ detail?: unknown }>(error)) {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") error.message = detail;
      else if (Array.isArray(detail)) {
        const messages = detail
          .map((item: unknown) => {
            if (!item || typeof item !== "object") return "";
            const record = item as { loc?: unknown; msg?: unknown };
            const field = Array.isArray(record.loc) ? record.loc.join(".") : "";
            return typeof record.msg === "string"
              ? `${field ? `${field}: ` : ""}${record.msg}`
              : "";
          })
          .filter(Boolean);
        if (messages.length) error.message = messages.join("; ");
      }
    }
    return Promise.reject(error);
  },
);

let authInterceptor: number | null = null;
export function attachAuthInterceptor(logout: () => void): () => void {
  if (authInterceptor !== null)
    apiClient.interceptors.response.eject(authInterceptor);
  const interceptor = apiClient.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      // A failed login must remain a login error; only authenticated requests
      // invalidate the current session.
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        AxiosHeaders.from(error.config?.headers).has("Authorization")
      )
        logout();
      return Promise.reject(error);
    },
  );
  authInterceptor = interceptor;
  return () => {
    apiClient.interceptors.response.eject(interceptor);
    if (authInterceptor === interceptor) authInterceptor = null;
  };
}

// Authentication
export type User = AuthUser;
export interface AuthResponse {
  token: string;
  user: AuthUser;
}
export async function apiRegister(payload: {
  fullName: string;
  email: string;
  password: string;
  role: "EVENT_ORGANISER" | "SYSTEM_ADMIN";
}): Promise<AuthResponse> {
  return (await apiClient.post<AuthResponse>("/api/auth/register", payload))
    .data;
}
export async function apiLogin(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return (
    await apiClient.post<AuthResponse>("/api/auth/login", { email, password })
  ).data;
}
export async function apiResetPassword(
  email: string,
  newPassword: string,
): Promise<{ message: string }> {
  return (
    await apiClient.post<{ message: string }>("/api/auth/reset-password", {
      email,
      newPassword,
    })
  ).data;
}
export async function apiMe(token: string): Promise<AuthUser> {
  return (
    await apiClient.get<AuthUser>("/api/auth/me", {
      headers: authHeader(token),
    })
  ).data;
}

// NSA configuration
export interface NsaConfig {
  detectorCount: number;
  detectorRadius: number;
  selfMatchThreshold: number;
  maxAttempts: number;
  randomSeed: number;
  apiUrl?: string | null;
}
export async function fetchNsaConfig(token: string): Promise<NsaConfig> {
  return (
    await apiClient.get<NsaConfig>("/api/nsa/config", {
      headers: authHeader(token),
    })
  ).data;
}
export async function saveNsaConfig(
  token: string,
  config: Partial<NsaConfig>,
): Promise<NsaConfig> {
  return (
    await apiClient.put<NsaConfig>("/api/nsa/config", config, {
      headers: authHeader(token),
    })
  ).data;
}

// Dataset metadata is camelCase, as returned by dataset_handler.py.
export type ResearchRole =
  | "SELF_CORPUS"
  | "EVALUATION"
  | "ANALYSIS"
  | "SUPPORT";
export type GroundTruthLabel = "SELF" | "NON_SELF";
export interface Dataset {
  id: number;
  name: string;
  type: string;
  description: string | null;
  researchRole: ResearchRole;
  totalRecords: number;
  status: string;
  uploadedAt: string | null;
  uploadedBy?: string | null;
}
export interface DatasetRecord {
  id: number;
  text: string;
  cleanedText: string | null;
  tokens: string[] | null;
  groundTruthLabel: GroundTruthLabel | null;
  preprocessingComplete: boolean;
  createdAt: string | null;
}
export interface UploadResponse {
  message: string;
  datasetId: number;
  name: string;
  researchRole: ResearchRole;
  totalRecords: number;
}
export interface PageOptions {
  limit?: number;
  offset?: number;
}
export async function listDatasets(
  token: string,
  params: PageOptions = {},
): Promise<{ total: number; datasets: Dataset[] }> {
  return (
    await apiClient.get<{ total: number; datasets: Dataset[] }>(
      "/api/datasets",
      { headers: authHeader(token), params },
    )
  ).data;
}
export async function getDataset(token: string, id: number): Promise<Dataset> {
  return (
    await apiClient.get<Dataset>(`/api/datasets/${id}`, {
      headers: authHeader(token),
    })
  ).data;
}
export async function getDatasetFeedback(
  token: string,
  id: number,
  params: PageOptions = {},
): Promise<{ datasetId: number; total: number; records: DatasetRecord[] }> {
  return (
    await apiClient.get<{
      datasetId: number;
      total: number;
      records: DatasetRecord[];
    }>(`/api/datasets/${id}/feedback`, { headers: authHeader(token), params })
  ).data;
}
function uploadForm(file: File, name?: string, description?: string): FormData {
  const form = new FormData();
  form.append("file", file);
  if (name?.trim()) form.append("name", name.trim());
  if (description?.trim()) form.append("description", description.trim());
  return form;
}
export async function uploadDataset(
  token: string,
  file: File,
  role: ResearchRole,
  name?: string,
  description?: string,
): Promise<UploadResponse> {
  if (role === "EVALUATION")
    return uploadLabelledDataset(token, file, name, description);
  const form = uploadForm(file, name, description);
  form.append("researchRole", role);
  // Let the browser supply the multipart boundary; do not set Content-Type.
  return (
    await apiClient.post<UploadResponse>("/api/datasets/upload", form, {
      headers: authHeader(token),
    })
  ).data;
}
export async function uploadLabelledDataset(
  token: string,
  file: File,
  name?: string,
  description?: string,
): Promise<UploadResponse> {
  return (
    await apiClient.post<UploadResponse>(
      "/api/datasets/upload-labelled",
      uploadForm(file, name, description),
      { headers: authHeader(token) },
    )
  ).data;
}
export async function deleteDataset(
  token: string,
  id: number,
): Promise<{ message: string; datasetId: number }> {
  return (
    await apiClient.delete<{ message: string; datasetId: number }>(
      `/api/datasets/${id}`,
      { headers: authHeader(token) },
    )
  ).data;
}

// Experiment run responses use camelCase. Stored history/results use the
// database field names; keep the two response shapes separate.
export type MetricValue = number | string | null;
export interface RunRequest {
  datasetId: number;
  experimentName: string;
  experimentDescription?: string;
  detectorCount: number;
  detectorRadius: number;
  selfMatchThreshold: number;
  maxAttempts: number;
  randomSeed: number;
}
export type RunExperimentRequest = RunRequest;
export interface EvaluationMetrics {
  accuracy: MetricValue;
  precision: MetricValue;
  recall: MetricValue;
  specificity: MetricValue;
  f1Score: MetricValue;
  detectionRate: MetricValue;
  falseAlarmRate: MetricValue;
  falseNegativeRate: MetricValue;
}
export interface RunSummary {
  experimentId: number;
  experimentName: string;
  totalRecords: number;
  selfCount: number;
  nonSelfCount: number;
  oovCount: number;
  requestedDetectorCount: number;
  generatedDetectorCount: number;
  detectorGenerationAttempts: number;
  detectorAcceptanceRate: MetricValue;
  trainingTimeMs: MetricValue;
  detectionTimeMs: MetricValue;
  totalExecutionTimeMs: MetricValue;
  confusionMatrix: {
    truePositive: number;
    trueNegative: number;
    falsePositive: number;
    falseNegative: number;
  } | null;
  metrics: EvaluationMetrics | null;
}
export interface Experiment extends Record<string, unknown> {
  experiment_id: number;
  experiment_name: string;
  status: string;
  created_at?: string | null;
  dataset_id?: number;
  training_dataset_id?: number | null;
  accuracy?: MetricValue;
  precision_score?: MetricValue;
  recall_score?: MetricValue;
  f1_score?: MetricValue;
}
export interface ResearchSummary extends Record<string, unknown> {
  experiment: { id: number; name: string; status: string };
  parameters: {
    detectorCount: number;
    generatedDetectors: number;
    detectorRadius: MetricValue;
    selfMatchThreshold: MetricValue;
    maxAttempts: number;
    randomSeed: number;
  };
  featureSpace: { vocabularySize: number; selfCorpusSize: number };
  detectorGeneration: { attempts: number; acceptanceRate: MetricValue };
  classification: { total: number; self: number; nonSelf: number; oov: number };
  confusionMatrix: {
    tp: number | null;
    tn: number | null;
    fp: number | null;
    fn: number | null;
  } | null;
  metrics: EvaluationMetrics | null;
  performance: {
    trainingTimeMs: MetricValue;
    detectionTimeMs: MetricValue;
    totalExecutionTimeMs: MetricValue;
  };
}
export interface ExperimentResult extends Record<string, unknown> {
  result_id: number;
  record_index: number;
  original_text: string;
  ground_truth_label: GroundTruthLabel | null;
  predicted_class: GroundTruthLabel | "OOV";
  nearest_self_distance: MetricValue;
  nearest_detector_distance: MetricValue;
  matched_detector_id: number | null;
  classification_reason: string | null;
}
export interface Detector extends Record<string, unknown> {
  detector_id: number;
  detector_index: number;
  radius: MetricValue;
  minimum_self_distance: MetricValue;
  created_at: string | null;
}
export async function listExperiments(
  token: string,
  params: PageOptions = {},
): Promise<{ total: number; experiments: Experiment[] }> {
  return (
    await apiClient.get<{ total: number; experiments: Experiment[] }>(
      "/api/experiments",
      { headers: authHeader(token), params },
    )
  ).data;
}
export async function runExperiment(
  token: string,
  body: RunRequest,
): Promise<RunSummary> {
  // The backend currently runs synchronously; avoid a short client timeout that
  // could encourage duplicate runs while the first experiment is still running.
  return (
    await apiClient.post<RunSummary>("/api/experiments/run", body, {
      headers: authHeader(token),
      timeout: 0,
    })
  ).data;
}
export async function getExperiment(
  token: string,
  id: number,
): Promise<Experiment> {
  return (
    await apiClient.get<Experiment>(`/api/experiments/${id}`, {
      headers: authHeader(token),
    })
  ).data;
}
export async function getSummary(
  token: string,
  id: number,
): Promise<ResearchSummary> {
  return (
    await apiClient.get<ResearchSummary>(`/api/experiments/${id}/summary`, {
      headers: authHeader(token),
    })
  ).data;
}
export async function getResults(
  token: string,
  id: number,
): Promise<{
  experimentId: number;
  total: number;
  results: ExperimentResult[];
}> {
  return (
    await apiClient.get<{
      experimentId: number;
      total: number;
      results: ExperimentResult[];
    }>(`/api/experiments/${id}/results`, { headers: authHeader(token) })
  ).data;
}
export async function getDetectors(
  token: string,
  id: number,
): Promise<{ experimentId: number; total: number; detectors: Detector[] }> {
  return (
    await apiClient.get<{
      experimentId: number;
      total: number;
      detectors: Detector[];
    }>(`/api/experiments/${id}/detectors`, { headers: authHeader(token) })
  ).data;
}

// Existing integration settings API, retained for callers in the user's app.
// These routes must remain registered by the backend if those screens are used.
export interface IntegrationSettings {
  extApiUrl: string | null;
  extApiToken: string | null;
  extDataPath: string | null;
  extTextField: string;
  extIdField: string;
  webhookUrl: string | null;
  webhookSecret: string | null;
  webhookEnabled: boolean;
  nsaThreshold: number | null;
  nsaDetectorCount: number | null;
  apiKey: string | null;
  apiKeyLabel: string | null;
  apiKeyCreatedAt: string | null;
  updatedAt: string | null;
}
export interface ConnectionTestResult {
  success: boolean;
  totalRecords: number;
  preview: { id: string | number | null; text: string }[];
}
export async function fetchSettings(
  token: string,
): Promise<IntegrationSettings> {
  return (
    await apiClient.get<IntegrationSettings>("/api/settings", {
      headers: authHeader(token),
    })
  ).data;
}
export async function saveSettings(
  token: string,
  payload: Partial<IntegrationSettings>,
): Promise<IntegrationSettings> {
  return (
    await apiClient.put<IntegrationSettings>("/api/settings", payload, {
      headers: authHeader(token),
    })
  ).data;
}
export async function generateApiKey(
  token: string,
): Promise<IntegrationSettings> {
  return (
    await apiClient.post<IntegrationSettings>("/api/settings/apikey", null, {
      headers: authHeader(token),
    })
  ).data;
}
export async function revokeApiKey(
  token: string,
): Promise<IntegrationSettings> {
  return (
    await apiClient.delete<IntegrationSettings>("/api/settings/apikey", {
      headers: authHeader(token),
    })
  ).data;
}
export async function testExternalConnection(
  token: string,
  payload: Partial<IntegrationSettings>,
): Promise<ConnectionTestResult> {
  return (
    await apiClient.post<ConnectionTestResult>(
      "/api/settings/test-connection",
      payload,
      { headers: authHeader(token) },
    )
  ).data;
}
