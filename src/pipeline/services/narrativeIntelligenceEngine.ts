// src/pipeline/services/narrativeIntelligenceEngine.ts
/**
 * NARRATIVE INTELLIGENCE LAYER (NIL) ENGINE
 * 
 * Transforms instructional outlines into engaging, cognitive-driven,
 * NotebookLM-quality educational lecture narrations.
 * 
 * Core Features:
 * 1. Epistemic Curiosity Loops (Curiosity before Content)
 * 2. Listener Mental-State & Cognitive Load Balancer (Sweller CLT)
 * 3. Analogies for Abstract Technical Topology
 * 4. Oral Discourse Pragmatics & Pacing Resets
 * 5. Deictic Visual Callouts (Pointing directly to diagram elements)
 * 6. Cross-Slide Narrative Momentum Bridges
 */

import {
  CanonicalDocumentTree,
  LessonBlueprint,
  UserConfiguration,
  NarrativeIR,
  NarrativeBeat,
  EpistemicCuriosityGap,
  ListenerMentalState,
  AnalogyPoint,
  SpokenDiscourseBlueprint
} from '../../types';

export class NarrativeIntelligenceEngine {
  private analogyCatalog: Record<string, AnalogyPoint> = {
    pose: {
      source_domain: 'vẽ người que (stick figure sketching)',
      target_concept: '17 điểm keypoint khung xương người',
      mapping_explanation: 'Thay vì tô vẽ hàng triệu pixel da thịt phức tạp, ta chỉ cần định vị đúng các điểm khớp bản lề then chốt như khuỷu tay và đầu gối.'
    },
    cnn: {
      source_domain: 'chiếc kính lúp quét qua tranh',
      target_concept: 'kernel trượt qua feature map',
      mapping_explanation: 'Giống như việc cầm kính lúp rê đều qua từng góc nhỏ của bức tranh để gom các đường nét đặc trưng lại.'
    },
    matrix: {
      source_domain: 'bảng chia ô bàn cờ',
      target_concept: 'ma trận số liệu đa chiều',
      mapping_explanation: 'Mỗi ô chứa một giá trị cường độ sáng đại diện cho độ đậm nhạt của hình ảnh.'
    }
  };

