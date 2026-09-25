// src/components/pipeline/LessonUnderstandingViewer.tsx
import React, { useState } from 'react';
import { LessonModel, ContentPrioritization, TeachingUnit } from '../../types';
import {
  BrainCircuit,
  Target,
  HelpCircle,
  Network,
  ListFilter,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface LessonUnderstandingViewerProps {
  lessonModel?: LessonModel;
  contentPrioritization?: ContentPrioritization;
  teachingUnits?: TeachingUnit[];
}

export const LessonUnderstandingViewer: React.FC<LessonUnderstandingViewerProps> = ({
  lessonModel,
  contentPrioritization,
  teachingUnits
}) => {
  const [activeTab, setActiveTab] = useState<'concepts' | 'prioritization' | 'arc' | 'needs'>('concepts');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(
    teachingUnits && teachingUnits.length > 0 ? teachingUnits[0].unit_id : null
  );

  if (!lessonModel) {
    return (
      <div className="bg-paper-sheet border border-rule rounded-2xl p-8 text-center text-ink-faint space-y-3 shadow-xs">
        <BrainCircuit className="w-10 h-10 text-rule-strong mx-auto animate-pulse" />
        <p className="text-sm">Chưa có dữ liệu Hiểu Toàn Bộ Bài Giảng (Lesson Understanding). Vui lòng chạy Pipeline để phân tích.</p>
      </div>
    );
  }

  const allPrioritizedItems = [
    ...(contentPrioritization?.core_items || []),
    ...(contentPrioritization?.supporting_items || []),
    ...(contentPrioritization?.example_items || []),
    ...(contentPrioritization?.context_items || []),
    ...(contentPrioritization?.noise_items || [])
  ];

  const filteredItems = selectedCategory === 'all'
    ? allPrioritizedItems
    : allPrioritizedItems.filter((i) => i.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header Banner: Lesson Understanding First */}
      <div className=" bg-cover-deep   text-white p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-print/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-print border border-rule-strong/30 flex items-center justify-center">
              <BrainCircuit className="w-6 h-6 text-cover-foil" />
            </div>
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-cover-foil font-semibold">
                Kiến trúc Semantic Core • M2.1 — M2.9
              </span>
              <h2 className="text-lg font-bold tracking-tight">Hiểu Toàn Diện Bài Giảng (Whole-Lesson Model)</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-print text-print-soft border border-print/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-print animate-pulse"></span>
              <span>Lesson-Understanding-First</span>
            </span>
          </div>
        </div>

        {/* Goal & Problem Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-paper-band border border-rule space-y-1.5">
            <div className="text-navy font-semibold flex items-center gap-1.5">
              <Target className="w-4 h-4 text-print-soft" />
              <span>Mục Tiêu Bài Giảng (Lesson Goal)</span>
            </div>
            <p className="text-ink-faint leading-relaxed font-medium">
              {lessonModel.lesson_goal}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-paper-band border border-rule space-y-1.5">
            <div className="text-pen font-semibold flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-pen" />
              <span>Vấn Đề Trọng Tâm Cần Giải Quyết (Main Problem)</span>
            </div>
            <p className="text-ink-faint leading-relaxed font-medium">
              {lessonModel.main_problem}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-rule text-xs font-semibold gap-2">
        <button
          onClick={() => setActiveTab('concepts')}
          className={`pb-3 px-3 transition flex items-center gap-1.5 border-b-2 ${
            activeTab === 'concepts'
              ? 'border-print text-print'
              : 'border-transparent text-ink-faint hover:text-ink'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Mô Hình Khái Niệm & Mối Quan Hệ ({lessonModel.core_concepts.length + lessonModel.supporting_concepts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('prioritization')}
          className={`pb-3 px-3 transition flex items-center gap-1.5 border-b-2 ${
            activeTab === 'prioritization'
              ? 'border-print text-print'
              : 'border-transparent text-ink-faint hover:text-ink'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>Phân Hạng Nội Dung ({allPrioritizedItems.length} mục • Đã lọc {contentPrioritization?.omitted_content_count || 0} rác)</span>
        </button>

        <button
          onClick={() => setActiveTab('arc')}
          className={`pb-3 px-3 transition flex items-center gap-1.5 border-b-2 ${
            activeTab === 'arc'
              ? 'border-print text-print'
              : 'border-transparent text-ink-faint hover:text-ink'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Tiến Trình & Đơn Vị Giảng Dạy ({teachingUnits?.length || 0} Units)</span>
        </button>

        <button
          onClick={() => setActiveTab('needs')}
          className={`pb-3 px-3 transition flex items-center gap-1.5 border-b-2 ${
            activeTab === 'needs'
              ? 'border-print text-print'
              : 'border-transparent text-ink-faint hover:text-ink'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Nhu Cầu Nhận Thức (Learning Needs)</span>
        </button>
      </div>

      {/* Tab 1: Concepts & Graph Relationships */}
      {activeTab === 'concepts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Core Concepts */}
            <div className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-rule pb-2.5">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cover"></span>
                  <span>Khái Niệm Cốt Lõi (Core Concepts)</span>
                </h3>
                <span className="text-xs font-mono bg-paper-band text-print px-2 py-0.5 rounded font-bold">
                  {lessonModel.core_concepts.length} khái niệm
                </span>
              </div>
              <div className="space-y-3">
                {lessonModel.core_concepts.map((concept) => (
                  <div key={concept.concept_id} className="p-3.5 bg-paper-band rounded-xl border border-rule space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-cover">{concept.name}</span>
                      <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-paper-band text-print">
                        {concept.concept_id}
                      </span>
                    </div>
                    <p className="text-xs text-ink-soft leading-relaxed">{concept.definition}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Supporting Concepts & Relationships */}
            <div className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-rule pb-2.5">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-print"></span>
                  <span>Khái Niệm Bổ Trợ & Mối Quan Hệ (Concept Graph)</span>
                </h3>
                <span className="text-xs font-mono bg-paper-band text-print px-2 py-0.5 rounded font-bold">
                  {lessonModel.concept_relationships.length} liên kết
                </span>
              </div>
              <div className="space-y-3">
                {lessonModel.concept_relationships.map((rel, idx) => (
                  <div key={idx} className="p-3.5 bg-paper-band rounded-xl border border-rule space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 font-mono font-bold text-print">
                      <span>{rel.source_concept_id}</span>
                      <span className="px-2 py-0.5 rounded bg-paper-band border border-rule-strong text-[11px] uppercase tracking-wider text-print">
                        {rel.relationship_type}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>{rel.target_concept_id}</span>
                    </div>
                    <p className="text-ink-soft leading-relaxed">{rel.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Content Prioritization Matrix */}
      {activeTab === 'prioritization' && (
        <div className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
            <div>
              <h3 className="text-sm font-bold text-ink">Ma Trận Phân Hạng Nội Dung (Content Prioritization Matrix)</h3>
              <p className="text-xs text-ink-faint">Phân định rành mạch thông tin cốt lõi cần giảng giải, chi tiết bổ trợ, ví dụ và siêu dữ liệu rác.</p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {['all', 'core', 'supporting', 'example', 'context', 'noise'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition uppercase tracking-wider text-[11px] ${
                    selectedCategory === cat
                      ? 'bg-cover text-white font-bold'
                      : 'bg-paper-band text-ink-soft hover:bg-rule'
                  }`}
                >
                  {cat === 'all' ? 'Tất cả' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-band text-ink-faint font-semibold border-b border-rule">
                <tr>
                  <th className="py-2.5 px-3">Phân loại</th>
                  <th className="py-2.5 px-3">Nội dung trích xuất</th>
                  <th className="py-2.5 px-3">Lý do sư phạm</th>
                  <th className="py-2.5 px-3 text-center">Bắt buộc hiểu</th>
                  <th className="py-2.5 px-3 text-center">Được lược bỏ</th>
                  <th className="py-2.5 px-3 text-right">Ưu tiên thuyết minh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {filteredItems.map((item) => (
                  <tr key={item.content_id} className="hover:bg-paper-band transition">
                    <td className="py-3 px-3 font-mono">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                        item.category === 'core' ? 'bg-paper-band text-print border border-rule-strong' :
                        item.category === 'supporting' ? 'bg-paper-band text-print border border-rule-strong' :
                        item.category === 'example' ? 'bg-paper-band text-print border border-rule-strong' :
                        item.category === 'context' ? 'bg-pen-soft text-pen border border-pen-line' :
                        'bg-pen-soft text-pen border border-pen-line line-through'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-ink max-w-sm">{item.text}</td>
                    <td className="py-3 px-3 text-ink-soft max-w-xs">{item.importance_reason}</td>
                    <td className="py-3 px-3 text-center">
                      {item.required_for_understanding ? (
                        <CheckCircle2 className="w-4 h-4 text-print mx-auto" />
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {item.can_be_omitted ? (
                        <span className="text-pen font-semibold text-xs">Có</span>
                      ) : (
                        <span className="text-ink-faint">Không</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
                        item.narration_priority === 'high' ? 'bg-paper-band text-print' :
                        item.narration_priority === 'medium' ? 'bg-paper-band text-print' :
                        'bg-paper-band text-ink-faint'
                      }`}>
                        {item.narration_priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Teaching Arc & Units */}
      {activeTab === 'arc' && (
        <div className="space-y-4">
          <div className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-ink">Tiến Trình Sư Phạm & Đơn Vị Giảng Dạy (Teaching Units)</h3>
              <p className="text-xs text-ink-faint">
                Xóa bỏ ép buộc 1 slide = 1 đơn vị giảng. Hệ thống ghép các slide liên quan thành một khối logic tự sự liên tục.
              </p>
            </div>

            <div className="space-y-3">
              {(teachingUnits || []).map((unit) => {
                const isExpanded = expandedUnitId === unit.unit_id;
                return (
                  <div
                    key={unit.unit_id}
                    className="border border-rule rounded-xl overflow-hidden transition"
                  >
                    <div
                      onClick={() => setExpandedUnitId(isExpanded ? null : unit.unit_id)}
                      className="p-4 bg-paper-band hover:bg-paper-band cursor-pointer flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-ink-faint" /> : <ChevronRight className="w-4 h-4 text-ink-faint" />}
                        <span className="font-mono font-bold text-print bg-paper-band px-2 py-0.5 rounded border border-rule-strong">
                          {unit.unit_id}
                        </span>
                        <span className="font-bold text-ink text-sm">{unit.title}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider bg-cover text-white">
                          {unit.stage}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-ink-soft">
                        <span>Slides: <strong className="text-print">{unit.slide_ids.join(', ')}</strong></span>
                        <span>•</span>
                        <span>{unit.target_duration_sec}s (~{unit.target_word_budget} từ)</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-paper-sheet border-t border-rule text-xs space-y-3">
                        <div>
                          <span className="font-semibold text-ink-faint block mb-1">Trọng tâm Thuyết minh (Narration Focus):</span>
                          <p className="p-2.5 rounded-lg bg-paper-band border border-rule-strong text-ink leading-relaxed font-medium">
                            {unit.narration_focus}
                          </p>
                        </div>

                        {unit.learning_need && (
                          <div className="p-3 bg-pen-soft rounded-lg border border-pen-line space-y-1">
                            <span className="font-bold text-pen flex items-center gap-1.5">
                              <HelpCircle className="w-3.5 h-3.5" />
                              <span>Nhu Cầu Nhận Thức Thúc Đẩy Chuyển Tiếp:</span>
                            </span>
                            <p className="text-pen italic">
                              "{unit.learning_need.natural_question}"
                            </p>
                          </div>
                        )}

                        {unit.key_talking_points.length > 0 && (
                          <div>
                            <span className="font-semibold text-ink-faint block mb-1">Các ý chính cần làm rõ:</span>
                            <ul className="list-disc pl-5 space-y-1 text-ink-soft">
                              {unit.key_talking_points.map((pt, i) => (
                                <li key={i}>{pt}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Learning Needs */}
      {activeTab === 'needs' && (
        <div className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-ink">Chuỗi Nhu Cầu Nhận Thức (Learning Needs)</h3>
            <p className="text-xs text-ink-faint">
              Chuyển tiếp tự nhiên xuất phát từ câu hỏi phát sinh trong tâm trí người học, thay vì thông báo số trang máy móc.
            </p>
          </div>

          <div className="space-y-3">
            {lessonModel.learning_needs.map((need, idx) => (
              <div key={idx} className="p-4 bg-paper-band rounded-xl border border-rule space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-ink-faint font-medium">Sau khi hiểu: <strong className="text-print">{need.after_concept_id}</strong></span>
                  <span className="text-print font-bold bg-paper-band px-2 py-0.5 rounded border border-rule-strong">
                    Giải quyết bởi: {need.resolved_by_concept_id}
                  </span>
                </div>
                <div className="p-3 bg-paper-sheet rounded-lg border border-rule font-medium text-ink leading-relaxed text-sm">
                  "{need.natural_question}"
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
