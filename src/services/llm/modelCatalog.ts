// src/services/llm/modelCatalog.ts
/**
 * Model pricing & practical capability catalog.
 *
 * Prices are USD per 1M tokens (list prices, standard tier, prompts <= 200k tokens).
 * Output price includes thinking tokens for Gemini 2.5 models.
 * Models not listed here (e.g. gemini-3.6-flash until its price is confirmed) get cost = null
 * (unknown) instead of a made-up number.
 */

export interface ModelPricing {
  inputPerM: number;
  outputPerM: number;
}

export interface ModelCapability {
  /** Max input context window (tokens). */
  contextTokens: number;
  /** Max output tokens per response. */
  maxOutputTokens: number;
  /** Requests per minute on the free tier (used to size parallel batches). */
  freeTierRpm: number;
  /** Observed practical output speed (tokens/sec) with thinking disabled. */
  outputTokensPerSec: number;
  /** Supports image input (vision OCR). */
  vision: boolean;
}

const PRICING: Record<string, ModelPricing> = {
  'gemini-2.5-flash': { inputPerM: 0.3, outputPerM: 2.5 },
  'gemini-2.5-flash-lite': { inputPerM: 0.1, outputPerM: 0.4 },
  'gemini-2.5-pro': { inputPerM: 1.25, outputPerM: 10 },
  'gemini-2.0-flash': { inputPerM: 0.1, outputPerM: 0.4 },
  'gemini-2.0-flash-lite': { inputPerM: 0.075, outputPerM: 0.3 },
  'gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.6 },
  'gpt-4o': { inputPerM: 2.5, outputPerM: 10 },
  'claude-3-5-sonnet-20241022': { inputPerM: 3, outputPerM: 15 },
  'claude-3-5-haiku-20241022': { inputPerM: 0.8, outputPerM: 4 }
};

const CAPABILITIES: Record<string, ModelCapability> = {
  // Limits not published to us yet: assume the 2.5 Flash envelope and the most conservative free-tier RPM.
  'gemini-3.6-flash': { contextTokens: 1_048_576, maxOutputTokens: 65_536, freeTierRpm: 10, outputTokensPerSec: 180, vision: true },
  'gemini-2.5-flash': { contextTokens: 1_048_576, maxOutputTokens: 65_536, freeTierRpm: 10, outputTokensPerSec: 180, vision: true },
  'gemini-2.5-flash-lite': { contextTokens: 1_048_576, maxOutputTokens: 65_536, freeTierRpm: 15, outputTokensPerSec: 300, vision: true },
  'gemini-2.5-pro': { contextTokens: 1_048_576, maxOutputTokens: 65_536, freeTierRpm: 5, outputTokensPerSec: 90, vision: true },
  'gemini-2.0-flash': { contextTokens: 1_048_576, maxOutputTokens: 8_192, freeTierRpm: 15, outputTokensPerSec: 200, vision: true },
  'gemini-2.0-flash-lite': { contextTokens: 1_048_576, maxOutputTokens: 8_192, freeTierRpm: 30, outputTokensPerSec: 250, vision: true }
};

export const DEFAULT_MODEL = 'gemini-3.6-flash';

/** Strip provider prefixes like "gemini:" or "google/" and version suffixes like "-001". */
export function normalizeModelId(model: string): string {
  return model
    .replace(/^[a-z]+:/i, '')
    .replace(/^(google|openai|anthropic)\//i, '')
    .replace(/-\d{3}$/, '')
    .trim();
}

export function getModelPricing(model: string): ModelPricing | null {
  return PRICING[normalizeModelId(model)] || null;
}

export function getModelCapability(model: string): ModelCapability {
  return CAPABILITIES[normalizeModelId(model)] || CAPABILITIES[DEFAULT_MODEL];
}

/** Returns cost in USD, or null when the model price is unknown. */
export function computeCostUsd(model: string, promptTokens: number, outputTokens: number): number | null {
  const p = getModelPricing(model);
  if (!p) return null;
  return (promptTokens * p.inputPerM + outputTokens * p.outputPerM) / 1_000_000;
}

export interface ScanLimits {
  /** Max pages/slides processed by the LLM keyword pass. */
  maxPages: number;
  /** Max keywords kept per page after weight filtering. */
  maxKeywordsPerPage: number;
  /** Pages sent in one LLM request. */
  pagesPerBatch: number;
  /** Parallel requests in flight. */
  concurrency: number;
  /** Max visual regions OCR'd per page. */
  maxRegionsPerPage: number;
  /** Max visual regions OCR'd in the whole document. */
  maxRegionsTotal: number;
  /** Wall-clock budget for the whole scan (ms). */
  budgetMs: number;
}

/**
 * Derives scan limits from what the model can realistically do inside the time budget.
 *
 * Each keyword batch costs roughly `pagesPerBatch * maxKeywordsPerPage * 18` output tokens.
 * The number of sequential "waves" we can afford is bounded by both latency and the free-tier RPM.
 */
export function deriveScanLimits(model: string = DEFAULT_MODEL, budgetMs = 55_000): ScanLimits {
  const cap = getModelCapability(model);
  const maxKeywordsPerPage = 8;
  const pagesPerBatch = 12;
  const concurrency = Math.max(2, Math.min(6, Math.floor(cap.freeTierRpm / 2)));

  const tokensPerBatch = pagesPerBatch * maxKeywordsPerPage * 18 + 200;
  const secPerBatch = 2.5 + tokensPerBatch / cap.outputTokensPerSec; // network + generation
  // Keep ~40% of the budget for OCR and tree building that run alongside.
  const keywordBudgetSec = (budgetMs / 1000) * 0.6;
  const waves = Math.max(1, Math.floor(keywordBudgetSec / secPerBatch));
  // Free tier caps total requests per minute across the whole scan (keyword + OCR share it).
  const requestsForKeywords = Math.max(1, Math.min(waves * concurrency, Math.floor(cap.freeTierRpm * 0.5)));
  const maxPages = Math.min(200, requestsForKeywords * pagesPerBatch);

  const requestsForOcr = Math.max(2, cap.freeTierRpm - requestsForKeywords);
  return {
    maxPages,
    maxKeywordsPerPage,
    pagesPerBatch,
    concurrency,
    maxRegionsPerPage: 3,
    maxRegionsTotal: cap.vision ? requestsForOcr * 2 : 0,
    budgetMs
  };
}
