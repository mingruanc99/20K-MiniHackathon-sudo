// src/services/llm/GeminiProvider.ts
/**
 * Production Multi-Provider Online LLM Engine for CLSG-IR
 * Supports: Google Gemini, Anthropic Claude, OpenAI GPT, and OpenRouter.
 * Features:
 * - Real-time switching between providers and models without page refresh
 * - Elimination of invalid models (e.g. gemini-3.5 404 errors)
 * - Automatic failover for 503 (High Demand) and 429 (Rate Limits)
 * - Fallback to structured MockLLMProvider when all providers are unavailable
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
import { apiKeyService, LLMProviderType } from './apiKeyService';
import { MockLLMProvider } from './MockLLMProvider';
import { contentPurifierService } from '../../pipeline/services/contentPurifierService';
import { adminTelemetryService } from '../adminTelemetryService';

export class GeminiProvider implements ILLMProvider {
  readonly providerId = 'multi_provider_llm';
  readonly isDemo = false;

  private customApiKey?: string;
  private fallbackMock = new MockLLMProvider();

  constructor(apiKey?: string) {
    this.customApiKey = apiKey;
  }

  public getActiveApiKey(): string {
    return this.customApiKey || apiKeyService.getApiKey();
  }

  public setApiKey(key: string) {
    this.customApiKey = key;
  }

  /**
   * Universal JSON caller routing to Gemini, Claude, OpenAI, or OpenRouter
   */
  private async callLLMJson<T>(
    prompt: string,
    systemInstruction: string = '',
    featureName: string = 'AI Generation'
  ): Promise<T> {
    const activeProvider = apiKeyService.getActiveProvider();
    const activeModel = apiKeyService.getActiveModel(activeProvider);
    const key = this.customApiKey || apiKeyService.getApiKey(activeProvider);

    if (!key) {
      adminTelemetryService.recordError({
        type: 'LLM_ERROR',
        lessonId: 'llm_session',
        lessonTitle: 'Online LLM Service',
        sectionId: featureName,
        model: `${activeProvider}:${activeModel}`,
        severity: 'high',
        message: `Chưa cấu hình API Key cho ${activeProvider}`
      });
      throw new Error(
        `Chưa cấu hình API Key cho ${activeProvider.toUpperCase()}. Vui lòng nhấn vào nút [Đổi Key / AI] trên thanh công cụ để nhập mã khóa của bạn.`
      );
    }

    if (activeProvider === 'claude') {
      return this.callClaude<T>(key, activeModel, prompt, systemInstruction, featureName);
    }

    if (activeProvider === 'openai') {
      return this.callOpenAI<T>(key, activeModel, prompt, systemInstruction, featureName);
    }

    if (activeProvider === 'openrouter') {
      return this.callOpenRouter<T>(key, activeModel, prompt, systemInstruction, featureName);
    }

    // Default: Google Gemini
    return this.callGemini<T>(key, activeModel, prompt, systemInstruction, featureName);
  }

  /**
   * Google Gemini Caller with verified model pool (NO non-existent 3.5 models)
   */
  private async callGemini<T>(
    key: string,
    requestedModel: string,
    prompt: string,
    systemInstruction: string,
    featureName: string
  ): Promise<T> {
    // Only real, existing Google Generative Language models:
    const candidateModels = Array.from(
      new Set([
        requestedModel,
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
      ])
    );

    let lastError: any = null;

    for (const currentModel of candidateModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${key}`;
      const tStart = performance.now();

      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      };

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 75000);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': key
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          const latencyMs = Math.round(performance.now() - tStart);

          adminTelemetryService.recordAICall({
            model: `gemini:${currentModel}`,
            feature: featureName,
            promptTokens: Math.round((prompt.length + (systemInstruction?.length || 0)) / 4),
            completionTokens: 0,
            totalTokens: Math.round((prompt.length + (systemInstruction?.length || 0)) / 4),
            costUsd: 0,
            latencyMs,
            status: 'error',
            errorMessage: `${res.status}: ${errText.slice(0, 150)}`
          });

          // 503/500: Server overloaded -> retry next model
          if (res.status === 503 || res.status === 502 || res.status === 500) {
            console.warn(`Model ${currentModel} quá tải (503). Đang chuyển sang model tiếp theo...`);
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }

          // 429: Rate limit -> switch to next model
          if (res.status === 429) {
            console.warn(`Model ${currentModel} đạt giới hạn tốc độ (429). Đang chuyển sang model khác...`);
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }

          if (res.status === 404) {
            continue;
          }

          throw new Error(`Gemini API Error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const latencyMs = Math.round(performance.now() - tStart);
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
          throw new Error('Không nhận được nội dung phản hồi từ Gemini.');
        }

        const usage = data.usageMetadata || {};
        const promptTokens = usage.promptTokenCount || Math.round((prompt.length + (systemInstruction?.length || 0)) / 4);
        const completionTokens = usage.candidatesTokenCount || Math.round(candidateText.length / 4);

        adminTelemetryService.recordAICall({
          model: `gemini:${currentModel}`,
          feature: featureName,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          costUsd: promptTokens * 0.0000001 + completionTokens * 0.0000004,
          latencyMs,
          status: 'success'
        });

        const cleanedJson = candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
        return JSON.parse(cleanedJson) as T;
      } catch (err: any) {
        lastError = err;
        console.warn(`Thử nghiệm ${currentModel} thất bại: ${err.message}. Đang thử model kế tiếp...`);
        continue;
      }
    }

    throw lastError || new Error('Tất cả các model Gemini đều không khả dụng hoặc bị giới hạn tốc độ.');
  }

  /**
   * Anthropic Claude Caller (Direct browser calls allowed with dangerous header)
   */
  private async callClaude<T>(
    key: string,
    model: string,
    prompt: string,
    systemInstruction: string,
    featureName: string
  ): Promise<T> {
    const tStart = performance.now();
    const endpoint = 'https://api.anthropic.com/v1/messages';

    const fullSystem = `${systemInstruction || 'You are an expert AI instructional designer.'}\nIMPORTANT: You must output ONLY a valid JSON object matching the requested schema. Do not add markdown backticks, greetings, or conversational remarks.`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: fullSystem,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const latencyMs = Math.round(performance.now() - tStart);

    if (!res.ok) {
      const errText = await res.text();
      adminTelemetryService.recordAICall({
        model: `claude:${model}`,
        feature: featureName,
        promptTokens: Math.round(prompt.length / 4),
        completionTokens: 0,
        totalTokens: Math.round(prompt.length / 4),
        costUsd: 0,
        latencyMs,
        status: 'error',
        errorMessage: `${res.status}: ${errText.slice(0, 150)}`
      });
      throw new Error(`Anthropic Claude Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const cleanedJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

    adminTelemetryService.recordAICall({
      model: `claude:${model}`,
      feature: featureName,
      promptTokens: data.usage?.input_tokens || Math.round(prompt.length / 4),
      completionTokens: data.usage?.output_tokens || Math.round(text.length / 4),
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      costUsd: 0.003,
      latencyMs,
      status: 'success'
    });

    return JSON.parse(cleanedJson) as T;
  }

  /**
   * OpenAI GPT Caller
   */
  private async callOpenAI<T>(
    key: string,
    model: string,
    prompt: string,
    systemInstruction: string,
    featureName: string
  ): Promise<T> {
    const tStart = performance.now();
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction || 'You are an expert AI instructional designer. Return strictly valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });

    const latencyMs = Math.round(performance.now() - tStart);

    if (!res.ok) {
      const errText = await res.text();
      adminTelemetryService.recordAICall({
        model: `openai:${model}`,
        feature: featureName,
        promptTokens: Math.round(prompt.length / 4),
        completionTokens: 0,
        totalTokens: Math.round(prompt.length / 4),
        costUsd: 0,
        latencyMs,
        status: 'error',
        errorMessage: `${res.status}: ${errText.slice(0, 150)}`
      });
      throw new Error(`OpenAI Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    const cleanedJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

    adminTelemetryService.recordAICall({
      model: `openai:${model}`,
      feature: featureName,
      promptTokens: data.usage?.prompt_tokens || Math.round(prompt.length / 4),
      completionTokens: data.usage?.completion_tokens || Math.round(text.length / 4),
      totalTokens: data.usage?.total_tokens || 0,
      costUsd: 0.001,
      latencyMs,
      status: 'success'
    });

    return JSON.parse(cleanedJson) as T;
  }

  /**
   * OpenRouter Unified Caller (supports Claude, GPT, DeepSeek, etc. without CORS hurdles)
   */
  private async callOpenRouter<T>(
    key: string,
    model: string,
    prompt: string,
    systemInstruction: string,
    featureName: string
  ): Promise<T> {
    const tStart = performance.now();
    const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'https://clsg-ir-studio.vercel.app',
        'X-Title': 'CLSG-IR Studio'
      },
      body: JSON.stringify({
        model: model || 'anthropic/claude-3.5-sonnet',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `${systemInstruction || 'Instructional Designer'}\nYou must respond strictly with valid JSON only.` },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });

    const latencyMs = Math.round(performance.now() - tStart);

    if (!res.ok) {
      const errText = await res.text();
      adminTelemetryService.recordAICall({
        model: `openrouter:${model}`,
        feature: featureName,
        promptTokens: Math.round(prompt.length / 4),
        completionTokens: 0,
        totalTokens: Math.round(prompt.length / 4),
        costUsd: 0,
        latencyMs,
        status: 'error',
        errorMessage: `${res.status}: ${errText.slice(0, 150)}`
      });
      throw new Error(`OpenRouter Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    const cleanedJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

    adminTelemetryService.recordAICall({
      model: `openrouter:${model}`,
      feature: featureName,
      promptTokens: data.usage?.prompt_tokens || Math.round(prompt.length / 4),
      completionTokens: data.usage?.completion_tokens || Math.round(text.length / 4),
      totalTokens: data.usage?.total_tokens || 0,
      costUsd: 0.002,
      latencyMs,
      status: 'success'
    });

    return JSON.parse(cleanedJson) as T;
  }

  async generateLessonUnderstanding(
    docTree: CanonicalDocumentTree,
    config: UserConfiguration
  ): Promise<LessonModel> {
    const docOverview = docTree.sections
      .map((s) => `[Slide ${s.section_id}] ${s.title}\n${(s.raw_text || '').slice(0, 300)}`)
      .join('\n\n');

    const prompt = `You are a Senior Instructional Architect. Analyze the following entire presentation comprehensively.
Do not evaluate slide-by-slide independently; understand the entire lesson thesis, main problem, core concepts, supporting concepts, concept graph relationships, and learner dependencies.

Presentation: "${docTree.title}" (${docTree.total_sections} slides)
Audience Level: ${config.learnerLevel}
Language Policy: Vietnamese-first narration, preserve standard English technical terms (CNN, kernel, feature map, etc.).

Document Content:
${docOverview}

Return a valid JSON object strictly adhering to this schema:
{
  "lesson_goal": "One clear sentence defining the overarching lesson objective in Vietnamese",
  "main_problem": "The fundamental problem or question this lecture solves",
  "target_audience": "${config.learnerLevel}",
  "core_concepts": [
    {
      "concept_id": "C01",
      "name": "Concept name",
      "definition": "Clear concise definition in Vietnamese",
      "importance": "core",
      "prerequisites": [],
      "related_concepts": []
    }
  ],
  "supporting_concepts": [
    {
      "concept_id": "C02",
      "name": "Supporting concept name",
      "definition": "Explanation in Vietnamese",
      "importance": "supporting",
      "prerequisites": ["C01"],
      "related_concepts": ["C01"]
    }
  ],
  "examples": ["Specific example 1", "Specific example 2"],
  "applications": ["Real-world application 1"],
  "evidence": ["Evaluation benchmark or empirical evidence"],
  "concept_relationships": [
    {
      "source_concept_id": "C01",
      "target_concept_id": "C02",
      "relationship_type": "enables | deepens | illustrates | contrasts | applies",
      "explanation": "Why C01 connects to C02"
    }
  ],
  "learning_dependencies": ["Prerequisite dependency statement"],
  "learning_needs": [
    {
      "after_concept_id": "C01",
      "natural_question": "What question naturally arises in the learner's mind after understanding C01?",
      "resolved_by_concept_id": "C02",
      "pedagogical_hook": "Hook label"
    }
  ],
  "teaching_arc": ["ENTRY", "HOOK", "CONCEPT", "MECHANISM", "EXAMPLE", "SUMMARY"],
  "teaching_units": [],
  "slide_mapping": []
}`;

    try {
      return await this.callLLMJson<LessonModel>(
        prompt,
        'You are an expert AI EdTech instructional designer.',
        'Module 2: Whole-Lesson Model'
      );
    } catch (err) {
      console.warn('Online LLM calls failed, using resilient fallback:', err);
      return this.fallbackMock.generateLessonUnderstanding(docTree, config);
    }
  }

  async generateContentPrioritization(
    docTree: CanonicalDocumentTree,
    lessonModel: LessonModel
  ): Promise<ContentPrioritization> {
    const docOverview = docTree.sections
      .map((s) => `[Slide ${s.section_id}] ${s.title}\n${(s.raw_text || '').slice(0, 300)}`)
      .join('\n\n');

    const prompt = `Analyze each piece of content in this lecture and prioritize it strictly into:
- core (Must teach, essential)
- supporting (Explain briefly)
- example (Concrete case)
- context (Background/Intro)
- noise (Administrative metadata like course codes "aicb-p2t4", dates "ngày 04", footers, copyrights)

Lecture: "${docTree.title}"
Lesson Goal: "${lessonModel.lesson_goal}"

Content:
${docOverview}

Return a valid JSON object matching:
{
  "total_items": number,
  "core_items": [{ "content_id": "string", "source_slide_id": "string", "text": "string", "category": "core", "importance_reason": "string", "required_for_understanding": true, "can_be_omitted": false, "narration_priority": "high" }],
  "supporting_items": [{ "content_id": "string", "source_slide_id": "string", "text": "string", "category": "supporting", "importance_reason": "string", "required_for_understanding": false, "can_be_omitted": true, "narration_priority": "medium" }],
  "example_items": [{ "content_id": "string", "source_slide_id": "string", "text": "string", "category": "example", "importance_reason": "string", "required_for_understanding": true, "can_be_omitted": false, "narration_priority": "high" }],
  "context_items": [{ "content_id": "string", "source_slide_id": "string", "text": "string", "category": "context", "importance_reason": "string", "required_for_understanding": false, "can_be_omitted": false, "narration_priority": "medium" }],
  "noise_items": [{ "content_id": "string", "source_slide_id": "string", "text": "string", "category": "noise", "importance_reason": "string", "required_for_understanding": false, "can_be_omitted": true, "narration_priority": "low" }],
  "omitted_content_count": number
}`;

    try {
      return await this.callLLMJson<ContentPrioritization>(
        prompt,
        'You are an instructional content filtering system.',
        'Module 2: Content Prioritization'
      );
    } catch (err) {
      console.warn('Prioritization failed, using resilient fallback:', err);
      return this.fallbackMock.generateContentPrioritization(docTree, lessonModel);
    }
  }

  async generateTeachingPlan(
    docTree: CanonicalDocumentTree,
    lessonModel: LessonModel,
    prioritization: ContentPrioritization,
    config: UserConfiguration
  ): Promise<TeachingUnit[]> {
    const totalSec = Math.max(60, config.targetDurationSeconds || 180);
    const wpm = config.targetWpm || 140;

    const prompt = `Group the following slides into cohesive Teaching Units along the lesson's Teaching Arc.
Do not force 1 slide = 1 unit; multiple related slides (e.g. concept + example, or title + motivation hook) should be combined into single units.

Lecture: "${docTree.title}"
Total Target Duration: ${totalSec} seconds
Target WPM: ${wpm}
Slides: ${JSON.stringify(docTree.sections.map((s) => ({ id: s.section_id, title: s.title })))}
Core Concepts: ${JSON.stringify(lessonModel.core_concepts.map((c) => ({ id: c.concept_id, name: c.name })))}
Learning Needs: ${JSON.stringify(lessonModel.learning_needs)}

Return a JSON array of Teaching Units:
[
  {
    "unit_id": "TU01",
    "title": "Unit Title in Vietnamese",
    "stage": "HOOK",
    "slide_ids": ["S1", "S2"],
    "primary_concept_id": "C01",
    "supporting_concept_ids": [],
    "target_duration_sec": 45,
    "target_word_budget": 50,
    "narration_focus": "Focus description in Vietnamese",
    "key_talking_points": ["Point 1", "Point 2"],
    "omitted_details": ["Detail to omit"]
  }
]`;

    try {
      return await this.callLLMJson<TeachingUnit[]>(
        prompt,
        'You are a master curriculum and instructional designer.',
        'Module 2: Teaching Plan'
      );
    } catch (err) {
      console.warn('Teaching plan failed, using resilient fallback:', err);
      return this.fallbackMock.generateTeachingPlan(docTree, lessonModel, prioritization, config);
    }
  }

  async generateNarration(
    unit: TeachingUnit,
    lessonModel: LessonModel,
    context: NarrationContext,
    config: UserConfiguration
  ): Promise<string> {
    const prompt = `Generate natural, concise, knowledge-driven Vietnamese lecture narration for this Teaching Unit.
CRITICAL RULES FOR SPOKEN CONTENT:
- Return ONLY "WHAT THE TEACHER WOULD ACTUALLY SAY" to students.
- Absolutely NO section badges or internal labels (HOOK, THINK, MECHANISM, EXAMPLE, TECHNICAL, S1, S2, HÃY SUY NGHĨ).
- Absolutely NO administrative metadata, course codes, footers, pagination (aicb, 1/52, ngày 04).
- Absolutely NO instructor notes, speaker directions, or parenthetical annotations.
- Absolutely NO agenda headers ("Nội dung bài học", "Mục lục").
- Absolutely NO low-density boilerplate fillers ("chúng ta sẽ tiếp tục khám phá các bước tiếp theo...").
- Do NOT read bullet points mechanically.
- Do NOT mention slide numbers ("Ở slide này", "Slide tiếp theo").
- Preserve English technical terms (CNN, kernel, feature map, bounding box, etc.).
- Omit noise items: ${unit.omitted_details.join(', ')}.

Unit Title: "${unit.title}" (${unit.stage})
Slides in Unit: ${unit.slide_ids.join(', ')}
Narration Focus: "${unit.narration_focus}"
Learning Need being satisfied: "${unit.learning_need?.natural_question || 'None'}"
Target Word Count: ${unit.target_word_budget} words (~${unit.target_duration_sec}s)
Previous Concept: "${context.previousConceptName || 'None'}"
Key Points: ${unit.key_talking_points.join('; ')}

Return JSON: { "narration": "Natural Vietnamese spoken lecture text" }`;

    try {
      const res = await this.callLLMJson<{ narration: string }>(
        prompt,
        'You are an inspiring university AI lecturer speaking fluent, natural Vietnamese.',
        'Module 3A: Narration Generation'
      );
      const purification = contentPurifierService.purifyNarration(res.narration);
      return purification.cleanedText;
    } catch (err) {
      console.warn('Narration generation failed, using resilient fallback:', err);
      return this.fallbackMock.generateNarration(unit, lessonModel, context, config);
    }
  }

  async semanticCritique(
    scenes: CLSGScene[],
    lessonModel: LessonModel,
    units: TeachingUnit[]
  ): Promise<SemanticCritiqueReport> {
    const sampleText = scenes.map((s) => `[${s.section_id}] ${s.narration.text}`).join('\n\n');
    const prompt = `Critique the generated lecture narration against semantic and instructional quality standards:
1. Concept satisfaction: Does it clearly convey the lesson goal?
2. Learning need closure: Does it answer the natural questions?
3. Slide reading & metadata leak: Does it speak administrative metadata or read slides passively?
4. Repetition: Does it repeat prior sentences?

Lesson Goal: "${lessonModel.lesson_goal}"
Generated Narration:
${sampleText}

Return JSON:
{
  "semantic_coherence_score": 0.95,
  "learning_need_satisfaction_score": 0.95,
  "premature_disclosure_score": 1.0,
  "slide_reading_score": 0.95,
  "metadata_leak_score": 1.0,
  "overall_semantic_status": "PASSED",
  "issues": [],
  "auto_repairs": [],
  "needs_regeneration": false
}`;

    try {
      return await this.callLLMJson<SemanticCritiqueReport>(
        prompt,
        'You are an instructional quality guard critic.',
        'Module 4: Quality Guard Critique'
      );
    } catch (err) {
      return this.fallbackMock.semanticCritique(scenes, lessonModel, units);
    }
  }
}
