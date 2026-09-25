// src/pipeline/module3_generator/llmNarrationGenerator.ts
/**
 * Module 3A (LLM mode): section narration written by the active LLM (Gemini 2.5 Flash by default).
 *
 * Opt-in via UserConfiguration.narrationEngine = 'llm'. Sections are generated in parallel
 * (bounded concurrency) with the neighbouring pages' source content as context, then pass through
 * exactly the same discourse/heading policies and guard as the template engine, so both modes are
 * benchmarked on equal terms. Any section whose call fails falls back to the template engine.
 */
import { SectionPlan, UserConfiguration, DocumentSection } from '../../types';
import { llmRouter } from '../../services/llm/LLMRouter';
import { technicalTerminologyService } from '../services/technicalTerminologyService';
import { contentPurifierService } from '../services/contentPurifierService';

export interface LlmNarrationInput {
  plan: SectionPlan;
  section?: DocumentSection;
  prevSection?: DocumentSection;
  nextTitle?: string;
  chapter?: { title: string; isFirstPage: boolean };
  keywords: string[];
  lessonTitle: string;
  isFirstScene: boolean;
}

const SYSTEM = `You are an experienced university lecturer speaking to students in natural spoken Vietnamese.
${technicalTerminologyService.getSystemPromptGuidance()}`;

const RULES = `SPOKEN-STYLE RULES (strict):
- Output only what the lecturer says aloud. No labels, no slide numbers, no "slide này", no stage directions.
- Connectives ("Tuy nhiên", "Vì vậy", "Ngoài ra", "Đồng thời", "Tiếp theo", "Như vậy"...):
  * use one ONLY when the logical relation really exists (contrast, cause→result, sequence in a process, recap)
  * at most 1 connective per 3 sentences; never start the section with one; never two sentences in a row
  * never use filler openers such as "Hãy thử hình dung...", "Ngay bây giờ, hãy cùng xem", "Nối tiếp..."
- Headings: do NOT read out the page title. Do NOT announce the next page ("chúng ta cùng bước sang ...").
  Mention the chapter title only if told this is the chapter's first page, and then only once.
- Ground every claim in the page content below; do not add facts that are not there.`;

function sourceBlock(section?: DocumentSection): string {
  if (!section) return '';
  return section.elements
    .filter((e) => e.type !== 'title')
    .map((e) => `${e.type === 'note' ? '[ghi chú giảng viên] ' : e.region_id ? `[${e.type}] ` : '- '}${e.text}`)
    .join('\n')
    .slice(0, 2500);
}

function buildPrompt(input: LlmNarrationInput): string {
  const { plan } = input;
  return `${RULES}

LESSON: ${input.lessonTitle}
${input.isFirstScene ? 'This is the FIRST section: greet briefly and state the lesson goal in one sentence.' : 'This is NOT the first section: no greeting.'}
${input.chapter?.isFirstPage ? `This page opens the chapter "${input.chapter.title}" (you may name it once).` : ''}
PAGE ROLE: ${plan.slide_analysis?.slide_role || plan.pedagogical_function}
LEARNING GOAL: ${plan.instructional_goal}
KEY CONCEPTS (by weight): ${input.keywords.slice(0, 8).join(', ') || '(none)'}
TARGET LENGTH: about ${plan.target_word_budget} words (±10%).

PAGE CONTENT:
${sourceBlock(input.section)}

PREVIOUS PAGE (context only, do not repeat it):
${sourceBlock(input.prevSection).slice(0, 600) || '(none)'}

Return JSON: {"narration": "..."}`;
}

export async function generateLlmNarrations(
  inputs: LlmNarrationInput[],
  config: UserConfiguration,
  opts: { concurrency?: number } = {}
): Promise<(string | null)[]> {
  const provider = llmRouter.getOnlineProvider();
  if (!provider || !provider.hasApiKey()) return inputs.map(() => null);

  const results: (string | null)[] = inputs.map(() => null);
  let cursor = 0;
  const worker = async () => {
    while (cursor < inputs.length) {
      const i = cursor++;
      const input = inputs[i];
      try {
        const res = await provider.generateJson<{ narration: string }>(buildPrompt(input), SYSTEM, 'Module 3A: LLM Narration', {
          maxOutputTokens: Math.max(400, input.plan.target_word_budget * 4),
          temperature: 0.5,
          timeoutMs: 30000
        });
        const text = contentPurifierService.purifyNarration(String(res?.narration || ''), {
          title: input.plan.title,
          role: input.plan.slide_analysis?.slide_role
        }).cleanedText;
        results[i] = text.trim() || null;
      } catch (err) {
        console.warn(`LLM narration failed for ${input.plan.section_id}, using template:`, err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency || 4, inputs.length)) }, worker));
  void config;
  return results;
}
