// src/services/llm/LLMProvider.ts
/**
 * LLM Provider Abstraction for CLSG-IR System
 * Ensures business modules do not depend directly on any specific AI SDK.
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

export interface NarrationContext {
  previousUnit?: TeachingUnit;
  nextUnit?: TeachingUnit;
  previousConceptName?: string;
  nextConceptName?: string;
  alreadyExplainedConcepts: string[];
}

export interface ILLMProvider {
  readonly providerId: string;
  readonly isDemo: boolean;

  /**
   * Generates whole-lesson comprehension: goal, problem, core concepts, relationships, learning needs
   */
  generateLessonUnderstanding(
    docTree: CanonicalDocumentTree,
    config: UserConfiguration
  ): Promise<LessonModel>;

  /**
   * Prioritizes all document content into Core, Supporting, Example, Context, and Noise
   */
  generateContentPrioritization(
    docTree: CanonicalDocumentTree,
    lessonModel: LessonModel
  ): Promise<ContentPrioritization>;

  /**
   * Groups slides into cohesive multi-slide Teaching Units along the pedagogical Teaching Arc
   */
  generateTeachingPlan(
    docTree: CanonicalDocumentTree,
    lessonModel: LessonModel,
    prioritization: ContentPrioritization,
    config: UserConfiguration
  ): Promise<TeachingUnit[]>;

  /**
   * Generates continuous, knowledge-driven narration for a teaching unit
   */
  generateNarration(
    unit: TeachingUnit,
    lessonModel: LessonModel,
    context: NarrationContext,
    config: UserConfiguration
  ): Promise<string>;

  /**
   * Validates instructional quality, concept resolution, and semantic coherence (Module 4 Critic)
   */
  semanticCritique(
    scenes: CLSGScene[],
    lessonModel: LessonModel,
    units: TeachingUnit[]
  ): Promise<SemanticCritiqueReport>;
}
