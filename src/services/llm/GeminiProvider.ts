// src/services/llm/GeminiProvider.ts
/**
 * Production Multi-Provider Online LLM Engine for CLSG-IR
 * Supports: Google Gemini, Anthropic Claude, OpenAI GPT, and OpenRouter.
 * Features:
 * - Real-time switching between providers and models without page refresh
 * - Automatic failover for 503 (High Demand) and 429 (Rate Limits)
 * - Real token accounting from API usage payloads (incl. Gemini thinking tokens)
 * - Image input (vision) for region OCR
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
import { apiKeyService, GEMINI_PROXY_ENDPOINT, isGeminiProxyConfigured, probeGeminiProxy } from './apiKeyService';
import { MockLLMProvider } from './MockLLMProvider';
import { contentPurifierService } from '../../pipeline/services/contentPurifierService';
import { adminTelemetryService } from '../adminTelemetryService';
import { usageMeter, estimateTokens, RecordCallInput } from './usageMeter';
import { DEFAULT_MODEL } from './modelCatalog';

export interface LLMImageInput {
  mimeType: string;
  /** Base64 payload without the data: prefix. */
  data: string;
}

export interface LLMRequestOptions {
  images?: LLMImageInput[];
  maxOutputTokens?: number;
  temperature?: number;
  /** Allow Gemini 2.5 thinking. Off by default: our structured tasks don't need it and it is slow. */
  thinking?: boolean;
  timeoutMs?: number;
}

interface LLMRequest extends LLMRequestOptions {
  prompt: string;
  systemInstruction: string;
  featureName: string;
}

