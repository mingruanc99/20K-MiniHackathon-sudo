// src/components/pipeline/NarrationViewer.tsx
import React, { useState } from 'react';
import { CLSGScene } from '../../types';
import { Mic, Volume2, Square, Play, CheckCircle2 } from 'lucide-react';

export const NarrationViewer: React.FC<{ scenes: CLSGScene[] }> = ({ scenes }) => {
  const [activeAudioIdx, setActiveAudioIdx] = useState<number | null>(null);

  if (!scenes || scenes.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <Mic className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Chưa có lời giảng thoại. Hãy chạy Module 3A để sinh kịch bản lời giảng.</p>
      </div>
    );
  }

  const playNarration = (text: string, idx: number) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      if (activeAudioIdx === idx) {
        setActiveAudioIdx(null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.onend = () => setActiveAudioIdx(null);
      utterance.onerror = () => setActiveAudioIdx(null);
      setActiveAudioIdx(idx);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Module 3A — Sinh Lời Giảng Thoại</span>
          <h2 className="text-lg font-bold text-slate-900">Kịch Bản Lời Giảng Sư Phạm</h2>
          <p className="text-xs text-slate-500 mt-0.5">Lời giảng sư phạm tự nhiên, tuân thủ nghiêm ngặt ngân sách từ ngữ mục tiêu của từng slide.</p>
        </div>
        <div className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
          Tổng số từ giảng: <span className="font-bold">{scenes.reduce((sum, s) => sum + s.narration.word_count, 0)} từ</span>
        </div>
      </div>

      <div className="space-y-4">
        {scenes.map((scene, idx) => (
          <div key={scene.section_id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {scene.section_id}
                </span>
                <h3 className="text-sm font-bold text-slate-900">{scene.topic}</h3>
                <span className={`px-2 py-0.2 rounded text-[10px] font-semibold uppercase badge-role-${scene.pedagogical_function}`}>
                  {scene.pedagogical_function}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500 font-mono">{scene.narration.word_count} từ</span>
                <button
                  onClick={() => playNarration(scene.narration.text, idx)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                    activeAudioIdx === idx
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {activeAudioIdx === idx ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>{activeAudioIdx === idx ? 'Dừng đọc' : 'Nghe giọng mẫu'}</span>
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/50 p-4 rounded-lg border border-slate-100">
              {scene.narration.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
