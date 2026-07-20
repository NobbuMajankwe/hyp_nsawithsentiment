// Core result type returned by the backend POST /api/nsa/analyse
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
export interface SentimentItem {
  id: number;
  originalText: string;
  label: SentimentLabel;
  confidence: number;     // 0–100 float
  model: string;
}

// Sentiment result returned by POST /api/sentiment/analyse
export type SentimentLabel = 'Positive' | 'Negative' | 'Neutral';


export interface SentimentResponse {
  totalRecords: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  results: SentimentItem[];
}
