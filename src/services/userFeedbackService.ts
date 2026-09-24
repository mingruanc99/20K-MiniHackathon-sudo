// src/services/userFeedbackService.ts
/**
 * Subsystem C: User Feedback & Behavioral Telemetry Service
 * Tracks behavioral signals: Copy Rate, Regeneration Rate, Edit Rate, Export Rate.
 * Gathers explicit user feedback (👍 / 👎 + complaint tags + comments).
 * Aggregates failure patterns to drive prompt, rule, and model improvements.
 */
import { UserFeedbackRecord, BehavioralSignalMetrics, UserTierType } from '../types';

const FEEDBACK_STORAGE_KEY = 'clsg_user_feedbacks';
const METRICS_STORAGE_KEY = 'clsg_behavioral_metrics';

class UserFeedbackService {
  private feedbacks: UserFeedbackRecord[] = [];
  private metrics: BehavioralSignalMetrics = {
    generation_count: 12,
    copy_count: 8,
    regeneration_count: 2,
    edit_count: 3,
    export_count: 9,
    abandonment_count: 1,
    copy_rate: 0.67,
    regeneration_rate: 0.17,
    edit_rate: 0.25
  };
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const fbData = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      if (fbData) {
        this.feedbacks = JSON.parse(fbData);
      }
      const metData = localStorage.getItem(METRICS_STORAGE_KEY);
      if (metData) {
        this.metrics = JSON.parse(metData);
      }
    } catch {
      // ignore
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(this.feedbacks));
      localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(this.metrics));
    } catch {
      // ignore
    }
    this.notify();
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('UserFeedbackService notify error:', err);
      }
    });
  }

  // -----------------------------------------------------------------
  // Behavioral Telemetry
  // -----------------------------------------------------------------
  public recordGeneration() {
    this.metrics.generation_count++;
    this.recomputeRates();
    this.saveToStorage();
  }

  public recordCopy() {
    this.metrics.copy_count++;
    this.recomputeRates();
    this.saveToStorage();
  }

  public recordRegenerate() {
    this.metrics.regeneration_count++;
    this.recomputeRates();
    this.saveToStorage();
  }

  public recordEdit() {
    this.metrics.edit_count++;
    this.recomputeRates();
    this.saveToStorage();
  }

  public recordExport() {
    this.metrics.export_count++;
    this.saveToStorage();
  }

  public recordAbandonment() {
    this.metrics.abandonment_count++;
    this.saveToStorage();
  }

  private recomputeRates() {
    const total = Math.max(1, this.metrics.generation_count);
    this.metrics.copy_rate = Math.round((this.metrics.copy_count / total) * 100) / 100;
    this.metrics.regeneration_rate = Math.round((this.metrics.regeneration_count / total) * 100) / 100;
    this.metrics.edit_rate = Math.round((this.metrics.edit_count / total) * 100) / 100;
  }

  public getBehavioralMetrics(): BehavioralSignalMetrics {
    return { ...this.metrics };
  }

  // -----------------------------------------------------------------
  // Explicit User Feedback
  // -----------------------------------------------------------------
  public recordFeedback(params: {
    generationId: string;
    projectId: string;
    sceneId?: string;
    isUseful: boolean;
    complaintTags?: string[];
    comment?: string;
    model?: string;
    promptVersion?: string;
    userTier?: UserTierType;
  }): UserFeedbackRecord {
    const record: UserFeedbackRecord = {
      feedback_id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      generation_id: params.generationId,
      project_id: params.projectId,
      scene_id: params.sceneId,
      is_useful: params.isUseful,
      complaint_tags: params.complaintTags || [],
      comment: params.comment,
      model: params.model || 'gemini-2.5-flash',
      prompt_version: params.promptVersion || 'v2.0',
      user_tier: params.userTier || 'NORMAL',
      created_at: Date.now()
    };

    this.feedbacks.unshift(record);
    if (this.feedbacks.length > 500) {
      this.feedbacks = this.feedbacks.slice(0, 500);
    }
    this.saveToStorage();
    return record;
  }

  public getFeedbacksForProject(projectId: string): UserFeedbackRecord[] {
    return this.feedbacks.filter((f) => f.project_id === projectId);
  }

  public getAllFeedbacks(): UserFeedbackRecord[] {
    return [...this.feedbacks];
  }

  // -----------------------------------------------------------------
  // Failure Pattern Aggregation
  // -----------------------------------------------------------------
  public getFailurePatterns(): {
    totalFeedbacks: number;
    positiveCount: number;
    negativeCount: number;
    satisfactionRatePct: number;
    complaintBreakdown: Array<{ tag: string; count: number; percentage: number }>;
    topActionableInsight: string;
  } {
    const total = this.feedbacks.length;
    let positive = 0;
    let negative = 0;
    const tagCounts: Record<string, number> = {};

    for (const fb of this.feedbacks) {
      if (fb.is_useful) {
        positive++;
      } else {
        negative++;
        for (const tag of fb.complaint_tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
    }

    const complaintBreakdown = Object.entries(tagCounts)
      .map(([tag, count]) => ({
        tag,
        count,
        percentage: negative > 0 ? Math.round((count / negative) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    let topActionableInsight = 'No critical failure patterns detected. Feedback indicates balanced generation.';
    if (complaintBreakdown.length > 0) {
      const top = complaintBreakdown[0];
      topActionableInsight = `Highest failure pattern is '${top.tag}' (${top.percentage}% of complaints). Recommend prompt engineering calibration for this dimension.`;
    }

    return {
      totalFeedbacks: total,
      positiveCount: positive,
      negativeCount: negative,
      satisfactionRatePct: total > 0 ? Math.round((positive / total) * 100) : 100,
      complaintBreakdown,
      topActionableInsight
    };
  }
}

export const userFeedbackService = new UserFeedbackService();
