// src/pipeline/services/transitionIntelligenceEngine.ts
/**
 * ============================================================================
 * TRANSITION INTELLIGENCE ENGINE — Frontend Service
 * ============================================================================
 * Frontend implementation of the Transition Intelligence Layer (TIL).
 *
 * Used in:
 *   - Studio UI: Visualize transitions between concepts
 *   - Pipeline orchestrator: Inject bridge text into narration context
 *   - Quality dashboard: Show transition quality heatmap
 *
 * This is the TypeScript mirror of:
 *   app/modules/transition/transition_layer.py
 * ============================================================================
 */

import {
  TransitionIR,
  LectureTransitionMap,
  TransitionRelationship,
  TransitionStrategy,
  TransitionQualityMetrics,
  RELATIONSHIP_LABELS,
} from '../../types/transitionIR';

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-PATTERN DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const SLIDE_CENTRIC_PATTERNS = [
  /let'?s move on to/i,
  /next slide/i,
  /next section/i,
  /now we will see/i,
  /in this slide/i,
  /in this section/i,
  /turning to the next/i,
  /moving on/i,
  /the next topic is/i,
  /now let'?s look at/i,
  /this slide (shows|presents|covers)/i,
  /our next (topic|subject|point) is/i,
  /bây giờ (chúng ta|ta) (sẽ|cùng) (xem|sang|chuyển)/i,
  /tiếp theo (chúng ta|ta) (sẽ|xem xét)/i,
  /slide tiếp theo/i,
  /phần tiếp theo là/i,
  /chuyển sang phần/i,
  /trong slide này/i,
];

