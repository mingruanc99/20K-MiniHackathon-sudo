// src/pages/ProjectDetailPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { projectService } from '../services/projectService';
import { pipelineOrchestrator } from '../pipeline/orchestrator';
import { Project, ExecutionTraceLog, UserConfiguration } from '../types';
import { Stepper, PipelineStage } from '../components/pipeline/Stepper';
import { StatusBadge } from '../components/common/StatusBadge';
import { MarkdownViewer } from '../components/pipeline/MarkdownViewer';
import { StructureViewer } from '../components/pipeline/StructureViewer';
import { UserConfigViewer } from '../components/pipeline/UserConfigViewer';
import { PlanViewer } from '../components/pipeline/PlanViewer';
import { NarrationViewer } from '../components/pipeline/NarrationViewer';
import { ProsodyViewer } from '../components/pipeline/ProsodyViewer';
import { VisualIntentViewer } from '../components/pipeline/VisualIntentViewer';
import { QualityGuardViewer } from '../components/pipeline/QualityGuardViewer';
import { LessonUnderstandingViewer } from '../components/pipeline/LessonUnderstandingViewer';
import { CLSGIRInspector } from '../components/pipeline/CLSGIRInspector';
import { VideoPreview } from '../components/pipeline/VideoPreview';
import { DecisionTrace } from '../components/pipeline/DecisionTrace';
import { RelationalDatabaseViewer } from '../components/pipeline/RelationalDatabaseViewer';
import { NarrativeInspector } from '../components/pipeline/NarrativeInspector';
import { KnowledgeGraphCurriculumViewer } from '../components/pipeline/KnowledgeGraphCurriculumViewer';
import TransitionIntelligenceViewer from '../components/pipeline/TransitionIntelligenceViewer';
import { technicalTerminologyService } from '../pipeline/services/technicalTerminologyService';
import { ApiKeyModal } from '../components/common/ApiKeyModal';
import { benchmarkService, summarizeRun } from '../services/benchmark/benchmarkService';
import { BenchmarkRunLog } from '../services/benchmark/benchmarkTypes';
import {
  Sparkles,
  Play,
  RotateCw,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Layers,
  KeyRound
} from 'lucide-react';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStage, setCurrentStage] = useState<PipelineStage>('source');
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineError, setPipelineError] = useState<string>('');
  const [progressMsg, setProgressMsg] = useState('');
  const [traceLogs, setTraceLogs] = useState<ExecutionTraceLog[]>([]);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [lastRun, setLastRun] = useState<BenchmarkRunLog | null>(null);

  useEffect(() => {
    if (user && id) {
      loadProject();
    }
  }, [user, id]);

  const sanitizeLegacyProject = (p: Project): Project => {
    if (!p.clsgIr?.scenes) return p;
    let modified = false;
    const sanitizedScenes = p.clsgIr.scenes.map((scene) => {
      let sceneMod = false;
      const cleanNarrationText = technicalTerminologyService.resolveAndPreserveSentence(scene.narration.text).resolvedText;
      if (cleanNarrationText !== scene.narration.text) {
        sceneMod = true;
        modified = true;
      }

      const cleanSentences = (scene.narration.sentences || []).map((sent) => {
        const { resolvedText } = technicalTerminologyService.resolveAndPreserveSentence(sent.text);
        if (resolvedText !== sent.text) {
          sceneMod = true;
          modified = true;
          return { ...sent, text: resolvedText };
        }
        return sent;
      });

      const cleanProsodySentences = (scene.prosody_plan?.sentences || []).map((sent) => {
        const { resolvedText } = technicalTerminologyService.resolveAndPreserveSentence(sent.text);
        if (resolvedText !== sent.text) {
          sceneMod = true;
          modified = true;
          return { ...sent, text: resolvedText };
        }
        return sent;
      });

      if (sceneMod) {
        return {
          ...scene,
          narration: {
            ...scene.narration,
            text: cleanNarrationText,
            sentences: cleanSentences,
            word_count: cleanNarrationText.split(/\s+/).length
          },
          prosody_plan: {
            ...scene.prosody_plan,
            sentences: cleanProsodySentences
          }
        };
      }
      return scene;
    });

    if (modified) {
      const sanitizedProject: Project = {
        ...p,
        clsgIr: {
          ...p.clsgIr,
          scenes: sanitizedScenes
        }
      };
      projectService.updateProject(sanitizedProject).catch(console.warn);
      return sanitizedProject;
    }
    return p;
  };

  const loadProject = async () => {
    if (!user || !id) return;
    setLoading(true);
    let p = await projectService.getProject(id, user.uid);
    if (!p) {
      // Fallback to demo project
      p = projectService.getBuiltinCnnProject(user.uid);
    }
    p = sanitizeLegacyProject(p);
    setProject(p);
    setTraceLogs(p.executionLogs || []);
    benchmarkService.listRuns(p.projectId, 5).then((runs) => setLastRun(runs.find((r) => r.kind === 'pipeline') || null));
    setLoading(false);

    // If already verified, set stage to quality or ir
    const rerun = searchParams.get('rerun') === '1';
    if (rerun) {
      setSearchParams({}, { replace: true });
      runPipeline(p);
    } else if (p.status === 'verified' && p.clsgIr) {
      setCurrentStage('quality');
    } else if (p.status === 'uploaded') {
      // Auto-trigger full pipeline for immediate satisfaction
      runPipeline(p);
    }
  };

  const runPipeline = async (targetProject?: Project) => {
    const proj = targetProject || project;
    if (!proj) return;

    try {
      setPipelineError('');
      setPipelineRunning(true);
      setProgressMsg('Initializing pipeline orchestrator...');

      const result = await pipelineOrchestrator.runFullPipeline(
        proj.canonicalDocument || proj.source.fileName,
        proj.source.fileName,
        proj.configuration,
        (msg) => setProgressMsg(msg),
        { knowledgeTree: proj.knowledgeTree, projectId: proj.projectId, projectTitle: proj.title }
      );

      const updatedProject: Project = {
        ...proj,
        status: result.qualityReport.overall_status === 'FAILED' ? 'failed' : 'verified',
        canonicalDocument: result.documentTree,
        lessonBlueprint: result.blueprint,
        clsgIr: result.verifiedIr,
        qualityReport: result.qualityReport,
        executionLogs: result.traceLogs,
        lastBenchmark: summarizeRun(result.benchmark),
        updatedAt: new Date().toISOString()
      };

      setProject(updatedProject);
      setTraceLogs(result.traceLogs);
      setLastRun(result.benchmark);
      await Promise.all([projectService.updateProject(updatedProject), benchmarkService.saveRun(result.benchmark)]);
      setCurrentStage('quality');
    } catch (err: any) {
      console.error('Pipeline failed:', err);
      setPipelineError(`Lỗi xử lý Pipeline: ${err.message || err}`);
    } finally {
      setPipelineRunning(false);
      setProgressMsg('');
    }
  };

  const handleUpdateConfig = async (newConfig: UserConfiguration, reRunPipeline: boolean) => {
    if (!project) return;
    const updatedProj: Project = {
      ...project,
      configuration: newConfig,
      updatedAt: new Date().toISOString()
    };
    setProject(updatedProj);
    await projectService.updateProject(updatedProj);

    if (reRunPipeline) {
      await runPipeline(updatedProj);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-ink-faint">Đang tải phòng thiết kế bài giảng...</div>;
  }

  if (!project) {
    return (
      <div className="p-12 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-pen mx-auto" />
        <div className="text-sm font-semibold text-ink-soft">Không tìm thấy bài giảng</div>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs text-navy font-semibold"
        >
          Quay lại Bảng điều khiển
        </button>
      </div>
    );
  }

  const scenes = project.clsgIr?.scenes || [];

  return (
    <div className="space-y-6">
      {pipelineError && (
        <div className="p-4 rounded-xl bg-pen-soft border border-pen-line text-xs text-pen flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-pen shrink-0" />
            <span className="leading-relaxed">{pipelineError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsKeyModalOpen(true)}
              className="px-3 py-1.5 bg-pen hover:bg-pen text-white rounded-lg font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Đổi Key / Chuyển sang Claude hoặc OpenAI</span>
            </button>
            <button
              onClick={() => runPipeline()}
              className="px-3 py-1.5 bg-pen hover:bg-pen text-white rounded-lg font-semibold text-xs transition"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* Studio Header */}
      <div className="bg-paper-sheet border border-rule rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-paper-band text-ink-soft">
              {project.source.fileType.toUpperCase()}
            </span>
            <StatusBadge status={project.status} />
            <span className="text-xs text-ink-faint">• Cập nhật lúc {new Date(project.updatedAt).toLocaleTimeString()}</span>
          </div>
          <h1 className="text-xl font-bold text-ink">{project.title}</h1>
          <p className="text-xs text-ink-faint mt-0.5">{project.description}</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Link
            to={`/projects/${project.projectId}/knowledge`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rule-strong hover:bg-paper-band text-ink-soft text-xs font-semibold shadow-2xs transition"
          >
            <Layers className="w-3.5 h-3.5 text-print" />
            <span>Knowledge Inspector</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsKeyModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rule-strong hover:bg-paper-band text-ink-soft text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-pen" />
            <span>Cấu hình AI / Đổi Key</span>
          </button>

          <button
            onClick={() => runPipeline()}
            disabled={pipelineRunning}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cover hover:bg-cover text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            {pipelineRunning ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{pipelineRunning ? progressMsg || 'Đang thực thi Pipeline...' : 'Chạy Toàn Bộ Pipeline'}</span>
          </button>
        </div>
      </div>

      {/* Stepper Navigation */}
      <Stepper currentStage={currentStage} onSelectStage={(s) => setCurrentStage(s)} />

      {/* Active Stage View */}
      <div className="min-h-[460px]">
        {currentStage === 'source' && (
          <div className="bg-paper-sheet border border-rule rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider">Tài Liệu Bài Giảng Gốc</h2>
            <div className="p-4 rounded-xl bg-paper-band border border-rule space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-faint font-medium">Tên file:</span>
                <span className="font-mono font-bold text-ink">{project.source.fileName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-faint font-medium">Định dạng:</span>
                <span className="uppercase font-mono text-ink">{project.source.fileType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-faint font-medium">Cloudinary Public ID:</span>
                <span className="font-mono text-print">{project.source.cloudinaryPublicId || 'demo/cnn_intro'}</span>
              </div>
            </div>
          </div>
        )}

        {currentStage === 'markdown' && <MarkdownViewer docTree={project.canonicalDocument || null} />}
        {currentStage === 'structure' && <StructureViewer docTree={project.canonicalDocument || null} initialTab="tree" />}
        {currentStage === 'database' && <RelationalDatabaseViewer />}
        {currentStage === 'curriculum' && (
          <KnowledgeGraphCurriculumViewer
            knowledgeIr={project.clsgIr?.knowledge_ir || project.knowledgeIr || null}
            curriculumIr={project.clsgIr?.curriculum_ir || project.curriculumIr || null}
          />
        )}
        {currentStage === 'understanding' && (
          <LessonUnderstandingViewer
            lessonModel={project.lessonBlueprint?.lesson_model || project.clsgIr?.lesson_model}
            contentPrioritization={project.lessonBlueprint?.content_prioritization || project.clsgIr?.content_prioritization}
            teachingUnits={project.lessonBlueprint?.teaching_units || project.clsgIr?.teaching_units}
          />
        )}
        {currentStage === 'config' && (
          <UserConfigViewer
            config={project.configuration}
            onUpdateConfig={handleUpdateConfig}
            isRunning={pipelineRunning}
          />
        )}
        {currentStage === 'plan' && <PlanViewer blueprint={project.lessonBlueprint || null} />}
        {currentStage === 'transition' && (
          <TransitionIntelligenceViewer
            transitionMap={(project.clsgIr as any)?.transition_map || null}
          />
        )}
        {currentStage === 'narrative' && (
          <NarrativeInspector narrativeIr={project.clsgIr?.narrative_ir || project.narrativeIr || null} />
        )}
        {currentStage === 'narration' && <NarrationViewer scenes={scenes} />}
        {currentStage === 'prosody' && <ProsodyViewer scenes={scenes} />}
        {currentStage === 'visual' && <VisualIntentViewer scenes={scenes} />}
        {currentStage === 'quality' && <QualityGuardViewer report={project.qualityReport || null} />}
        {currentStage === 'ir' && <CLSGIRInspector ir={project.clsgIr || null} />}
        {currentStage === 'video' && <VideoPreview ir={project.clsgIr || null} />}
      </div>

      {/* Explainability Decision Trace Drawer */}
      <DecisionTrace />

      {/* Live Pipeline Execution Trace */}
      {traceLogs.length > 0 && (
        <div className="bg-paper-sheet border border-rule rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-rule pb-2">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-print" />
              <span>Nhật Ký Thực Thi Pipeline</span>
            </h3>
            <div className="flex items-center gap-3">
              {lastRun && (
                <span className="text-xs font-mono text-ink-soft">
                  {lastRun.tokens.totalTokens.toLocaleString()} tokens • {lastRun.tokens.calls - lastRun.tokens.cacheHits} lần gọi API
                  {lastRun.tokens.estimatedCalls > 0 ? ` (${lastRun.tokens.estimatedCalls} ước tính)` : ''}
                  {lastRun.tokens.costUsd > 0 ? ` • $${lastRun.tokens.costUsd.toFixed(5)}` : ''}
                </span>
              )}
              <span className="text-xs font-mono text-print font-semibold">
                Tổng: {((lastRun?.total_ms ?? 0) / 1000 || traceLogs.reduce((sum, l) => sum + l.duration_sec, 0)).toFixed(2)}s
              </span>
              {lastRun && (
                <button
                  type="button"
                  onClick={() => benchmarkService.download(lastRun)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rule-strong text-xs font-semibold text-ink-soft hover:bg-paper-band"
                >
                  <Download className="w-3 h-3" />
                  Log benchmark (JSON)
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {traceLogs.map((log, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-paper-band border border-rule text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-print"></span>
                  <span className="font-semibold text-ink">{log.stage}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-ink-faint">
                  <span className="text-xs text-ink-faint">{JSON.stringify(log.details)}</span>
                  <span className="font-bold text-ink-soft">{log.duration_sec}s</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global API Key & Multi-Provider Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
      />
    </div>
  );
};
