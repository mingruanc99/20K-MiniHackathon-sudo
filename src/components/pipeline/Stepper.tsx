// src/components/pipeline/Stepper.tsx
import React from 'react';
import {
  FileText,
  FileCode,
  Layers,
  Compass,
  Mic,
  Activity,
  Eye,
  ShieldCheck,
  Code2,
  Video,
  Sliders,
  BrainCircuit,
  Database,
  Sparkles,
  Network,
  GitMerge
} from 'lucide-react';

export type PipelineStage =
  | 'source'
  | 'markdown'
  | 'structure'
  | 'database'
  | 'curriculum'
  | 'understanding'
  | 'config'
  | 'plan'
  | 'transition'
  | 'narrative'
  | 'narration'
  | 'prosody'
  | 'visual'
  | 'quality'
  | 'ir'
  | 'video';

interface StepperProps {
  currentStage: PipelineStage;
  onSelectStage: (stage: PipelineStage) => void;
  maxAccessibleStage?: PipelineStage;
}

const STAGES: { id: PipelineStage; label: string; module: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'source', label: 'Tệp gốc', module: 'IN', icon: FileText },
  { id: 'markdown', label: 'Markdown CIR', module: 'CIR', icon: FileCode },
  { id: 'structure', label: 'Cấu trúc', module: 'M1', icon: Layers },
  { id: 'database', label: 'Database quan hệ', module: 'DB', icon: Database },
  { id: 'curriculum', label: 'Giáo trình động', module: 'KCL', icon: Network },
  { id: 'understanding', label: 'Hiểu bài giảng', module: 'M2', icon: BrainCircuit },
  { id: 'config', label: 'Cấu hình', module: 'CFG', icon: Sliders },
  { id: 'plan', label: 'Kế hoạch', module: 'ARC', icon: Compass },
  { id: 'transition', label: 'Cầu nối ý tưởng', module: 'TIL', icon: GitMerge },
  { id: 'narrative', label: 'Trí tuệ tự sự', module: 'NIL', icon: Sparkles },
  { id: 'narration', label: 'Lời giảng', module: '3A', icon: Mic },
  { id: 'prosody', label: 'Ngắt nghỉ', module: '3B', icon: Activity },
  { id: 'visual', label: 'Ý đồ thị giác', module: '3C', icon: Eye },
  { id: 'quality', label: 'Kiểm định', module: 'M4', icon: ShieldCheck },
  { id: 'ir', label: 'CLSG-IR', module: 'OUT', icon: Code2 },
  { id: 'video', label: 'Xem trước', module: 'SYN', icon: Video },
];

export const Stepper: React.FC<StepperProps> = ({ currentStage, onSelectStage }) => {
  return (
    <div className="w-full bg-paper-sheet border border-rule rounded-xl p-2 mb-6 shadow-sm overflow-x-auto">
      <div className="flex items-center min-w-[760px] justify-between gap-1">
        {STAGES.map((s, idx) => {
          const Icon = s.icon;
          const isActive = currentStage === s.id;

          return (
            <button
              key={s.id}
              onClick={() => onSelectStage(s.id)}
              className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg transition text-center group ${
                isActive
                  ? 'bg-paper-band border border-rule-strong text-print font-semibold shadow-xs'
                  : 'hover:bg-paper-band text-ink-soft'
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <span className={`text-[11px] font-mono px-1 py-0.2 rounded font-bold ${
                  isActive ? 'bg-cover text-white' : 'bg-paper-band text-ink-faint group-hover:bg-rule'
                }`}>
                  {s.module}
                </span>
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-print' : 'text-ink-faint group-hover:text-ink-soft'}`} />
              </div>
              <span className="text-xs truncate max-w-[90px]">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
