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
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <Code2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Chưa có biểu diễn CLSG-IR đã xác thực. Hãy chạy toàn bộ pipeline.</p>
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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Module OUT
              </span>
              <span className="text-xs font-semibold text-slate-500">Standardized Output Representation</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Đặc Tả Đầu Ra Bài Giảng</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hệ thống hỗ trợ 2 định dạng: Kịch bản & Thời gian (dành cho MC/Lồng tiếng/Subtitles) và JSON CLSG-IR đầy đủ (cho Engine Video).
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
            <div className="text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Thời lượng</div>
              <div className="font-mono font-bold text-slate-800">{formatTime(ir.total_duration_sec)} ({Math.round(ir.total_duration_sec)}s)</div>
            </div>
            <div className="w-px h-6 bg-slate-200"></div>
            <div className="text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Từ ngữ</div>
              <div className="font-mono font-bold text-indigo-600">{ir.total_words} từ</div>
            </div>
            <div className="w-px h-6 bg-slate-200"></div>
            <div className="text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Phân cảnh</div>
              <div className="font-mono font-bold text-slate-800">{ir.total_scenes} slides</div>
            </div>
          </div>
        </div>

        {/* Format Selector Tabs */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('script_timing')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'script_timing'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
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
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>JSON Chuẩn CLSG-IR (Full Schema)</span>
            </button>
          </div>

          {/* Action buttons per tab */}
          {activeTab === 'script_timing' ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs mr-2">
                <button
                  type="button"
                  onClick={() => setTimingViewMode('timeline')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                    timingViewMode === 'timeline' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ListOrdered className="w-3 h-3 inline mr-1" />
                  Dòng thời gian
                </button>
                <button
                  type="button"
                  onClick={() => setTimingViewMode('text')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                    timingViewMode === 'text' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <AlignLeft className="w-3 h-3 inline mr-1" />
                  Văn bản thuần
                </button>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(generatePlainTextScript(), 'script')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition"
              >
                {copiedType === 'script' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'script' ? 'Đã sao chép' : 'Sao chép kịch bản'}</span>
              </button>

              <button
                type="button"
                onClick={() => downloadFile(generatePlainTextScript(), `kich_ban_${ir.ir_id}.txt`, 'text/plain;charset=utf-8')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-xs font-semibold text-indigo-700 shadow-xs transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Tải tệp .txt</span>
              </button>

              <button
                type="button"
                onClick={() => downloadFile(generateSrt(), `phu_de_${ir.ir_id}.srt`, 'text/plain;charset=utf-8')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs transition"
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
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition"
              >
                {copiedType === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'json' ? 'Đã sao chép' : 'Sao chép JSON'}</span>
              </button>
              <button
                type="button"
                onClick={() => downloadFile(jsonString, `clsg_ir_${ir.ir_id}.json`, 'application/json')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs transition"
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
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-indigo-300 transition space-y-3"
              >
                {/* Header: Timing & Section info */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    {/* Timing Badge */}
                    <span className="flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <Clock className="w-3 h-3 text-indigo-500" />
                      <span>{scene.timeLabel}</span>
                      <span className="text-[10px] text-indigo-400 font-normal">({scene.durLabel})</span>
                    </span>

                    <span className="font-mono text-xs font-bold text-slate-800">
                      {scene.section_id}
                    </span>
                    <span className="text-xs font-medium text-slate-600">
                      • {scene.topic}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-400 font-mono text-[11px]">
                      {scene.narration.word_count} từ
                    </span>
                    <button
                      type="button"
                      onClick={() => playSpeech(scene.narration.text, scene.idx)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        activeAudioIdx === scene.idx
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
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
                <div className="text-sm text-slate-800 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 font-normal">
                  {scene.narration.text}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Plain Text / Teleprompter View */
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-700 uppercase tracking-wider">
                Văn Bản Kịch Bản Lời Giảng & Mốc Thời Gian (Plain Script & Timecode)
              </span>
              <span>Định dạng chuẩn sao chép cho MC / Voice Talent</span>
            </div>
            <textarea
              readOnly
              rows={Math.max(14, timedScenes.length * 4)}
              value={generatePlainTextScript()}
              className="w-full p-4 rounded-xl bg-slate-50 font-mono text-xs leading-relaxed border border-slate-200 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )
      ) : (
        /* Full JSON Schema View */
        <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 p-5 font-mono text-xs overflow-x-auto max-h-[600px] shadow-inner space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
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

