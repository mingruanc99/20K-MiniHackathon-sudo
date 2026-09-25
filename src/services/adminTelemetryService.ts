// src/services/adminTelemetryService.ts
/**
 * Admin Telemetry & Observability Aggregation Service
 * Real-time aggregation of Projects, AI Calls, Users, Content Quality, Errors,
 * and Langfuse Traces from production storage and live execution events.
 */
import {
  TimeFilter,
  AdminOverviewKPIs,
  ContentQualityIssue,
  AILlmMetric,
  ErrorRecord,
  PromptMetadata,
  TTSMetric,
  EvaluationMetric,
  LangfuseTraceSummary,
  QualityIssueType,
  ErrorSeverity,
  LessonAdminItem,
  UserAdminRecord,
  UserRole,
  User,
  Project
} from '../types';
import { projectService } from './projectService';
import { contentPurifierService } from '../pipeline/services/contentPurifierService';

export interface RealAICallRecord {
  id: string;
  timestamp: string;
  model: string;
  feature: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  lessonId?: string;
  lessonTitle?: string;
  traceId?: string;
}

export interface RealTTSRecord {
  id: string;
  timestamp: string;
  voice: string;
  provider: string;
  charactersCount: number;
  durationSec: number;
  costUsd: number;
  latencyMs: number;
  status: 'success' | 'error';
}

type TelemetryListener = () => void;

export class AdminTelemetryService {
  private readonly DEFAULT_PROJECT_ID = 'cmucynwfb02llad0dhxexgdr2';
  private readonly DEFAULT_BASE_URL = 'https://cloud.langfuse.com';

  public get LANGFUSE_PROJECT_ID(): string {
    const fromMeta = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LANGFUSE_PROJECT_ID;
    const fromProcess = typeof process !== 'undefined' && process.env?.LANGFUSE_PROJECT_ID;
    return fromMeta || fromProcess || this.DEFAULT_PROJECT_ID;
  }

  public get LANGFUSE_PUBLIC_KEY(): string {
    const fromMeta = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LANGFUSE_PUBLIC_KEY;
    const fromProcess = typeof process !== 'undefined' && process.env?.LANGFUSE_PUBLIC_KEY;
    return fromMeta || fromProcess || '';
  }

  /** The Langfuse secret key never ships to the browser: ingestion goes through this serverless route. */
  private readonly LANGFUSE_INGEST_ENDPOINT = '/api/telemetry/langfuse';

  public get LANGFUSE_BASE_URL(): string {
    return `https://cloud.langfuse.com/project/${this.LANGFUSE_PROJECT_ID}`;
  }

  private readonly STORAGE_AI_CALLS = 'clsg_telemetry_ai_calls';
  private readonly STORAGE_ERRORS = 'clsg_telemetry_errors';
  private readonly STORAGE_USERS = 'clsg_registered_users';
  private readonly STORAGE_TTS = 'clsg_telemetry_tts';

  private cachedProjects: Project[] = [];
  private cachedAICalls: RealAICallRecord[] = [];
  private cachedErrors: ErrorRecord[] = [];
  private cachedUsers: UserAdminRecord[] = [];
  private cachedTTS: RealTTSRecord[] = [];

  private listeners: Set<TelemetryListener> = new Set();
  private isInitialized = false;

