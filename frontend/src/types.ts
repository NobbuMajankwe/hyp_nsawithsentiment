// Re-export sentiment types from api.ts for backward compatibility.
// The canonical definitions live in services/api.ts.
export type { SentimentLabel, SentimentItem, SentimentAnalysisResponse as SentimentResponse } from './services/api';
