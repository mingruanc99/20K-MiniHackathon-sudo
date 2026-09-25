// src/components/pipeline/DecisionTrace.tsx
import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Lightbulb, PauseCircle, Layers } from 'lucide-react';

export const DecisionTrace: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-paper-sheet border border-rule rounded-xl overflow-hidden shadow-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-paper-band transition text-left"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-print" />
          <span className="text-xs font-bold text-ink uppercase tracking-wider">
            Giải Trình Quyết Định Sư Phạm & Tính Minh Bạch
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-paper-band text-print font-semibold border border-rule-strong">
            Kiểm Toán Nhận Thức
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-ink-faint" /> : <ChevronDown className="w-4 h-4 text-ink-faint" />}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-rule bg-paper-band space-y-3 text-xs">
          <div className="flex items-start gap-2.5 p-3 bg-paper-sheet rounded-lg border border-rule">
            <Lightbulb className="w-4 h-4 text-pen shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-ink">Tại sao lại tạo gợi ý thị giác cho phép Tích chập (Convolution)?</div>
              <div className="text-ink-soft mt-0.5 leading-relaxed">
                Lý do: Thao tác trượt ma trận 2D liên quan đến chuyển đổi không gian và vùng tiếp nhận chồng lấp, tạo tải nhận thức rất lớn nếu chỉ nghe giảng thoại đơn thuần. Trực quan hoá quá trình giúp học viên hình dung rõ cơ chế tích luỹ tích vô hướng.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 bg-paper-sheet rounded-lg border border-rule">
            <PauseCircle className="w-4 h-4 text-print-soft shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-ink">Tại sao chèn khoảng dừng 650ms sau định nghĩa bộ lọc Kernel?</div>
              <div className="text-ink-soft mt-0.5 leading-relaxed">
                Lý do: Phát hiện ranh giới khái niệm giữa định nghĩa cấu trúc của kernel và cơ chế trượt thuật toán, đòi hỏi thời gian nghỉ để bộ nhớ làm việc của người học củng cố kiến thức trước khi tiếp tục.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 bg-paper-sheet rounded-lg border border-rule">
            <Layers className="w-4 h-4 text-print-soft shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-ink">Tại sao Phân cảnh 3 được gán mức độ quan trọng cao?</div>
              <div className="text-ink-soft mt-0.5 leading-relaxed">
                Lý do: Phép tích chập là mục tiêu học tập trọng tâm ở cấp độ Hiểu & Phân tích (Bloom) của bài học, do đó được phân bổ 45% tổng thời lượng sư phạm của bài giảng.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
