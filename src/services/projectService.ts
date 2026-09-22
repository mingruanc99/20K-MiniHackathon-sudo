// src/services/projectService.ts
/**
 * Project Data Persistence Service
 * Interacts with Firebase Firestore for project lifecycle management.
 * Provides full local storage persistence fallback for Demo Mode.
 */
import {
  auth,
  db,
  isFirebaseConfigured,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from '../lib/firebase';
import { Project, UserConfiguration, SourceAsset, ProjectProcessingStatus, CanonicalDocumentTree } from '../types';

export class ProjectService {
  private getLocalKey(userId: string): string {
    return `clsg_projects_${userId}`;
  }

  private canUseFirestore(): boolean {
    return Boolean(isFirebaseConfigured && auth && auth.currentUser);
  }

  private cleanForFirestore(data: any): any {
    return JSON.parse(JSON.stringify(data, (_, value) => (value === undefined ? null : value)));
  }

  async listProjects(userId: string): Promise<Project[]> {
    if (this.canUseFirestore()) {
      try {
        const q = query(collection(db, 'projects'), where('userId', '==', userId));
        const snap = await getDocs(q);
        const projects: Project[] = [];
        snap.forEach((d) => projects.push(d.data() as Project));
        return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      } catch (err) {
        console.warn('Firestore query failed, falling back to local store:', err);
      }
    }

    const raw = localStorage.getItem(this.getLocalKey(userId));
    if (!raw) {
      // Initialize with default CNN demo project if empty
      const initialProjects = [this.getBuiltinCnnProject(userId)];
      localStorage.setItem(this.getLocalKey(userId), JSON.stringify(initialProjects));
      return initialProjects;
    }

    try {
      const list: Project[] = JSON.parse(raw);
      return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch {
      return [];
    }
  }

  async getProject(projectId: string, userId: string): Promise<Project | null> {
    if (this.canUseFirestore()) {
      try {
        const d = await getDoc(doc(db, 'projects', projectId));
        if (d.exists()) {
          const data = d.data() as Project;
          if (data.userId === userId) return data;
        }
      } catch (err) {
        console.warn('Firestore get failed, falling back to local store:', err);
      }
    }

    const projects = await this.listProjects(userId);
    return projects.find((p) => p.projectId === projectId) || null;
  }

  async createProject(
    userId: string,
    title: string,
    source: SourceAsset,
    config: UserConfiguration,
    description?: string,
    canonicalDocument?: CanonicalDocumentTree
  ): Promise<Project> {
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newProject: Project = {
      projectId,
      userId,
      title,
      description: description || 'Instructional lecture video project',
      source,
      configuration: config,
      canonicalDocument,
      status: 'uploaded',
      createdAt: now,
      updatedAt: now
    };

    if (this.canUseFirestore()) {
      try {
        const payload = this.cleanForFirestore(newProject);
        await setDoc(doc(db, 'projects', projectId), {
          ...payload,
          serverCreatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('Firestore create failed, saving to local store:', err);
      }
    }

    // Always keep local mirror updated
    const list = await this.listProjects(userId);
    list.unshift(newProject);
    localStorage.setItem(this.getLocalKey(userId), JSON.stringify(list));

    return newProject;
  }

  async updateProject(project: Project): Promise<void> {
    const updated = {
      ...project,
      updatedAt: new Date().toISOString()
    };

    if (this.canUseFirestore()) {
      try {
        const payload = this.cleanForFirestore(updated);
        await updateDoc(doc(db, 'projects', project.projectId), payload);
      } catch (err) {
        console.warn('Firestore update failed, updating local store:', err);
      }
    }

    const list = await this.listProjects(project.userId);
    const idx = list.findIndex((p) => p.projectId === project.projectId);
    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.unshift(updated);
    }
    localStorage.setItem(this.getLocalKey(project.userId), JSON.stringify(list));
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    if (this.canUseFirestore()) {
      try {
        await deleteDoc(doc(db, 'projects', projectId));
      } catch (err) {
        console.warn('Firestore delete failed:', err);
      }
    }

    const list = await this.listProjects(userId);
    const filtered = list.filter((p) => p.projectId !== projectId);
    localStorage.setItem(this.getLocalKey(userId), JSON.stringify(filtered));
  }

  getBuiltinCnnProject(userId: string): Project {
    return {
      projectId: 'proj_demo_cnn_001',
      userId,
      title: 'Introduction to Convolutional Neural Networks',
      description: 'Foundations of Computer Vision, Spatial Locality, and Feature Hierarchies',
      source: {
        fileName: 'cnn_intro.pptx',
        fileType: 'pptx',
        fileSize: 45200,
        cloudinaryPublicId: 'demo/cnn_intro',
        cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg'
      },
      configuration: {
        language: 'en',
        learnerLevel: 'undergraduate',
        priorKnowledge: 'Basic linear algebra, matrix operations, introductory calculus',
        targetDurationSeconds: 180,
        targetWpm: 140,
        narrationStyle: 'academic',
        visualDensity: 'balanced',
        interactionLevel: 'moderate',
        accessibility: {
          captions: true,
          highContrast: false,
          slowerPacing: false
        }
      },
      status: 'verified',
      createdAt: '2026-09-21T10:00:00.000Z',
      updatedAt: '2026-09-21T10:02:15.000Z'
    };
  }
}

export const projectService = new ProjectService();
