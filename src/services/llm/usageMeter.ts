// src/services/llm/usageMeter.ts
/**
 * Per-run LLM usage meter.
 *
 * Every provider call (and every cache hit) is recorded here with the token counts
 * reported by the API response. When the API does not report usage, the record is
 * flagged `tokensEstimated: true` so benchmark logs never pass estimates off as real.
 */
import { computeCostUsd } from './modelCatalog';

export type LLMCallStatus = 'success' | 'error' | 'cache_hit';

export interface LLMCallRecord {
  callId: string;
  timestamp: string;
  provider: string;
  model: string;
  feature: string;
  promptTokens: number;
  completionTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  tokensEstimated: boolean;
  costUsd: number | null;
  latencyMs: number;
  status: LLMCallStatus;
  errorMessage?: string;
}

export interface UsageSummary {
  calls: number;
  successfulCalls: number;
  failedCalls: number;
  cacheHits: number;
  estimatedCalls: number;
  promptTokens: number;
  completionTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  /** Sum of known costs; `costComplete` is false if any call had an unknown price. */
  costUsd: number;
  costComplete: boolean;
  totalLatencyMs: number;
  byFeature: Record<string, { calls: number; totalTokens: number; costUsd: number }>;
  byModel: Record<string, { calls: number; totalTokens: number; costUsd: number }>;
}

export function summarizeCalls(calls: LLMCallRecord[]): UsageSummary {
  const summary: UsageSummary = {
    calls: calls.length,
    successfulCalls: 0,
    failedCalls: 0,
    cacheHits: 0,
    estimatedCalls: 0,
    promptTokens: 0,
    completionTokens: 0,
    thoughtsTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    costComplete: true,
    totalLatencyMs: 0,
    byFeature: {},
    byModel: {}
  };

  for (const c of calls) {
    if (c.status === 'success') summary.successfulCalls++;
    if (c.status === 'error') summary.failedCalls++;
    if (c.status === 'cache_hit') summary.cacheHits++;
    if (c.tokensEstimated && c.status !== 'cache_hit') summary.estimatedCalls++;
    summary.promptTokens += c.promptTokens;
    summary.completionTokens += c.completionTokens;
    summary.thoughtsTokens += c.thoughtsTokens;
    summary.totalTokens += c.totalTokens;
    summary.totalLatencyMs += c.latencyMs;
    if (c.costUsd === null) {
      if (c.totalTokens > 0) summary.costComplete = false;
    } else {
      summary.costUsd += c.costUsd;
    }

    const f = (summary.byFeature[c.feature] ||= { calls: 0, totalTokens: 0, costUsd: 0 });
    f.calls++;
    f.totalTokens += c.totalTokens;
    f.costUsd += c.costUsd || 0;

    const m = (summary.byModel[c.model] ||= { calls: 0, totalTokens: 0, costUsd: 0 });
    m.calls++;
    m.totalTokens += c.totalTokens;
    m.costUsd += c.costUsd || 0;
  }
  return summary;
}

export interface RecordCallInput {
  provider: string;
  model: string;
  feature: string;
  promptTokens?: number;
  completionTokens?: number;
  thoughtsTokens?: number;
  totalTokens?: number;
  tokensEstimated?: boolean;
  latencyMs: number;
  status: LLMCallStatus;
  errorMessage?: string;
}

class UsageMeter {
  private activeRuns = new Map<string, LLMCallRecord[]>();

  beginRun(runId: string): void {
    this.activeRuns.set(runId, []);
  }

  /** Stops collecting for a run and returns its call records. */
  endRun(runId: string): LLMCallRecord[] {
    const calls = this.activeRuns.get(runId) || [];
    this.activeRuns.delete(runId);
    return calls;
  }

  peek(runId: string): LLMCallRecord[] {
    return [...(this.activeRuns.get(runId) || [])];
  }

  record(input: RecordCallInput): LLMCallRecord {
    const promptTokens = input.promptTokens || 0;
    const completionTokens = input.completionTokens || 0;
    const thoughtsTokens = input.thoughtsTokens || 0;
    const totalTokens = input.totalTokens || promptTokens + completionTokens + thoughtsTokens;
    const rec: LLMCallRecord = {
      callId: `llm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      provider: input.provider,
      model: input.model,
      feature: input.feature,
      promptTokens,
      completionTokens,
      thoughtsTokens,
      totalTokens,
      tokensEstimated: Boolean(input.tokensEstimated),
      costUsd:
        input.status === 'cache_hit'
          ? 0
          : computeCostUsd(input.model, promptTokens, completionTokens + thoughtsTokens),
      latencyMs: input.latencyMs,
      status: input.status,
      errorMessage: input.errorMessage
    };
    this.activeRuns.forEach((list) => list.push(rec));
    return rec;
  }
}

export const usageMeter = new UsageMeter();

/** Rough token estimate (~4 chars/token) used only when an API omits usage data. */
export const estimateTokens = (text: string): number => Math.ceil((text || '').length / 4);