  /**
   * Generates the Narrative IR blueprint for the entire lesson
   */
  generateNarrativeIR(
    docTree: CanonicalDocumentTree,
    blueprint: LessonBlueprint,
    config?: UserConfiguration
  ): NarrativeIR {
    const beats: NarrativeBeat[] = [];
    let totalLoad = 0;

    const sections = docTree.sections || [];
    sections.forEach((sec, idx) => {
      const title = sec.title || `Phần ${idx + 1}`;
      const textEls = sec.elements.filter(e => e.type !== 'note');
      const noteEls = sec.elements.filter(e => e.type === 'note');

      // 1. Epistemic Curiosity Formulation
      const promptQ = this.formulateCuriosityQuestion(title, sec.elements.map(e => e.text).join(' '));
      const gap: EpistemicCuriosityGap = {
        hook_type: 'epistemic_conflict',
        prompt_question: promptQ,
        known_anchor: 'Máy tính có thể nhìn thấy toàn bộ bức ảnh dưới dạng ma trận điểm ảnh.',
        unknown_frontier: `Làm sao hệ thống có thể hiểu được bản chất động tác trong ${title} một cách tức thời?`,
        intensity: 0.86,
        grounding_element_ids: textEls.slice(0, 2).map(e => e.element_id)
      };

      // 2. Cognitive Load & Working Memory
      const visEl = sec.elements.find(e => e.type === 'diagram' || e.type === 'image');
      const conceptCount = textEls.length + (visEl ? 1 : 0);
      const cogLoad = Math.min(0.9, 0.3 + conceptCount * 0.08);
      totalLoad += cogLoad;

      const mentalState: ListenerMentalState = {
        cognitive_load_score: Number(cogLoad.toFixed(2)),
        active_memory_items: Math.min(5, Math.max(2, conceptCount)),
        probable_misconception: 'Cho rằng trí tuệ nhân tạo phải nhận diện từng chi tiết phức tạp thay vì mô hình hóa tối giản.',
        requires_digestive_pause: cogLoad > 0.65
      };

      // 3. Analogy Grounding
      const analogy = this.findAnalogy(title, sec.elements.map(e => e.text).join(' '));

      // 4. Spoken Discourse & Deictic Visual Pointers
      const deicticCues = [];
      if (visEl) {
        deicticCues.push({
          phrase: `Hãy nhìn vào sơ đồ trực quan ngay trên màn hình (${visEl.type})`,
          target_id: visEl.element_id
        });
      }

      const discourse: SpokenDiscourseBlueprint = {
        lead_marker: 'Hãy thử hình dung một câu hỏi thú vị trước nhé...',
        adversative_marker: 'Tuy nhiên, thách thức thực sự ở đây là gì?',
        resultative_marker: 'Và chính vì vậy, giải pháp đưa ra cực kỳ thông minh:',
        digestive_pause_sec: mentalState.requires_digestive_pause ? 1.2 : 0.8,
        conversational_questions: [
          'Tại sao các kỹ sư lại chọn cách tiếp cận này thay vì phương pháp truyền thống?',
          'Điều gì sẽ xảy ra nếu một phần cơ thể bị che khuất?'
        ],
        deictic_visual_cues: deicticCues
      };

      // 5. Cross-Slide Transitional Bridge
      const nextTitle = sections[idx + 1] ? sections[idx + 1].title : 'phần tổng kết ứng dụng';
      const bridgeOut = `Sau khi đã nắm vững nguyên lý này, làm sao để đưa nó vào thực tế vận hành? Chúng ta cùng bước sang ${nextTitle} ngay sau đây.`;

      beats.push({
        beat_id: `beat_${String(idx + 1).padStart(2, '0')}_${sec.section_id}`,
        target_section_id: sec.section_id,
        timing_target_sec: Math.max(30, blueprint.sections[idx]?.target_duration_sec || 45),
        curiosity_gap: gap,
        cognitive_goal: mentalState,
        analogy,
        spoken_discourse: discourse,
        transitional_bridge_out: bridgeOut,
        grounding_refs: sec.elements.map(e => e.element_id)
      });
    });

    const avgLoad = Number((totalLoad / Math.max(1, beats.length)).toFixed(2));

    return {
      lecture_narrative_id: `narr_${docTree.title.replace(/\s+/g, '_').toLowerCase()}`,
      source_document_id: docTree.source_filename,
      persona_archetype: 'insightful_mentor',
      overall_story_arc: 'problem_mystery_deconstruction_mastery',
      narrative_beats: beats,
      average_cognitive_load: avgLoad,
      total_curiosity_hooks: beats.length,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Re-voices a raw summary draft into spoken, conversational, NotebookLM-quality storytelling
   */
  revoiceDraft(
    draftText: string,
    beat?: NarrativeBeat,
    isVietnamese: boolean = true
  ): string {
    if (!draftText) return draftText;
    if (!beat) return draftText;

    const parts: string[] = [];

    // 1. Curiosity Lead & Question
    if (beat.curiosity_gap && beat.spoken_discourse) {
      parts.push(`${beat.spoken_discourse.lead_marker} ${beat.curiosity_gap.prompt_question}`);
    }

    // 2. Deictic Visual Pointer
    if (beat.spoken_discourse?.deictic_visual_cues?.length) {
      parts.push(`${beat.spoken_discourse.deictic_visual_cues[0].phrase}.`);
    }

    // 3. Conversational Re-voicing of Body
    let cleanBody = draftText.trim();
    cleanBody = cleanBody.replace(/Nội dung bao gồm:/gi, 'Điểm mấu chốt ở đây chính là:');
    cleanBody = cleanBody.replace(/Slide này trình bày/gi, 'Bây giờ chúng ta cùng phân tích sâu về');
    cleanBody = cleanBody.replace(/Tiếp theo là/gi, 'Ngay bây giờ, hãy cùng xem');
    parts.push(cleanBody);

    // 4. Analogy Anchor
    if (beat.analogy) {
      parts.push(`Các bạn cứ hình dung nó tương tự như ${beat.analogy.source_domain}: ${beat.analogy.mapping_explanation}`);
    }

    // 5. Cross-slide Bridge
    if (beat.transitional_bridge_out) {
      parts.push(beat.transitional_bridge_out);
    }

    return parts.join(' ');
  }

  private formulateCuriosityQuestion(title: string, text: string): string {
    const combined = (title + ' ' + text).toLowerCase();
    if (combined.includes('pose') || combined.includes('khung xương') || combined.includes('keypoint')) {
      return 'Làm thế nào máy tính có thể nhận diện chính xác từng cử động của cơ thể người chỉ từ một bức ảnh 2D tĩnh?';
    }
    if (combined.includes('cnn') || combined.includes('convolution') || combined.includes('tích chập')) {
      return 'Làm sao một mạng nơ-ron nhân tạo có thể phân biệt được con mèo và con chó giữa hàng triệu pixel hỗn loạn?';
    }
    return `Vì sao nguyên lý trong ${title} lại là mắt xích quyết định hiệu năng của toàn bộ hệ thống?`;
  }

  private findAnalogy(title: string, text: string): AnalogyPoint | undefined {
    const combined = (title + ' ' + text).toLowerCase();
    for (const [key, item] of Object.entries(this.analogyCatalog)) {
      if (combined.includes(key)) {
        return item;
      }
    }
    return undefined;
  }
}

export const narrativeIntelligenceEngine = new NarrativeIntelligenceEngine();
