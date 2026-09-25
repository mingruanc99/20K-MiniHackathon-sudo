// src/services/llm/LLMRouter.ts
/**
 * LLM Router & Gateway for CLSG-IR
 * Automatically selects and routes tasks between Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, and MockLLMProvider.
 * Intercepts calls with the Hash-based LLMCache to minimize API costs and eliminate redundant requests.
 */
import {
  CanonicalDocumentTree,
  UserConfiguration,
  LessonModel,
  ContentPrioritization,
  TeachingUnit,
  CLSGScene,
  SemanticCritiqueReport
} from '../../types';
import { ILLMProvider, NarrationContext } from './LLMProvider';
import { GeminiProvider } from './GeminiProvider';
import { MockLLMProvider } from './MockLLMProvider';
import { llmCache } from './llmCache';

import { apiKeyService } from './apiKeyService';
import { usageMeter } from './usageMeter';

export class LLMRouter implements ILLMProvider {
  private primaryProvider: ILLMProvider;

  constructor() {
    // 100% Online LLM Mode: Always use GeminiProvider
    const gemini = new GeminiProvider();
    this.primaryProvider = gemini;

    // Reactively update when user saves a new API key or switches provider in the UI
    apiKeyService.subscribe((state) => {
      gemini.setApiKey(typeof state === 'string' ? state : state.apiKey);
    });
  }

  get providerId(): string {
    return this.primaryProvider.providerId;
  }

  get isDemo(): boolean {
    return false;
  }

  setProvider(provider: ILLMProvider) {
    this.primaryProvider = provider;
  }

  /** The online provider when one is active (null in mock/offline mode). */
  getOnlineProvider(): GeminiProvider | null {
    return this.primaryProvider instanceof GeminiProvider ? this.primaryProvider : null;
  }

  /** Cache hits cost 0 tokens but are still logged so benchmark runs show why no API call happened. */
  private recordCacheHit(feature: string) {
    const online = this.getOnlineProvider();
    usageMeter.record({
      provider: 'cache',
      model: online ? online.getActiveModel() : 'mock',
      feature,
      latencyMs: 0,
      status: 'cache_hit'
    });
  }

  async generateLessonUnderstanding(
    docTree: CanonicalDocumentTree,
    config: UserConfiguration
  ): Promise<LessonModel> {
    const cacheKey = llmCache.buildCacheKey(
      `lesson_model_${docTree.document_id}_${docTree.title}`,
      config,
      'v2_lesson_understanding'
    );
    const cached = llmCache.get<LessonModel>(cacheKey);
    if (cached) {
      this.recordCacheHit('Module 2: Whole-Lesson Model');
      return cached;
    }

    const result = await this.primaryProvider.generateLessonUnderstanding(docTree, config);
    llmCache.set(cacheKey, result);
    return result;
  }

  async generateContentPrioritization(
    docTree: CanonicalDocumentTree,
    lessonModel: LessonModel
  ): Promise<ContentPrioritization> {
    const cacheKey = llmCache.buildCacheKey(
      `prioritization_${docTree.document_id}`,
      { goal: lessonModel.lesson_goal },
      'v2_prioritization'
    );
    const cached = llmCache.get<ContentPrioritization>(cacheKey);
    if (cached) {
      this.recordCacheHit('Module 2: Content Prioritization');
      return cached;
    }

    const result = await this.primaryProvider.generateContentPrioritization(docTree, lessonModel);
    llmCache.set(cacheKey, result);
    return result;
  }

  async generateTeachingPlan(
    docTree: CanonicalDocumentTree,
    lessonModel: LessonModel,
    prioritization: ContentPrioritization,
    config: UserConfiguration
  ): Promise<TeachingUnit[]> {
    const cacheKey = llmCache.buildCacheKey(
      `teaching_plan_${docTree.document_id}_${config.targetDurationSeconds}`,
      { goal: lessonModel.lesson_goal, wpm: config.targetWpm },
      'v2_teaching_plan'
    );
    const cached = llmCache.get<TeachingUnit[]>(cacheKey);
    if (cached) {
      this.recordCacheHit('Module 2: Teaching Plan');
      return cached;
    }

    const result = await this.primaryProvider.generateTeachingPlan(
      docTree,
      lessonModel,
      prioritization,
      config
    );
    llmCache.set(cacheKey, result);
    return result;
  }

  async generateNarration(
    unit: TeachingUnit,
    lessonModel: LessonModel,
    context: NarrationContext,
    config: UserConfiguration
  ): Promise<string> {
    const cacheKey = llmCache.buildCacheKey(
      `narration_${unit.unit_id}_${unit.title}`,
      { lang: config.narration_language || config.language, focus: unit.narration_focus },
      'v2_narration'
    );
    const cached = llmCache.get<string>(cacheKey);
    if (cached) {
      this.recordCacheHit('Module 3A: Narration Generation');
      return cached;
    }

    const result = await this.primaryProvider.generateNarration(unit, lessonModel, context, config);
    llmCache.set(cacheKey, result);
    return result;
  }

  async semanticCritique(
    scenes: CLSGScene[],
    lessonModel: LessonModel,
    units: TeachingUnit[]
  ): Promise<SemanticCritiqueReport> {
    return await this.primaryProvider.semanticCritique(scenes, lessonModel, units);
  }
}

export const llmRouter = new LLMRouter();
