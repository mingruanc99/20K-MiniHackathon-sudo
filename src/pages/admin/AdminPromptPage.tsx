// src/pages/admin/AdminPromptPage.tsx
import React, { useState } from 'react';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import { PromptMetadata } from '../../types';
import {
  Sliders,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  ExternalLink,
  Flame,
  ArrowUpRight,
  GitBranch,
  FileCode,
  Copy,
  Check
} from 'lucide-react';

export const AdminPromptPage: React.FC = () => {
  const prompts = adminTelemetryService.getPromptsData();
  const [selectedPrompt, setSelectedPrompt] = useState<PromptMetadata | null>(prompts[0] ?? null);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-print" />
            <span>Prompt Studio & Version Registry</span>
          </h1>
          <p className="text-xs text-ink-faint mt-1">
            Quản lý vòng đời prompt, theo dõi phiên bản sản xuất (Production) so với Staging, gắn kết trực tiếp với Langfuse Prompts.
          </p>
        </div>

        <a
          href={adminTelemetryService.getLangfusePromptUrl('section_generator')}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-cover hover:bg-cover text-white text-xs font-semibold rounded-xl transition shadow-xs self-start sm:self-auto"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Langfuse Prompt CMS</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Prompts Catalog & Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Prompts List */}
        <div className="bg-paper-sheet rounded-2xl border border-rule shadow-xs p-4 space-y-3">
          <div className="px-2 py-1 text-xs font-bold text-ink uppercase tracking-wider">
            System Prompts ({prompts.length})
          </div>

          <div className="space-y-2">
            {prompts.length === 0 && (
              <div className="p-4 text-center text-xs text-ink-faint bg-paper-band rounded-xl border border-dashed border-rule">
                Chưa có dữ liệu — chưa ghi nhận lượt gọi LLM nào
              </div>
            )}
            {prompts.map((p) => {
              const isSelected = selectedPrompt?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPrompt(p)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer text-xs space-y-1.5 ${
                    isSelected
                      ? 'bg-paper-band border-rule-strong shadow-xs'
                      : 'bg-paper-sheet hover:bg-paper-band border-rule'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-ink">{p.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[11px] font-bold uppercase bg-paper-band text-print">
                      {p.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-ink-faint font-mono">
                    <span>{p.version}</span>
                    <span className="text-print font-bold">{p.qualityScore > 0 ? `${p.qualityScore}/100` : '—'}</span>
                  </div>

                  <div className="text-[11px] text-ink-faint truncate">
                    Model: {p.model}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Prompt Inspection */}
        {selectedPrompt && (
          <div className="lg:col-span-2 bg-paper-sheet rounded-2xl border border-rule shadow-xs p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold font-mono text-ink">{selectedPrompt.name}</h2>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-paper-band text-print font-mono">
                    {selectedPrompt.version}
                  </span>
                </div>
                <div className="text-xs text-ink-faint mt-0.5">
                  Cập nhật lần cuối: {selectedPrompt.updatedAt} • Tạo: {selectedPrompt.createdAt}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={adminTelemetryService.getLangfusePromptUrl(selectedPrompt.name, selectedPrompt.version)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-cover hover:bg-cover-deep text-white rounded-xl text-xs font-semibold transition"
                >
                  <Flame className="w-3.5 h-3.5 text-pen-line" />
                  <span>Langfuse Sync</span>
                  <ArrowUpRight className="w-3 h-3 text-ink-faint" />
                </a>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-paper-band p-4 rounded-xl border border-rule/80 text-xs">
              <div>
                <span className="text-[11px] text-ink-faint uppercase font-semibold">Điểm Chất Lượng</span>
                <div className="text-base font-bold text-print">
                  {selectedPrompt.qualityScore > 0 ? `${selectedPrompt.qualityScore}/100` : '—'}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-ink-faint uppercase font-semibold">Tổng Chi Phí</span>
                <div className="text-base font-mono font-bold text-ink">${selectedPrompt.cost.toFixed(4)}</div>
              </div>
              <div>
                <span className="text-[11px] text-ink-faint uppercase font-semibold">Độ Trễ TB</span>
                <div className="text-base font-mono font-bold text-ink">{selectedPrompt.avgLatencyMs}ms</div>
              </div>
              <div>
                <span className="text-[11px] text-ink-faint uppercase font-semibold">Lượt Gọi (Traces)</span>
                <div className="text-base font-mono font-bold text-print">{selectedPrompt.traceCount.toLocaleString()}</div>
              </div>
            </div>

            {/* Prompt Template Snippet */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-ink uppercase tracking-wider flex items-center space-x-1.5">
                  <FileCode className="w-4 h-4 text-print" />
                  <span>Nội Dung Prompt Mẫu (Template Directive)</span>
                </span>
                <button
                  onClick={() => handleCopy(selectedPrompt.templateSnippet)}
                  className="inline-flex items-center space-x-1 text-ink-faint hover:text-ink text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-print" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>

              <div className="p-4 bg-cover text-paper rounded-xl font-mono text-xs leading-relaxed overflow-x-auto border border-cover-deep">
                {selectedPrompt.templateSnippet || 'Chưa có dữ liệu — mẫu prompt chưa được đăng ký, chỉ ghi nhận telemetry lượt gọi.'}
              </div>
            </div>

            {/* Version History */}
            <div className="space-y-2.5 pt-2">
              <h3 className="font-bold text-ink text-xs uppercase tracking-wider flex items-center space-x-1.5">
                <GitBranch className="w-4 h-4 text-print" />
                <span>Lịch Sử Phiên Bản (Version History)</span>
              </h3>

              <div className="space-y-1.5 text-xs">
                <div className="p-2.5 bg-paper-band border border-rule-strong rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-print">{selectedPrompt.version}</span>
                    <span className="ml-2 text-ink-soft">Phiên bản đang chạy (ghi nhận từ telemetry)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-print text-white">Active</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
