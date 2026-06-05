// Pipeline step data and helpers — kept in a separate file so that
// PipelineTracker.tsx only exports a component (required for fast refresh).

export interface PipelineStep {
  step: string;
  label: string;
  desc: string;
  done?: boolean;
  active?: boolean;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { step: '01', label: 'Load Dataset',  desc: 'Raw feedback records ingested' },
  { step: '02', label: 'NSA Scan',      desc: 'Detect suspicious feedback' },
  { step: '03', label: 'Sentiment',     desc: 'DistilBERT classifies valid records' },
  { step: '04', label: 'Insight Story', desc: 'Narrative report generated' },
];

/**
 * Build a steps array with one step marked active.
 * Steps before `activeIndex` (0-based) are automatically marked done.
 */
export function buildSteps(
  activeIndex: number,
  overrides: Partial<PipelineStep>[] = [],
): PipelineStep[] {
  return PIPELINE_STEPS.map((s, i) => ({
    ...s,
    ...overrides[i],
    done: i < activeIndex,
    active: i === activeIndex,
  }));
}
