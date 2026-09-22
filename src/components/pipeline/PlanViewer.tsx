// src/components/pipeline/PlanViewer.tsx
import React, { useState } from 'react';
import { LessonBlueprint, SectionPlan } from '../../types';
import { Compass, Clock, BookOpen, Target, Sparkles, GitCommit, ArrowRight, Layers, Lightbulb, ShieldAlert } from 'lucide-react';

export const PlanViewer: React.FC<{ blueprint: LessonBlueprint | null }> = ({ blueprint }) => {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  if (!blueprint) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <Compass className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Chưa có bản kế hoạch sư phạm. Hãy chạy Module 2 để lập chiến lược bài giảng.</p>
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
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
          <div>
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Module 2 — Kế Hoạch Bài Giảng Sư Phạm & Chuỗi Tự Sự</span>
            <h2 className="text-lg font-bold text-slate-900">{blueprint.lecture_title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{blueprint.pedagogical_strategy}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Thời lượng mục tiêu</div>
              <div className="text-sm font-bold text-slate-900">{formatSeconds(blueprint.total_target_duration_sec)} ({blueprint.total_target_duration_sec}s)</div>
            </div>
            <div className="text-center px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Tốc độ đọc WPM</div>
              <div className="text-sm font-bold text-slate-900">{blueprint.target_wpm} WPM</div>
            </div>
            <div className="text-center px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900">
              <div className="text-xs text-indigo-600 font-medium">Ngân sách từ (W_target)</div>
              <div className="text-sm font-bold">{blueprint.total_word_budget} từ</div>
            </div>
          </div>
        </div>

        {/* Section Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
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
            <tbody className="divide-y divide-slate-100">
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
                      isSelected ? 'bg-indigo-50/70 font-medium' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 px-3 font-mono font-bold text-indigo-700">{sec.section_id}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{sec.title}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                        role === 'INTRODUCTION' ? 'bg-sky-100 text-sky-800 border border-sky-200' :
                        role === 'HOOK' ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200' :
                        role === 'CORE_CONCEPT' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                        role === 'EXAMPLE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        role === 'PROCESS' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        role === 'APPLICATION' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        role === 'COMPARISON' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        role === 'SUMMARY' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                        role === 'DECORATIVE' ? 'bg-slate-100 text-slate-500' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 max-w-xs truncate">{sec.instructional_goal}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {narrativeFunc}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        listStrat === 'NONE' ? 'text-slate-500 bg-slate-50' : 'text-amber-700 bg-amber-50 font-bold border border-amber-200'
                      }`}>
                        {listStrat}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">{formatSeconds(sec.target_duration_sec)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-indigo-600">{sec.target_word_budget}</td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSectionId(sec.section_id);
                        }}
                        className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
        <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border border-indigo-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-indigo-600 text-white">
                {activeSection.section_id}
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">{activeSection.title}</h3>
                <p className="text-xs text-slate-500">Thanh tra Chiến lược Tự sự & Mạch liên kết phân cảnh (Context-Aware Narrative Inspector)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 font-semibold">
                Bloom: {activeSection.bloom_level}
              </span>
            </div>
          </div>

          {/* One Slide = One Core Message & Filtered Metadata Card */}
          <div className="p-4 bg-white rounded-xl border border-indigo-200 shadow-2xs space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Thông điệp Cốt lõi (Core Message — 1 Slide = 1 Core Message)</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Verbosity: {activeSection.narrative_plan?.verbosity || 'concise'}
              </span>
            </div>
            <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100 font-medium text-slate-800 leading-relaxed">
              "{activeSection.slide_analysis?.core_message || activeSection.instructional_goal || 'Thông điệp chính của phân cảnh.'}"
            </div>

            {/* Excluded Content Badges */}
            {activeSection.slide_analysis?.excluded_content && activeSection.slide_analysis.excluded_content.length > 0 && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <span className="text-slate-500 font-medium text-[11px]">Siêu dữ liệu đã loại bỏ (Excluded Metadata):</span>
                {activeSection.slide_analysis.excluded_content.map((item, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono text-[10px] line-through">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 7 Core Inspector Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {/* Field 1: Role */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-slate-400 font-medium">Slide Role (Vai trò Slide)</div>
              <div className="text-sm font-bold text-indigo-700">
                {activeSection.slide_analysis?.slide_role || activeSection.pedagogical_function}
              </div>
              <div className="text-[11px] text-slate-500">
                Content Type: <span className="font-mono">{activeSection.slide_analysis?.content_type || 'concept'}</span>
              </div>
            </div>

            {/* Field 2: Importance & Instructional Value */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-slate-400 font-medium">Tầm quan trọng & Giá trị sư phạm</div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                  Importance: {activeSection.slide_analysis?.importance || activeSection.importance || 'medium'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Instructional Value: <span className="font-semibold text-slate-700">{activeSection.slide_analysis?.instructional_value || 'high'}</span>
              </div>
            </div>

            {/* Field 3: Narrative Function */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-slate-400 font-medium">Narrative Function (Chức năng)</div>
              <div className="text-sm font-bold text-emerald-700 font-mono">
                {activeSection.narrative_plan?.narrative_function || 'EXPLAIN'}
              </div>
              <div className="text-[11px] text-slate-500">
                Cần diễn giải: {activeSection.slide_analysis?.requires_explanation !== false ? 'Có' : 'Không (Minimal)'}
              </div>
            </div>

            {/* Field 4: List Strategy */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-slate-400 font-medium">Chiến lược danh sách (List Strategy)</div>
              <div className="text-sm font-bold text-slate-800 font-mono">
                {activeSection.narrative_plan?.list_strategy || activeSection.slide_analysis?.list_strategy || 'NONE'}
              </div>
              <div className="text-[11px] text-slate-500">
                {activeSection.narrative_plan?.list_strategy === 'NONE'
                  ? 'Diễn giải quan hệ liên tục, không đánh số máy móc'
                  : 'Sử dụng liệt kê tuần tự do nội dung là phân loại chuẩn'}
              </div>
            </div>
          </div>

          {/* Relationships to Previous & Next Slide */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Previous Relationship */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-600 rotate-180" />
                  <span>Liên kết với Slide Trước (Previous Relationship)</span>
                </span>
                <span className="font-mono font-bold text-indigo-700 px-2 py-0.5 bg-indigo-50 rounded border border-indigo-200">
                  {activeSection.narrative_plan?.relationship_to_previous?.type || 'CONTINUES'}
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                {activeSection.narrative_plan?.relationship_to_previous?.reason ||
                  'Nối tiếp tiến trình sư phạm liên tục từ chủ đề phân cảnh trước.'}
              </p>
            </div>

            {/* Next Relationship */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Liên kết với Slide Tiếp (Next Relationship)</span>
                </span>
                <span className="font-mono font-bold text-indigo-700 px-2 py-0.5 bg-indigo-50 rounded border border-indigo-200">
                  {activeSection.narrative_plan?.relationship_to_next?.type || 'CONTINUES'}
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                {activeSection.narrative_plan?.relationship_to_next?.reason ||
                  'Chuẩn bị mạch dẫn cho phân cảnh kiến thức tiếp theo.'}
              </p>
            </div>
          </div>

          {/* Narration Strategy */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
            <div className="font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Chiến lược Diễn giải & Cấu trúc Tự sự (Narration Strategy)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-slate-500 font-medium block">Mở đầu (Opening):</span>
                <span className="font-mono font-bold text-indigo-700">
                  {activeSection.narrative_plan?.opening_strategy || 'DIRECT'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-slate-500 font-medium block">Thân bài (Body):</span>
                <span className="font-mono font-bold text-indigo-700">
                  {activeSection.narrative_plan?.body_strategy || 'CONCEPTUAL'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-slate-500 font-medium block">Kết thúc (Closing):</span>
                <span className="font-mono font-bold text-indigo-700">
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
