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
    const localMap = new Map<string, Project>();

    // 1. Read local storage projects
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(this.getLocalKey(userId));
        if (raw) {
          const list: Project[] = JSON.parse(raw);
          list.forEach((p) => localMap.set(p.projectId, p));
        }
      } catch (err) {
        console.warn('Error reading local projects:', err);
      }
    }

    // 2. Read Firestore projects and merge with newer updatedAt
    if (this.canUseFirestore()) {
      try {
        const q = query(collection(db, 'projects'), where('userId', '==', userId));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          const p = d.data() as Project;
          const existing = localMap.get(p.projectId);
          if (!existing || new Date(p.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
            localMap.set(p.projectId, p);
          }
        });
      } catch (err) {
        console.warn('Firestore query failed, falling back to local store:', err);
      }
    }

    if (localMap.size === 0) {
      const initialProjects = [this.getBuiltinCnnProject(userId)];
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.getLocalKey(userId), JSON.stringify(initialProjects));
      }
      return initialProjects;
    }

    const merged = Array.from(localMap.values());
    merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return merged;
  }

  async listAllProjects(): Promise<Project[]> {
    const projectMap = new Map<string, Project>();

    // 1. Read all localStorage keys starting with clsg_projects_
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('clsg_projects_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const list: Project[] = JSON.parse(raw);
              if (Array.isArray(list)) {
                list.forEach((p) => {
                  if (p && p.projectId) {
                    const existing = projectMap.get(p.projectId);
                    if (!existing || new Date(p.updatedAt || 0).getTime() >= new Date(existing.updatedAt || 0).getTime()) {
                      projectMap.set(p.projectId, p);
                    }
                  }
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error reading local projects for admin:', err);
      }
    }

    // 2. Read all Firestore projects if connected
    if (this.canUseFirestore()) {
      try {
        const snap = await getDocs(collection(db, 'projects'));
        snap.forEach((d) => {
          const p = d.data() as Project;
          if (p && p.projectId) {
            const existing = projectMap.get(p.projectId);
            if (!existing || new Date(p.updatedAt || 0).getTime() >= new Date(existing.updatedAt || 0).getTime()) {
              projectMap.set(p.projectId, p);
            }
          }
        });
      } catch (err) {
        console.warn('Admin Firestore list all projects notice:', err);
      }
    }

    // 3. If empty, ensure default CNN project is present
    if (projectMap.size === 0) {
      const defaultProj = this.getBuiltinCnnProject('admin_hkthien_husc');
      projectMap.set(defaultProj.projectId, defaultProj);
    }

    const merged = Array.from(projectMap.values());
    merged.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return merged;
  }

  async getProject(projectId: string, userId: string): Promise<Project | null> {
    // 1. First check local store for the latest customized configuration
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(this.getLocalKey(userId));
        if (raw) {
          const list: Project[] = JSON.parse(raw);
          const found = list.find((p) => p.projectId === projectId);
          if (found) return found;
        }
      } catch (e) {
        console.warn('Local store read error:', e);
      }
    }

    // 2. Check Firestore if available
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

    // 3. Built-in CNN demo fallback
    if (projectId === 'proj_demo_cnn_001') {
      return this.getBuiltinCnnProject(userId);
    }

    return null;
  }

  async createProject(
    userId: string,
    title: string,
    source: SourceAsset,
    config: UserConfiguration,
    description?: string,
    canonicalDocument?: CanonicalDocumentTree
  ): Promise<Project> {
    const newId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newProj: Project = {
      projectId: newId,
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

    // 1. Save to local store immediately
    try {
      const raw = localStorage.getItem(this.getLocalKey(userId));
      const list: Project[] = raw ? JSON.parse(raw) : [];
      list.unshift(newProj);
      localStorage.setItem(this.getLocalKey(userId), JSON.stringify(list));
    } catch (e) {
      console.warn('Local store create error:', e);
    }

    // 2. Sync to Firestore if authenticated
    if (this.canUseFirestore()) {
      try {
        const clean = this.cleanForFirestore(newProj);
        await setDoc(doc(db, 'projects', newId), {
          ...clean,
          serverCreatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('Firestore create failed, saved to local store:', err);
      }
    }

    return newProj;
  }

  async updateProject(project: Project): Promise<void> {
    const updated = {
      ...project,
      updatedAt: new Date().toISOString()
    };

    // 1. ALWAYS update local store immediately so customized settings are never lost
    try {
      const raw = localStorage.getItem(this.getLocalKey(project.userId));
      const list: Project[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((p) => p.projectId === project.projectId);
      if (idx >= 0) {
        list[idx] = updated;
      } else {
        list.unshift(updated);
      }
      localStorage.setItem(this.getLocalKey(project.userId), JSON.stringify(list));
    } catch (e) {
      console.warn('Local store update error:', e);
    }

    // 2. Sync to Firestore using setDoc with merge: true to avoid failures on uncreated docs
    if (this.canUseFirestore()) {
      try {
        const payload = this.cleanForFirestore(updated);
        await setDoc(doc(db, 'projects', project.projectId), payload, { merge: true });
      } catch (err) {
        console.warn('Firestore update failed, saved to local store:', err);
      }
    }
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
