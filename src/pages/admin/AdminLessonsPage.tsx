// src/pages/admin/AdminLessonsPage.tsx
import React, { useState } from 'react';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  ExternalLink,
  Flame,
  ArrowUpRight,
  X,
  FileText,
  DollarSign,
  Cpu
} from 'lucide-react';

interface LessonAdminItem {
  id: string;
  title: string;
  author: string;
  authorEmail: string;
  sectionsCount: number;
  status: 'Published' | 'Draft' | 'Generating' | 'Failed' | 'Archived';
  qualityScore: number;
  aiCost: number;
  latencyMs: number;
  model: string;
  promptVersion: string;
  traceId: string;
  lastUpdated: string;
  sections: {
    id: string;
    title: string;
    role: string;
    narration: string;
    durationSec: number;
  }[];
}

export const AdminLessonsPage: React.FC = () => {
  const [selectedLesson, setSelectedLesson] = useState<LessonAdminItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const lessons: LessonAdminItem[] = [
    {
      id: 'proj_pose_17_keypoints',
      title: 'Keypoint & Human Pose Estimation',
      author: 'Huỳnh Khắc Thiên',
      authorEmail: 'hkthien@husc.edu.vn',
      sectionsCount: 4,
      status: 'Published',
      qualityScore: 99.2,
      aiCost: 0.0032,
      latencyMs: 840,
      model: 'gemini-1.5-pro',
      promptVersion: 'section_generator:v2.1',
      traceId: 'tr_lf_pose_s2_0912',
      lastUpdated: '2026-09-22 22:45',
      sections: [
        {
          id: 'S1',
          title: 'Giới Thiệu Keypoint & Pose',
          role: 'INTRODUCTION',
          narration: 'Chào mừng các bạn đến với bài học về Keypoint & Pose. Trong phần này, chúng ta sẽ tìm hiểu cách mô hình biểu diễn các điểm đặc trưng và tư thế của con người.',
          durationSec: 18.5
        },
        {
          id: 'S2',
          title: 'Thách Thức Góc Nhìn',
          role: 'HOOK',
          narration: 'Bạn thử nhìn một người từ góc này. Liệu mô hình có thể xác định chính xác đâu là tay trái và tay phải? Cấu trúc đối xứng cơ thể đặt ra bài toán suy luận phức tạp.',
          durationSec: 22.0
        },
        {
          id: 'S3',
          title: 'Phân Tích Cánh Tay Bị Che Khuất',
          role: 'EXAMPLE',
          narration: 'Trong hình này, cánh tay bị che một phần. Mô hình vẫn cần suy ra vị trí của khớp khuỷu tay dựa trên các keypoint xung quanh.',
          durationSec: 24.5
        },
        {
          id: 'S4',
          title: 'Mối Quan Hệ Không Gian Giữa Các Keypoint',
          role: 'MECHANISM',
          narration: 'Để giải quyết vấn đề này, mô hình không chỉ nhìn từng điểm riêng lẻ mà còn học mối quan hệ không gian giữa các keypoint.',
          durationSec: 25.0
        }
      ]
    },
    {
      id: 'proj_intro_to_cnn',
      title: 'Introduction to Convolutional Neural Networks',
      author: 'Prof. Alex Rivers',
      authorEmail: 'alex.rivers@stanford.edu',
      sectionsCount: 5,
      status: 'Published',
      qualityScore: 98.8,
      aiCost: 0.0041,
      latencyMs: 760,
      model: 'gemini-1.5-pro',
      promptVersion: 'section_generator:v2.1',
      traceId: 'tr_lf_cnn_s3_0772',
      lastUpdated: '2026-09-22 20:15',
      sections: [
        {
          id: 'S1',
          title: 'What is CNN?',
          role: 'CORE_CONCEPT',
          narration: 'CNN, hay Convolutional Neural Network, là một kiến trúc neural network được thiết kế đặc biệt để xử lý dữ liệu dạng grid như hình ảnh.',
          durationSec: 20.0
        },
        {
          id: 'S2',
          title: 'CNN Architecture',
          role: 'KEY_EXPLANATION',
          narration: 'Để hiểu cách CNN xử lý ảnh, chúng ta có thể nhìn vào kiến trúc gồm nhiều layer, trong đó mỗi layer đảm nhiệm một vai trò khác nhau.',
          durationSec: 25.0
        },
        {
          id: 'S3',
          title: 'Convolution Operation',
          role: 'KEY_EXPLANATION',
          narration: 'Ở slide trước, chúng ta đã thấy CNN gồm nhiều layer. CNN dùng kernel để quét qua từng vùng nhỏ của ảnh và tạo ra feature map.',
          durationSec: 28.0
        },
        {
          id: 'S4',
          title: 'Convolution Example',
          role: 'EXAMPLE',
          narration: 'Để hình dung rõ hơn cơ chế này, chúng ta thử nhìn vào một ví dụ cụ thể. Khi kernel di chuyển trên ảnh, mỗi vị trí sẽ tạo ra một giá trị tương ứng.',
          durationSec: 26.0
        },
        {
          id: 'S5',
          title: 'Summary',
          role: 'SUMMARY',
          narration: 'Như vậy, convolution giúp trích xuất đặc trưng từ ảnh và pooling giúp giảm kích thước biểu diễn hiệu quả.',
          durationSec: 22.0
        }
      ]
    },
    {
      id: 'proj_linear_algebra_ai',
      title: 'Eigenvectors & SVD in Deep Learning',
      author: 'Dr. Minh Nguyen',
      authorEmail: 'minh.nguyen@vinuni.edu.vn',
      sectionsCount: 6,
      status: 'Generating',
      qualityScore: 94.2,
      aiCost: 0.0028,
      latencyMs: 1140,
      model: 'gemini-1.5-pro',
      promptVersion: 'section_generator:v2.0',
      traceId: 'tr_lf_svd_s3_0411',
      lastUpdated: '2026-09-22 18:30',
      sections: []
    },
    {
      id: 'proj_vision_transformers',
      title: 'Vision Transformers (ViT) Architecture',
      author: 'Le Hoang Nam',
      authorEmail: 'nam.lh@fpt.edu.vn',
      sectionsCount: 7,
      status: 'Draft',
      qualityScore: 91.0,
      aiCost: 0.0019,
      latencyMs: 980,
      model: 'gemini-1.5-flash',
      promptVersion: 'section_generator:v2.0',
      traceId: 'tr_lf_vit_s6_0102',
      lastUpdated: '2026-09-22 14:10',
      sections: []
    }
  ];

  const filteredLessons = lessons.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.title.toLowerCase().includes(q) || l.author.toLowerCase().includes(q) || l.id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Lessons Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý toàn bộ bài giảng trong hệ thống, theo dõi chất lượng sư phạm, trạng thái sinh AI và chi phí.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Tổng số:</span>
          <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs font-mono">
            {lessons.length} bài giảng
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm bài giảng, tác giả, id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Published">Published</option>
              <option value="Generating">Generating</option>
              <option value="Draft">Draft</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Lessons Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Bài Giảng</th>
                <th className="py-3 px-3">Tác Giả</th>
                <th className="py-3 px-3">Sections</th>
                <th className="py-3 px-3">Trạng Thái</th>
                <th className="py-3 px-3">Chất Lượng</th>
                <th className="py-3 px-3">AI Cost</th>
                <th className="py-3 px-3">Cập Nhật</th>
                <th className="py-3 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLessons.map((lesson) => (
                <tr
                  key={lesson.id}
                  onClick={() => setSelectedLesson(lesson)}
                  className="hover:bg-blue-50/40 cursor-pointer transition"
                >
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-800">{lesson.title}</div>
                    <div className="text-[10px] font-mono text-slate-400">{lesson.id}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-700">{lesson.author}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{lesson.authorEmail}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono">{lesson.sectionsCount} slides</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        lesson.status === 'Published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : lesson.status === 'Generating'
                          ? 'bg-blue-100 text-blue-800 animate-pulse'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {lesson.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="font-bold text-slate-800">{lesson.qualityScore}</span>
                    <span className="text-[10px] text-slate-400">/100</span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono text-emerald-600 font-semibold">
                    ${lesson.aiCost.toFixed(4)}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                    {lesson.lastUpdated}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLesson(lesson);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lesson Detail Drawer / Modal */}
      {selectedLesson && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-3xl w-full rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedLesson.title}</h3>
                  <div className="text-[11px] text-slate-400 font-mono">Tác giả: {selectedLesson.author} ({selectedLesson.authorEmail})</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLesson(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
              {/* Technical Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Điểm Chất Lượng</span>
                  <div className="text-base font-bold text-emerald-600">{selectedLesson.qualityScore}/100</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">AI Cost</span>
                  <div className="text-base font-mono font-bold text-slate-800">${selectedLesson.aiCost.toFixed(4)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Mô hình AI</span>
                  <div className="font-mono text-xs font-semibold text-slate-800">{selectedLesson.model}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Latency TB</span>
                  <div className="font-mono text-xs font-semibold text-slate-800">{selectedLesson.latencyMs}ms</div>
                </div>
              </div>

              {/* Sections Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Danh Sách Phân Cảnh (Sections Breakdown)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">{selectedLesson.sections.length} sections</span>
                </div>

                <div className="space-y-2.5">
                  {selectedLesson.sections.map((sec) => (
                    <div
                      key={sec.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[10px]">
                            {sec.id}
                          </span>
                          <span className="font-semibold text-slate-800">{sec.title}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">[{sec.role}]</span>
                        </div>
                        <span className="text-slate-400 font-mono text-[10px]">{sec.durationSec}s</span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed pl-2 border-l-2 border-blue-200">
                        "{sec.narration}"
                      </p>
                    </div>
                  ))}

                  {selectedLesson.sections.length === 0 && (
                    <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Bài giảng đang trong trạng thái khởi tạo phân cảnh.
                    </div>
                  )}
                </div>
              </div>

              {/* Trace Deep Link */}
              <div className="flex items-center justify-between p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl">
                <div>
                  <div className="text-[10px] text-blue-600 font-semibold uppercase">Langfuse Trace ID</div>
                  <div className="font-mono text-xs text-slate-800">{selectedLesson.traceId}</div>
                </div>

                <a
                  href={adminTelemetryService.getLangfuseTraceUrl(selectedLesson.traceId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-xs"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Inspect Trace</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedLesson(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-xl hover:bg-slate-100 transition shadow-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
