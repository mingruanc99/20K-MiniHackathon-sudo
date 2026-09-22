// src/components/pipeline/ProsodyViewer.tsx
import React, { useState } from 'react';
import { CLSGScene } from '../../types';
import { Activity, Volume2, Copy, Check, Code2 } from 'lucide-react';

export const ProsodyViewer: React.FC<{ scenes: CLSGScene[] }> = ({ scenes }) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!scenes || scenes.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Chưa có kế hoạch ngắt nghỉ & nhịp điệu. Hãy chạy Module 3B.</p>
      </div>
    );
  }

  const copySSML = (ssml: string, idx: number) => {
    navigator.clipboard.writeText(ssml);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Module 3B — Kế Hoạch Ngắt Nghỉ & Nhịp Điệu</span>
          <h2 className="text-lg font-bold text-slate-900">Định Hình Ngữ Điệu Lời Giảng (Tiền Tổng Hợp Giọng TTS)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Xác định 4 loại khoảng dừng sư phạm và kiểm soát tốc độ trước khi truyền vào bộ tổng hợp giọng nói.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">Cú pháp (150-250ms)</span>
          <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200 font-medium">Nhấn mạnh (300-450ms)</span>
          <span className="px-2.5 py-1 rounded bg-purple-50 text-purple-800 border border-purple-200 font-medium">Ranh giới khái niệm (500-700ms)</span>
          <span className="px-2.5 py-1 rounded bg-rose-50 text-rose-800 border border-rose-200 font-medium">Chuyển tiếp (800-1200ms)</span>
        </div>
      </div>

      <div className="space-y-6">
        {scenes.map((scene, idx) => (
          <div key={scene.section_id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {scene.section_id}
                </span>
                <h3 className="text-sm font-bold text-slate-900">{scene.topic}</h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500">Phát âm: <b className="text-slate-700 font-mono">{scene.prosody_plan.total_speaking_sec}s</b></span>
                <span className="text-slate-500">Khoảng dừng: <b className="text-slate-700 font-mono">{scene.prosody_plan.total_pause_sec}s</b></span>
                <span className="text-indigo-600 font-bold font-mono">Tổng thời lượng: {scene.prosody_plan.effective_scene_duration_sec}s</span>
                <button
                  onClick={() => copySSML(scene.prosody_plan.ssml_full, idx)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600"
                >
                  {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedIdx === idx ? 'Đã sao chép' : 'Sao chép SSML'}</span>
                </button>
              </div>
            </div>

            {/* Sentence Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 w-16">Mã</th>
                    <th className="py-2 px-3">Câu Lời Giảng</th>
                    <th className="py-2 px-3 w-28">Nghỉ sau câu</th>
                    <th className="py-2 px-3 w-36">Loại khoảng dừng</th>
                    <th className="py-2 px-3 w-20">Tốc độ</th>
                    <th className="py-2 px-3 w-28">Nhấn mạnh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scene.prosody_plan.sentences.map((sent) => (
                    <tr key={sent.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono text-slate-500">{sent.id}</td>
                      <td className="py-2.5 px-3 text-slate-800 leading-relaxed">{sent.text}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{sent.prosody.pause_after_ms} ms</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          sent.prosody.pause_type === 'concept_boundary' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          sent.prosody.pause_type === 'section_transition' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          sent.prosody.pause_type === 'emphasis' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {sent.prosody.pause_type === 'concept_boundary' ? 'Ranh giới khái niệm' :
                           sent.prosody.pause_type === 'section_transition' ? 'Chuyển phân cảnh' :
                           sent.prosody.pause_type === 'emphasis' ? 'Nhấn mạnh' : 'Cú pháp'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono capitalize text-slate-600">{sent.prosody.rate}</td>
                      <td className="py-2.5 px-3 text-[11px] text-indigo-700 font-mono">
                        {sent.prosody.emphasis.length > 0 ? sent.prosody.emphasis.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
