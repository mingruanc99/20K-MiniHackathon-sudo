// src/components/pipeline/VideoPreview.tsx
import React, { useState, useEffect } from 'react';
import { VerifiedCLSG_IR, CLSGScene, VisualCue } from '../../types';
import { Video, Play, Pause, RotateCcw, MonitorPlay, Sparkles } from 'lucide-react';

export const VideoPreview: React.FC<{ ir: VerifiedCLSG_IR | null }> = ({ ir }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (isPlaying && ir) {
      interval = setInterval(() => {
        setCurrentTimeSec((prev) => {
          if (prev >= ir.total_duration_sec) {
            setIsPlaying(false);
            return 0;
          }
          return Math.round((prev + 0.5) * 10) / 10;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, ir]);

  if (!ir) {
    return (
      <div className="p-8 text-center bg-paper-sheet rounded-xl border border-rule">
        <Video className="w-8 h-8 text-ink-faint mx-auto mb-2" />
        <p className="text-sm text-ink-faint">Chưa có biểu diễn trung gian đã xác thực sẵn sàng cho việc dựng video.</p>
      </div>
    );
  }

  // Find active scene and cue
  const activeScene = ir.scenes.find(
    (s) => currentTimeSec >= s.scene_start_time_sec && currentTimeSec <= s.scene_end_time_sec
  ) || ir.scenes[0];

  const activeCue = activeScene.visual_cues.find(
    (c) => currentTimeSec >= c.trigger_timestamp_sec - 1 && currentTimeSec <= c.trigger_timestamp_sec + 8
  );

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-paper-sheet border border-rule rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-print uppercase tracking-wider">Tổng Hợp Video Đầu Ra</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-pen-soft text-pen border border-pen-line font-bold">
              MÔ PHỎNG PHÒNG THỬ NGHIỆM
            </span>
          </div>
          <h2 className="text-lg font-bold text-ink">Xem Trước Video Đồng Bộ & Khớp Dòng Thời Gian</h2>
          <p className="text-xs text-ink-faint mt-0.5">
            Mô phỏng phát video được kết xuất trực tiếp từ các mốc thời gian và gợi ý thị giác của CLSG-IR.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cover hover:bg-cover text-white text-xs font-medium shadow-xs transition"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Tạm dừng' : 'Phát thử video'}</span>
          </button>
          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentTimeSec(0);
            }}
            className="p-1.5 rounded-lg border border-rule hover:bg-paper-band text-ink-soft"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Simulation Canvas */}
      <div className="bg-cover text-white rounded-2xl overflow-hidden shadow-md border border-cover-deep aspect-video max-w-4xl mx-auto flex flex-col justify-between p-8 relative">
        {/* Top bar */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-print text-cover-foil border border-print/40">
              {activeScene.section_id}
            </span>
            <span className="text-sm font-semibold text-paper">{activeScene.topic}</span>
          </div>
          <span className="text-xs font-mono text-ink-faint">
            {formatTime(currentTimeSec)} / {formatTime(ir.total_duration_sec)}
          </span>
        </div>

        {/* Center Visual Cue Active Display */}
        <div className="my-auto text-center space-y-4 z-10 max-w-xl mx-auto">
          {activeCue ? (
            <div className="p-5 rounded-xl bg-cover-deep border border-print/40  shadow-lg animate-fade-in">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-[11px] uppercase font-bold px-2 py-0.5 rounded bg-cover text-white">
                  {activeCue.visual_type.replace('_', ' ')}
                </span>
                <span className="text-[11px] font-mono text-paper/80">Đối tượng: {activeCue.element_target}</span>
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">{activeCue.visual_purpose}</h3>
              <p className="text-xs text-cover-foil">{activeCue.learning_support}</p>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-cover-deep border border-cover-deep/50">
              <MonitorPlay className="w-10 h-10 text-ink-faint mx-auto mb-2" />
              <p className="text-xs text-ink-faint">Giảng viên đang thuyết giảng — tập trung vào dòng diễn giải âm thanh.</p>
            </div>
          )}
        </div>

        {/* Bottom Captions & Scrubber */}
        <div className="z-10 space-y-3">
          <div className="bg-cover-deep  rounded-lg p-3 text-xs text-center text-paper max-w-2xl mx-auto border border-white/10">
            <p className="line-clamp-2">{activeScene.narration.text}</p>
          </div>

          {/* Timeline bar */}
          <div className="w-full bg-cover-deep h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-print h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentTimeSec / (ir.total_duration_sec || 1)) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};