const stripJsonFences = (text: string): string =>
  text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

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

  /** True when a personal key is set, or (for Gemini) the server-side shared key is available. */
  public hasApiKey(): boolean {
    const provider = apiKeyService.getActiveProvider();
    if (this.customApiKey || apiKeyService.getApiKey(provider)) return true;
    return provider === 'gemini' && isGeminiProxyConfigured();
  }

  public getActiveModel(): string {
    const provider = apiKeyService.getActiveProvider();
    return `${provider}:${apiKeyService.getActiveModel(provider)}`;
  }

  /** Records a call in the per-run usage meter and in admin telemetry. */
  private track(input: RecordCallInput) {
    const rec = usageMeter.record(input);
    if (input.status === 'cache_hit') return;
    adminTelemetryService.recordAICall({
      model: `${input.provider}:${input.model}`,
      feature: input.feature,
      promptTokens: rec.promptTokens,
      completionTokens: rec.completionTokens + rec.thoughtsTokens,
      totalTokens: rec.totalTokens,
      costUsd: rec.costUsd ?? 0,
      latencyMs: input.latencyMs,
      status: input.status === 'error' ? 'error' : 'success',
      errorMessage: input.errorMessage
    });
  }

  /**
   * Public structured-JSON entry point used by the scanner, OCR and LLM narration.
   * Throws when no key is configured or every model fails.
   */
  public async generateJson<T>(
    prompt: string,
    systemInstruction: string,
    featureName: string,
    options: LLMRequestOptions = {}
  ): Promise<T> {
    return this.callLLMJson<T>({ prompt, systemInstruction, featureName, ...options });
  }

  /**
   * Universal JSON caller routing to Gemini, Claude, OpenAI, or OpenRouter
   */
  private async callLLMJson<T>(req: LLMRequest | string, systemInstruction = '', featureName = 'AI Generation'): Promise<T> {
    const request: LLMRequest =
      typeof req === 'string' ? { prompt: req, systemInstruction, featureName } : req;
    const activeProvider = apiKeyService.getActiveProvider();
    const activeModel = apiKeyService.getActiveModel(activeProvider);
    const key = this.customApiKey || apiKeyService.getApiKey(activeProvider);
    if (!key && activeProvider === 'gemini') await probeGeminiProxy();
    const useProxy = !key && activeProvider === 'gemini' && isGeminiProxyConfigured();

    if (!key && !useProxy) {
      adminTelemetryService.recordError({
        type: 'LLM_ERROR',
        lessonId: 'llm_session',
        lessonTitle: 'Online LLM Service',
        sectionId: request.featureName,
        model: `${activeProvider}:${activeModel}`,
        severity: 'high',
        message: `Chưa cấu hình API Key cho ${activeProvider}`
      });
      throw new Error(
        `Chưa cấu hình API Key cho ${activeProvider.toUpperCase()}. Vui lòng nhấn vào nút [Đổi Key / AI] trên thanh công cụ để nhập mã khóa của bạn.`
      );
    }

    if (activeProvider === 'claude') return this.callClaude<T>(key, activeModel, request);
    if (activeProvider === 'openai') return this.callOpenAICompatible<T>('openai', key, activeModel, request);
    if (activeProvider === 'openrouter') return this.callOpenAICompatible<T>('openrouter', key, activeModel, request);
    return this.callGemini<T>(key, activeModel, request);
  }

  /**
   * Google Gemini caller with a verified model pool.
   */
  private async callGemini<T>(key: string, requestedModel: string, req: LLMRequest): Promise<T> {
    // 2.5 models are closed to new Google accounts; 3.6 Flash is the current default.
    const candidateModels = Array.from(new Set([requestedModel || DEFAULT_MODEL, 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']));
    const promptEstimate = estimateTokens(req.prompt + req.systemInstruction) + (req.images?.length || 0) * 258;

    let lastError: any = null;

    for (const currentModel of candidateModels) {
      const tStart = performance.now();

      const parts: any[] = [{ text: req.prompt }];
      (req.images || []).forEach((img) => parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } }));

      const generationConfig: Record<string, any> = {
        responseMimeType: 'application/json',
        temperature: req.temperature ?? 0.2
      };
      if (req.maxOutputTokens) generationConfig.maxOutputTokens = req.maxOutputTokens;
      // Only Gemini 2.5 Flash / Flash-Lite are known to accept thinkingBudget 0; newer models use their defaults.
      if (!req.thinking && /^gemini-2\.5-flash/.test(currentModel)) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const body = {
        contents: [{ role: 'user', parts }],
        systemInstruction: req.systemInstruction ? { parts: [{ text: req.systemInstruction }] } : undefined,
        generationConfig
      };

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), req.timeoutMs || 75000);

        // Personal key: call Google directly. No personal key: the server proxy adds the shared key.
        const res = key
          ? await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
              body: JSON.stringify(body),
              signal: controller.signal
            })
          : await fetch(GEMINI_PROXY_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: currentModel, request: body }),
              signal: controller.signal
            });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          this.track({
            provider: 'gemini',
            model: currentModel,
            feature: req.featureName,
            promptTokens: 0,
            latencyMs: Math.round(performance.now() - tStart),
            status: 'error',
            errorMessage: `${res.status}: ${errText.slice(0, 150)}`
          });

          if (res.status === 503 || res.status === 502 || res.status === 500) {
            console.warn(`Model ${currentModel} quá tải (${res.status}). Đang chuyển sang model tiếp theo...`);
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
          if (res.status === 429) {
            console.warn(`Model ${currentModel} đạt giới hạn tốc độ (429). Đang chuyển sang model khác...`);
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          if (res.status === 404) continue;
          throw new Error(`Gemini API Error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const latencyMs = Math.round(performance.now() - tStart);
        const candidateText = (data.candidates?.[0]?.content?.parts || [])
          .map((p: any) => p.text || '')
          .join('');
        if (!candidateText) {
          throw new Error(`Không nhận được nội dung phản hồi từ Gemini (finishReason: ${data.candidates?.[0]?.finishReason || 'unknown'}).`);
        }

        const usage = data.usageMetadata;
        this.track({
          provider: 'gemini',
          model: currentModel,
          feature: req.featureName,
          promptTokens: usage?.promptTokenCount ?? promptEstimate,
          completionTokens: usage?.candidatesTokenCount ?? estimateTokens(candidateText),
          thoughtsTokens: usage?.thoughtsTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount,
          tokensEstimated: !usage,
          latencyMs,
          status: 'success'
        });

        return JSON.parse(stripJsonFences(candidateText)) as T;
      } catch (err: any) {
        lastError = err;
        console.warn(`Thử nghiệm ${currentModel} thất bại: ${err.message}. Đang thử model kế tiếp...`);
        continue;
      }
    }

    throw lastError || new Error('Tất cả các model Gemini đều không khả dụng hoặc bị giới hạn tốc độ.');
  }

  /**
   * Anthropic Claude caller (direct browser calls allowed with dangerous header)
   */
  private async callClaude<T>(key: string, model: string, req: LLMRequest): Promise<T> {
    const tStart = performance.now();
    const resolvedModel = model || 'claude-3-5-sonnet-20241022';
    const fullSystem = `${req.systemInstruction || 'You are an expert AI instructional designer.'}\nIMPORTANT: You must output ONLY a valid JSON object matching the requested schema. Do not add markdown backticks, greetings, or conversational remarks.`;

    const content: any[] = (req.images || []).map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: img.data }
    }));
    content.push({ type: 'text', text: req.prompt });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: req.maxOutputTokens || 4096,
        system: fullSystem,
        messages: [{ role: 'user', content }]
      })
    });

    const latencyMs = Math.round(performance.now() - tStart);

    if (!res.ok) {
      const errText = await res.text();
      this.track({
        provider: 'claude',
        model: resolvedModel,
        feature: req.featureName,
        latencyMs,
        status: 'error',
        errorMessage: `${res.status}: ${errText.slice(0, 150)}`
      });
      throw new Error(`Anthropic Claude Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    this.track({
      provider: 'claude',
      model: resolvedModel,
      feature: req.featureName,
      promptTokens: data.usage?.input_tokens ?? estimateTokens(req.prompt + fullSystem),
      completionTokens: data.usage?.output_tokens ?? estimateTokens(text),
      tokensEstimated: !data.usage,
      latencyMs,
      status: 'success'
    });

    return JSON.parse(stripJsonFences(text)) as T;
  }

  /**
   * OpenAI & OpenRouter (same chat-completions wire format)
   */
  private async callOpenAICompatible<T>(
    provider: 'openai' | 'openrouter',
    key: string,
    model: string,
    req: LLMRequest
  ): Promise<T> {
    const tStart = performance.now();
    const isRouter = provider === 'openrouter';
    const resolvedModel = model || (isRouter ? 'anthropic/claude-3.5-sonnet' : 'gpt-4o-mini');
    const endpoint = isRouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const userContent: any = req.images?.length
      ? [
          { type: 'text', text: req.prompt },
          ...req.images.map((img) => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } }))
        ]
      : req.prompt;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    };
    if (isRouter) {
      headers['HTTP-Referer'] = 'https://clsg-ir-studio.vercel.app';
      headers['X-Title'] = 'CLSG-IR Studio';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: resolvedModel,
        response_format: { type: 'json_object' },
        max_tokens: req.maxOutputTokens,
        messages: [
          {
            role: 'system',
            content: `${req.systemInstruction || 'You are an expert AI instructional designer.'}\nYou must respond strictly with valid JSON only.`
          },
          { role: 'user', content: userContent }
        ],
        temperature: req.temperature ?? 0.2
      })
    });

    const latencyMs = Math.round(performance.now() - tStart);

    if (!res.ok) {
      const errText = await res.text();
      this.track({
        provider,
        model: resolvedModel,
        feature: req.featureName,
        latencyMs,
        status: 'error',
        errorMessage: `${res.status}: ${errText.slice(0, 150)}`
      });
      throw new Error(`${isRouter ? 'OpenRouter' : 'OpenAI'} Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    this.track({
      provider,
      model: resolvedModel,
      feature: req.featureName,
      promptTokens: data.usage?.prompt_tokens ?? estimateTokens(req.prompt + req.systemInstruction),
      completionTokens: data.usage?.completion_tokens ?? estimateTokens(text),
      totalTokens: data.usage?.total_tokens,
      tokensEstimated: !data.usage,
      latencyMs,
      status: 'success'
    });

    return JSON.parse(stripJsonFences(text)) as T;
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
