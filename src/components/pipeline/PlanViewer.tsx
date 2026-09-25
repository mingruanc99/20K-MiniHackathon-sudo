// src/components/pipeline/PlanViewer.tsx
import React, { useState } from 'react';
import { LessonBlueprint, SectionPlan } from '../../types';
import { Compass, Clock, BookOpen, Target, Sparkles, GitCommit, ArrowRight, Layers, Lightbulb, ShieldAlert } from 'lucide-react';

export const PlanViewer: React.FC<{ blueprint: LessonBlueprint | null }> = ({ blueprint }) => {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  if (!blueprint) {
    return (
      <div className="p-8 text-center bg-paper-sheet rounded-xl border border-rule">
        <Compass className="w-8 h-8 text-ink-faint mx-auto mb-2" />
        <p className="text-sm text-ink-faint">Chưa có bản kế hoạch sư phạm. Hãy chạy Module 2 để lập chiến lược bài giảng.</p>
      </div>
    );
  }

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const activeSection = blueprint.sections.find((s) => s.section_id === selectedSectionId) || blueprint.sections[0];

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="bg-paper-sheet border border-rule rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-rule">
          <div>
            <span className="text-xs font-semibold text-print uppercase tracking-wider">Module 2 — Kế Hoạch Bài Giảng Sư Phạm & Chuỗi Tự Sự</span>
            <h2 className="text-lg font-bold text-ink">{blueprint.lecture_title}</h2>
            <p className="text-xs text-ink-faint mt-0.5">{blueprint.pedagogical_strategy}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-3 py-1.5 rounded-lg bg-paper-band border border-rule">
              <div className="text-xs text-ink-faint">Thời lượng mục tiêu</div>
              <div className="text-sm font-bold text-ink">{formatSeconds(blueprint.total_target_duration_sec)} ({blueprint.total_target_duration_sec}s)</div>
            </div>
            <div className="text-center px-3 py-1.5 rounded-lg bg-paper-band border border-rule">
              <div className="text-xs text-ink-faint">Tốc độ đọc WPM</div>
              <div className="text-sm font-bold text-ink">{blueprint.target_wpm} WPM</div>
            </div>
            <div className="text-center px-3 py-1.5 rounded-lg bg-paper-band border border-rule-strong text-cover">
              <div className="text-xs text-print font-medium">Ngân sách từ (W_target)</div>
              <div className="text-sm font-bold">{blueprint.total_word_budget} từ</div>
            </div>
          </div>
        </div>

        {/* Section Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper-band text-ink-faint font-semibold border-b border-rule">
              <tr>
                <th className="py-2.5 px-3">Mã</th>
                <th className="py-2.5 px-3">Chủ đề phân cảnh</th>
                <th className="py-2.5 px-3">Vai trò Slide (Role)</th>
                <th className="py-2.5 px-3">Mục tiêu sư phạm</th>
                <th className="py-2.5 px-3">Chức năng tự sự</th>
                <th className="py-2.5 px-3">Chiến lược danh sách</th>
                <th className="py-2.5 px-3 text-right">Thời lượng</th>
                <th className="py-2.5 px-3 text-right">Số từ</th>
                <th className="py-2.5 px-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {blueprint.sections.map((sec) => {
                const isSelected = activeSection?.section_id === sec.section_id;
                const role = sec.slide_analysis?.slide_role || sec.pedagogical_function;
                const narrativeFunc = sec.narrative_plan?.narrative_function || 'EXPLAIN';
                const listStrat = sec.narrative_plan?.list_strategy || sec.slide_analysis?.list_strategy || 'NONE';

                return (
                  <tr
                    key={sec.section_id}
                    onClick={() => setSelectedSectionId(sec.section_id)}
                    className={`cursor-pointer transition ${
                      isSelected ? 'bg-paper-band font-medium' : 'hover:bg-paper-band'
                    }`}
                  >
                    <td className="py-3 px-3 font-mono font-bold text-print">{sec.section_id}</td>
                    <td className="py-3 px-3 font-semibold text-ink">{sec.title}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                        role === 'INTRODUCTION' ? 'bg-paper-band text-print border border-rule-strong' :
                        role === 'HOOK' ? 'bg-paper-band text-print border border-rule-strong' :
                        role === 'CORE_CONCEPT' ? 'bg-paper-band text-print border border-rule-strong' :
                        role === 'EXAMPLE' ? 'bg-paper-band text-print border border-rule-strong' :
                        role === 'PROCESS' ? 'bg-paper-band text-print border border-rule-strong' :
                        role === 'APPLICATION' ? 'bg-paper-band text-print border border-rule-strong' :
                        role === 'COMPARISON' ? 'bg-pen-soft text-pen border border-pen-line' :
                        role === 'SUMMARY' ? 'bg-paper-band text-print border border-rule-strong' :
                        role === 'DECORATIVE' ? 'bg-paper-band text-ink-faint' :
                        'bg-paper-band text-ink-soft'
                      }`}>
                        {role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-ink-soft max-w-xs truncate">{sec.instructional_goal}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-paper-band text-ink-soft border border-rule">
                        {narrativeFunc}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                        listStrat === 'NONE' ? 'text-ink-faint bg-paper-band' : 'text-pen bg-pen-soft font-bold border border-pen-line'
                      }`}>
                        {listStrat}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-ink-soft">{formatSeconds(sec.target_duration_sec)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-print">{sec.target_word_budget}</td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSectionId(sec.section_id);
                        }}
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          isSelected ? 'bg-cover text-white' : 'bg-paper-band text-ink-soft hover:bg-rule'
                        }`}
                      >
                        {isSelected ? 'Đang chọn' : 'Xem chi tiết'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 27: Narrative Strategy Inspector Card */}
      {activeSection && (
        <div className=" bg-paper-band via-white  border border-rule-strong rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-strong pb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-cover text-white">
                {activeSection.section_id}
              </span>
              <div>
                <h3 className="text-base font-bold text-ink">{activeSection.title}</h3>
                <p className="text-xs text-ink-faint">Thanh tra Chiến lược Tự sự & Mạch liên kết phân cảnh (Context-Aware Narrative Inspector)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-print bg-paper-band px-3 py-1 rounded-full border border-rule-strong font-semibold">
                Bloom: {activeSection.bloom_level}
              </span>
            </div>
          </div>

          {/* One Slide = One Core Message & Filtered Metadata Card */}
          <div className="p-4 bg-paper-sheet rounded-xl border border-rule-strong shadow-2xs space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-ink flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-print animate-pulse"></span>
                <span>Thông điệp Cốt lõi (Core Message — 1 Slide = 1 Core Message)</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-paper-band text-print border border-rule-strong">
                Verbosity: {activeSection.narrative_plan?.verbosity || 'concise'}
              </span>
            </div>
            <div className="p-3 bg-paper-band rounded-lg border border-rule-strong font-medium text-ink leading-relaxed">
              "{activeSection.slide_analysis?.core_message || activeSection.instructional_goal || 'Thông điệp chính của phân cảnh.'}"
            </div>

            {/* Excluded Content Badges */}
            {activeSection.slide_analysis?.excluded_content && activeSection.slide_analysis.excluded_content.length > 0 && (
              <div className="pt-2 border-t border-rule flex flex-wrap items-center gap-2">
                <span className="text-ink-faint font-medium text-xs">Siêu dữ liệu đã loại bỏ (Excluded Metadata):</span>
                {activeSection.slide_analysis.excluded_content.map((item, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-pen-soft text-pen border border-pen-line font-mono text-[11px] line-through">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 7 Core Inspector Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {/* Field 1: Role */}
            <div className="p-3.5 bg-paper-sheet rounded-xl border border-rule shadow-2xs space-y-1">
              <div className="text-ink-faint font-medium">Slide Role (Vai trò Slide)</div>
              <div className="text-sm font-bold text-print">
                {activeSection.slide_analysis?.slide_role || activeSection.pedagogical_function}
              </div>
              <div className="text-xs text-ink-faint">
                Content Type: <span className="font-mono">{activeSection.slide_analysis?.content_type || 'concept'}</span>
              </div>
            </div>

            {/* Field 2: Importance & Instructional Value */}
            <div className="p-3.5 bg-paper-sheet rounded-xl border border-rule shadow-2xs space-y-1">
              <div className="text-ink-faint font-medium">Tầm quan trọng & Giá trị sư phạm</div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded font-bold text-xs bg-pen-soft text-pen border border-pen-line uppercase">
                  Importance: {activeSection.slide_analysis?.importance || activeSection.importance || 'medium'}
                </span>
              </div>
              <div className="text-xs text-ink-faint">
                Instructional Value: <span className="font-semibold text-ink-soft">{activeSection.slide_analysis?.instructional_value || 'high'}</span>
              </div>
            </div>

            {/* Field 3: Narrative Function */}
            <div className="p-3.5 bg-paper-sheet rounded-xl border border-rule shadow-2xs space-y-1">
              <div className="text-ink-faint font-medium">Narrative Function (Chức năng)</div>
              <div className="text-sm font-bold text-print font-mono">
                {activeSection.narrative_plan?.narrative_function || 'EXPLAIN'}
              </div>
              <div className="text-xs text-ink-faint">
                Cần diễn giải: {activeSection.slide_analysis?.requires_explanation !== false ? 'Có' : 'Không (Minimal)'}
              </div>
            </div>

            {/* Field 4: List Strategy */}
            <div className="p-3.5 bg-paper-sheet rounded-xl border border-rule shadow-2xs space-y-1">
              <div className="text-ink-faint font-medium">Chiến lược danh sách (List Strategy)</div>
              <div className="text-sm font-bold text-ink font-mono">
                {activeSection.narrative_plan?.list_strategy || activeSection.slide_analysis?.list_strategy || 'NONE'}
              </div>
              <div className="text-xs text-ink-faint">
                {activeSection.narrative_plan?.list_strategy === 'NONE'
                  ? 'Diễn giải quan hệ liên tục, không đánh số máy móc'
                  : 'Sử dụng liệt kê tuần tự do nội dung là phân loại chuẩn'}
              </div>
            </div>
          </div>

          {/* Relationships to Previous & Next Slide */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Previous Relationship */}
            <div className="p-4 bg-paper-sheet rounded-xl border border-rule shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink-soft flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-print rotate-180" />
                  <span>Liên kết với Slide Trước (Previous Relationship)</span>
                </span>
                <span className="font-mono font-bold text-print px-2 py-0.5 bg-paper-band rounded border border-rule-strong">
                  {activeSection.narrative_plan?.relationship_to_previous?.type || 'CONTINUES'}
                </span>
              </div>
              <p className="text-ink-soft leading-relaxed bg-paper-band p-2.5 rounded border border-rule">
                {activeSection.narrative_plan?.relationship_to_previous?.reason ||
                  'Nối tiếp tiến trình sư phạm liên tục từ chủ đề phân cảnh trước.'}
              </p>
            </div>

            {/* Next Relationship */}
            <div className="p-4 bg-paper-sheet rounded-xl border border-rule shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink-soft flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-print" />
                  <span>Liên kết với Slide Tiếp (Next Relationship)</span>
                </span>
                <span className="font-mono font-bold text-print px-2 py-0.5 bg-paper-band rounded border border-rule-strong">
                  {activeSection.narrative_plan?.relationship_to_next?.type || 'CONTINUES'}
                </span>
              </div>
              <p className="text-ink-soft leading-relaxed bg-paper-band p-2.5 rounded border border-rule">
                {activeSection.narrative_plan?.relationship_to_next?.reason ||
                  'Chuẩn bị mạch dẫn cho phân cảnh kiến thức tiếp theo.'}
              </p>
            </div>
          </div>

          {/* Narration Strategy */}
          <div className="p-4 bg-paper-sheet rounded-xl border border-rule shadow-2xs space-y-2 text-xs">
            <div className="font-bold text-ink-soft flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-print" />
              <span>Chiến lược Diễn giải & Cấu trúc Tự sự (Narration Strategy)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-2.5 bg-paper-band rounded border border-rule">
                <span className="text-ink-faint font-medium block">Mở đầu (Opening):</span>
                <span className="font-mono font-bold text-print">
                  {activeSection.narrative_plan?.opening_strategy || 'DIRECT'}
                </span>
              </div>
              <div className="p-2.5 bg-paper-band rounded border border-rule">
                <span className="text-ink-faint font-medium block">Thân bài (Body):</span>
                <span className="font-mono font-bold text-print">
                  {activeSection.narrative_plan?.body_strategy || 'CONCEPTUAL'}
                </span>
              </div>
              <div className="p-2.5 bg-paper-band rounded border border-rule">
                <span className="text-ink-faint font-medium block">Kết thúc (Closing):</span>
                <span className="font-mono font-bold text-print">
                  {activeSection.narrative_plan?.closing_strategy || 'CONCEPT_RECAP'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
