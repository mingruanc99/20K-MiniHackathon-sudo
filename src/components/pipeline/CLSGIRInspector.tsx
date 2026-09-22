// src/components/pipeline/CLSGIRInspector.tsx
import React, { useState } from 'react';
import { VerifiedCLSG_IR } from '../../types';
import { Code2, Copy, Download, Check } from 'lucide-react';

export const CLSGIRInspector: React.FC<{ ir: VerifiedCLSG_IR | null }> = ({ ir }) => {
  const [copied, setCopied] = useState(false);

  if (!ir) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <Code2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Chưa có biểu diễn CLSG-IR đã xác thực. Hãy chạy toàn bộ pipeline.</p>
      </div>
    );
  }

  const jsonString = JSON.stringify(ir, null, 2);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJson = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clsg_ir_${ir.ir_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Đầu Ra Chuẩn Hoá — Cấu Trúc Độc Lập Engine</span>
          <h2 className="text-lg font-bold text-slate-900">Đặc Tả CLSG-IR Đã Được Xác Thực</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Biểu diễn trung gian tách rời, sẵn sàng truyền trực tiếp sang TTS, Manim, Remotion hoặc các mô hình AI Video.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-xs transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép JSON'}</span>
          </button>
          <button
            onClick={downloadJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-medium text-white shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải tệp JSON</span>
          </button>
        </div>
      </div>

      {/* JSON Viewer */}
      <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 p-4 font-mono text-xs overflow-x-auto max-h-[580px] shadow-inner">
        <pre className="leading-relaxed">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
};
