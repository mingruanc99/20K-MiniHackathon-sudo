// src/components/pipeline/KnowledgeGraphCurriculumViewer.tsx
import React, { useState, useMemo } from 'react';
import {
  Network,
  Compass,
  Clock,
  Sparkles,
  GitFork,
  Layers,
  ChevronRight,
  BookOpen,
  Sliders,
  CheckCircle2,
  FileCode,
  Image as ImageIcon,
  ArrowRight,
  BarChart3,
  HelpCircle,
  Eye,
  Info
} from 'lucide-react';
import {
  KnowledgeIR,
  CurriculumIR,
  ConceptNode,
  TeachingUnitPlan,
  EpistemicRole
} from '../../types';
import { knowledgeSpaceEngine } from '../../pipeline/services/knowledgeSpaceEngine';

interface KnowledgeGraphCurriculumViewerProps {
  knowledgeIr?: KnowledgeIR | null;
  curriculumIr?: CurriculumIR | null;
  className?: string;
}

export const KnowledgeGraphCurriculumViewer: React.FC<KnowledgeGraphCurriculumViewerProps> = ({
  knowledgeIr,
  curriculumIr,
  className = ''
}) => {
  // Demonstration baseline Knowledge Space if not provided
  const fallbackKnowledge: KnowledgeIR = useMemo(() => {
    return {
      knowledge_space_id: 'kspace_pose_estimation_mastery',
      source_document_id: 'Pose_Estimation.pptx',
      domain: 'Computer Vision & Deep Learning',
      total_propositions: 28,
      total_evidence_artifacts: 5,
      created_at: new Date().toISOString(),
      concepts: [
        {
          concept_id: 'c_foundations',
          canonical_name: 'Giới Thiệu Bài Toán Human Pose Estimation',
          formal_definition: 'Bài toán ước lượng vị trí không gian 2D/3D của các khớp xương người từ tín hiệu thị giác pixel.',
          epistemic_role: 'foundational_axiom',
          cognitive_complexity_score: 0.45,
          significance_score: 0.75,
          propositions: [
            {
              prop_id: 'p1',
              statement: 'Mục tiêu là dự đoán tọa độ x, y của các khớp cử động thay vì nhận diện cả hộp viền.',
              grounding_source: 'Pose_Estimation.pptx#el_01',
              confidence: 1.0
            }
          ],
          analogies: [
            {
              source_domain: 'bộ cảm biến gắn trên diễn viên',
              explanation: 'Giống như công nghệ motion capture trong làm phim Hollywood nhưng hoàn toàn bằng camera thường.'
            }
          ],
          common_misconceptions: [
            'Nghĩ rằng pose estimation yêu cầu camera hồng ngoại đặc biệt.'
          ],
          evidence_artifacts: [],
          keywords: ['pose', 'estimation', 'vision', 'joints']
        },
        {
          concept_id: 'c_coco_17_keypoints',
          canonical_name: 'Định Dạng Chuẩn Hóa COCO 17 Keypoints & 19 Cạnh',
          formal_definition: 'Cấu trúc đồ thị topo chuẩn quốc tế gồm 17 điểm khớp bản lề (từ mũi đến mắt cá chân) và 19 liên kết động lực học.',
          epistemic_role: 'core_mechanism',
          cognitive_complexity_score: 0.65,
          significance_score: 0.98,
          propositions: [
            {
              prop_id: 'p2',
              statement: 'Điểm 0 là mũi, 1-4 là vùng mắt tai, 5-10 là chi trên, 11-16 là chi dưới.',
              grounding_source: 'Pose_Estimation.pptx#el_02',
              confidence: 1.0
            }
          ],
          analogies: [
            {
              source_domain: 'vẽ người que (stick figure)',
              explanation: 'Chỉ chấm đúng 17 khớp bản lề then chốt thay vì vẽ hàng triệu pixel da thịt.'
            }
          ],
          common_misconceptions: [
            'Cho rằng 17 điểm này chọn ngẫu nhiên thay vì chuẩn hóa hình học cơ thể.'
          ],
          evidence_artifacts: [
            {
              artifact_id: 'art_skeleton_diagram',
              modality: 'diagram',
              subtype: 'human_pose_skeleton',
              role: 'definitive_proof',
              semantic_description: 'Sơ đồ hình học bộ khung xương 17 điểm và 19 đường nối',
              spatial_features: { keypoints: 17, connections: 19 },
              raw_source_ref: 'diagram_slide_08',
              confidence: 0.98
            }
          ],
          keywords: ['coco', 'keypoints', 'skeleton', '17_points']
        },
        {
          concept_id: 'c_heatmap_regression',
          canonical_name: 'Cơ Chế Hồi Quy Heatmap Xác Suất Khớp',
          formal_definition: 'Mỗi điểm khớp được dự đoán thông qua một ma trận bản đồ nhiệt Gaussian 2D, biểu thị xác suất tồn tại khớp tại mỗi vị trí pixel.',
          epistemic_role: 'core_mechanism',
          cognitive_complexity_score: 0.82,
          significance_score: 0.88,
          propositions: [
            {
              prop_id: 'p3',
              statement: 'Dùng Gaussian heatmap thay vì trực tiếp hồi quy số thực (x, y) để tránh bất ổn định phi tuyến.',
              grounding_source: 'Pose_Estimation.pptx#el_03',
              confidence: 1.0
            }
          ],
          analogies: [],
          common_misconceptions: [],
          evidence_artifacts: [
            {
              artifact_id: 'art_heatmap_vis',
              modality: 'image',
              subtype: 'gaussian_heatmap',
              role: 'intuitive_illustration',
              semantic_description: 'Ảnh minh họa phổ nhiệt Gaussian tỏa sáng tại khuỷu tay',
              raw_source_ref: 'heatmap_img_01',
              confidence: 0.92
            }
          ],
          keywords: ['heatmap', 'gaussian', 'regression', 'probability']
        },
        {
          concept_id: 'c_topdown_vs_bottomup',
          canonical_name: 'Thách Thức Kiến Trúc: Top-Down vs Bottom-Up',
          formal_definition: 'Sự đánh đổi cốt tử: Top-Down phát hiện người trước rồi tìm khớp (chính xác cao nhưng độ trễ tăng tuyến tính theo số người); Bottom-Up phát hiện toàn bộ khớp rồi gom nhóm (tốc độ không đổi 60 FPS trong đám đông).',
          epistemic_role: 'architectural_tradeoff',
          cognitive_complexity_score: 0.85,
          significance_score: 0.92,
          propositions: [
            {
              prop_id: 'p4',
              statement: 'Top-down có độ phức tạp O(N_person), Bottom-up có độ phức tạp O(1) đối với số người trong ảnh.',
              grounding_source: 'Pose_Estimation.pptx#el_04',
              confidence: 1.0
            }
          ],
          analogies: [
            {
              source_domain: 'tìm vé xe trong bãi giữ xe',
              explanation: 'Top-down là tìm từng chiếc xe rồi đọc biển số; Bottom-up là scan tất cả biển số cùng lúc rồi gán vào xe.'
            }
          ],
          common_misconceptions: [
            'Cho rằng Top-Down luôn tốt hơn Bottom-Up trong mọi bài toán thực tế.'
          ],
          evidence_artifacts: [
            {
              artifact_id: 'art_tradeoff_table',
              modality: 'table',
              subtype: 'comparison_matrix',
              role: 'quantitative_benchmark',
              semantic_description: 'Bảng so sánh FPS, mAP và tài nguyên GPU giữa OpenPose và HRNet',
              raw_source_ref: 'table_slide_15',
              confidence: 0.96
            }
          ],
          keywords: ['top_down', 'bottom_up', 'tradeoff', 'realtime', 'crowd']
        }
      ],
      edges: [
        {
          source_concept_id: 'c_foundations',
          target_concept_id: 'c_coco_17_keypoints',
          relationship_type: 'prerequisite_to',
          strength: 0.95
        },
        {
          source_concept_id: 'c_coco_17_keypoints',
          target_concept_id: 'c_heatmap_regression',
          relationship_type: 'operationalized_by',
          strength: 0.9
        },
        {
          source_concept_id: 'c_coco_17_keypoints',
          target_concept_id: 'c_topdown_vs_bottomup',
          relationship_type: 'prerequisite_to',
          strength: 0.92
        }
      ]
    };
  }, []);

  const activeKnowledge = knowledgeIr || fallbackKnowledge;

  // Selected Duration Dial (3, 10, 30, 60 minutes)
  const [selectedDuration, setSelectedDuration] = useState<number>(10);
  const [selectedConceptId, setSelectedConceptId] = useState<string>(activeKnowledge.concepts[0]?.concept_id || '');

  // Compile Dynamic Curriculum on the fly when duration changes
  const activeCurriculum: CurriculumIR = useMemo(() => {
    return knowledgeSpaceEngine.compileCurriculum(activeKnowledge, selectedDuration, 135);
  }, [activeKnowledge, selectedDuration]);

  const selectedConcept = useMemo(() => {
    return activeKnowledge.concepts.find(c => c.concept_id === selectedConceptId) || activeKnowledge.concepts[0];
  }, [activeKnowledge, selectedConceptId]);

  const getRoleTheme = (role: EpistemicRole) => {
    switch (role) {
      case 'core_mechanism':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-300',
          text: 'text-emerald-700',
          badge: 'bg-emerald-600 text-white',
          label: '⚙️ Cơ Chế Cốt Lõi'
        };
      case 'foundational_axiom':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-300',
          text: 'text-blue-700',
          badge: 'bg-blue-600 text-white',
          label: '🏛️ Tiên Đề Nền Tảng'
        };
      case 'architectural_tradeoff':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-300',
          text: 'text-amber-700',
          badge: 'bg-amber-600 text-white',
          label: '⚖️ Đánh Đổi Kiến Trúc'
        };
      case 'empirical_proof':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-300',
          text: 'text-purple-700',
          badge: 'bg-purple-600 text-white',
          label: '📊 Dẫn Chứng Thực Nghiệm'
        };
      default:
        return {
          bg: 'bg-slate-50',
          border: 'border-slate-300',
          text: 'text-slate-700',
          badge: 'bg-slate-600 text-white',
          label: '🚀 Ứng Dụng Thực Tế'
        };
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Banner: Knowledge Space & Curriculum Architect */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider font-mono border border-indigo-400/30">
                <Network className="w-3.5 h-3.5" />
                Knowledge Space & Dynamic Curriculum Engine
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                Slide-Agnostic Pedagogy
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Tái Cấu Trúc Không Gian Tri Thức & Thiết Kế Giáo Trình Động
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Hệ thống không còn giảng giải thụ động từng slide. Toàn bộ tài liệu được giải phóng thành <strong>Mạng lưới khái niệm (Knowledge DAG)</strong> với các sơ đồ, công thức đóng vai trò <strong>Dẫn chứng thực nghiệm (Evidence Artifacts)</strong> gắn trực tiếp vào khái niệm.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2.5 shrink-0 text-center font-mono">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-[10px] text-slate-400 uppercase font-sans">Khái niệm</div>
              <div className="text-base font-extrabold text-white mt-0.5">{activeKnowledge.concepts.length}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-[10px] text-slate-400 uppercase font-sans">Mệnh đề sự thật</div>
              <div className="text-base font-extrabold text-indigo-300 mt-0.5">{activeKnowledge.total_propositions}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-[10px] text-slate-400 uppercase font-sans">Dẫn chứng thị giác</div>
              <div className="text-base font-extrabold text-amber-300 mt-0.5">{activeKnowledge.total_evidence_artifacts}</div>
            </div>
          </div>
        </div>

        {/* Dynamic Duration Dial Selector */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-200">
              Mô Phỏng Biên Soạn Bài Giảng Theo Thời Lượng (Duration Dial):
            </span>
          </div>

          <div className="flex items-center bg-white/10 p-1 rounded-xl gap-1 border border-white/10">
            {[3, 10, 30, 60].map((dur) => (
              <button
                key={dur}
                onClick={() => setSelectedDuration(dur)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition font-mono ${
                  selectedDuration === dur
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {dur} Phút {dur === 3 ? '(Flash)' : dur === 10 ? '(Cốt lõi)' : dur === 30 ? '(Chuyên sâu)' : '(Master)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Workspace: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Dynamic Curriculum Trajectory (Compiled for chosen duration) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Lộ Trình Sư Phạm Được Tái Thiết Lập ({selectedDuration} Phút — {activeCurriculum.total_target_words} từ)
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                Chiến lược: {activeCurriculum.compression_strategy.toUpperCase()}
              </span>
            </div>

            {/* Curriculum Units Sequence */}
            <div className="space-y-3">
              {activeCurriculum.teaching_trajectory.map((unit, idx) => {
                const concept = activeKnowledge.concepts.find(c => c.concept_id === unit.concept_id);
                const roleTheme = concept ? getRoleTheme(concept.epistemic_role) : getRoleTheme('core_mechanism');

                return (
                  <div
                    key={unit.unit_id}
                    onClick={() => setSelectedConceptId(unit.concept_id)}
                    className={`p-4 rounded-xl border transition cursor-pointer ${
                      selectedConceptId === unit.concept_id
                        ? `${roleTheme.bg} ${roleTheme.border} ring-2 ring-indigo-400/40 shadow-xs`
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{unit.unit_title}</h4>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-semibold">
                          {unit.target_duration_sec}s ({unit.target_word_budget} từ)
                        </span>
                        <span className={`px-2 py-0.5 rounded text-white font-bold ${roleTheme.badge}`}>
                          {unit.bloom_level}
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-600 text-xs leading-relaxed mb-2.5">
                      {unit.epistemic_goal}
                    </p>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/60 font-mono">
                      <span className="text-indigo-700 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Chiến lược: {unit.pedagogical_strategy}
                      </span>
                      {unit.primary_evidence_artifact_id && (
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          Dẫn chứng: {unit.primary_evidence_artifact_id}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pruning Stats Box */}
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                Đã kích hoạt {activeCurriculum.active_concepts_count}/{activeKnowledge.concepts.length} khái niệm cốt lõi.
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                {activeCurriculum.pruned_concepts_count > 0
                  ? `(Tự động lược bỏ ${activeCurriculum.pruned_concepts_count} khái niệm phụ để vừa vặn ${selectedDuration} phút)`
                  : 'Toàn bộ không gian tri thức được bao phủ hoàn chỉnh.'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Selected Concept Deep-Dive & Evidence Artifacts */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs sticky top-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Thực Thể Tri Thức (Concept Detail)
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                {selectedConcept.concept_id}
              </span>
            </div>

            {/* Concept Header */}
            {(() => {
              const theme = getRoleTheme(selectedConcept.epistemic_role);
              return (
                <div className={`p-3.5 rounded-xl border ${theme.bg} ${theme.border} space-y-1.5`}>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${theme.badge}`}>
                      {theme.label}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-700">
                      Độ phức tạp: {Math.round(selectedConcept.cognitive_complexity_score * 100)}%
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{selectedConcept.canonical_name}</h4>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {selectedConcept.formal_definition}
                  </p>
                </div>
              );
            })()}

            {/* Evidence Artifacts Bound to this Concept */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                Dẫn Chứng Thị Giác & Bằng Chứng Thực Nghiệm ({selectedConcept.evidence_artifacts.length}):
              </div>

              {selectedConcept.evidence_artifacts.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-400 italic text-center">
                  Khái niệm này sử dụng trực giác ẩn dụ, không gắn dẫn chứng thị giác tĩnh.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedConcept.evidence_artifacts.map((art) => (
                    <div
                      key={art.artifact_id}
                      className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-900 font-mono text-[11px] flex items-center gap-1">
                          <Eye className="w-3 h-3 text-amber-700" />
                          {art.artifact_id} ({art.modality.toUpperCase()})
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                          {art.role}
                        </span>
                      </div>
                      <p className="text-slate-800 text-[11px] leading-relaxed">
                        {art.semantic_description}
                      </p>
                      {art.spatial_features && Object.keys(art.spatial_features).length > 0 && (
                        <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-amber-200/60">
                          Đặc trưng topo: {JSON.stringify(art.spatial_features)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Atomic Propositions */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Mệnh Đề Sự Thật Bất Biến (Atomic Propositions):
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {selectedConcept.propositions.map((p) => (
                  <div
                    key={p.prop_id}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-800 flex items-start gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                    <span>{p.statement}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Analogies & Misconceptions */}
            {selectedConcept.analogies.length > 0 && (
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200 text-xs space-y-1">
                <span className="text-[10px] font-bold text-purple-800 uppercase font-mono block">
                  Ẩn dụ trực quan:
                </span>
                <p className="text-slate-800 text-[11px]">
                  <strong>{selectedConcept.analogies[0].source_domain}:</strong> {selectedConcept.analogies[0].explanation}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
