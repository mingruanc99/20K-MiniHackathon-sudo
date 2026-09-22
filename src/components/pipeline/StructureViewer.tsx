// src/components/pipeline/StructureViewer.tsx
import React from 'react';
import { CanonicalDocumentTree } from '../../types';
import { Layers, FileCode, CheckCircle2, Clock } from 'lucide-react';

export const StructureViewer: React.FC<{ docTree: CanonicalDocumentTree | null }> = ({ docTree }) => {
  if (!docTree) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Chưa có cấu trúc tài liệu chuẩn hoá. Hãy chạy Module 1 để bóc tách bài giảng.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Meta header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Module 1 — Bộ Bóc Tách Nội Dung</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
              Zero-LLM / Zero-VLM
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">{docTree.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">Tệp nguồn: <span className="font-mono text-slate-700">{docTree.source_filename}</span> ({docTree.source_type.toUpperCase()})</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Đã bóc tách {docTree.total_sections} phân cảnh / slide</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Clock className="w-4 h-4" />
            <span>Độ trễ: {docTree.extraction_time_ms} ms</span>
          </div>
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-4">
        {docTree.sections.map((sec) => (
          <div key={sec.section_id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {sec.section_id}
                </span>
                <h3 className="text-sm font-bold text-slate-800">{sec.title}</h3>
              </div>
              <span className="text-xs text-slate-400">Thứ tự: #{sec.order}</span>
            </div>

            {/* Elements */}
            <div className="space-y-2">
              {sec.elements.map((el) => (
                <div key={el.element_id} className="flex items-start gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase shrink-0 font-medium ${
                    el.type === 'title' ? 'bg-indigo-100 text-indigo-800 font-bold' :
                    el.type === 'bullet_point' ? 'bg-slate-100 text-slate-700' :
                    el.type === 'note' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                    'bg-slate-50 text-slate-600'
                  }`}>
                    {el.type === 'title' ? 'Tiêu đề' : el.type === 'bullet_point' ? 'Ý chính' : el.type === 'note' ? 'Ghi chú' : el.type === 'code' ? 'Mã nguồn' : el.type === 'heading' ? 'Mục' : 'Đoạn văn'}
                  </span>
                  <p className="text-slate-700 leading-relaxed">{el.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
