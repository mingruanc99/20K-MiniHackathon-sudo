// src/components/pipeline/CLSGIRInspector.tsx
import React, { useState } from 'react';
import { VerifiedCLSG_IR, CLSGScene } from '../../types';
import {
  Code2,
  Copy,
  Download,
  Check,
  Clock,
  FileText,
  Subtitles,
  Play,
  Square,
  Sparkles,
  AlignLeft,
  ListOrdered
} from 'lucide-react';

export const CLSGIRInspector: React.FC<{ ir: VerifiedCLSG_IR | null }> = ({ ir }) => {
  const [activeTab, setActiveTab] = useState<'script_timing' | 'json'>('script_timing');
  const [timingViewMode, setTimingViewMode] = useState<'timeline' | 'text'>('timeline');
  const [copiedType, setCopiedType] = useState<'json' | 'script' | 'srt' | null>(null);
  const [activeAudioIdx, setActiveAudioIdx] = useState<number | null>(null);

  if (!ir) {
    return (
      <div className="p-8 text-center bg-paper-sheet rounded-xl border border-rule">
        <Code2 className="w-8 h-8 text-ink-faint mx-auto mb-2" />
        <p className="text-sm text-ink-faint">Chưa có biểu diễn CLSG-IR đã xác thực. Hãy chạy toàn bộ pipeline.</p>
      </div>
    );
  }

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatSrtTime = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const sRem = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sRem).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  // Compute timing intervals
  let runningTime = 0;
  const timedScenes = ir.scenes.map((s, idx) => {
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

  const generateSrt = (): string => {
    return timedScenes
      .map(
        (s, i) =>
          `${i + 1}\n${formatSrtTime(s.startSec)} --> ${formatSrtTime(s.endSec)}\n${s.narration.text}\n`
      )
      .join('\n');
  };

  const jsonString = JSON.stringify(ir, null, 2);

  const copyToClipboard = (text: string, type: 'json' | 'script' | 'srt') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const playSpeech = (text: string, idx: number) => {
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
      {/* Top Banner & Tab Controls */}
      <div className="bg-paper-sheet border border-rule rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-paper-band text-print border border-rule-strong">
                Module OUT
              </span>
              <span className="text-xs font-semibold text-ink-faint">Standardized Output Representation</span>
            </div>
            <h2 className="text-xl font-bold text-ink tracking-tight">Đặc Tả Đầu Ra Bài Giảng</h2>
            <p className="text-xs text-ink-faint mt-0.5">
              Hệ thống hỗ trợ 2 định dạng: Kịch bản & Thời gian (dành cho MC/Lồng tiếng/Subtitles) và JSON CLSG-IR đầy đủ (cho Engine Video).
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 text-xs bg-paper-band border border-rule rounded-xl px-4 py-2">
            <div className="text-center">
              <div className="text-[11px] uppercase font-bold text-ink-faint">Thời lượng</div>
              <div className="font-mono font-bold text-ink">{formatTime(ir.total_duration_sec)} ({Math.round(ir.total_duration_sec)}s)</div>
            </div>
            <div className="w-px h-6 bg-rule"></div>
            <div className="text-center">
              <div className="text-[11px] uppercase font-bold text-ink-faint">Từ ngữ</div>
              <div className="font-mono font-bold text-print">{ir.total_words} từ</div>
            </div>
            <div className="w-px h-6 bg-rule"></div>
            <div className="text-center">
              <div className="text-[11px] uppercase font-bold text-ink-faint">Phân cảnh</div>
              <div className="font-mono font-bold text-ink">{ir.total_scenes} slides</div>
            </div>
          </div>
        </div>

        {/* Format Selector Tabs */}
        <div className="flex items-center justify-between pt-2 border-t border-rule">
          <div className="flex items-center gap-1.5 p-1 bg-paper-band rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('script_timing')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'script_timing'
                  ? 'bg-paper-sheet text-print shadow-xs'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Kịch Bản & Thời Gian (Script & Timing)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('json')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'json'
                  ? 'bg-paper-sheet text-print shadow-xs'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>JSON Chuẩn CLSG-IR (Full Schema)</span>
            </button>
          </div>

          {/* Action buttons per tab */}
          {activeTab === 'script_timing' ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 p-0.5 bg-paper-band rounded-lg text-xs mr-2">
                <button
                  type="button"
                  onClick={() => setTimingViewMode('timeline')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                    timingViewMode === 'timeline' ? 'bg-paper-sheet text-ink shadow-2xs' : 'text-ink-faint hover:text-ink'
                  }`}
                >
                  <ListOrdered className="w-3 h-3 inline mr-1" />
                  Dòng thời gian
                </button>
                <button
                  type="button"
                  onClick={() => setTimingViewMode('text')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                    timingViewMode === 'text' ? 'bg-paper-sheet text-ink shadow-2xs' : 'text-ink-faint hover:text-ink'
                  }`}
                >
                  <AlignLeft className="w-3 h-3 inline mr-1" />
                  Văn bản thuần
                </button>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(generatePlainTextScript(), 'script')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rule-strong bg-paper-sheet hover:bg-paper-band text-xs font-semibold text-ink-soft shadow-xs transition"
              >
                {copiedType === 'script' ? <Check className="w-3.5 h-3.5 text-print" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'script' ? 'Đã sao chép' : 'Sao chép kịch bản'}</span>
              </button>

              <button
                type="button"
                onClick={() => downloadFile(generatePlainTextScript(), `kich_ban_${ir.ir_id}.txt`, 'text/plain;charset=utf-8')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rule-strong bg-paper-band hover:bg-paper-band text-xs font-semibold text-navy shadow-xs transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Tải tệp .txt</span>
              </button>

              <button
                type="button"
                onClick={() => downloadFile(generateSrt(), `phu_de_${ir.ir_id}.srt`, 'text/plain;charset=utf-8')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cover hover:bg-cover text-xs font-semibold text-white shadow-xs transition"
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span>Tải phụ đề .srt</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(jsonString, 'json')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rule-strong bg-paper-sheet hover:bg-paper-band text-xs font-semibold text-ink-soft shadow-xs transition"
              >
                {copiedType === 'json' ? <Check className="w-3.5 h-3.5 text-print" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'json' ? 'Đã sao chép' : 'Sao chép JSON'}</span>
              </button>
              <button
                type="button"
                onClick={() => downloadFile(jsonString, `clsg_ir_${ir.ir_id}.json`, 'application/json')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cover hover:bg-cover text-xs font-semibold text-white shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải tệp JSON</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* View Content based on Tab */}
      {activeTab === 'script_timing' ? (
        timingViewMode === 'timeline' ? (
          /* Timeline Cards View: ONLY CONTENT AND TIMING */
          <div className="space-y-3.5">
            {timedScenes.map((scene) => (
              <div
                key={scene.section_id}
                className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs hover:border-rule-strong transition space-y-3"
              >
                {/* Header: Timing & Section info */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2.5">
                  <div className="flex items-center gap-2.5">
                    {/* Timing Badge */}
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

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-ink-faint font-mono text-xs">
                      {scene.narration.word_count} từ
                    </span>
                    <button
                      type="button"
                      onClick={() => playSpeech(scene.narration.text, scene.idx)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        activeAudioIdx === scene.idx
                          ? 'bg-pen-soft text-pen border border-pen-line'
                          : 'bg-paper-band text-ink-soft border border-rule hover:bg-paper-band'
                      }`}
                    >
                      {activeAudioIdx === scene.idx ? (
                        <Square className="w-3 h-3 fill-current" />
                      ) : (
                        <Play className="w-3 h-3 fill-current" />
                      )}
                      <span>{activeAudioIdx === scene.idx ? 'Dừng' : 'Phát giọng'}</span>
                    </button>
                  </div>
                </div>

                {/* Pure Narration Content */}
                <div className="text-sm text-ink leading-relaxed bg-paper-band p-4 rounded-xl border border-rule/80 font-normal">
                  {scene.narration.text}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Plain Text / Teleprompter View */
          <div className="bg-paper-sheet border border-rule rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs text-ink-faint border-b border-rule pb-2">
              <span className="font-semibold text-ink-soft uppercase tracking-wider">
                Văn Bản Kịch Bản Lời Giảng & Mốc Thời Gian (Plain Script & Timecode)
              </span>
              <span>Định dạng chuẩn sao chép cho MC / Voice Talent</span>
            </div>
            <textarea
              readOnly
              rows={Math.max(14, timedScenes.length * 4)}
              value={generatePlainTextScript()}
              className="w-full p-4 rounded-xl bg-paper-band font-mono text-xs leading-relaxed border border-rule text-ink outline-none focus:ring-2 focus:ring-print"
            />
          </div>
        )
      ) : (
        /* Full JSON Schema View */
        <div className="bg-cover text-paper rounded-2xl border border-cover-deep p-5 font-mono text-xs overflow-x-auto max-h-[600px] shadow-inner space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-faint border-b border-cover-deep pb-2">
            <span>CLSG-IR Schema v1.0.0 • Full Machine-Readable JSON</span>
            <span>{ir.scenes.length} scenes</span>
          </div>
          <pre className="leading-relaxed">
            <code>{jsonString}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

