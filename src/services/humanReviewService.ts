// src/services/humanReviewService.ts
/**
 * Subsystem B: Human-in-the-Loop Review Service
 * Manages human educator review records, edits, approvals, and structured issue flagging.
 */
import { HumanReviewRecord, HumanReviewAction, IssueSeverity } from '../types';

const STORAGE_KEY = 'clsg_human_reviews';

class HumanReviewService {
  private reviews: HumanReviewRecord[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.reviews = JSON.parse(data);
      }
    } catch {
      this.reviews = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.reviews));
    } catch {
      // ignore quota
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
        console.error('HumanReviewService notify error:', err);
      }
    });
  }

  public recordReview(params: {
    generationId: string;
    projectId: string;
    reviewerId: string;
    action: HumanReviewAction;
    selectedIssues: string[];
    severity?: IssueSeverity;
    comment?: string;
    editedScript?: Record<string, string>;
  }): HumanReviewRecord {
    const record: HumanReviewRecord = {
      review_id: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      generation_id: params.generationId,
      project_id: params.projectId,
      reviewer_id: params.reviewerId,
      action: params.action,
      selected_issues: params.selectedIssues,
      severity: params.severity || 'medium',
      comment: params.comment,
      edited_script: params.editedScript,
      reviewed_at: Date.now()
    };

    this.reviews.unshift(record);
    if (this.reviews.length > 500) {
      this.reviews = this.reviews.slice(0, 500);
    }
    this.saveToStorage();
    return record;
  }

  public getReviewsForProject(projectId: string): HumanReviewRecord[] {
    return this.reviews.filter((r) => r.project_id === projectId);
  }

  public getAllReviews(): HumanReviewRecord[] {
    return [...this.reviews];
  }

  public getReviewStats(): {
    totalReviews: number;
    approvedCount: number;
    editedCount: number;
    regeneratedCount: number;
    rejectedCount: number;
    issueCounts: Record<string, number>;
  } {
    const stats = {
      totalReviews: this.reviews.length,
      approvedCount: 0,
      editedCount: 0,
      regeneratedCount: 0,
      rejectedCount: 0,
      issueCounts: {} as Record<string, number>
    };

    for (const r of this.reviews) {
      if (r.action === 'APPROVE') stats.approvedCount++;
      else if (r.action === 'EDIT') stats.editedCount++;
      else if (r.action === 'REGENERATE') stats.regeneratedCount++;
      else if (r.action === 'REJECT') stats.rejectedCount++;

      for (const issue of r.selected_issues) {
        stats.issueCounts[issue] = (stats.issueCounts[issue] || 0) + 1;
      }
    }

    return stats;
  }
}

export const humanReviewService = new HumanReviewService();
