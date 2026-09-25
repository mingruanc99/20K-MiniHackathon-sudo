// src/components/pipeline/StructureViewer.tsx
import React, { useState } from 'react';
import { CanonicalDocumentTree } from '../../types';
import { Layers, FileCode, CheckCircle2, Clock, Database, Sparkles, SlidersHorizontal } from 'lucide-react';
import { RelationalDatabaseViewer } from './RelationalDatabaseViewer';

export const StructureViewer: React.FC<{ docTree: CanonicalDocumentTree | null; initialTab?: 'tree' | 'database' }> = ({
  docTree,
  initialTab = 'database'
}) => {
  const [activeTab, setActiveTab] = useState<'tree' | 'database'>(initialTab);

  if (!docTree) {
    return (
      <div className="space-y-6">
        {/* Even without docTree, allow inspecting the persistent relational database */}
        <div className="bg-paper-sheet border border-rule rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-print" />
            <span className="text-sm font-bold text-ink">
              Kiểm Tra Trực Tiếp Cơ Sở Dữ Liệu Quan Hệ Đa Phương Thức
            </span>
          </div>
          <span className="text-xs text-ink-faint font-mono">SQLite / Memory Store</span>
        </div>
        <RelationalDatabaseViewer />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Meta header & View Switcher */}
      <div className="bg-paper-sheet border border-rule rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-print uppercase tracking-wider">Module 1 — Bộ Bóc Tách Nội Dung</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-paper-band text-print font-bold border border-rule-strong">
              Zero-LLM / Multimodal IR
            </span>
          </div>
          <h2 className="text-lg font-bold text-ink">{docTree.title}</h2>
          <p className="text-xs text-ink-faint mt-0.5">Tệp nguồn: <span className="font-mono text-ink-soft">{docTree.source_filename}</span> ({docTree.source_type.toUpperCase()})</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-band border border-rule">
            <Layers className="w-4 h-4 text-ink-faint" />
            <span>{docTree.total_sections} phân cảnh / slide</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-band text-print border border-rule-strong">
            <Clock className="w-4 h-4" />
            <span>{docTree.extraction_time_ms} ms</span>
          </div>
        </div>
      </div>

      {/* Primary Tab Navigation within Structure */}
      <div className="flex items-center justify-between bg-paper-band p-1.5 rounded-2xl border border-rule">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('database')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'database'
                ? 'bg-paper-sheet text-print shadow-xs border border-rule'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Database className="w-4 h-4 text-print" />
            <span>Database Quan Hệ Đa Phương Thức (Ảnh • Biểu Đồ • Nội Dung • Chú Thích)</span>
            <span className="px-1.5 py-0.5 rounded bg-paper-band text-print text-[11px] font-mono font-bold">
              M1-DB
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tree')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'tree'
                ? 'bg-paper-sheet text-print shadow-xs border border-rule'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Layers className="w-4 h-4 text-ink-faint" />
            <span>Cây Phân Cấp Bài Giảng (Document Tree)</span>
          </button>
        </div>

        <span className="text-xs text-ink-faint hidden md:inline font-mono px-3">
          Kiểm định thực thể quan hệ & bố cục không gian
        </span>
      </div>

      {/* Render Active View */}
      {activeTab === 'database' ? (
        <RelationalDatabaseViewer />
      ) : (
        <div className="space-y-4">
          {docTree.sections.map((sec) => (
            <div key={sec.section_id} className="bg-paper-sheet border border-rule rounded-xl p-5 shadow-xs hover:border-rule-strong transition">
              <div className="flex items-center justify-between mb-3 border-b border-rule pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-paper-band text-print border border-rule-strong">
                    {sec.section_id}
                  </span>
                  <h3 className="text-sm font-bold text-ink">{sec.title}</h3>
                </div>
                <span className="text-xs text-ink-faint font-mono">Thứ tự: #{sec.order}</span>
              </div>

              {/* Elements */}
              <div className="space-y-2">
                {sec.elements.map((el) => (
                  <div key={el.element_id} className="flex items-start gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono uppercase shrink-0 font-medium ${
                      el.type === 'title' ? 'bg-paper-band text-print font-bold' :
                      el.type === 'bullet_point' ? 'bg-paper-band text-ink-soft' :
                      el.type === 'note' ? 'bg-pen-soft text-pen border border-pen-line' :
                      'bg-paper-band text-ink-soft'
                    }`}>
                      {el.type === 'title' ? 'Tiêu đề' : el.type === 'bullet_point' ? 'Ý chính' : el.type === 'note' ? 'Ghi chú' : el.type === 'code' ? 'Mã nguồn' : el.type === 'heading' ? 'Mục' : 'Đoạn văn'}
                    </span>
                    <p className="text-ink-soft leading-relaxed">{el.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
