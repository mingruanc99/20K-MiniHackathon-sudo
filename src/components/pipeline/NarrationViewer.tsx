// src/components/pipeline/NarrationViewer.tsx
import React, { useState } from 'react';
import { CLSGScene } from '../../types';
import {
  Mic,
  Square,
  Play,
  Clock,
  Copy,
  Check,
  FileText,
  AlignLeft,
  ListOrdered
} from 'lucide-react';

export const NarrationViewer: React.FC<{ scenes: CLSGScene[] }> = ({ scenes }) => {
  const [activeAudioIdx, setActiveAudioIdx] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'script_timing'>('script_timing');
  const [copied, setCopied] = useState(false);

  if (!scenes || scenes.length === 0) {
    return (
      <div className="p-8 text-center bg-paper-sheet rounded-xl border border-rule">
        <Mic className="w-8 h-8 text-ink-faint mx-auto mb-2" />
        <p className="text-sm text-ink-faint">Chưa có lời giảng thoại. Hãy chạy Module 3A để sinh kịch bản lời giảng.</p>
      </div>
    );
  }

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  let runningTime = 0;
  const timedScenes = scenes.map((s, idx) => {
    const start = s.scene_start_time_sec !== undefined ? s.scene_start_time_sec : runningTime;
    const dur = s.scene_duration_sec || s.prosody_plan?.effective_scene_duration_sec || 25;
    const end = s.scene_end_time_sec !== undefined ? s.scene_end_time_sec : start + dur;
    runningTime = end;
    return {
      ...s,
      idx,
      startSec: start,
      endSec: end,
      durSec: dur,
      timeLabel: `${formatTime(start)} - ${formatTime(end)}`,
      durLabel: `${Math.round(dur)}s`
    };
  });

  const generatePlainTextScript = (): string => {
    return timedScenes
      .map(
        (s) =>
          `[${s.timeLabel}] (${s.durLabel}) ${s.section_id} - ${s.topic}\n${s.narration.text}\n`
      )
      .join('\n');
  };

  const copyScript = () => {
    navigator.clipboard.writeText(generatePlainTextScript());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = () => {
    const blob = new Blob([generatePlainTextScript()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kich_ban_thoi_gian.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  const totalWords = scenes.reduce((sum, s) => sum + s.narration.word_count, 0);
  const totalDuration = timedScenes[timedScenes.length - 1]?.endSec || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-paper-sheet border border-rule rounded-2xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-paper-band text-print border border-rule-strong">
              Module 3A
            </span>
            <span className="text-xs font-semibold text-ink-faint">Narration Generation</span>
          </div>
          <h2 className="text-xl font-bold text-ink tracking-tight">Kịch Bản Lời Giảng Sư Phạm</h2>
          <p className="text-xs text-ink-faint mt-0.5">
            Lời giảng sư phạm tự nhiên, tuân thủ nghiêm ngặt ngân sách từ ngữ mục tiêu của từng slide.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-medium px-3 py-1.5 rounded-xl bg-paper-band border border-rule text-ink-soft">
            Tổng: <span className="font-bold text-print">{totalWords} từ</span> • <span className="font-mono font-bold text-ink">{formatTime(totalDuration)}</span>
          </div>

          <button
            type="button"
            onClick={copyScript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rule-strong bg-paper-sheet hover:bg-paper-band text-xs font-semibold text-ink-soft shadow-xs transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-print" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép kịch bản'}</span>
          </button>

          <button
            type="button"
            onClick={downloadTxt}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rule-strong bg-paper-band hover:bg-paper-band text-xs font-semibold text-navy shadow-xs transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Tải .txt</span>
          </button>
        </div>
      </div>

      {/* Format Toggle Bar */}
      <div className="flex items-center justify-between bg-paper-sheet border border-rule rounded-xl p-2 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('script_timing')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === 'script_timing'
                ? 'bg-cover text-white shadow-xs'
                : 'text-ink-soft hover:text-ink hover:bg-paper-band'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Định Dạng Kịch Bản & Thời Gian (Chỉ hiện nội dung & thời gian)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === 'cards'
                ? 'bg-cover text-white shadow-xs'
                : 'text-ink-soft hover:text-ink hover:bg-paper-band'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Dạng Thẻ Phân Cảnh Sư Phạm</span>
          </button>
        </div>

        <span className="text-xs text-ink-faint hidden sm:inline">
          {viewMode === 'script_timing' ? 'Mỗi phân cảnh chỉ hiển thị mốc thời gian và lời giảng sạch' : 'Hiển thị vai trò sư phạm và bộ điều khiển giọng đọc'}
        </span>
      </div>

      {/* Render based on ViewMode */}
      {viewMode === 'script_timing' ? (
        /* PURE CONTENT & TIMING VIEW */
        <div className="space-y-3.5">
          {timedScenes.map((scene) => (
            <div
              key={scene.section_id}
              className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs hover:border-rule-strong transition space-y-3"
            >
              <div className="flex items-center justify-between border-b border-rule pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-paper-band text-print border border-rule-strong">
                    <Clock className="w-3 h-3 text-print-soft" />
                    <span>{scene.timeLabel}</span>
                    <span className="text-[11px] text-print-soft font-normal">({scene.durLabel})</span>
                  </span>

                  <span className="font-mono text-xs font-bold text-ink">
                    {scene.section_id}
                  </span>
                  <span className="text-xs font-medium text-ink-soft">
                    • {scene.topic}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-ink-faint font-mono text-xs">{scene.narration.word_count} từ</span>
                  <button
                    onClick={() => playNarration(scene.narration.text, scene.idx)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      activeAudioIdx === scene.idx
                        ? 'bg-pen-soft text-pen border border-pen-line'
                        : 'bg-paper-band text-ink-soft border border-rule hover:bg-paper-band'
                    }`}
                  >
                    {activeAudioIdx === scene.idx ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                    <span>{activeAudioIdx === scene.idx ? 'Dừng' : 'Phát giọng'}</span>
                  </button>
                </div>
              </div>

              <div className="text-sm text-ink leading-relaxed bg-paper-band p-4 rounded-xl border border-rule/80">
                {scene.narration.text}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ORIGINAL CARDS VIEW */
        <div className="space-y-4">
          {timedScenes.map((scene, idx) => (
            <div key={scene.section_id} className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-rule pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-paper-band text-print border border-rule-strong">
                    {scene.section_id}
                  </span>
                  <h3 className="text-sm font-bold text-ink">{scene.topic}</h3>
                  <span className={`px-2 py-0.2 rounded text-[11px] font-semibold uppercase badge-role-${scene.pedagogical_function}`}>
                    {scene.pedagogical_function}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-ink-faint font-mono">{scene.narration.word_count} từ</span>
                  <button
                    onClick={() => playNarration(scene.narration.text, idx)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                      activeAudioIdx === idx
                        ? 'bg-pen-soft text-pen border border-pen-line'
                        : 'bg-paper-band text-ink-soft border border-rule hover:bg-paper-band'
                    }`}
                  >
                    {activeAudioIdx === idx ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                    <span>{activeAudioIdx === idx ? 'Dừng đọc' : 'Nghe giọng mẫu'}</span>
                  </button>
                </div>
              </div>

              <p className="text-sm text-ink-soft leading-relaxed bg-paper-band p-4 rounded-lg border border-rule">
                {scene.narration.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

