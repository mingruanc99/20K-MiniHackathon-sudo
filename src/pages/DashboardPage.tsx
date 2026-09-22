// src/pages/DashboardPage.tsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { projectService } from '../services/projectService';
import { PPTXExtractor } from '../pipeline/module1_extractor/pptxExtractor';
import { PDFExtractor } from '../pipeline/module1_extractor/pdfExtractor';
import { Project, CanonicalDocumentTree } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  Plus,
  BookOpen,
  CheckCircle2,
  Clock,
  Video,
  ArrowRight,
  Sparkles,
  Trash2,
  UploadCloud,
  FileText,
  Loader2
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    loadProjects();
  }, [user]);

  const loadProjects = async () => {
    if (!user) return;
    setLoading(true);
    const list = await projectService.listProjects(user.uid);
    setProjects(list);
    setLoading(false);
  };

  const handlePptxUpload = async (file: File) => {
    setErrorMessage('');
    let activeUser = user;
    if (!activeUser) {
      loginAsDemo();
      activeUser = {
        uid: 'demo_user_edtech_01',
        email: 'alex.rivers@stanford.edu',
        displayName: 'Prof. Alex Rivers',
        role: 'instructor'
      };
    }

    try {
      setUploading(true);
      setUploadStatus(`Đang đọc cấu trúc bài giảng: ${file.name}...`);

      const filenameLower = file.name.toLowerCase();
      const isPptx = filenameLower.endsWith('.pptx') || filenameLower.endsWith('.ppt');
      const isPdf = filenameLower.endsWith('.pdf');

      let docTree: CanonicalDocumentTree | undefined;

      if (isPptx) {
        const extractor = new PPTXExtractor();
        docTree = await extractor.extract(file, file.name);
        setUploadStatus(`✅ Đã trích xuất thành công ${docTree.total_sections} slides! Đang tạo dự án...`);
      } else if (isPdf) {
        const extractor = new PDFExtractor();
        docTree = await extractor.extract(file, file.name);
        setUploadStatus(`✅ Đã trích xuất thành công ${docTree.total_sections} slides từ PDF! Đang tạo dự án...`);
      }

      const title = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      const totalSections = docTree?.total_sections || 5;
      const newProj = await projectService.createProject(
        activeUser.uid,
        title,
        {
          fileName: file.name,
          fileType: isPptx ? 'pptx' : isPdf ? 'pdf' : 'text',
          fileSize: file.size,
          cloudinaryUrl: URL.createObjectURL(file)
        },
        {
          language: 'vi',
          learnerLevel: 'undergraduate',
          priorKnowledge: 'Kiến thức nền tảng về môn học',
          targetDurationSeconds: Math.max(60, totalSections * 45),
          targetWpm: 140,
          narrationStyle: 'academic',
          visualDensity: 'balanced',
          interactionLevel: 'moderate',
          accessibility: { captions: true, highContrast: false, slowerPacing: false }
        },
        `Bài giảng tải lên từ file: ${file.name} (${Math.round(file.size / 1024)} KB, ${totalSections} slides)`,
        docTree
      );

      navigate(`/projects/${newProj.projectId}`);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMessage(`Lỗi xử lý file bài giảng: ${err.message || 'Không thể đọc nội dung file'}`);
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handlePptxUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user || !window.confirm('Bạn có chắc chắn muốn xoá bài giảng này không?')) return;
    await projectService.deleteProject(id, user.uid);
    loadProjects();
  };

  const verifiedCount = projects.filter((p) => p.status === 'verified').length;
  const processingCount = projects.filter((p) => p.status !== 'verified' && p.status !== 'uploaded').length;
  const totalSeconds = projects.reduce((sum, p) => sum + (p.configuration?.targetDurationSeconds || 180), 0);

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div>
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Bảng Điều Khiển Sư Phạm</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quản Lý Bài Giảng Video</h1>
          <p className="text-xs text-slate-500 mt-1">
            Chuyển đổi bài giảng slide (.pptx, .pdf) thành cấu trúc trung gian CLSG-IR chuẩn hóa sư phạm cho AI Video.
          </p>
        </div>
        <Link
          to="/projects/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Bài Giảng Mới</span>
        </Link>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="font-bold underline text-[11px]">Đóng</button>
        </div>
      )}

      {/* Prominent PPTX Upload Dropzone (Entire Card Clickable & Droppable) */}
      <label
        htmlFor="pptx-dashboard-input"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`block relative border-2 border-dashed rounded-2xl p-8 transition text-center cursor-pointer ${
          isDragOver
            ? 'border-indigo-600 bg-indigo-100/60 scale-[1.01] shadow-md ring-4 ring-indigo-100'
            : 'border-indigo-300 hover:border-indigo-500 bg-gradient-to-b from-indigo-50/40 via-white to-indigo-50/20'
        }`}
      >
        <input
          type="file"
          id="pptx-dashboard-input"
          accept=".pptx,.ppt,.pdf,.docx,.md,.txt"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handlePptxUpload(e.target.files[0]);
            }
          }}
          className="hidden"
        />

        <div className="max-w-xl mx-auto space-y-4 pointer-events-none">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
            {uploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            ) : (
              <UploadCloud className="w-8 h-8 text-indigo-600" />
            )}
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              {uploading ? uploadStatus : 'Kéo & Thả hoặc Bấm vào đây để Tải lên File Slide (.pptx, .pdf)'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Hỗ trợ <code>.pptx</code>, <code>.pdf</code>, <code>.docx</code>, <code>.md</code> — <strong>Không giới hạn số lượng slide</strong> (hỗ trợ từ 1 đến 100+ slides). Hệ thống sẽ đọc trực tiếp toàn bộ các slide/trang, trích xuất cấu trúc và phân tích sư phạm nhanh chóng.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 pointer-events-auto">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition">
              <UploadCloud className="w-4 h-4" />
              <span>Duyệt file từ máy tính</span>
            </span>

            <Link
              to="/projects/new"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold text-xs transition"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>⚡ Hoặc chạy Demo CNN 1-Click (5 Slides)</span>
            </Link>
          </div>
        </div>
      </label>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Tổng số dự án</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{projects.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Bài giảng sư phạm</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Đã xác thực CLSG-IR</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{verifiedCount}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Đạt chuẩn sư phạm & DAR-P</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Hàng đợi xử lý</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{processingCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Tác vụ đang chạy</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Tổng thời lượng video</span>
            <Video className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{Math.round(totalSeconds / 60)} phút</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Thời lượng video tổng hợp</div>
        </div>
      </div>

      {/* Projects List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Danh Sách Bài Giảng Gần Đây</h2>
          <span className="text-xs text-slate-400">Tìm thấy {projects.length} bài giảng</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Đang tải danh sách bài giảng...</div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">Chưa có bài giảng nào</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Bắt đầu bằng cách kéo thả file bài giảng (.pptx, .pdf) hoặc bấm nút trải nghiệm Demo CNN 1-Click.
            </p>
            <Link
              to="/projects/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo bài giảng đầu tiên</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {projects.map((p) => (
              <div
                key={p.projectId}
                onClick={() => navigate(`/projects/${p.projectId}`)}
                className="p-5 hover:bg-slate-50/80 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {p.source?.fileType || 'pptx'}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                      {p.title}
                    </h3>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{p.description || 'Dự án bài giảng sư phạm'}</p>
                </div>

                <div className="flex items-center gap-6 text-xs text-slate-500 shrink-0">
                  <div className="text-right hidden md:block">
                    <div className="font-mono text-slate-700 font-semibold">{p.configuration?.targetDurationSeconds || 180}s ({Math.round((p.configuration?.targetDurationSeconds || 180) / 60)} phút)</div>
                    <div className="text-[10px] text-slate-400 capitalize">
                      {p.configuration?.learnerLevel === 'beginner' ? 'Mới bắt đầu' : p.configuration?.learnerLevel === 'undergraduate' ? 'Đại học' : p.configuration?.learnerLevel === 'graduate' ? 'Sau đại học' : 'Chuyên nghiệp'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDelete(e, p.projectId)}
                      title="Xoá bài giảng"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="flex items-center gap-1 font-semibold text-indigo-600 text-xs group-hover:translate-x-0.5 transition">
                      Mở thiết kế <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
