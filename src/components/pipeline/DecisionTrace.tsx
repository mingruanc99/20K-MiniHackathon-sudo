// src/components/pipeline/DecisionTrace.tsx
import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Lightbulb, PauseCircle, Layers } from 'lucide-react';

export const DecisionTrace: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition text-left"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Giải Trình Quyết Định Sư Phạm & Tính Minh Bạch
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
            Kiểm Toán Nhận Thức
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3 text-xs">
          <div className="flex items-start gap-2.5 p-3 bg-white rounded-lg border border-slate-200">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900">Tại sao lại tạo gợi ý thị giác cho phép Tích chập (Convolution)?</div>
              <div className="text-slate-600 mt-0.5 leading-relaxed">
                Lý do: Thao tác trượt ma trận 2D liên quan đến chuyển đổi không gian và vùng tiếp nhận chồng lấp, tạo tải nhận thức rất lớn nếu chỉ nghe giảng thoại đơn thuần. Trực quan hoá quá trình giúp học viên hình dung rõ cơ chế tích luỹ tích vô hướng.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 bg-white rounded-lg border border-slate-200">
            <PauseCircle className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900">Tại sao chèn khoảng dừng 650ms sau định nghĩa bộ lọc Kernel?</div>
              <div className="text-slate-600 mt-0.5 leading-relaxed">
                Lý do: Phát hiện ranh giới khái niệm giữa định nghĩa cấu trúc của kernel và cơ chế trượt thuật toán, đòi hỏi thời gian nghỉ để bộ nhớ làm việc của người học củng cố kiến thức trước khi tiếp tục.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 bg-white rounded-lg border border-slate-200">
            <Layers className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900">Tại sao Phân cảnh 3 được gán mức độ quan trọng cao?</div>
              <div className="text-slate-600 mt-0.5 leading-relaxed">
                Lý do: Phép tích chập là mục tiêu học tập trọng tâm ở cấp độ Hiểu & Phân tích (Bloom) của bài học, do đó được phân bổ 45% tổng thời lượng sư phạm của bài giảng.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