export function detectSlideCentricPhrases(text: string): string[] {
  const found: string[] = [];
  for (const pattern of SLIDE_CENTRIC_PATTERNS) {
    const match = text.match(pattern);
    if (match) found.push(match[0]);
  }
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP INFERENCE
// ─────────────────────────────────────────────────────────────────────────────

type RolePair = [string, string];
type RelStratPair = [TransitionRelationship, TransitionStrategy];

const ROLE_PAIR_MAP: Map<string, RelStratPair> = new Map([
  ['hook,definition',   ['ObservationToExplanation',  'curiosity_hook']],
  ['hook,mechanism',    ['ObservationToExplanation',  'curiosity_hook']],
  ['hook,example',      ['AbstractToConcreteInstance', 'curiosity_hook']],
  ['definition,mechanism', ['FoundationToExtension',  'causal_chain']],
  ['definition,example',   ['DefinitionToExample',    'gap_bridge']],
  ['definition,comparison',['SimpleToAdvanced',       'contrast_pivot']],
  ['mechanism,example',    ['ConceptToApplication',   'gap_bridge']],
  ['mechanism,mechanism',  ['StepToNextStep',         'sequential_step']],
  ['mechanism,comparison', ['TradeoffAnalysis',       'contrast_pivot']],
  ['mechanism,summary',    ['SummaryToDepth',         'zoom_transition']],
  ['example,mechanism',    ['PrerequisiteToDependent','causal_chain']],
  ['example,comparison',   ['ContrastHighlight',      'contrast_pivot']],
  ['example,summary',      ['ComponentToWhole',       'zoom_transition']],
  ['comparison,summary',   ['ScopeWideOut',           'zoom_transition']],
  ['comparison,mechanism', ['TradeoffAnalysis',       'contrast_pivot']],
  ['summary,hook',         ['ScopeNarrowDown',        'curiosity_hook']],
  ['summary,definition',   ['FoundationToExtension',  'gap_bridge']],
]);

function inferRelationship(roleA: string, roleB: string): RelStratPair {
  const key = `${roleA},${roleB}`;
  return ROLE_PAIR_MAP.get(key) ?? ['PrerequisiteToDependent', 'gap_bridge'];
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIDGE TEXT TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const BRIDGE_TEMPLATES: Partial<Record<TransitionRelationship, {
  closing: string;
  opening: string;
  question: string;
}>> & { _default: { closing: string; opening: string; question: string } } = {
  LimitationToSolution: {
    closing:  'But {A} alone has a fundamental limitation: it cannot tell us {gap}.',
    opening:  'That is precisely the gap that {B} fills — giving us {resolution}.',
    question: 'What critical information does {A} still leave out?',
  },
  DefinitionToExample: {
    closing:  'This definition is precise, but abstract. The real question is: what does {A} look like in practice?',
    opening:  'Consider this concrete case — {B} — which shows exactly how the definition plays out.',
    question: 'How does {A} behave in a real scenario?',
  },
  PrerequisiteToDependent: {
    closing:  'Understanding {A} is essential, because without it the next idea simply would not make sense.',
    opening:  'Building directly on that foundation, {B} takes the reasoning one step further.',
    question: 'What depends on understanding {A} first?',
  },
  ConceptToApplication: {
    closing:  'The theory of {A} is now clear. The more interesting question is: where does this actually get used?',
    opening:  '{B} is the answer — the direct application of everything we just established.',
    question: 'How is {A} applied in a real system?',
  },
  StepToNextStep: {
    closing:  'With {A} complete, we have everything we need for the next stage.',
    opening:  'That feeds directly into {B}, which takes the output of the previous step and transforms it further.',
    question: 'What happens after {A}?',
  },
  ContrastHighlight: {
    closing:  '{A} works well in certain conditions. But there is a different approach worth examining.',
    opening:  '{B}, by contrast, takes a fundamentally different path — which reveals an important tradeoff.',
    question: 'How does {A} compare to an alternative?',
  },
  FoundationToExtension: {
    closing:  '{A} gives us the core building block. The natural question is: how far can we extend this?',
    opening:  '{B} is exactly that extension — it inherits the foundation and adds a new layer of power.',
    question: 'What does {A} enable beyond itself?',
  },
  ObservationToExplanation: {
    closing:  'We have observed that {A}. But observation alone is not enough — we need to understand why.',
    opening:  '{B} is the mechanism that explains what we just saw.',
    question: 'Why does {A} behave this way?',
  },
  ComponentToWhole: {
    closing:  'We have examined {A} in isolation. Now we can step back and see where it fits in the larger picture.',
    opening:  '{B} is that larger picture — the system into which {A} slots as a critical component.',
    question: 'How does {A} contribute to the full system?',
  },
  ScopeWideOut: {
    closing:  'We have spent time in the details of {A}. It is worth pulling back to see the broader implications.',
    opening:  'At a higher level, {B} is the perspective that unifies everything we have covered.',
    question: 'What does {A} look like from a higher vantage point?',
  },
  _default: {
    closing:  '{A} lays the groundwork for the next idea. There is still one important question left open.',
    opening:  '{B} is the answer — and it changes how we think about everything so far.',
    question: 'What important idea does {A} lead to?',
  },
};

function fillTemplate(template: string, a: string, b: string): string {
  return template.replace(/\{A\}/g, a).replace(/\{B\}/g, b).replace(/\{gap\}/g, 'something essential').replace(/\{resolution\}/g, 'the missing piece');
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────────────────

function scoreTransition(
  closing: string,
  opening: string,
  conceptA: string,
  conceptB: string,
): TransitionQualityMetrics {
  const bridge = (closing + ' ' + opening).toLowerCase();

  const badPhrases = detectSlideCentricPhrases(bridge);
  const slideDep = Math.min(1.0, badPhrases.length * 0.35);

  const connectives = ['however', 'but', 'yet', 'that is why', 'this is where',
    'which means', 'so', 'therefore', 'exactly', 'nhưng', 'chính vì vậy',
    'đó là lý do', 'vì thế', 'vì vậy'];
  const flowHits = connectives.filter(c => bridge.includes(c)).length;
  const humanFlow = Math.min(1.0, 0.5 + flowHits * 0.1);

  const aIn = bridge.includes(conceptA.toLowerCase().slice(0, 6));
  const bIn = bridge.includes(conceptB.toLowerCase().slice(0, 6));
  const coherence = 0.5 + (aIn ? 0.25 : 0) + (bIn ? 0.25 : 0);

  const titleInjected = closing.toLowerCase().slice(0, 60).includes(conceptB.toLowerCase().slice(0, 6));
  const continuity = titleInjected ? 0.5 : 0.9;

  const quality = Math.min(1.0, ((humanFlow + coherence + continuity) / 3.0) * (1 - slideDep * 0.5));
  const overall = Math.round((quality * 0.30 + coherence * 0.25 + continuity * 0.20 + humanFlow * 0.20 + (1.0 - slideDep) * 0.05) * 1000) / 1000;

  return {
    transition_quality_score: Math.round(quality * 1000) / 1000,
    bridge_coherence_score: Math.round(coherence * 1000) / 1000,
    concept_continuity_score: Math.round(continuity * 1000) / 1000,
    human_lecture_flow_score: Math.round(humanFlow * 1000) / 1000,
    slide_dependency_score: Math.round(slideDep * 1000) / 1000,
    overall,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export interface SectionPlanLike {
  section_id: string;
  title: string;
  pedagogical_function: string;
  key_concepts?: string[];
  order: number;
}

export function buildTransitionMap(
  blueprintId: string,
  documentId: string,
  sections: SectionPlanLike[],
): LectureTransitionMap {
  const transitions: TransitionIR[] = [];

  for (let i = 0; i < sections.length - 1; i++) {
    const sA = sections[i];
    const sB = sections[i + 1];

    const conceptA = sA.key_concepts?.[0] ?? sA.title;
    const conceptB = sB.key_concepts?.[0] ?? sB.title;

    const [relationship, strategy] = inferRelationship(
      sA.pedagogical_function,
      sB.pedagogical_function,
    );

    const tmpl = (BRIDGE_TEMPLATES as Record<string, typeof BRIDGE_TEMPLATES['_default']>)[relationship]
      ?? BRIDGE_TEMPLATES._default;

    const closing = fillTemplate(tmpl.closing, conceptA, conceptB);
    const opening = fillTemplate(tmpl.opening, conceptA, conceptB);
    const question = fillTemplate(tmpl.question, conceptA, conceptB);
    const bridgeText = `${closing} ${opening}`;

    const badPhrases = detectSlideCentricPhrases(bridgeText);
    const quality = scoreTransition(closing, opening, conceptA, conceptB);

    const tr: TransitionIR = {
      transition_id: `tr_${String(i + 1).padStart(2, '0')}_${String(i + 2).padStart(2, '0')}`,
      from_section_id: sA.section_id,
      to_section_id: sB.section_id,
      from_concept_label: conceptA,
      to_concept_label: conceptB,
      relationship,
      bridge_reason: `${conceptA} sets the conceptual stage; ${conceptB} advances it via ${RELATIONSHIP_LABELS[relationship]}.`,
      learner_question: question,
      strategy,
      closing_sentence_a: closing,
      opening_sentence_b: opening,
      bridge_text: bridgeText,
      quality,
      slide_centric_phrases_detected: badPhrases,
      generation_method: 'rule_based',
    };

    transitions.push(tr);
  }

  const qualities = transitions.map(t => t.quality!);
  const avg = (fn: (q: TransitionQualityMetrics) => number) =>
    qualities.length > 0
      ? Math.round((qualities.reduce((s, q) => s + fn(q), 0) / qualities.length) * 1000) / 1000
      : 0;

  const weakTransitions = transitions
    .filter(t => (t.quality?.overall ?? 0) < 0.6)
    .map(t => t.transition_id);

  return {
    map_id: `tmap_${Math.random().toString(36).slice(2, 10)}`,
    blueprint_id: blueprintId,
    document_id: documentId,
    transitions,
    average_transition_quality: avg(q => q.transition_quality_score),
    average_bridge_coherence: avg(q => q.bridge_coherence_score),
    average_human_flow: avg(q => q.human_lecture_flow_score),
    average_slide_dependency: avg(q => q.slide_dependency_score),
    total_transitions: transitions.length,
    weak_transitions: weakTransitions,
    created_at: new Date().toISOString(),
  };
}

/** Returns a {to_section_id: TransitionIR} index for fast lookup */
export function indexTransitions(map: LectureTransitionMap): Map<string, TransitionIR> {
  return new Map(map.transitions.map(t => [t.to_section_id, t]));
}
