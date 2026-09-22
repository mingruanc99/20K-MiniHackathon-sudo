// src/components/pipeline/UserConfigViewer.tsx
import React, { useState } from 'react';
import { UserConfiguration, LearnerLevel, NarrationStyle, VisualDensity } from '../../types';
import {
  Sliders,
  Clock,
  Gauge,
  GraduationCap,
  Sparkles,
  Palette,
  CheckCircle2,
  RotateCcw,
  Save,
  BookOpen,
  Volume2,
  Info
} from 'lucide-react';

interface UserConfigViewerProps {
  config: UserConfiguration;
  onUpdateConfig?: (newConfig: UserConfiguration, reRunPipeline: boolean) => void;
  isRunning?: boolean;
}

export const UserConfigViewer: React.FC<UserConfigViewerProps> = ({
  config,
  onUpdateConfig,
  isRunning = false
}) => {
  const [editingConfig, setEditingConfig] = useState<UserConfiguration>({ ...config });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync editingConfig when incoming config prop updates
  React.useEffect(() => {
    setEditingConfig({ ...config });
  }, [config]);

  const hasUnsavedChanges = React.useMemo(() => {
    return JSON.stringify(config) !== JSON.stringify(editingConfig);
  }, [config, editingConfig]);

  // Dynamic pause overhead factor
  let pauseFactor = 0.18;
  if (editingConfig.narrationStyle === 'conversational') pauseFactor = 0.20;
  if (editingConfig.accessibility?.slowerPacing) pauseFactor = 0.24;

  const netSec = Math.round(editingConfig.targetDurationSeconds * (1.0 - pauseFactor));
  const estimatedWords = Math.round(netSec * (editingConfig.targetWpm / 60));

  const handleApplyPreset = (preset: {
    duration: number;
    wpm: number;
    level: LearnerLevel;
    style: NarrationStyle;
    density: VisualDensity;
    prior: string;
  }) => {
    setEditingConfig((prev) => ({
      ...prev,
      targetDurationSeconds: preset.duration,
      targetWpm: preset.wpm,
      learnerLevel: preset.level,
      narrationStyle: preset.style,
      visualDensity: preset.density,
      priorKnowledge: preset.prior
    }));
  };

  const handleSaveOnly = () => {
    onUpdateConfig?.(editingConfig, false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSaveAndRun = (reRun: boolean) => {
    onUpdateConfig?.(editingConfig, reRun);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              Module Config
            </span>
            <span className="text-xs font-semibold text-slate-500">Learner & Pedagogical Configuration</span>
            {hasUnsavedChanges && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 animate-pulse">
                Có thay đổi chưa lưu
              </span>
            )}
            {savedSuccess && (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                ✅ Đã lưu cấu hình thành công
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Cấu Hình Sư Phạm & Người Học</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tham số trực tiếp điều khiển ngân sách từ ngữ (W_target), cấp độ nhận thức Bloom và định hình nhịp điệu (Prosody).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setEditingConfig({ ...config })}
            disabled={!hasUnsavedChanges}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục gốc</span>
          </button>
          <button
            type="button"
            onClick={handleSaveOnly}
            disabled={!hasUnsavedChanges}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Lưu cấu hình</span>
          </button>
          <button
            type="button"
            onClick={() => handleSaveAndRun(true)}
            disabled={isRunning}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{savedSuccess ? '✅ Đã lưu!' : 'Lưu & Chạy Lại Pipeline'}</span>
          </button>
        </div>
      </div>

      {/* Real-time Target Word Budget KPI Card */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-indigo-700 font-semibold">Ngân sách từ W_target</span>
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-950 mt-1 font-mono">{estimatedWords} từ</div>
          <div className="text-[10px] text-indigo-600/80 mt-0.5 font-mono">
            {editingConfig.targetWpm} WPM • Overhead {(pauseFactor * 100).toFixed(0)}%
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Thời lượng mục tiêu</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {editingConfig.targetDurationSeconds}s
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            ~{(editingConfig.targetDurationSeconds / 60).toFixed(1)} phút giảng
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Thời gian phát âm thực</span>
            <Volume2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{netSec}s</div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Dành {editingConfig.targetDurationSeconds - netSec}s cho 4 loại khoảng dừng (Pause)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Trình độ đối tượng</span>
            <GraduationCap className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-base font-bold text-slate-900 mt-1 capitalize">
            {editingConfig.learnerLevel}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
            Bloom: {editingConfig.learnerLevel === 'beginner' ? 'Nhớ & Hiểu' : editingConfig.learnerLevel === 'graduate' ? 'Phân tích & Đánh giá' : 'Áp dụng & Phân tích'}
          </div>
        </div>
      </div>

      {/* Preset Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Mẫu Cấu Hình Sư Phạm Chuẩn (1-Click Presets)</span>
          </span>
          <span className="text-[11px] text-slate-400">Chọn để áp dụng nhanh</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() =>
              handleApplyPreset({
                duration: 180,
                wpm: 140,
                level: 'undergraduate',
                style: 'academic',
                density: 'balanced',
                prior: 'Kiến thức đại cương môn học, tư duy logic cơ bản'
              })
            }
            className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-left transition space-y-1 group"
          >
            <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 flex items-center justify-between">
              <span>🎓 Giảng dạy Đại học (Chuẩn)</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 rounded">180s</span>
            </div>
            <p className="text-[11px] text-slate-500">
              140 WPM, Academic Tone, Mật độ hình ảnh cân bằng, Bloom Phân tích.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              handleApplyPreset({
                duration: 60,
                wpm: 160,
                level: 'beginner',
                style: 'conversational',
                density: 'rich',
                prior: 'Chưa có kiến thức trước, người mới bắt đầu'
              })
            }
            className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-left transition space-y-1 group"
          >
            <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 flex items-center justify-between">
              <span>⚡ Micro-learning (Bite-sized)</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 rounded">60s</span>
            </div>
            <p className="text-[11px] text-slate-500">
              160 WPM, Giọng điệu hội thoại sinh động, nhiều hiệu ứng trực quan Rich.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              handleApplyPreset({
                duration: 300,
                wpm: 120,
                level: 'graduate',
                style: 'rigorous',
                density: 'minimal',
                prior: 'Toán cao cấp, cấu trúc dữ liệu và giải thuật nâng cao'
              })
            }
            className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-left transition space-y-1 group"
          >
            <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 flex items-center justify-between">
              <span>🔬 Seminar Sau Đại học (Chuyên sâu)</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 rounded">300s</span>
            </div>
            <p className="text-[11px] text-slate-500">
              120 WPM chậm rãi, Toán học chặt chẽ, tối giản hóa hình ảnh phụ trợ.
            </p>
          </button>
        </div>
      </div>

      {/* Main Parameters Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-600" />
          <span>Thông Số Điều Khiển Chi Tiết</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
          {/* Target Duration */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 flex items-center justify-between">
              <span>Thời Lượng Mục Tiêu (Duration)</span>
              <span className="font-mono text-indigo-600">{editingConfig.targetDurationSeconds} giây</span>
            </label>
            <select
              value={editingConfig.targetDurationSeconds}
              onChange={(e) =>
                setEditingConfig({ ...editingConfig, targetDurationSeconds: parseInt(e.target.value, 10) })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="60">1 Phút (Bite-sized, ~110 từ)</option>
              <option value="120">2 Phút (Ngắn gọn, ~230 từ)</option>
              <option value="180">3 Phút (Tiêu chuẩn, ~340 từ)</option>
              <option value="240">4 Phút (Mở rộng, ~460 từ)</option>
              <option value="300">5 Phút (Chuyên sâu, ~570 từ)</option>
              <option value="600">10 Phút (Bài giảng đầy đủ, ~1150 từ)</option>
              <option value="900">15 Phút (Chuyên đề dài, ~1750 từ)</option>
              <option value="1200">20 Phút (Hội thảo / Seminar, ~2350 từ)</option>
              <option value="1800">30 Phút (Khóa học trọn gói, ~3500 từ)</option>
              {![60, 120, 180, 240, 300, 600, 900, 1200, 1800].includes(editingConfig.targetDurationSeconds) && (
                <option value={editingConfig.targetDurationSeconds}>
                  Tự động theo slides ({editingConfig.targetDurationSeconds}s - {(editingConfig.targetDurationSeconds / 60).toFixed(1)} phút)
                </option>
              )}
            </select>
          </div>

          {/* Speaking Pacing (WPM) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 flex items-center justify-between">
              <span>Tốc Độ Giọng Đọc (Pacing WPM)</span>
              <span className="font-mono text-indigo-600">{editingConfig.targetWpm} WPM</span>
            </label>
            <select
              value={editingConfig.targetWpm}
              onChange={(e) =>
                setEditingConfig({ ...editingConfig, targetWpm: parseInt(e.target.value, 10) })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="120">120 WPM (Chậm - Dành cho khái niệm phức tạp, 22% Pause)</option>
              <option value="140">140 WPM (Bình thường - Tiêu chuẩn bài giảng MOOC, 18% Pause)</option>
              <option value="160">160 WPM (Nhanh - Tóm tắt nhanh & truyền cảm hứng, 12% Pause)</option>
            </select>
          </div>

          {/* Learner Level */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Trình Độ Người Học (Learner Level)</label>
            <select
              value={editingConfig.learnerLevel}
              onChange={(e) =>
                setEditingConfig({ ...editingConfig, learnerLevel: e.target.value as LearnerLevel })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="beginner">Beginner / Học sinh phổ thông</option>
              <option value="undergraduate">Undergraduate / Sinh viên Đại học</option>
              <option value="graduate">Graduate / Học viên Cao học & Nghiên cứu sinh</option>
              <option value="professional">Professional / Kỹ sư doanh nghiệp</option>
            </select>
          </div>

          {/* Instructional Tone */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Giọng Điệu Sư Phạm (Instructional Tone)</label>
            <select
              value={editingConfig.narrationStyle}
              onChange={(e) =>
                setEditingConfig({ ...editingConfig, narrationStyle: e.target.value as NarrationStyle })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="academic">Học thuật & Chuẩn mực (Academic & Precise)</option>
              <option value="conversational">Tự nhiên & Đối thoại (Conversational & Engaging)</option>
              <option value="rigorous">Toán học Chặt chẽ (Mathematically Rigorous)</option>
              <option value="engaging">Truyền cảm hứng & Sinh động (Engaging Storytelling)</option>
            </select>
          </div>

          {/* Visual Density */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Mật Độ Hình Ảnh (Visual Density)</label>
            <select
              value={editingConfig.visualDensity}
              onChange={(e) =>
                setEditingConfig({ ...editingConfig, visualDensity: e.target.value as VisualDensity })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="minimal">Tối giản (Chỉ hiện định nghĩa & công thức trọng tâm)</option>
              <option value="balanced">Cân bằng (1-2 visual cues mỗi phân cảnh)</option>
              <option value="rich">Phong phú (Ảnh động, sơ đồ cấu trúc dày đặc)</option>
            </select>
          </div>

          {/* Narration Language */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Ngôn Ngữ Lời Giảng (Narration Language)</label>
            <select
              value={editingConfig.narration_language || editingConfig.language || 'vi'}
              onChange={(e) =>
                setEditingConfig({
                  ...editingConfig,
                  language: e.target.value,
                  narration_language: e.target.value as any
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="vi">Vietnamese (Tiếng Việt)</option>
              <option value="en">English (US/UK)</option>
            </select>
          </div>

          {/* Technical Terminology */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Thuật Ngữ Kỹ Thuật (Technical Terminology)</label>
            <select
              value={editingConfig.technical_terminology_language || 'en'}
              onChange={(e) =>
                setEditingConfig({
                  ...editingConfig,
                  technical_terminology_language: e.target.value as any,
                  preserve_technical_terms: true
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="en">English — Preserve Standard Terms (Bảo toàn chuẩn AI/CV)</option>
              <option value="vi">Tiếng Việt (Dịch thuần)</option>
            </select>
          </div>
        </div>

        {/* Terminology Policy Card */}
        <div className="p-3 bg-gradient-to-r from-indigo-50/80 to-blue-50/50 border border-indigo-100 rounded-xl text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-slate-700 font-medium">
              Chính sách ngôn ngữ: <strong>Generate natural Vietnamese narration while preserving standard English technical terminology</strong> (CNN, kernel, feature map, bounding box...).
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-white border border-indigo-200 text-indigo-700 font-semibold rounded shrink-0">
            Vietnamese-first
          </span>
        </div>

        {/* Prior Knowledge Input */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <label className="font-semibold text-slate-700 block">
            Kiến thức nền tảng yêu cầu (Prior Knowledge / Prerequisites)
          </label>
          <textarea
            rows={2}
            value={editingConfig.priorKnowledge}
            onChange={(e) => setEditingConfig({ ...editingConfig, priorKnowledge: e.target.value })}
            placeholder="Ví dụ: Đại số tuyến tính cơ bản, phép nhân ma trận, giải tích vi phân..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-sans"
          />
        </div>

        {/* Accessibility Switches */}
        <div className="pt-2 border-t border-slate-100">
          <label className="font-semibold text-slate-700 block mb-2">Trợ Năng & Hỗ Trợ Tiếp Cận (Accessibility)</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
              <input
                type="checkbox"
                checked={editingConfig.accessibility?.captions ?? true}
                onChange={(e) =>
                  setEditingConfig({
                    ...editingConfig,
                    accessibility: {
                      ...editingConfig.accessibility,
                      captions: e.target.checked,
                      highContrast: editingConfig.accessibility?.highContrast ?? false,
                      slowerPacing: editingConfig.accessibility?.slowerPacing ?? false
                    }
                  })
                }
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <span className="font-medium text-slate-800">Hiển thị Phụ đề (Captions)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
              <input
                type="checkbox"
                checked={editingConfig.accessibility?.highContrast ?? false}
                onChange={(e) =>
                  setEditingConfig({
                    ...editingConfig,
                    accessibility: {
                      ...editingConfig.accessibility,
                      captions: editingConfig.accessibility?.captions ?? true,
                      highContrast: e.target.checked,
                      slowerPacing: editingConfig.accessibility?.slowerPacing ?? false
                    }
                  })
                }
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <span className="font-medium text-slate-800">Độ tương phản cao (High Contrast)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
              <input
                type="checkbox"
                checked={editingConfig.accessibility?.slowerPacing ?? false}
                onChange={(e) =>
                  setEditingConfig({
                    ...editingConfig,
                    accessibility: {
                      ...editingConfig.accessibility,
                      captions: editingConfig.accessibility?.captions ?? true,
                      highContrast: editingConfig.accessibility?.highContrast ?? false,
                      slowerPacing: e.target.checked
                    }
                  })
                }
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <span className="font-medium text-slate-800">Nhịp điệu giãn cách (+24% Pause)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
