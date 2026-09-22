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
  const [selectedPrompt, setSelectedPrompt] = useState<PromptMetadata | null>(prompts[0]);
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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <span>Prompt Studio & Version Registry</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý vòng đời prompt, theo dõi phiên bản sản xuất (Production) so với Staging, gắn kết trực tiếp với Langfuse Prompts.
          </p>
        </div>

        <a
          href={adminTelemetryService.getLangfusePromptUrl('section_generator')}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-xs self-start sm:self-auto"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Langfuse Prompt CMS</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Prompts Catalog & Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Prompts List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="px-2 py-1 text-xs font-bold text-slate-900 uppercase tracking-wider">
            System Prompts ({prompts.length})
          </div>

          <div className="space-y-2">
            {prompts.map((p) => {
              const isSelected = selectedPrompt?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPrompt(p)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer text-xs space-y-1.5 ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{p.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">
                      {p.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>{p.version}</span>
                    <span className="text-emerald-600 font-bold">{p.qualityScore}/100</span>
                  </div>

                  <div className="text-[10px] text-slate-400 truncate">
                    Model: {p.model}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Prompt Inspection */}
        {selectedPrompt && (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold font-mono text-slate-900">{selectedPrompt.name}</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 font-mono">
                    {selectedPrompt.version}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Cập nhật lần cuối: {selectedPrompt.updatedAt} • Tạo: {selectedPrompt.createdAt}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={adminTelemetryService.getLangfusePromptUrl(selectedPrompt.name, selectedPrompt.version)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
                >
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span>Langfuse Sync</span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400" />
                </a>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Điểm Chất Lượng</span>
                <div className="text-base font-bold text-emerald-600">{selectedPrompt.qualityScore}/100</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Chi Phí TB</span>
                <div className="text-base font-mono font-bold text-slate-800">${selectedPrompt.cost.toFixed(4)}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Độ Trễ TB</span>
                <div className="text-base font-mono font-bold text-slate-800">{selectedPrompt.avgLatencyMs}ms</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Lượt Gọi (Traces)</span>
                <div className="text-base font-mono font-bold text-blue-600">{selectedPrompt.traceCount.toLocaleString()}</div>
              </div>
            </div>

            {/* Prompt Template Snippet */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileCode className="w-4 h-4 text-blue-600" />
                  <span>Nội Dung Prompt Mẫu (Template Directive)</span>
                </span>
                <button
                  onClick={() => handleCopy(selectedPrompt.templateSnippet)}
                  className="inline-flex items-center space-x-1 text-slate-500 hover:text-slate-800 text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>

              <div className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs leading-relaxed overflow-x-auto border border-slate-800">
                {selectedPrompt.templateSnippet}
              </div>
            </div>

            {/* Version History */}
            <div className="space-y-2.5 pt-2">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                <GitBranch className="w-4 h-4 text-blue-600" />
                <span>Lịch Sử Phiên Bản (Version History)</span>
              </h3>

              <div className="space-y-1.5 text-xs">
                <div className="p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-emerald-800">{selectedPrompt.version}</span>
                    <span className="ml-2 text-slate-600">Bản phát hành chính thức hiện tại (Production)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">Active</span>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-slate-500">
                  <div>
                    <span className="font-mono font-semibold text-slate-700">v1.0 (Legacy)</span>
                    <span className="ml-2 text-slate-500">Phiên bản ban đầu, chưa tích hợp bộ khử ký tự lỗi ■</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">Deprecated</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
