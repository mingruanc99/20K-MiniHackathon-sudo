// src/pages/NewProjectPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { projectService } from '../services/projectService';
import { cloudinaryService } from '../services/cloudinaryService';
import { scanDocument, ScanProgress } from '../pipeline/services/documentScanner';
import { benchmarkService, buildScanRunLog, summarizeRun } from '../services/benchmark/benchmarkService';
import { LLMCallRecord } from '../services/llm/usageMeter';
import { UserConfiguration, SourceAsset, FileType, CanonicalDocumentTree, KnowledgeTree } from '../types';
import { UploadCloud, FileText, Sparkles, Sliders, CheckCircle2, ArrowRight, Layers, Loader2 } from 'lucide-react';

export const NewProjectPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedTree, setExtractedTree] = useState<CanonicalDocumentTree | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [knowledgeTree, setKnowledgeTree] = useState<KnowledgeTree | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanLog, setScanLog] = useState<{ calls: LLMCallRecord[]; timings: { stage: string; ms: number }[]; totalMs: number } | null>(null);
  const [isDemoSelected, setIsDemoSelected] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Configuration state
  const [config, setConfig] = useState<UserConfiguration>({
    language: 'vi',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Kiến thức nền tảng về xác suất và đại số tuyến tính',
    targetDurationSeconds: 180,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced',
    narration_language: 'vi',
    technical_terminology_language: 'en',
    preserve_technical_terms: true,
    natural_vietnamese: true,
    language_policy: {
      narration_language: 'vi',
      technical_terminology_language: 'en',
      preserve_technical_terms: true,
      natural_vietnamese: true
    },
    interactionLevel: 'moderate',
    accessibility: {
      captions: true,
      highContrast: false,
      slowerPacing: false
    }
  });

  const handleSelectDemo = () => {
    setIsDemoSelected(true);
    setSelectedFile(null);
    setExtractedTree(null);
    setKnowledgeTree(null);
    setScanLog(null);
    setTitle('Introduction to Convolutional Neural Networks');
    setDescription('Deep Learning for Computer Vision, Spatial Locality, and Feature Hierarchies (5 Slides)');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSelectedFile(f);
      setIsDemoSelected(false);
      setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));

      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (['pptx', 'pdf', 'md', 'markdown', 'txt'].includes(ext)) {
        try {
          setExtracting(true);
          setError('');
          setKnowledgeTree(null);
          const res = await scanDocument(f, f.name, config, { onProgress: setScanProgress });
          setExtractedTree(res.documentTree);
          setKnowledgeTree(res.knowledgeTree);
          setScanLog({
            calls: res.llmCalls,
            totalMs: res.timings.totalMs,
            timings: [
              { stage: 'extract', ms: res.timings.extractMs },
              { stage: 'ocr+keywords+chapters (parallel)', ms: res.timings.analyzeMs },
              { stage: 'build tree', ms: res.timings.buildMs }
            ]
          });
          setDescription(`Đã quét ${res.documentTree.total_sections} trang, ${res.knowledgeTree.stats.regions_ocr_done}/${res.knowledgeTree.stats.regions_total} vùng hình ảnh trong ${(res.timings.totalMs / 1000).toFixed(1)}s`);
        } catch (err: any) {
          console.warn('Document scan failed:', err);
          setError(`Không quét được tài liệu: ${err.message || err}`);
        } finally {
          setExtracting(false);
        }
      } else {
        setExtractedTree(null);
        setDescription(`Uploaded material: ${f.name} (${Math.round(f.size / 1024)} KB)`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề bài giảng.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      let sourceAsset: SourceAsset;

      if (isDemoSelected || !selectedFile) {
        sourceAsset = {
          fileName: 'cnn_intro.pptx',
          fileType: 'pptx',
          fileSize: 45200,
          cloudinaryPublicId: 'demo/cnn_intro',
          cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg'
        };
      } else {
        const uploadRes = await cloudinaryService.uploadFile(selectedFile, selectedFile.name);
        const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'pptx';
        sourceAsset = {
          fileName: selectedFile.name,
          fileType: ext as FileType,
          fileSize: selectedFile.size,
          cloudinaryPublicId: uploadRes.public_id,
          cloudinaryUrl: uploadRes.secure_url
        };
      }

      let project = await projectService.createProject(
        user.uid,
        title,
        sourceAsset,
        config,
        description,
        extractedTree || undefined
      );

      if (knowledgeTree && scanLog) {
        const log = buildScanRunLog({
          runId: `scan_${Date.now().toString(36)}`,
          projectId: project.projectId,
          projectTitle: title,
          config,
          tree: knowledgeTree,
          timings: scanLog.timings,
          totalMs: scanLog.totalMs,
          calls: scanLog.calls
        });
        project = { ...project, knowledgeTree, lastBenchmark: summarizeRun(log) };
        await Promise.all([projectService.updateProject(project), benchmarkService.saveRun(log)]);
      }

      navigate(`/projects/${project.projectId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <span className="text-xs font-semibold text-print uppercase tracking-wider">Tạo Dự Án Mới</span>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Khởi Tạo Bài Giảng Sư Phạm</h1>
        <p className="text-xs text-ink-faint mt-1">
          Tải lên tài liệu học tập (.pptx, .pdf, .docx, .md) hoặc chọn Demo CNN 1-Click để khởi chạy pipeline CLSG-IR.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-pen-soft border border-pen-line text-xs text-pen">
            {error}
          </div>
        )}

        {/* Source Material Selector */}
        <div className="bg-paper-sheet border border-rule rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-print" />
            <span>Bước 1: Chọn Tài Liệu Bài Giảng</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1-Click CNN Demo Card */}
            <div
              onClick={handleSelectDemo}
              className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                isDemoSelected
                  ? 'border-print bg-paper-band shadow-xs'
                  : 'border-rule hover:border-rule-strong bg-paper-sheet'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-print px-2 py-0.5 rounded bg-paper-band">
                    Bài giảng mẫu
                  </span>
                  {isDemoSelected && <CheckCircle2 className="w-4 h-4 text-print" />}
                </div>
                <h3 className="text-sm font-bold text-ink">Bài giảng mẫu: CNN & Tích chập</h3>
                <p className="text-xs text-ink-faint mt-1">
                  Nhập môn Mạng nơ-ron Tích chập CNN (5 Slides). Bao gồm Convolutions, Kernels, Feature Maps, và Max Pooling.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-rule flex items-center gap-2 text-xs text-print font-medium">
                <Sparkles className="w-3.5 h-3.5" /> Thực thi trực tuyến bằng Google Gemini AI
              </div>
            </div>

            {/* Custom Upload Card */}
            <label
              className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                !isDemoSelected && selectedFile
                  ? 'border-print bg-paper-band shadow-xs'
                  : 'border-rule hover:border-rule-strong bg-paper-sheet'
              }`}
            >
              <input
                type="file"
                accept=".pptx,.ppt,.pdf,.docx,.md,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink-soft px-2 py-0.5 rounded bg-paper-band">
                    Tải tài liệu lên
                  </span>
                  {!isDemoSelected && selectedFile && <CheckCircle2 className="w-4 h-4 text-print" />}
                </div>
                <h3 className="text-sm font-bold text-ink">
                  {selectedFile ? selectedFile.name : 'Tải lên PPTX, PDF, DOCX hoặc Markdown'}
                </h3>
                <p className="text-xs text-ink-faint mt-1">
                  {selectedFile
                    ? `Đã chọn tệp: ${Math.round(selectedFile.size / 1024)} KB`
                    : 'Kéo thả hoặc bấm vào đây để tải lên slide bài giảng (.pptx, .pdf) hoặc đề cương.'}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-rule flex items-center gap-2 text-xs text-print font-medium">
                <UploadCloud className="w-3.5 h-3.5" /> Bộ bóc tách Rule-based sẵn sàng
              </div>
            </label>
          </div>

          {/* Real-time Extraction Preview */}
          {extracting && (
            <div className="p-4 rounded-xl bg-paper-band border border-rule-strong flex items-center gap-3 text-xs text-print">
              <Loader2 className="w-4 h-4 animate-spin text-print shrink-0" />
              <span className="flex-1">{scanProgress?.message || 'Đang đọc tài liệu...'}</span>
              <span className="font-mono tabular-nums">{((scanProgress?.elapsedMs || 0) / 1000).toFixed(1)}s</span>
            </div>
          )}

          {extractedTree && (
            <div className="p-4 rounded-xl bg-paper-band border border-rule-strong space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-print flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-print" />
                  Đã quét {extractedTree.total_sections} trang từ {extractedTree.source_type.toUpperCase()}
                  {knowledgeTree ? ` trong ${(knowledgeTree.stats.scan_ms / 1000).toFixed(1)}s • ${knowledgeTree.stats.regions_ocr_done}/${knowledgeTree.stats.regions_total} vùng ảnh đã đọc • ${knowledgeTree.stats.total_tokens.toLocaleString()} tokens` : ''}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-paper-band text-cover font-bold">
                  {knowledgeTree?.model || 'local-rules'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {extractedTree.sections.map((sec, idx) => (
                  <div key={sec.section_id} className="p-2.5 rounded-lg bg-paper-sheet border border-rule-strong shadow-2xs space-y-0.5">
                    <div className="font-bold text-ink flex items-center gap-1.5">
                      <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-paper-band text-print">
                        Slide {idx + 1}
                      </span>
                      <span className="truncate">{sec.title}</span>
                    </div>
                    <div className="text-[11px] text-ink-faint">
                      {sec.elements.length} phần tử nội dung (Tiêu đề, Bullet points)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project Title Input */}
          <div className="pt-3 border-t border-rule">
            <label className="block text-xs font-semibold text-ink-soft mb-1">Tiêu Đề Bài Giảng</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Nhập môn Mạng Nơ-ron Tích chập (CNN)"
              className="w-full px-3.5 py-2 border border-rule-strong rounded-lg text-xs font-medium focus:ring-2 focus:ring-print outline-none"
            />
          </div>
        </div>

        {/* Instructional & Learner Configuration */}
        <div className="bg-paper-sheet border border-rule rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-print" />
            <span>Bước 2: Ngữ Cảnh Người Học & Cấu Hình Sư Phạm</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-ink-soft mb-1">Trình Độ Người Học</label>
              <select
                value={config.learnerLevel}
                onChange={(e) => setConfig({ ...config, learnerLevel: e.target.value as any })}
                className="w-full px-3 py-2 border border-rule-strong rounded-lg text-xs outline-none"
              >
                <option value="beginner">Mới bắt đầu / Phổ thông</option>
                <option value="undergraduate">Đại học</option>
                <option value="graduate">Sau đại học / Nghiên cứu chuyên sâu</option>
                <option value="professional">Chuyên gia / Doanh nghiệp</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-ink-soft mb-1">Thời Lượng Mục Tiêu</label>
              <select
                value={config.targetDurationSeconds}
                onChange={(e) => setConfig({ ...config, targetDurationSeconds: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-rule-strong rounded-lg text-xs outline-none"
              >
                <option value="60">1 Phút (~120 từ)</option>
                <option value="180">3 Phút (~340 từ)</option>
                <option value="300">5 Phút (~560 từ)</option>
                <option value="600">10 Phút (~1120 từ)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-ink-soft mb-1">Tốc Độ Lời Giảng (WPM)</label>
              <select
                value={config.targetWpm}
                onChange={(e) => setConfig({ ...config, targetWpm: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-rule-strong rounded-lg text-xs outline-none"
              >
                <option value="120">Chậm (120 WPM, nghỉ 22%)</option>
                <option value="140">Bình thường (140 WPM, nghỉ 18%)</option>
                <option value="160">Nhanh (160 WPM, nghỉ 12%)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-ink-soft mb-1">Phong Cách Lời Giảng</label>
              <select
                value={config.narrationStyle}
                onChange={(e) => setConfig({ ...config, narrationStyle: e.target.value as any })}
                className="w-full px-3 py-2 border border-rule-strong rounded-lg text-xs outline-none"
              >
                <option value="conversational">Đàm thoại & Lôi cuốn</option>
                <option value="academic">Hàn lâm & Chuẩn xác</option>
                <option value="rigorous">Toán học & Chặt chẽ</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-ink-soft mb-1">Mật Độ Thị Giác</label>
              <select
                value={config.visualDensity}
                onChange={(e) => setConfig({ ...config, visualDensity: e.target.value as any })}
                className="w-full px-3 py-2 border border-rule-strong rounded-lg text-xs outline-none"
              >
                <option value="minimal">Tối giản (Chỉ khái niệm chính)</option>
                <option value="balanced">Cân bằng (1-2 hình mỗi cảnh)</option>
                <option value="rich">Phong phú (Hoạt ảnh liên tục)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-ink-soft mb-1">Ngôn Ngữ Lời Giảng (Narration Language)</label>
              <select
                value={config.narration_language || config.language || 'vi'}
                onChange={(e) => setConfig({ ...config, language: e.target.value, narration_language: e.target.value as any })}
                className="w-full px-3 py-2 border border-rule-strong rounded-lg text-xs outline-none"
              >
                <option value="vi">Vietnamese (Tiếng Việt)</option>
                <option value="en">English</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-ink-soft mb-1">Cách Viết Lời Giảng</label>
              <select
                value={config.narrationEngine || 'template'}
                onChange={(e) => setConfig({ ...config, narrationEngine: e.target.value as 'template' | 'llm' })}
                className="w-full px-3 py-2 border border-rule-strong rounded-lg text-xs outline-none"
              >
                <option value="template">Theo mẫu (nhanh, 0 token)</option>
                <option value="llm">LLM viết (tự nhiên hơn, tốn token)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-ink-soft mb-1">Thuật Ngữ Kỹ Thuật (Technical Terminology)</label>
              <select
                value={config.technical_terminology_language || 'en'}
                onChange={(e) => setConfig({ ...config, technical_terminology_language: e.target.value as any, preserve_technical_terms: true })}
                className="w-full px-3 py-2 border border-rule-strong rounded-lg text-xs outline-none"
              >
                <option value="en">English — Preserve Standard Terms (Bảo toàn chuẩn AI/CV)</option>
                <option value="vi">Tiếng Việt (Dịch toàn bộ)</option>
              </select>
            </div>
          </div>

          {/* Language policy note */}
          <div className="mt-3 p-2.5 bg-paper-band border border-rule-strong rounded-xl text-xs text-print flex items-center justify-between">
            <span>
              💡 <strong>Chính sách ngôn ngữ mặc định:</strong> Generate natural Vietnamese narration while preserving standard English technical terminology (CNN, kernel, feature map, bounding box...).
            </span>
            <span className="font-mono text-[11px] bg-paper-sheet px-2 py-0.5 rounded border border-rule-strong text-print shrink-0 ml-2">
              vi + en-terms
            </span>
          </div>
        </div>

        {/* Submit button */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 border border-rule-strong rounded-xl text-xs font-semibold text-ink-soft hover:bg-paper-band transition"
          >
            Huỷ bỏ
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cover hover:bg-cover text-white font-semibold text-xs shadow-sm transition"
          >
            {loading ? 'Đang khởi tạo dự án...' : 'Tạo & Mở Phòng Thiết Kế'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
