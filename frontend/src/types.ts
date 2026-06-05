// Core result type returned by the backend POST /api/nsa/analyse
// and also used by the local analysis engine fallback.

export type NsaStatus = 'Valid' | 'Suspicious';

export interface AnalysisResult {
  id: number;
  originalText: string;
  cleanedText: string;
  tokens: string[];
  nsaStatus: NsaStatus;
  anomalyScore: number;   // 0–100 integer
  anomalyReason: string;
}
