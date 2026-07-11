import axios from 'axios';
import type { AnalysisResult } from '../types';
import type { AuthUser } from '../types/auth';
//import type { AuthUser } from '../context/AuthContext';

const BASE_URL = ''; // Vite proxies /api/* → localhost:8000

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
