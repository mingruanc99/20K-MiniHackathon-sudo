// src/components/pipeline/MarkdownViewer.tsx
import React, { useState } from 'react';
import { CanonicalDocumentTree } from '../../types';
import {
  FileCode,
  Copy,
  Check,
  Eye,
  Code2,
  Layers,
  Sparkles,
  Info,
  Tag,
  Image,
  MessageSquare
} from 'lucide-react';

interface MarkdownViewerProps {
  docTree: CanonicalDocumentTree | null;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ docTree }) => {
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [copied, setCopied] = useState(false);

  if (!docTree) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
        <FileCode className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Chưa có dữ liệu Markdown chuẩn hoá. Hãy tải lên tệp bài giảng.</p>
      </div>
    );
  }

  // Generate fallback markdown if not already stored
  const generateMarkdownFallback = (): string => {
    const lines: string[] = [];
    lines.push(`# ${docTree.title}`);
    lines.push('');
    lines.push(`> [DOCUMENT_METADATA: id=${docTree.document_id}, type=${docTree.source_type}, total_sections=${docTree.total_sections}]`);
    lines.push('');

    docTree.sections.forEach((sec) => {
      lines.push(`## Slide ${sec.order}: ${sec.title}`);
      lines.push(`> [SOURCE: doc=${docTree.document_id}, slide=${sec.order}, section_id=${sec.section_id}, type=${docTree.source_type}]`);
      lines.push('');

      const notes: string[] = [];
      sec.elements.forEach((el) => {
        if (el.source_type === 'diagram_annotation' || el.type === 'annotation') {
          // Do NOT display diagram annotations as standalone text paragraphs
          return;
        }
        if (el.type === 'diagram') {
          lines.push(`[VISUAL: ${el.role || 'conceptual_diagram'}]`);
          lines.push(`type: diagram`);
          lines.push(`subtype: ${el.subtype || 'unknown'}`);
          lines.push(`role: ${el.role || 'conceptual_diagram'}`);
          lines.push('');
          lines.push(`![${el.caption || 'Human pose skeleton'}](assets/slide_${sec.order}_diagram_01.png)`);
          if (el.description) {
            lines.push('');
            lines.push(`**Visual description:**`);
            lines.push(el.description);
          }
          if (el.structured_diagram && el.structured_diagram.node_count > 0) {
            lines.push('');
            lines.push(`**Diagram Structure:** ${el.structured_diagram.node_count} nodes, ${el.structured_diagram.edge_count} connections`);
          }
          lines.push('');
        } else if (el.type === 'bullet_point') {
          const indent = '  '.repeat(Math.max(0, (el.level || 1) - 1));
          lines.push(`${indent}- ${el.text}`);
        } else if (el.type === 'paragraph') {
          lines.push(el.text);
          lines.push('');
        } else if (el.type === 'table') {
          lines.push('| Cột 1 | Cột 2 | Cột 3 |');
          lines.push('| --- | --- | --- |');
          lines.push(`| ${el.text.replace(/\n/g, ' | ')} |`);
          lines.push('');
        } else if (el.type === 'note') {
          notes.push(el.text);
        }
      });

      if (notes.length > 0) {
        notes.forEach((n) => lines.push(`> [SPEAKER_NOTE: ${n}]`));
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  };

  const markdownContent = docTree.canonical_markdown || generateMarkdownFallback();
  const lineCount = markdownContent.split('\n').length;
  const sourceDirectivesCount = (markdownContent.match(/\[SOURCE:/g) || []).length;
  const visualDirectivesCount = (markdownContent.match(/\[VISUAL_ROLE:/g) || []).length;
  const noteDirectivesCount = (markdownContent.match(/\[SPEAKER_NOTE:/g) || []).length;

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Banner Giải thích CIR */}
      <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-white border border-indigo-100 rounded-xl p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-lg shrink-0 mt-0.5 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Tầng Trung Gian: Structured Markdown (Canonical IR)
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200">
                Bridge Layer: Raw File ──► Markdown CIR ──► Chunks
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Đây là biểu diễn trung gian chuẩn tắc đứng <strong>ngay giữa tệp gốc và cấu trúc bài giảng</strong>.
              Nội dung từ tệp thô (PPTX / PDF / DOCX) được chuẩn hóa thành Markdown có cấu trúc, gắn kèm chỉ thị nguồn
              <code className="text-indigo-700 bg-white px-1.5 py-0.5 mx-1 rounded border border-indigo-200">[SOURCE]</code>,
              vai trò thị giác <code className="text-indigo-700 bg-white px-1.5 py-0.5 mx-1 rounded border border-indigo-200">[VISUAL_ROLE]</code>
              và ghi chú bài giảng <code className="text-indigo-700 bg-white px-1.5 py-0.5 mx-1 rounded border border-indigo-200">[SPEAKER_NOTE]</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Control Bar & Stats */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Stats */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
            <FileCode className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold">{lineCount}</span> dòng Markdown
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-medium">
            <Tag className="w-3.5 h-3.5" />
            <span>{sourceDirectivesCount} thẻ [SOURCE]</span>
          </div>
          {visualDirectivesCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 font-medium">
              <Image className="w-3.5 h-3.5" />
              <span>{visualDirectivesCount} thẻ [VISUAL_ROLE]</span>
            </div>
          )}
          {noteDirectivesCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-medium">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{noteDirectivesCount} thẻ [SPEAKER_NOTE]</span>
            </div>
          )}
        </div>

        {/* View mode toggle & Copy button */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
            <button
              onClick={() => setViewMode('rendered')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                viewMode === 'rendered'
                  ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem Trực Quan</span>
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                viewMode === 'raw'
                  ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Mã Nguồn Markdown</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-xs active:scale-95"
            title="Sao chép toàn bộ Markdown"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Đã chép!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Sao chép</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Display */}
      {viewMode === 'raw' ? (
        <div className="bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-800 shadow-md font-mono text-xs overflow-x-auto leading-relaxed">
          <pre className="whitespace-pre-wrap">{markdownContent}</pre>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          {markdownContent.split('---').map((block, idx) => {
            const trimmed = block.trim();
            if (!trimmed) return null;

            return (
              <div
                key={idx}
                className="p-5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50/80 transition space-y-3"
              >
                {trimmed.split('\n').map((line, lIdx) => {
                  const lineTrimmed = line.trim();

                  // Heading 1
                  if (lineTrimmed.startsWith('# ')) {
                    return (
                      <h1 key={lIdx} className="text-lg font-black text-slate-900 border-b border-slate-200 pb-2">
                        {lineTrimmed.replace(/^#\s*/, '')}
                      </h1>
                    );
                  }

                  // Heading 2 (Slide title)
                  if (lineTrimmed.startsWith('## ')) {
                    return (
                      <h2 key={lIdx} className="text-sm font-bold text-indigo-700 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        <span>{lineTrimmed.replace(/^##\s*/, '')}</span>
                      </h2>
                    );
                  }

                  // Source Directive Card
                  if (lineTrimmed.startsWith('> [SOURCE:')) {
                    return (
                      <div key={lIdx} className="px-3 py-1.5 rounded-lg bg-indigo-50/80 border border-indigo-200 text-[11px] font-mono text-indigo-900 flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{lineTrimmed.replace(/^>\s*/, '')}</span>
                      </div>
                    );
                  }

                  // Visual Role Directive Card
                  if (lineTrimmed.startsWith('> [VISUAL_ROLE:')) {
                    return (
                      <div key={lIdx} className="px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-[11px] font-mono text-sky-900 flex items-center gap-2">
                        <Image className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>{lineTrimmed.replace(/^>\s*/, '')}</span>
                      </div>
                    );
                  }

                  // Speaker Note Directive Card
                  if (lineTrimmed.startsWith('> [SPEAKER_NOTE:')) {
                    return (
                      <div key={lIdx} className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span className="italic">{lineTrimmed.replace(/^>\s*\[SPEAKER_NOTE:\s*/, '').replace(/\]$/, '')}</span>
                      </div>
                    );
                  }

                  // General Document Directive Card
                  if (lineTrimmed.startsWith('> [')) {
                    return (
                      <div key={lIdx} className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700 flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{lineTrimmed.replace(/^>\s*/, '')}</span>
                      </div>
                    );
                  }

                  // Bullets
                  if (lineTrimmed.startsWith('- ')) {
                    return (
                      <li key={lIdx} className="text-xs text-slate-700 list-disc ml-5 leading-relaxed">
                        {lineTrimmed.replace(/^- \s*/, '')}
                      </li>
                    );
                  }

                  // Image markdown
                  if (lineTrimmed.startsWith('![')) {
                    const match = lineTrimmed.match(/!\[(.*?)\]\((.*?)\)/);
                    return (
                      <div key={lIdx} className="p-3 bg-white rounded-lg border border-slate-200 flex items-center gap-3">
                        <Image className="w-5 h-5 text-indigo-500 shrink-0" />
                        <div className="text-xs">
                          <span className="font-semibold text-slate-800">{match ? match[1] : 'Hình ảnh'}</span>
                          <span className="text-[11px] font-mono text-slate-400 ml-2">({match ? match[2] : ''})</span>
                        </div>
                      </div>
                    );
                  }

                  // Tables
                  if (lineTrimmed.startsWith('|')) {
                    if (lineTrimmed.includes('---')) return null; // skip markdown divider
                    const cells = lineTrimmed.split('|').filter(c => c.trim().length > 0);
                    return (
                      <div key={lIdx} className="grid grid-cols-4 gap-2 p-2 bg-white rounded border border-slate-200 text-xs">
                        {cells.map((cell, cIdx) => (
                          <span key={cIdx} className="text-slate-800 font-medium">{cell.trim()}</span>
                        ))}
                      </div>
                    );
                  }

                  // Normal paragraph
                  if (lineTrimmed.length > 0) {
                    return (
                      <p key={lIdx} className="text-xs text-slate-800 leading-relaxed">
                        {lineTrimmed}
                      </p>
                    );
                  }

                  return null;
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
