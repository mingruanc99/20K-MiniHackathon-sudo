// src/components/pipeline/VisualIntentViewer.tsx
import React from 'react';
import { CLSGScene } from '../../types';
import { Eye, Clock, CheckCircle, Tag, Target, Sparkles } from 'lucide-react';

export const VisualIntentViewer: React.FC<{ scenes: CLSGScene[] }> = ({ scenes }) => {
  const allCues = scenes ? scenes.flatMap((s) => s.visual_cues) : [];

  if (!scenes || allCues.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <Eye className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Chưa có gợi ý ý đồ thị giác. Hãy chạy Module 3C.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Module 3C — Định Hình Ý Đồ Thị Giác</span>
          <h2 className="text-lg font-bold text-slate-900">Gợi Ý Minh Hoạ & Thị Giác Sư Phạm</h2>
          <p className="text-xs text-slate-500 mt-0.5">Quy chuẩn nghiêm ngặt theo 13 phân loại thị giác kinh điển kèm minh giải giảm tải nhận thức.</p>
        </div>
        <div className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
          Tổng số gợi ý thị giác: <span className="font-bold">{allCues.length}</span>
        </div>
      </div>

      <div className="space-y-4">
        {scenes.map((scene) => (
          <div key={scene.section_id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {scene.section_id}
                </span>
                <h3 className="text-sm font-bold text-slate-900">{scene.topic}</h3>
              </div>
              <span className="text-xs text-slate-500">{scene.visual_cues.length} sự kiện thị giác</span>
            </div>

            {scene.visual_cues.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Không cần thêm hiệu ứng thị giác cho phần chuyển tiếp khái niệm này.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {scene.visual_cues.map((cue) => (
                  <div key={cue.cue_id} className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 hover:bg-slate-50 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          ⏱️ Giây thứ {cue.trigger_timestamp_sec}s
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {cue.visual_type.replace('_', ' ')}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        cue.importance_level === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {cue.importance_level === 'high' ? 'Quan trọng' : 'Phụ trợ'}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-800">{cue.visual_purpose}</div>
                      <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                        <span className="font-medium text-slate-700">Hỗ trợ nhận thức:</span> {cue.learning_support}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-medium">Trọng tâm:</span>
                      {cue.content_focus.map((cf, i) => (
                        <span key={i} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                          {cf}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
