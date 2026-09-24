// src/components/pipeline/NarrativeInspector.tsx
import React, { useState } from 'react';
import {
  Sparkles,
  Brain,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Eye,
  GitCommit,
  Clock,
  ArrowRight,
  TrendingUp,
  Activity,
  Layers,
  ChevronRight,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { NarrativeIR, NarrativeBeat } from '../../types';

interface NarrativeInspectorProps {
  narrativeIr?: NarrativeIR | null;
  className?: string;
}

export const NarrativeInspector: React.FC<NarrativeInspectorProps> = ({
  narrativeIr,
  className = ''
}) => {
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);

  // If no narrative IR passed, provide demonstration data
  const fallbackNarrative: NarrativeIR = {
    lecture_narrative_id: 'narr_pose_estimation_01',
    source_document_id: 'Pose_Estimation.pptx',
    persona_archetype: 'insightful_mentor',
    overall_story_arc: 'problem_mystery_deconstruction_mastery',
    average_cognitive_load: 0.62,
    total_curiosity_hooks: 8,
    created_at: new Date().toISOString(),
    narrative_beats: [
      {
        beat_id: 'beat_01_hook',
        target_section_id: 'S01',
        timing_target_sec: 35,
        curiosity_gap: {
          hook_type: 'epistemic_conflict',
          prompt_question: 'Làm thế nào máy tính có thể nhận diện chính xác từng cử động của cơ thể người chỉ từ một bức ảnh 2D tĩnh?',
          known_anchor: 'Máy tính thông thường chỉ thấy ảnh như một mớ ma trận điểm ảnh vô hồn.',
          unknown_frontier: 'Làm sao biến hàng triệu pixel đó thành bộ khung chuyển động sinh học thời gian thực?',
          intensity: 0.88,
          grounding_element_ids: ['el_01', 'el_02']
        },
        cognitive_goal: {
          cognitive_load_score: 0.45,
          active_memory_items: 3,
          probable_misconception: 'Cho rằng máy tính cần vẽ lại toàn bộ da thịt người thay vì chỉ mô hình hóa các khớp nối then chốt.',
          requires_digestive_pause: false
        },
        analogy: {
          source_domain: 'vẽ người que (stick figure sketching)',
          target_concept: 'khung xương 17 điểm COCO keypoints',
          mapping_explanation: 'Thay vì tô vẽ từng sợi tóc, ta chỉ cần chấm đúng các khớp bản lề như khuỷu tay và đầu gối.'
        },
        spoken_discourse: {
          lead_marker: 'Hãy thử hình dung một câu hỏi thú vị trước nhé...',
          adversative_marker: 'Tuy nhiên, thách thức thực sự ở đây là gì?',
          resultative_marker: 'Và chính vì vậy, giải pháp đưa ra cực kỳ thông minh:',
          digestive_pause_sec: 0.8,
          conversational_questions: [
            'Tại sao ta không theo dõi mọi điểm ảnh mà lại dùng khung xương tối giản?'
          ],
          deictic_visual_cues: [
            {
              phrase: 'Các bạn hãy nhìn vào sơ đồ bên trái ngay trên màn hình',
              target_id: 'vis_diagram_01'
            }
          ]
        },
        transitional_bridge_out: 'Sau khi đã nắm rõ cấu trúc này, làm sao để hệ thống kết nối các điểm lại thành hành động? Ta sẽ xem ngay phần tiếp theo.',
        grounding_refs: ['doc_el_01', 'doc_el_02']
      },
      {
        beat_id: 'beat_08_pose_skeleton',
        target_section_id: 'S08',
        timing_target_sec: 45,
        curiosity_gap: {
          hook_type: 'counter_intuitive',
          prompt_question: 'Tại sao lại là đúng 17 điểm khớp chuẩn hóa quốc tế mà không phải 10 hay 50 điểm?',
          known_anchor: 'Cơ thể người có hơn 200 xương và hàng trăm khớp cử động phức tạp.',
          unknown_frontier: 'Đâu là điểm cân bằng toán học giữa độ chính xác nhận diện và tốc độ suy luận 60 FPS?',
          intensity: 0.94,
          grounding_element_ids: ['doc_pose_est_01_S08_el01']
        },
        cognitive_goal: {
          cognitive_load_score: 0.78,
          active_memory_items: 5,
          probable_misconception: 'Nghĩ rằng 17 điểm này được chọn ngẫu nhiên thay vì chuẩn COCO tối ưu cho thị giác máy tính.',
          requires_digestive_pause: true
        },
        analogy: {
          source_domain: 'hệ thống các mắt xích bản lề cơ khí',
          target_concept: '17 keypoints và 19 cạnh liên kết topo',
          mapping_explanation: 'Từng điểm giống như mắt xích truyền động: mũi định hướng khuôn mặt, vai và hông làm trụ giữ cân bằng trọng tâm.'
        },
        spoken_discourse: {
          lead_marker: 'Các bạn hãy để ý kỹ chi tiết này:',
          adversative_marker: 'Nhưng đây mới là chỗ đáng ngạc nhiên:',
          resultative_marker: 'Đó chính là lý do vì sao định dạng COCO trở thành tiêu chuẩn vàng:',
          digestive_pause_sec: 1.4,
          conversational_questions: [
            'Nếu người bị che khuất một cánh tay thì 17 điểm này phản ứng ra sao?'
          ],
          deictic_visual_cues: [
            {
              phrase: 'Hãy nhìn vào điểm số 0 ở mũi và dải điểm 5 đến 10 ở hai cánh tay',
              target_id: 'ann_kp_00'
            }
          ]
        },
        transitional_bridge_out: 'Và khi đã có bộ khung 17 điểm vững chắc này, bước kế tiếp chính là thuật toán tính góc cử động.',
        grounding_refs: ['doc_pose_est_01_S08_el01', 'ann_kp_00']
      }
    ]
  };

  const activeNarrative = narrativeIr || fallbackNarrative;
  const currentBeatId = selectedBeatId || activeNarrative.narrative_beats[0]?.beat_id;
  const selectedBeat = activeNarrative.narrative_beats.find(b => b.beat_id === currentBeatId) || activeNarrative.narrative_beats[0];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-indigo-200 text-xs font-bold uppercase tracking-wider font-mono border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Narrative Intelligence Layer (NIL)
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                NotebookLM-Style Storytelling
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Trí Tuệ Tự Sự Sư Phạm (Narrative IR & Cognitive Engagement)
            </h2>
            <p className="text-xs text-indigo-200/80 mt-1 max-w-3xl leading-relaxed">
              Chuyển hóa bài giảng kỹ thuật khô khan thành một câu chuyện học tập lôi cuốn. Quản lý trạng thái nhận thức người nghe qua <strong>Vòng lặp tò mò (Curiosity Loop)</strong>, <strong>Thuyết tải nhận thức (Sweller CLT)</strong>, và <strong>Khẩu ngữ tự nhiên</strong>.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2.5 shrink-0 text-center">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-[10px] text-indigo-300 font-medium uppercase">Persona</div>
              <div className="text-xs font-bold font-mono text-white mt-0.5">{activeNarrative.persona_archetype}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-[10px] text-indigo-300 font-medium uppercase">Curiosity Hooks</div>
              <div className="text-base font-extrabold font-mono text-amber-300">{activeNarrative.total_curiosity_hooks}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-[10px] text-indigo-300 font-medium uppercase">Avg Cog-Load</div>
              <div className="text-base font-extrabold font-mono text-emerald-300">{Math.round(activeNarrative.average_cognitive_load * 100)}%</div>
            </div>
          </div>
        </div>

        {/* Narrative Beats Selector */}
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-indigo-200/70 font-semibold shrink-0">Các Nhịp Tự Sự (Beats):</span>
          {activeNarrative.narrative_beats.map((b, i) => (
            <button
              key={b.beat_id}
              onClick={() => setSelectedBeatId(b.beat_id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition shrink-0 flex items-center gap-1.5 ${
                b.beat_id === currentBeatId
                  ? 'bg-white text-indigo-900 shadow-md'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <span>Beat #{i + 1} ({b.target_section_id})</span>
              <span className={`w-2 h-2 rounded-full ${b.cognitive_goal.cognitive_load_score > 0.7 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Selected Beat Deep-Dive */}
      {selectedBeat && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols): Cognitive Dynamics & Spoken Discourse */}
          <div className="lg:col-span-8 space-y-5">
            {/* 1. Curiosity Before Content */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Vòng Lặp Tò Mò (Curiosity Before Content)
                    </h3>
                    <p className="text-[11px] text-slate-400">Gợi mở câu đố nhận thức trước khi cung cấp kiến thức</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                  {selectedBeat.curiosity_gap?.hook_type.toUpperCase()}
                </span>
              </div>

              {selectedBeat.curiosity_gap ? (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200">
                    <div className="text-[10px] font-bold text-amber-800 uppercase font-mono mb-1">
                      Câu hỏi kích hoạt tư duy (Provocative Question):
                    </div>
                    <p className="text-slate-900 font-semibold text-sm leading-relaxed">
                      "{selectedBeat.curiosity_gap.prompt_question}"
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block mb-1">
                        1. Điểm neo đã biết (Known Anchor):
                      </span>
                      <p className="text-slate-700">{selectedBeat.curiosity_gap.known_anchor}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase font-mono block mb-1">
                        2. Biên giới chưa biết (Unknown Frontier):
                      </span>
                      <p className="text-slate-800">{selectedBeat.curiosity_gap.unknown_frontier}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Không có curiosity gap cho nhịp này.</p>
              )}
            </div>

            {/* 2. Analogy & Conceptual Grounding */}
            {selectedBeat.analogy && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                  <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Điểm Tựa Ẩn Dụ Trực Quan (Analogy Grounding)
                    </h3>
                    <p className="text-[11px] text-slate-400">Ánh xạ topo kỹ thuật trừu tượng sang trực giác đời thực</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Ẩn dụ nguồn:</span>
                    <span className="font-bold text-purple-900 font-mono">{selectedBeat.analogy.source_domain}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-bold text-indigo-700 font-mono">{selectedBeat.analogy.target_concept}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed italic bg-white/70 p-2.5 rounded-lg border border-purple-100">
                    "{selectedBeat.analogy.mapping_explanation}"
                  </p>
                </div>
              </div>
            )}

            {/* 3. Spoken Discourse & Pacing Blueprint */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Ngữ Dụng Học Khẩu Ngữ (Spoken Discourse & Pacing)
                    </h3>
                    <p className="text-[11px] text-slate-400">Tạo nhịp điệu nói tự nhiên như người thật đang giảng giải</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                  Nghỉ tiêu hóa: {selectedBeat.spoken_discourse.digestive_pause_sec}s
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block mb-0.5">Dẫn nhập (Lead Marker):</span>
                  <span className="text-indigo-700 font-bold">{selectedBeat.spoken_discourse.lead_marker}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block mb-0.5">Nghịch biện (Adversative):</span>
                  <span className="text-slate-800 font-bold">{selectedBeat.spoken_discourse.adversative_marker || 'N/A'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block mb-0.5">Hệ quả (Resultative):</span>
                  <span className="text-emerald-700 font-bold">{selectedBeat.spoken_discourse.resultative_marker || 'N/A'}</span>
                </div>
              </div>

              {/* Deictic Visual Pointer */}
              {selectedBeat.spoken_discourse.deictic_visual_cues?.length > 0 && (
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold mb-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Chỉ dẫn thị giác khẩu ngữ (Deictic Visual Cue):</span>
                  </div>
                  <p className="text-slate-800 font-medium">
                    "{selectedBeat.spoken_discourse.deictic_visual_cues[0].phrase}"
                  </p>
                  <span className="text-[10px] font-mono text-emerald-700 mt-1 block">
                    Target element: {selectedBeat.spoken_discourse.deictic_visual_cues[0].target_id}
                  </span>
                </div>
              )}
            </div>

            {/* 4. Cross-Slide Transitional Bridge */}
            {selectedBeat.transitional_bridge_out && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono flex items-center gap-1.5">
                  <GitCommit className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Cầu Nối Chuyển Tiếp Sang Phân Cảnh Sau (Transitional Bridge):</span>
                </div>
                <p className="text-slate-800 leading-relaxed font-medium">
                  "{selectedBeat.transitional_bridge_out}"
                </p>
              </div>
            )}
          </div>

          {/* Right Column (4 cols): Cognitive Load Gauge & Comparison */}
          <div className="lg:col-span-4 space-y-4">
            {/* Cognitive State Box */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <Brain className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Mô Hình Nhận Thức (Theory of Mind)
                </h3>
              </div>

              {/* Sweller Cognitive Load Gauge */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Tải nhận thức (Sweller CLT):</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {Math.round(selectedBeat.cognitive_goal.cognitive_load_score * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      selectedBeat.cognitive_goal.cognitive_load_score > 0.75
                        ? 'bg-rose-500'
                        : selectedBeat.cognitive_goal.cognitive_load_score > 0.55
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${selectedBeat.cognitive_goal.cognitive_load_score * 100}%` }}
                  />
                </div>
              </div>

              {/* Working Memory Chunks */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">
                  Bộ nhớ làm việc (Miller 7±2):
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base text-slate-900 font-mono">
                    {selectedBeat.cognitive_goal.active_memory_items}
                  </span>
                  <span className="text-slate-500 text-[11px]">khái niệm đồng thời</span>
                </div>
              </div>

              {/* Probable Misconception */}
              {selectedBeat.cognitive_goal.probable_misconception && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-amber-800 uppercase font-mono block">
                    Ngộ nhận học viên tiềm năng:
                  </span>
                  <p className="text-slate-700 text-[11px] leading-relaxed">
                    {selectedBeat.cognitive_goal.probable_misconception}
                  </p>
                </div>
              )}
            </div>

            {/* Side-by-Side Comparison Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                So Sánh Giọng Điệu Giảng Bài
              </h3>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">
                    ❌ Trước (Tóm tắt sách giáo khoa khô khan):
                  </span>
                  <p className="text-slate-600 text-[11px] leading-relaxed italic">
                    "Slide này trình bày định dạng 17 keypoints. Các điểm bao gồm mũi, mắt, tai, vai, khuỷu tay và chân."
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase font-mono block mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ✓ Sau (Tự sự NotebookLM lôi cuốn):
                  </span>
                  <p className="text-slate-900 text-[11px] leading-relaxed font-medium">
                    "{selectedBeat.spoken_discourse.lead_marker} {selectedBeat.curiosity_gap?.prompt_question} Thay vì vẽ hàng triệu pixel, ta chỉ cần 17 điểm then chốt như người que..."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
