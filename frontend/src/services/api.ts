import axios from 'axios';
import type { AnalysisResult } from '../types';
import type { AuthUser } from '../types/auth';
//import type { AuthUser } from '../context/AuthContext';

const BASE_URL = ''; // Vite proxies /api/* -> localhost:8000

// ---------------------------------------------------------------------------
// Axios instance with a 401 interceptor
// ---------------------------------------------------------------------------

export const apiClient = axios.create({ baseURL: BASE_URL });

/**
 * Attach a 401 interceptor after the auth context is ready.
 * Called once from AuthProvider so we have access to `logout`.
 */
export function attachAuthInterceptor(logout: () => void) {
  apiClient.interceptors.response.use(
    (res) => res,
    (error) => {
      if (error?.response?.status === 401) {
        // Token is missing, expired, or the backend restarted with a new secret.
        // Clear the session so the user is sent back to the login page.
        logout();
      }
      return Promise.reject(error);
    },
  );
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function apiRegister(payload: {
  fullName: string;
  email: string;
  password: string;
  role: 'EVENT_ORGANISER' | 'SYSTEM_ADMIN';
}): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/api/auth/register', payload);
  return data;
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/api/auth/login', { email, password });
  return data;
}

export async function apiResetPassword(email: string, newPassword: string) {
  const response = await apiClient.post('/api/auth/reset-password', {
    email,
    newPassword,
  });

  return response.data;
}
// ---------------------------------------------------------------------------
// NSA — fetch latest valid records for sentiment page
// ---------------------------------------------------------------------------

export interface NsaLatestValidResponse {
  found: boolean;
  sessionInfo: {
    totalRecords: number;
    validRecords: number;
    suspiciousRecords: number;
    createdAt: string;
  } | null;
  records: { id: number; text: string }[];
}

export async function fetchLatestValidRecords(
  token: string,
): Promise<NsaLatestValidResponse> {
  const { data } = await apiClient.get<NsaLatestValidResponse>(
    '/api/nsa/latest-valid',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}

// ---------------------------------------------------------------------------
// NSA analysis (requires token)
// ---------------------------------------------------------------------------

export interface AnalyseResponse {
  totalRecords: number;
  validRecords: number;
  suspiciousRecords: number;
  results: AnalysisResult[];
  cached: boolean;
}

export async function runNsaAnalysis(
  feedback: string[],
  token: string,
): Promise<AnalyseResponse> {
  const { data } = await apiClient.post<AnalyseResponse>(
    '/api/nsa/analyse',
    { feedback },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Sentiment analysis (requires token)
// ---------------------------------------------------------------------------

import type { SentimentResponse } from '../types';

export async function runSentimentAnalysis(
  texts: string[],
  token: string,
): Promise<SentimentResponse> {
  const { data } = await apiClient.post<SentimentResponse>(
    '/api/sentiment/analyse',
    { texts },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Dashboard summary (requires token)
// ---------------------------------------------------------------------------

export interface DashboardActivity {
  eventType: 'nsa_scan' | 'dataset_loaded' | 'account_created';
  title: string;
  detail: string;
  createdAt: string | null;
}

export interface DashboardSummary {
  datasetCount: number;
  totalFeedback: number;
  nsaTotalRecords: number;
  nsaValidRecords: number;
  nsaSuspiciousRecords: number;
  nsaPassRate: number;
  nsaSessionCount: number;
  sentimentCount: number;
  donutData: { name: string; value: number }[];
  pipeline: {
    datasetLoaded: boolean;
    nsaRun: boolean;
    sentimentRun: boolean;
  };
  nsaRunAt: string | null;
  activity: DashboardActivity[];
}

export async function fetchDashboardSummary(token: string): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>('/api/dashboard/summary', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

// ---------------------------------------------------------------------------
// Integration Settings
// ---------------------------------------------------------------------------

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

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchSettings(token: string): Promise<IntegrationSettings> {
  const { data } = await apiClient.get<IntegrationSettings>('/api/settings', {
    headers: authHeader(token),
  });
  return data;
}

export async function saveSettings(
  token: string,
  payload: Partial<IntegrationSettings>,
): Promise<IntegrationSettings> {
  const { data } = await apiClient.put<IntegrationSettings>('/api/settings', payload, {
    headers: authHeader(token),
  });
  return data;
}

export async function generateApiKey(token: string): Promise<IntegrationSettings> {
  const { data } = await apiClient.post<IntegrationSettings>('/api/settings/apikey', null, {
    headers: authHeader(token),
  });
  return data;
}

export async function revokeApiKey(token: string): Promise<IntegrationSettings> {
  const { data } = await apiClient.delete<IntegrationSettings>('/api/settings/apikey', {
    headers: authHeader(token),
  });
  return data;
}

export async function testExternalConnection(
  token: string,
  payload: Partial<IntegrationSettings>,
): Promise<ConnectionTestResult> {
  const { data } = await apiClient.post<ConnectionTestResult>(
    '/api/settings/test-connection',
    payload,
    { headers: authHeader(token) },
  );
  return data;
}