  constructor() {
    this.ensureBootstrapAdmin();
    if (this.cachedProjects.length === 0) {
      this.cachedProjects = [projectService.getBuiltinCnnProject('admin_hkthien_husc')];
    }
    this.loadInitialStorage();
    // Auto sync on initialization in browser
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.syncRealData().catch(console.warn);
      }, 50);
    }
  }

  public subscribe(callback: TelemetryListener): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.warn('Listener error in AdminTelemetryService:', e);
      }
    });
  }

  /**
   * Load local persistence synchronously on service instantiation
   */
  private loadInitialStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      // 1. Registered Users
      const rawUsers = localStorage.getItem(this.STORAGE_USERS);
      if (rawUsers) {
        this.cachedUsers = JSON.parse(rawUsers);
      }
      this.ensureBootstrapAdmin();

      // 2. AI Calls
      const rawCalls = localStorage.getItem(this.STORAGE_AI_CALLS);
      if (rawCalls) {
        const parsed: RealAICallRecord[] = JSON.parse(rawCalls);
        // Drop records fabricated by an older syncRealData() that synthesised
        // calls from project executionLogs (ids `log_<projectId>_<n>`, fixed
        // 850/420 tokens, $0.00019). They were never real measurements.
        this.cachedAICalls = parsed.filter((c) => !this.isFabricatedCall(c));
        if (this.cachedAICalls.length !== parsed.length) {
          this.saveAICallsToStorage();
        }
      }

      // 3. Errors
      const rawErrors = localStorage.getItem(this.STORAGE_ERRORS);
      if (rawErrors) {
        this.cachedErrors = JSON.parse(rawErrors);
      }

      // 4. TTS Calls
      const rawTTS = localStorage.getItem(this.STORAGE_TTS);
      if (rawTTS) {
        this.cachedTTS = JSON.parse(rawTTS);
      }
    } catch (err) {
      console.warn('Error reading admin telemetry storage:', err);
    }

    // Always ensure at least 1 baseline real project so admin view has valid schema immediately
    if (this.cachedProjects.length === 0) {
      this.cachedProjects = [projectService.getBuiltinCnnProject('admin_hkthien_husc')];
    }
  }

  /**
   * Ensures hkthien@husc.edu.vn is always permanently registered as Root Admin
   */
  private ensureBootstrapAdmin() {
    const adminEmail = 'hkthien@husc.edu.vn';
    const existing = this.cachedUsers.find(
      (u) => u.email.toLowerCase() === adminEmail || u.id === 'admin_hkthien_husc'
    );
    if (!existing) {
      this.cachedUsers.unshift({
        id: 'admin_hkthien_husc',
        name: 'Huỳnh Khắc Thiên (Root Admin)',
        email: adminEmail,
        role: 'admin',
        lessonsCount: 0,
        activityStatus: 'active',
        aiRequestsCount: 0,
        ttsRequestsCount: 0,
        lastActive: 'Vừa xong',
        totalCost: 0,
        recentActivity: [
          'Đăng nhập bảng điều khiển quản trị viên Root Admin',
          'Kích hoạt giám sát chất lượng nội dung Zero-Leak'
        ]
      });
      this.saveUsersToStorage();
    } else {
      existing.role = 'admin';
    }
  }

  private saveUsersToStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.STORAGE_USERS, JSON.stringify(this.cachedUsers));
    }
  }

  private saveAICallsToStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.STORAGE_AI_CALLS, JSON.stringify(this.cachedAICalls.slice(0, 200)));
    }
  }

  private saveErrorsToStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.STORAGE_ERRORS, JSON.stringify(this.cachedErrors.slice(0, 100)));
    }
  }

  private saveTTSToStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.STORAGE_TTS, JSON.stringify(this.cachedTTS.slice(-100)));
    }
  }

  // --------------------------------------------------------------------------
  // Helpers for honest aggregation (no invented numbers)
  // --------------------------------------------------------------------------

  /** Builtin demo lesson seeded by projectService; never counted as a real lesson. */
  private readonly DEMO_PROJECT_ID = 'proj_demo_cnn_001';

  private isFabricatedCall(c: RealAICallRecord): boolean {
    return (
      typeof c?.id === 'string' &&
      c.id.startsWith('log_') &&
      c.promptTokens === 850 &&
      c.completionTokens === 420
    );
  }

  /** Projects that count toward aggregates (demo project excluded). */
  private realProjects(): Project[] {
    return this.cachedProjects.filter((p) => p.projectId !== this.DEMO_PROJECT_ID);
  }

  /** Converts a 0..1 (or already 0..100) score to a 0..100 value with 1 decimal. */
  private toPct(v: number): number {
    const pct = v <= 1 ? v * 100 : v;
    return Math.round(pct * 10) / 10;
  }

  /** Real overall quality score of a project (0..100) or null when not evaluated. */
  private projectQuality(p: Project): number | null {
    const raw = p.qualityReport?.overall_quality_score ?? (p.qualityReport as any)?.overall_score;
    return typeof raw === 'number' && Number.isFinite(raw) ? this.toPct(raw) : null;
  }

  private round(v: number, decimals: number): number {
    const f = Math.pow(10, decimals);
    return Math.round(v * f) / f;
  }

  private callsForLesson(lessonId: string): RealAICallRecord[] {
    return this.cachedAICalls.filter((c) => c.lessonId === lessonId);
  }

  private mostCommonModel(calls: RealAICallRecord[]): string {
    if (calls.length === 0) return '—';
    const counts = new Map<string, number>();
    calls.forEach((c) => counts.set(c.model || 'unknown', (counts.get(c.model || 'unknown') || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Average real overall quality (0..100) across evaluated, non-demo projects;
   * null when no project has a quality report yet.
   */
  public getAverageQualityScore(): number | null {
    const scores = this.realProjects()
      .map((p) => this.projectQuality(p))
      .filter((s): s is number => s !== null);
    if (scores.length === 0) return null;
    return this.round(scores.reduce((a, b) => a + b, 0) / scores.length, 1);
  }

  /** Real per-project overall quality scores ordered by updatedAt (oldest first). */
  public getQualityTrend(limit = 12): { label: string; value: number }[] {
    return this.realProjects()
      .map((p) => ({ p, q: this.projectQuality(p) }))
      .filter((x): x is { p: Project; q: number } => x.q !== null)
      .sort((a, b) => new Date(a.p.updatedAt).getTime() - new Date(b.p.updatedAt).getTime())
      .slice(-limit)
      .map(({ p, q }) => ({
        label: `${p.title.slice(0, 18)}${p.title.length > 18 ? '…' : ''} (${new Date(p.updatedAt).toLocaleDateString('vi-VN')})`,
        value: q
      }));
  }

  /** Time buckets covering the selected window, ending now. */
  private buildBuckets(timeFilter: TimeFilter): { start: number; end: number; label: string }[] {
    const now = new Date();
    const HOUR = 3600 * 1000;
    const DAY = 24 * HOUR;
    let count: number;
    let size: number;
    let firstStart: number;
    if (timeFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      count = 12;
      size = 2 * HOUR;
      firstStart = startOfDay;
    } else {
      const days = timeFilter === '7d' ? 7 : timeFilter === '30d' ? 30 : 90;
      count = timeFilter === '7d' ? 7 : timeFilter === '30d' ? 15 : 18;
      size = (days / count) * DAY;
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() + DAY;
      firstStart = endOfDay - days * DAY;
    }
    return Array.from({ length: count }, (_, i) => {
      const start = firstStart + i * size;
      const d = new Date(start);
      const label = timeFilter === 'today'
        ? `${d.getHours()}:00`
        : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { start, end: start + size, label };
    });
  }

  private inBucket(ts: string | undefined, b: { start: number; end: number }): boolean {
    if (!ts) return false;
    const t = new Date(ts).getTime();
    return Number.isFinite(t) && t >= b.start && t < b.end;
  }

  /**
   * Real time-bucketed AI call series (requests, cost, avg latency, error rate).
   * Empty arrays when there are no recorded calls in the window.
   */
  public getAILlmTimeSeries(timeFilter: TimeFilter = '7d') {
    const buckets = this.buildBuckets(timeFilter);
    const perBucket = buckets.map((b) => ({ b, calls: this.cachedAICalls.filter((c) => this.inBucket(c.timestamp, b)) }));
    const hasAny = perBucket.some((x) => x.calls.length > 0);
    if (!hasAny) {
      return { requests: [], cost: [], latency: [], errorRate: [] } as {
        requests: { label: string; value: number }[];
        cost: { label: string; value: number }[];
        latency: { label: string; value: number }[];
        errorRate: { label: string; value: number }[];
      };
    }
    return {
      requests: perBucket.map(({ b, calls }) => ({ label: b.label, value: calls.length })),
      cost: perBucket.map(({ b, calls }) => ({
        label: b.label,
        value: this.round(calls.reduce((s, c) => s + (c.costUsd || 0), 0), 4)
      })),
      // Latency only for buckets that actually had calls (no invented zeros).
      latency: perBucket
        .filter(({ calls }) => calls.length > 0)
        .map(({ b, calls }) => ({
          label: b.label,
          value: Math.round(calls.reduce((s, c) => s + (c.latencyMs || 0), 0) / calls.length)
        })),
      errorRate: perBucket.map(({ b, calls }) => ({
        label: b.label,
        value: calls.length > 0
          ? this.round((calls.filter((c) => c.status === 'error').length / calls.length) * 100, 1)
          : 0
      }))
    };
  }

  /**
   * Synchronize all live projects, extract execution logs, recalculate telemetry
   */
  public async syncRealData(): Promise<void> {
    try {
      const allProjects = await projectService.listAllProjects();
      this.cachedProjects = allProjects;

      // AI call records come only from real provider calls (recordAICall).
      // Pipeline executionLogs are NOT converted into synthetic AI calls.

      // Update users project counts & activities
      this.updateUsersFromProjects(allProjects);

      this.isInitialized = true;
      this.notifyListeners();
    } catch (err) {
      console.warn('Failed to sync real telemetry data:', err);
    }
  }

  private updateUsersFromProjects(projects: Project[]) {
    this.ensureBootstrapAdmin();

    projects = projects.filter((p) => p.projectId !== this.DEMO_PROJECT_ID);

    projects.forEach((p) => {
      const authorId = p.userId || 'admin_hkthien_husc';
      let user = this.cachedUsers.find((u) => u.id === authorId || u.email === authorId);

      if (!user) {
        const email = authorId.includes('@') ? authorId : `${authorId}@clsg.edu.vn`;
        const name = authorId === 'admin_hkthien_husc'
          ? 'Huỳnh Khắc Thiên'
          : authorId.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        user = {
          id: authorId,
          name,
          email,
          role: email === 'hkthien@husc.edu.vn' ? 'admin' : 'instructor',
          lessonsCount: 0,
          activityStatus: 'active',
          aiRequestsCount: 0,
          ttsRequestsCount: 0,
          lastActive: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('vi-VN') : 'Gần đây',
          totalCost: 0,
          recentActivity: [`Tạo bài giảng: ${p.title}`]
        };
        this.cachedUsers.push(user);
      }
    });

    // Re-tally counts
    this.cachedUsers.forEach((u) => {
      const userProjects = projects.filter((p) => p.userId === u.id || p.userId === u.email);
      u.lessonsCount = userProjects.length;

      const userCalls = this.cachedAICalls.filter((c) =>
        userProjects.some((p) => p.projectId === c.lessonId)
      );
      u.aiRequestsCount = userCalls.length;
      u.totalCost = Math.round(userCalls.reduce((sum, c) => sum + (c.costUsd || 0), 0) * 10000) / 10000;
    });

    this.saveUsersToStorage();
  }

  /**
   * Records an actual live AI LLM call
   */
  public recordAICall(call: Omit<RealAICallRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) {
    const record: RealAICallRecord = {
      id: call.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: call.timestamp || new Date().toISOString(),
      model: call.model,
      feature: call.feature,
      promptTokens: call.promptTokens,
      completionTokens: call.completionTokens,
      totalTokens: call.totalTokens || (call.promptTokens + call.completionTokens),
      costUsd: call.costUsd,
      latencyMs: call.latencyMs,
      status: call.status,
      errorMessage: call.errorMessage,
      lessonId: call.lessonId,
      lessonTitle: call.lessonTitle,
      traceId: call.traceId
    };

    this.cachedAICalls.unshift(record);
    this.saveAICallsToStorage();

    // Asynchronously dispatch live trace and generation span to Langfuse Cloud
    this.pushToLangfuseCloud(record).catch(() => {});

    if (call.status === 'error') {
      this.recordError({
        type: 'LLM_ERROR',
        lessonId: call.lessonId || 'live_session',
        lessonTitle: call.lessonTitle || 'Trực tiếp Gemini API',
        sectionId: call.feature,
        model: call.model,
        severity: 'high',
        message: call.errorMessage || 'Lỗi gọi API Google Gemini',
        traceId: call.traceId
      });
    }

    this.notifyListeners();
  }

  /**
   * Records a system error
   */
  public recordError(err: Omit<ErrorRecord, 'id' | 'timestamp' | 'status'> & { id?: string; timestamp?: string }) {
    const errorRecord: ErrorRecord = {
      id: err.id || `err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: err.timestamp || new Date().toISOString(),
      type: err.type,
      lessonId: err.lessonId,
      lessonTitle: err.lessonTitle,
      sectionId: err.sectionId,
      model: err.model,
      severity: err.severity,
      status: 'unresolved',
      message: err.message,
      traceId: err.traceId,
      stackSnippet: err.stackSnippet
    };

    this.cachedErrors.unshift(errorRecord);
    this.saveErrorsToStorage();
    this.notifyListeners();
  }

  /**
   * Registers a user in the admin telemetry registry
   */
  public registerUser(user: Partial<User>) {
    if (!user.uid && !user.email) return;

    this.ensureBootstrapAdmin();
    const email = user.email || `${user.uid}@clsg.edu.vn`;
    const isRoot = email.toLowerCase() === 'hkthien@husc.edu.vn';

    let existing = this.cachedUsers.find((u) => u.id === user.uid || u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      existing.name = user.displayName || existing.name;
      existing.role = isRoot ? 'admin' : (user.role || existing.role);
      existing.lastActive = 'Vừa xong';
    } else {
      this.cachedUsers.push({
        id: user.uid || `usr_${Date.now()}`,
        name: user.displayName || email.split('@')[0],
        email,
        role: isRoot ? 'admin' : (user.role || 'instructor'),
        lessonsCount: 0,
        activityStatus: 'active',
        aiRequestsCount: 0,
        ttsRequestsCount: 0,
        lastActive: 'Vừa xong',
        totalCost: 0,
        recentActivity: ['Đăng nhập hệ thống CLSG-IR']
      });
    }

    this.saveUsersToStorage();
    this.notifyListeners();
  }

  /**
   * Updates user role
   */
  public changeUserRole(userId: string, newRole: UserRole): boolean {
    const u = this.cachedUsers.find((x) => x.id === userId);
    if (u) {
      if (u.email.toLowerCase() === 'hkthien@husc.edu.vn' && newRole !== 'admin') {
        return false; // Root Admin cannot be demoted
      }
      u.role = newRole;
      this.saveUsersToStorage();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Resolves an error
   */
  public resolveError(errorId: string): boolean {
    const item = this.cachedErrors.find((e) => e.id === errorId);
    if (item) {
      item.status = 'resolved';
      this.saveErrorsToStorage();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Dispatches live trace & generation telemetry to Langfuse Cloud Ingestion API
   */
  public async pushToLangfuseCloud(call: RealAICallRecord): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      const timestamp = call.timestamp || new Date().toISOString();
      const body = {
        batch: [
          {
            id: `evt_tr_${call.id}_${Date.now()}`,
            type: 'trace-create',
            timestamp,
            body: {
              id: call.traceId,
              name: `LLM Call: ${call.feature}`,
              userId: 'clsg-ir-app',
              sessionId: call.lessonId ? `sess_${call.lessonId.slice(-6)}` : 'sess_clsg_ir',
              tags: ['production', 'clsg-ir', 'zero-leak', 'gemini-telemetry'],
              metadata: {
                lessonId: call.lessonId,
                model: call.model,
                status: call.status,
                costUsd: call.costUsd,
                latencyMs: call.latencyMs
              }
            }
          },
          {
            id: `evt_gen_${call.id}_${Date.now()}`,
            type: 'generation-create',
            timestamp,
            body: {
              id: `gen_${call.id}`,
              traceId: call.traceId,
              name: call.feature,
              model: call.model,
              startTime: new Date(Date.now() - (call.latencyMs || 0)).toISOString(),
              endTime: timestamp,
              usage: {
                promptTokens: call.promptTokens,
                completionTokens: call.completionTokens,
                totalTokens: call.totalTokens
              }
            }
          }
        ]
      };

      await fetch(this.LANGFUSE_INGEST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch {
      // Non-blocking telemetry
    }
  }

  /**
   * Returns metadata about the connected Langfuse Cloud Project
   */
  public getLangfuseProjectConfig() {
    return {
      projectId: this.LANGFUSE_PROJECT_ID,
      projectName: 'My Project',
      orgName: "Hồ's Organization",
      publicKey: this.LANGFUSE_PUBLIC_KEY,
      publicKeyMasked: this.LANGFUSE_PUBLIC_KEY ? `${this.LANGFUSE_PUBLIC_KEY.slice(0, 10)}...${this.LANGFUSE_PUBLIC_KEY.slice(-6)}` : '(chưa cấu hình)',
      secretKeyMasked: 'lưu trên server (LANGFUSE_SECRET_KEY)',
      baseUrl: 'https://cloud.langfuse.com',
      projectUrl: this.LANGFUSE_BASE_URL,
      tracesUrl: `${this.LANGFUSE_BASE_URL}/traces`,
      generationsUrl: `${this.LANGFUSE_BASE_URL}/generations`,
      scoresUrl: `${this.LANGFUSE_BASE_URL}/scores`,
      isConnected: true
    };
  }

  /**
   * Generates a direct deep-link into Langfuse Trace inspector.
   */
  getLangfuseTraceUrl(traceId?: string): string {
    if (!traceId) return this.LANGFUSE_BASE_URL;
    return `${this.LANGFUSE_BASE_URL}/traces/${traceId}`;
  }

  /**
   * Generates a deep link to Langfuse Prompts.
   */
  getLangfusePromptUrl(promptName: string, version?: string): string {
    if (version) {
      return `${this.LANGFUSE_BASE_URL}/prompts/${promptName}?v=${version}`;
    }
    return `${this.LANGFUSE_BASE_URL}/prompts/${promptName}`;
  }

  /**
   * Returns REAL overview KPIs computed from actual projects, users, AI calls, and errors.
   */
  getOverviewKPIs(timeFilter: TimeFilter): AdminOverviewKPIs {
    // Note: KPIs are all-time totals; timeFilter only affects the trend charts.
    const projects = this.realProjects();
    const totalUsers = this.cachedUsers.length;
    const activeUsers = this.cachedUsers.filter((u) => u.activityStatus === 'active').length;
    const totalLessons = projects.length;
    const publishedLessons = projects.filter(
      (p) => p.status === 'verified' || (p.status as any) === 'completed'
    ).length;

    const totalAICalls = this.cachedAICalls.length;
    const aiRequests = totalAICalls;

    const aiCost = this.cachedAICalls.reduce((sum, c) => sum + (c.costUsd || 0), 0);

    // 0 = no recorded calls (UI renders "—")
    const avgLatencyMs = totalAICalls > 0
      ? Math.round(this.cachedAICalls.reduce((sum, c) => sum + (c.latencyMs || 0), 0) / totalAICalls)
      : 0;

    // Error rate = failed AI calls / recorded AI calls (%). 0 when no calls.
    const failedCalls = this.cachedAICalls.filter((c) => c.status === 'error').length;
    const errorRate = totalAICalls > 0 ? this.round((failedCalls / totalAICalls) * 100, 1) : 0;

    // Real average quality from Module 4 reports; 0 = no evaluated lesson (UI renders "—")
    const contentQualityScore = this.getAverageQualityScore() ?? 0;

    return {
      totalUsers,
      activeUsers,
      totalLessons,
      publishedLessons,
      aiRequests,
      aiCost: this.round(aiCost, 4),
      avgLatencyMs,
      errorRate,
      contentQualityScore
    };
  }

  /**
   * Returns trend chart series reflecting real historical data distribution.
   */
  getOverviewCharts(timeFilter: TimeFilter) {
    type Point = { label: string; value: number };
    const buckets = this.buildBuckets(timeFilter);
    const projects = this.realProjects();
    // A series with no data at all is returned empty so the chart shows its empty state.
    const orEmpty = (series: Point[]): Point[] => (series.some((p) => p.value !== 0) ? series : []);

    // Active users = distinct authors that created/updated a lesson in the bucket.
    const users = orEmpty(buckets.map((b) => ({
      label: b.label,
      value: new Set(
        projects
          .filter((p) => this.inBucket(p.createdAt, b) || this.inBucket(p.updatedAt, b))
          .map((p) => p.userId || 'unknown')
      ).size
    })));

    // Lessons created in the bucket.
    const lessons = orEmpty(buckets.map((b) => ({
      label: b.label,
      value: projects.filter((p) => this.inBucket(p.createdAt, b)).length
    })));

    const ai = this.getAILlmTimeSeries(timeFilter);

    // Average real quality of lessons last updated in the bucket (only buckets with data).
    const quality: Point[] = buckets
      .map((b) => {
        const scores = projects
          .filter((p) => this.inBucket(p.updatedAt, b))
          .map((p) => this.projectQuality(p))
          .filter((s): s is number => s !== null);
        return scores.length > 0
          ? { label: b.label, value: this.round(scores.reduce((a, c) => a + c, 0) / scores.length, 1) }
          : null;
      })
      .filter((x): x is Point => x !== null);

    return {
      users,
      lessons,
      requests: ai.requests,
      cost: ai.cost,
      quality,
      errorRate: ai.errorRate
    };
  }

  /**
   * Returns real lesson administration items from actual projects
   */
  getLessons(): LessonAdminItem[] {
    if (this.cachedProjects.length === 0) {
      // Return builtin CNN project converted if sync hasn't resolved
      const builtin = projectService.getBuiltinCnnProject('admin_hkthien_husc');
      return [this.mapProjectToLessonAdminItem(builtin)];
    }
    return this.cachedProjects.map((p) => this.mapProjectToLessonAdminItem(p));
  }

  private mapProjectToLessonAdminItem(p: Project): LessonAdminItem {
    const scenes = p.clsgIr?.scenes || [];
    const blueprintSections = (p.lessonBlueprint?.sections || p.blueprint?.sections || []) as any[];

    const sections = scenes.length > 0
      ? scenes.map((s) => ({
          id: s.section_id,
          title: s.topic || s.section_id,
          role: s.pedagogical_function || 'CONTENT',
          narration: s.narration?.text || '',
          durationSec: Math.round(s.scene_duration_sec || 0)
        }))
      : blueprintSections.map((bs) => ({
          id: bs.section_id,
          title: bs.title,
          role: bs.pedagogical_function || bs.role || 'CONTENT',
          narration: bs.allocated_words_budget ? `Ngân sách: ${bs.allocated_words_budget} từ` : '',
          durationSec: Math.round(bs.target_duration_sec || 0)
        }));

    const authorEmail = p.userId?.includes('@')
      ? p.userId
      : (p.userId === 'admin_hkthien_husc' ? 'hkthien@husc.edu.vn' : `${p.userId || 'admin'}@husc.edu.vn`);

    const authorName = authorEmail === 'hkthien@husc.edu.vn'
      ? 'Huỳnh Khắc Thiên (Admin)'
      : (p.userId || 'Tác giả');

    // 0 = lesson not evaluated yet (UI renders "—")
    const qualityScore = this.projectQuality(p) ?? 0;
    const lessonCalls = this.callsForLesson(p.projectId);
    const lessonCost = lessonCalls.reduce((s, c) => s + (c.costUsd || 0), 0);
    const lessonLatency = lessonCalls.length > 0
      ? Math.round(lessonCalls.reduce((s, c) => s + (c.latencyMs || 0), 0) / lessonCalls.length)
      : 0;

    const sectionsCount = sections.length || (p.canonicalDocument?.sections?.length || p.documentTree?.sections?.length || 0);

    const isPublished = p.status === 'verified' || (p.status as any) === 'completed';
    const isGenerating = p.status === 'generating' || p.status === 'validating' || p.status === 'planning' || (p.status as any) === 'processing';
    const isFailed = p.status === 'failed' || (p.status as any) === 'error';

    return {
      id: p.projectId,
      title: p.title,
      author: authorName,
      authorEmail,
      sectionsCount,
      status: isPublished
        ? 'Published'
        : isGenerating
        ? 'Generating'
        : isFailed
        ? 'Failed'
        : 'Draft',
      qualityScore,
      aiCost: this.round(lessonCost, 4),
      latencyMs: lessonLatency,
      model: this.mostCommonModel(lessonCalls),
      promptVersion: '—',
      traceId: `tr_${p.projectId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`,
      lastUpdated: p.updatedAt ? new Date(p.updatedAt).toLocaleString('vi-VN') : 'Vừa xong',
      sections
    };
  }

  /**
   * Returns real users from the telemetry registry
   */
  getUsers(): UserAdminRecord[] {
    this.ensureBootstrapAdmin();
    return this.cachedUsers;
  }

  /**
   * Returns real content quality data, error distribution, and issue records from real projects.
   */
  getContentQualityData(): {
    qualityMetrics: {
      duplicateRate: number;
      metadataLeakageRate: number;
      invalidCharacterRate: number;
      fillerRate: number;
      sectionRoleViolationRate: number;
      generationErrorRate: number;
      overallQualityScore: number;
    };
    errorDistribution: { type: string; count: number; percentage: number; color: string }[];
    issues: ContentQualityIssue[];
    /** Number of real (non-demo) narrated scenes scanned by the purifier. */
    scannedScenes: number;
  } {
    const issues: ContentQualityIssue[] = [];
    let detectedLeaks = 0;
    let detectedChars = 0;
    let detectedDuplicates = 0;
    let detectedFillers = 0;
    let detectedRoleViolations = 0;
    let scannedScenes = 0;

    // Scan real projects (demo excluded) for real issues using ContentPurifierService
    this.realProjects().forEach((proj) => {
      const scenes = proj.clsgIr?.scenes || [];
      const projModel = this.mostCommonModel(this.callsForLesson(proj.projectId));
      scenes.forEach((scene) => {
        const raw = scene.narration?.text || '';
        if (!raw) return;
        scannedScenes++;

        const purification = contentPurifierService.purifyNarration(raw);
        if (purification.removedElements.length > 0 || !purification.passedValidation) {
          const removedStr = purification.removedElements.join(' ');
          let issueType: QualityIssueType = 'METADATA_LEAK';

          if (removedStr.includes('■') || raw.includes('■') || /\d+\^-\d+/.test(raw)) {
            issueType = 'INVALID_CHARACTER';
            detectedChars++;
          } else if (/trước khi đi vào/i.test(removedStr) || /nền tảng của hãy suy nghĩ/i.test(removedStr)) {
            issueType = 'DUPLICATE_CONTENT';
            detectedDuplicates++;
          } else if (/aicb|slide|trang|page/i.test(removedStr)) {
            issueType = 'METADATA_LEAK';
            detectedLeaks++;
          } else {
            issueType = 'FILLER_CONTENT';
            detectedFillers++;
          }

          issues.push({
            id: `iss_${proj.projectId.slice(-4)}_${scene.section_id}`,
            lessonId: proj.projectId,
            lessonTitle: proj.title,
            sectionId: scene.section_id,
            issueType,
            severity: issueType === 'METADATA_LEAK' ? 'critical' : issueType === 'INVALID_CHARACTER' ? 'high' : 'medium',
            rawOutput: raw,
            cleanedOutput: purification.cleanedText,
            model: projModel,
            promptVersion: '—',
            timestamp: proj.updatedAt || new Date().toISOString(),
            traceId: `tr_${proj.projectId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`,
            resolved: true
          });
        }
      });
    });

    const totalIssues = Math.max(1, issues.length);
    const distribution = [
      {
        type: 'METADATA_LEAK',
        count: detectedLeaks,
        percentage: Math.round((detectedLeaks / totalIssues) * 100),
        color: '#ef4444'
      },
      {
        type: 'INVALID_CHARACTER',
        count: detectedChars,
        percentage: Math.round((detectedChars / totalIssues) * 100),
        color: '#f97316'
      },
      {
        type: 'DUPLICATE_CONTENT',
        count: detectedDuplicates,
        percentage: Math.round((detectedDuplicates / totalIssues) * 100),
        color: '#eab308'
      },
      {
        type: 'FILLER_CONTENT',
        count: detectedFillers,
        percentage: Math.round((detectedFillers / totalIssues) * 100),
        color: '#3b82f6'
      },
      {
        type: 'ROLE_VIOLATION',
        count: detectedRoleViolations,
        percentage: Math.round((detectedRoleViolations / totalIssues) * 100),
        color: '#8b5cf6'
      }
    ].filter((d) => d.count > 0);

    // Only claim "clean" when scenes were actually scanned and none had issues.
    if (distribution.length === 0 && scannedScenes > 0) {
      distribution.push({
        type: 'ZERO_LEAK_CLEAN',
        count: 0,
        percentage: 100,
        color: '#10b981'
      });
    }

    // Rates = affected scenes / scanned scenes (%). 0 when nothing was scanned.
    const rate = (n: number) => (scannedScenes > 0 ? this.round((n / scannedScenes) * 100, 1) : 0);
    const totalCalls = this.cachedAICalls.length;
    const failedCalls = this.cachedAICalls.filter((c) => c.status === 'error').length;

    return {
      qualityMetrics: {
        duplicateRate: rate(detectedDuplicates),
        metadataLeakageRate: rate(detectedLeaks),
        invalidCharacterRate: rate(detectedChars),
        fillerRate: rate(detectedFillers),
        // No role-violation detector exists yet, so this stays 0 (nothing detected).
        sectionRoleViolationRate: rate(detectedRoleViolations),
        generationErrorRate: totalCalls > 0 ? this.round((failedCalls / totalCalls) * 100, 1) : 0,
        // 0 = no evaluated lesson (UI renders "—")
        overallQualityScore: this.getAverageQualityScore() ?? 0
      },
      errorDistribution: distribution,
      issues,
      scannedScenes
    };
  }

  /**
   * Returns AI / LLM metrics computed from real recorded calls only.
   * All values are 0 / empty lists when no call has been recorded.
   */
  getAILlmData(): AILlmMetric {
    const calls = this.cachedAICalls;
    const totalRequests = calls.length;
    const failedRequests = calls.filter((c) => c.status === 'error').length;
    const successfulRequests = totalRequests - failedRequests;
    const successRate = totalRequests > 0
      ? Math.round((successfulRequests / totalRequests) * 10000) / 100
      : 0;

    const inputTokens = calls.reduce((sum, c) => sum + (c.promptTokens || 0), 0);
    const outputTokens = calls.reduce((sum, c) => sum + (c.completionTokens || 0), 0);
    const totalTokens = inputTokens + outputTokens;
    const totalCost = calls.reduce((sum, c) => sum + (c.costUsd || 0), 0);
    const avgLatencyMs = totalRequests > 0
      ? Math.round(calls.reduce((sum, c) => sum + (c.latencyMs || 0), 0) / totalRequests)
      : 0;

    type Agg = { requests: number; errors: number; tokens: number; cost: number; latencySum: number };
    const aggregate = (keyOf: (c: RealAICallRecord) => string) => {
      const map = new Map<string, Agg>();
      calls.forEach((c) => {
        const k = keyOf(c);
        const cur = map.get(k) || { requests: 0, errors: 0, tokens: 0, cost: 0, latencySum: 0 };
        cur.requests++;
        if (c.status === 'error') cur.errors++;
        cur.tokens += c.totalTokens || ((c.promptTokens || 0) + (c.completionTokens || 0));
        cur.cost += c.costUsd || 0;
        cur.latencySum += c.latencyMs || 0;
        map.set(k, cur);
      });
      return Array.from(map.entries()).sort((a, b) => b[1].requests - a[1].requests);
    };

    const byModel = aggregate((c) => c.model || 'unknown').map(([model, d]) => ({
      model,
      requests: d.requests,
      tokens: d.tokens,
      cost: this.round(d.cost, 4),
      avgLatencyMs: Math.round(d.latencySum / d.requests),
      errorRate: this.round((d.errors / d.requests) * 100, 1)
    }));

    const featureAgg = aggregate((c) => c.feature || 'unknown');
    const byFeature = featureAgg.map(([feature, d]) => ({
      feature,
      requests: d.requests,
      tokens: d.tokens,
      cost: this.round(d.cost, 4),
      avgLatencyMs: Math.round(d.latencySum / d.requests)
    }));

    // No prompt registry/versioning exists: each feature name is treated as a
    // "prompt" at version 'current'. qualityScore is 0 because no per-prompt
    // evaluation is recorded (UI renders "—").
    const byPromptVersion = featureAgg.map(([feature, d]) => ({
      prompt: feature,
      version: 'current',
      requests: d.requests,
      qualityScore: 0,
      cost: this.round(d.cost, 4)
    }));

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate,
      inputTokens,
      outputTokens,
      totalTokens,
      totalCost: this.round(totalCost, 4),
      avgLatencyMs,
      byModel,
      byFeature,
      byPromptVersion
    };
  }

  /**
   * Returns Langfuse summary and traces built from recorded AI calls and real projects.
   */
  getLangfuseData(): {
    summary: {
      totalTraces: number;
      totalGenerations: number;
      totalCost: number;
      avgLatencyMs: number;
      qualityScore: number;
      projectId: string;
      projectUrl: string;
    };
    traces: LangfuseTraceSummary[];
  } {
    const traces: LangfuseTraceSummary[] = [];

    // 1. Traces from real live AI calls
    this.cachedAICalls.forEach((call) => {
      traces.push({
        traceId: call.traceId || call.id,
        name: `LLM Call: ${call.feature}`,
        sessionId: call.lessonId ? `sess_${call.lessonId.slice(-6)}` : 'sess_clsg_live',
        userId: 'hkthien@husc.edu.vn',
        lessonId: call.lessonId || 'live_lesson',
        latencyMs: call.latencyMs,
        totalCost: call.costUsd,
        status: call.status === 'success' ? 'success' : 'error',
        tags: ['production', 'llm-call', call.model],
        url: this.getLangfuseTraceUrl(call.traceId),
        timestamp: call.timestamp,
        model: call.model
      });
    });

    // 2. One pipeline entry per real (non-demo) project. Latency is the real sum of
    //    its executionLogs stage durations; cost/model come only from AI calls
    //    attributed to the lesson (0 / '—' when none).
    this.realProjects().forEach((proj) => {
      const traceId = `tr_${proj.projectId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`;
      if (traces.some((t) => t.traceId === traceId)) return;
      const lessonCalls = this.callsForLesson(proj.projectId);
      const pipelineMs = Math.round(
        (proj.executionLogs || []).reduce((s, l) => s + (l.duration_sec || 0), 0) * 1000
      );
      traces.push({
        traceId,
        name: `Pipeline Execution: ${proj.title}`,
        sessionId: `sess_${proj.projectId.slice(-6)}`,
        userId: proj.userId || 'hkthien@husc.edu.vn',
        lessonId: proj.projectId,
        latencyMs: pipelineMs,
        totalCost: this.round(lessonCalls.reduce((s, c) => s + (c.costUsd || 0), 0), 4),
        status: proj.status === 'failed' || (proj.status as string) === 'error' ? 'error' : 'success',
        tags: ['production', 'clsg-ir', 'pipeline'],
        url: this.getLangfuseTraceUrl(traceId),
        timestamp: proj.updatedAt || proj.createdAt,
        model: this.mostCommonModel(lessonCalls)
      });
    });

    const totalCost = traces.reduce((sum, t) => sum + (t.totalCost || 0), 0);
    const avgLatency = traces.length > 0
      ? Math.round(traces.reduce((sum, t) => sum + (t.latencyMs || 0), 0) / traces.length)
      : 0;

    return {
      summary: {
        totalTraces: traces.length,
        // One generation is pushed per recorded AI call.
        totalGenerations: this.cachedAICalls.length,
        totalCost: this.round(totalCost, 4),
        avgLatencyMs: avgLatency,
        // 0 = no evaluated lesson (UI renders "—")
        qualityScore: this.getAverageQualityScore() ?? 0,
        projectId: this.LANGFUSE_PROJECT_ID,
        projectUrl: this.LANGFUSE_BASE_URL
      },
      traces
    };
  }

  /**
   * Returns AI Evaluation data derived from real Module 4 (Quality Guard) reports.
   *
   * Mapping from QualityReport (0..1, converted to 0..100) to EvaluationMetric:
   *   accuracy             <- scores.content   (factual consistency)
   *   relevance            <- scores.pedagogy  (visual necessity + language/terminology)
   *   clarity              <- scores.narrative (narrative coherence)
   *   structure            <- scores.visual    (taxonomy validity + visual necessity)
   *   conciseness          <- scores.technical (DAR-P duration fit + prosody)
   *   instructionAdherence <- 100 - |duration_error_pct| (fit to the requested duration)
   *   overallScore         <- overall_quality_score
   * Each field is the mean over non-demo projects that have the value; 0 when none
   * (evaluator is the rule-based Module 4 guard).
   */
  getEvaluationData(): {
    metrics: EvaluationMetric;
    worstPerformingSections: {
      lesson: string;
      section: string;
      role: string;
      score: number;
      primaryIssue: string;
      model: string;
      traceId: string;
    }[];
  } {
    const worst: {
      lesson: string;
      section: string;
      role: string;
      score: number;
      primaryIssue: string;
      model: string;
      traceId: string;
    }[] = [];

    const projects = this.realProjects();

    projects.forEach((p) => {
      const scenes = p.clsgIr?.scenes || [];
      // No per-section score exists; use the lesson's real overall score (0 if not evaluated).
      const lessonScore = this.projectQuality(p) ?? 0;
      const model = this.mostCommonModel(this.callsForLesson(p.projectId));
      scenes.forEach((s) => {
        const text = s.narration?.text || '';
        if (!text) return;
        const purifier = contentPurifierService.purifyNarration(text);
        if (purifier.removedElements.length > 0) {
          worst.push({
            lesson: p.title,
            section: s.section_id,
            role: s.pedagogical_function || 'CONTENT',
            score: lessonScore,
            primaryIssue: `Loại bỏ siêu dữ liệu: ${purifier.removedElements.slice(0, 2).join(', ')}`,
            model,
            traceId: `tr_${p.projectId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`
          });
        }
      });
    });
    worst.sort((a, b) => a.score - b.score);

    const mean = (vals: (number | null | undefined)[]): number => {
      const xs = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      return xs.length > 0 ? this.round(xs.reduce((a, b) => a + b, 0) / xs.length, 1) : 0;
    };
    const dim = (k: 'content' | 'pedagogy' | 'narrative' | 'visual' | 'technical') =>
      mean(projects.map((p) => {
        const v = p.qualityReport?.scores?.[k];
        return typeof v === 'number' ? this.toPct(v) : null;
      }));

    const trend = projects
      .filter((p) => this.projectQuality(p) !== null)
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
      .slice(-10)
      .map((p) => this.projectQuality(p) as number);

    return {
      metrics: {
        relevance: dim('pedagogy'),
        accuracy: dim('content'),
        clarity: dim('narrative'),
        conciseness: dim('technical'),
        structure: dim('visual'),
        instructionAdherence: mean(projects.map((p) => {
          const err = p.qualityReport?.duration_error_pct;
          return typeof err === 'number' ? Math.max(0, 100 - Math.abs(err)) : null;
        })),
        overallScore: mean(projects.map((p) => this.projectQuality(p))),
        evaluatorType: 'rule_based',
        failedSamplesCount: worst.length,
        trend
      },
      worstPerformingSections: worst.slice(0, 5)
    };
  }

  /**
   * Returns "prompts" derived from recorded AI calls grouped by feature.
   * There is no prompt registry, so version is 'current', qualityScore is 0
   * (not evaluated) and templateSnippet is empty. Empty list when no calls.
   */
  getPromptsData(): PromptMetadata[] {
    const groups = new Map<string, RealAICallRecord[]>();
    this.cachedAICalls.forEach((c) => {
      const f = c.feature || 'unknown';
      const arr = groups.get(f) || [];
      arr.push(c);
      groups.set(f, arr);
    });

    return Array.from(groups.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([feature, calls]) => {
        const times = calls
          .map((c) => new Date(c.timestamp).getTime())
          .filter((t) => Number.isFinite(t));
        const fmt = (t: number) => new Date(t).toLocaleDateString('vi-VN');
        return {
          id: `prm_${feature.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: feature,
          version: 'current',
          status: 'production' as const,
          model: this.mostCommonModel(calls),
          qualityScore: 0,
          cost: this.round(calls.reduce((s, c) => s + (c.costUsd || 0), 0), 4),
          avgLatencyMs: Math.round(calls.reduce((s, c) => s + (c.latencyMs || 0), 0) / calls.length),
          templateSnippet: '',
          createdAt: times.length > 0 ? fmt(Math.min(...times)) : '—',
          updatedAt: times.length > 0 ? fmt(Math.max(...times)) : '—',
          traceCount: calls.length
        };
      });
  }

  /**
   * Returns centralized Error Center records
   */
  getErrorRecords(): ErrorRecord[] {
    return this.cachedErrors;
  }

  /**
   * Returns TTS speech telemetry computed from recorded TTS calls (zeros / empty when none).
   */
  getTTSData(): TTSMetric {
    const tts = this.cachedTTS;
    const requests = tts.length;
    const failed = tts.filter((t) => t.status === 'error').length;
    const totalDurationMin = this.round(tts.reduce((sum, t) => sum + (t.durationSec || 0), 0) / 60, 1);
    const totalCost = this.round(tts.reduce((sum, t) => sum + (t.costUsd || 0), 0), 4);
    const avgLatencyMs = requests > 0
      ? Math.round(tts.reduce((sum, t) => sum + (t.latencyMs || 0), 0) / requests)
      : 0;

    const voiceMap = new Map<string, { voice: string; provider: string; requests: number; durationSec: number; cost: number }>();
    const providerMap = new Map<string, { requests: number; latencySum: number; cost: number }>();
    tts.forEach((t) => {
      const vk = `${t.voice}__${t.provider}`;
      const v = voiceMap.get(vk) || { voice: t.voice, provider: t.provider, requests: 0, durationSec: 0, cost: 0 };
      v.requests++;
      v.durationSec += t.durationSec || 0;
      v.cost += t.costUsd || 0;
      voiceMap.set(vk, v);

      const p = providerMap.get(t.provider) || { requests: 0, latencySum: 0, cost: 0 };
      p.requests++;
      p.latencySum += t.latencyMs || 0;
      p.cost += t.costUsd || 0;
      providerMap.set(t.provider, p);
    });

    return {
      requests,
      totalDurationMin,
      successRate: requests > 0 ? this.round(((requests - failed) / requests) * 100, 1) : 0,
      avgLatencyMs,
      failureRate: requests > 0 ? this.round((failed / requests) * 100, 1) : 0,
      totalCost,
      byVoice: Array.from(voiceMap.values()).map((v) => ({
        voice: v.voice,
        provider: v.provider,
        requests: v.requests,
        durationMin: this.round(v.durationSec / 60, 1),
        cost: this.round(v.cost, 4)
      })),
      byProvider: Array.from(providerMap.entries()).map(([provider, p]) => ({
        provider,
        requests: p.requests,
        avgLatencyMs: Math.round(p.latencySum / p.requests),
        cost: this.round(p.cost, 4)
      }))
    };
  }
}

export const adminTelemetryService = new AdminTelemetryService();
