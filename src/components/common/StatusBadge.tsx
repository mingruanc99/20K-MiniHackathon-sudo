// src/components/common/StatusBadge.tsx
import React from 'react';
import { ProjectProcessingStatus } from '../../types';
import { CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';

export const StatusBadge: React.FC<{ status: ProjectProcessingStatus; className?: string }> = ({
  status,
  className = ''
}) => {
  switch (status) {
    case 'verified':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-paper-band text-print border border-rule-strong ${className}`}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Đã xác thực
        </span>
      );
    case 'extracting':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-paper-band text-print border border-rule-strong ${className}`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang bóc tách...
        </span>
      );
    case 'planning':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-paper-band text-print border border-rule-strong ${className}`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang lập kế hoạch...
        </span>
      );
    case 'generating':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-paper-band text-print border border-rule-strong ${className}`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang sinh nội dung...
        </span>
      );
    case 'validating':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-paper-band text-print border border-rule-strong ${className}`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang kiểm định...
        </span>
      );
    case 'failed':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pen-soft text-pen border border-pen-line ${className}`}>
          <AlertCircle className="w-3.5 h-3.5" /> Thất bại
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-paper-band text-ink-soft border border-rule ${className}`}>
          <Clock className="w-3.5 h-3.5" /> {status === 'uploaded' ? 'Đã tải lên' : status}
        </span>
      );
  }
};
