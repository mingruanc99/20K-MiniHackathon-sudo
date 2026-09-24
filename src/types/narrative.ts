// src/types/narrative.ts
/**
 * Types for Narrative Intelligence Layer (NIL) and Narrative IR
 */

export interface EpistemicCuriosityGap {
  hook_type: 'epistemic_conflict' | 'counter_intuitive' | 'real_world_conundrum';
  prompt_question: string;
  known_anchor: string;
  unknown_frontier: string;
  intensity: number; // 0.0 - 1.0
  grounding_element_ids: string[];
}

export interface ListenerMentalState {
  cognitive_load_score: number; // 0.0 - 1.0 (Sweller CLT)
  active_memory_items: number;  // 2 - 7 items
  probable_misconception?: string;
  requires_digestive_pause: boolean;
}

export interface AnalogyPoint {
  source_domain: string;
  target_concept: string;
  mapping_explanation: string;
  pedagogical_purpose?: string;
}

export interface DeicticVisualCue {
  phrase: string;
  target_id: string;
}

export interface SpokenDiscourseBlueprint {
  lead_marker: string;
  adversative_marker?: string;
  resultative_marker?: string;
  digestive_pause_sec: number;
  conversational_questions: string[];
  deictic_visual_cues: DeicticVisualCue[];
}

export interface NarrativeBeat {
  beat_id: string;
  target_section_id: string;
  timing_target_sec: number;
  curiosity_gap?: EpistemicCuriosityGap;
  cognitive_goal: ListenerMentalState;
  analogy?: AnalogyPoint;
  spoken_discourse: SpokenDiscourseBlueprint;
  transitional_bridge_out?: string;
  grounding_refs: string[];
}

export interface NarrativeIR {
  lecture_narrative_id: string;
  source_document_id: string;
  persona_archetype: 'insightful_mentor' | 'socratic_explorer' | 'master_craftsman';
  overall_story_arc: string;
  narrative_beats: NarrativeBeat[];
  average_cognitive_load: number;
  total_curiosity_hooks: number;
  created_at: string;
}
