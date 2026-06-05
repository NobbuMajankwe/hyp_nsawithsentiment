import axios from 'axios';
import type { AnalysisResult } from '../types';
import type { AuthUser } from '../context/AuthContext';

const BASE_URL = ''; // Vite proxies /api/* → localhost:8000

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
  role: 'event_organiser' | 'system_admin';
}): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${BASE_URL}/api/auth/register`, payload);
  return data;
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${BASE_URL}/api/auth/login`, { email, password });
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
}

export async function runNsaAnalysis(
  feedback: string[],
  token: string,
): Promise<AnalyseResponse> {
  const { data } = await axios.post<AnalyseResponse>(
    `${BASE_URL}/api/nsa/analyse`,
    { feedback },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}
