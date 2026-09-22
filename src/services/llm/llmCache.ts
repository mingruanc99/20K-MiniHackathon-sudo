// src/services/llm/llmCache.ts
/**
 * In-Memory & LocalStorage Semantic Cache for CLSG-IR
 * Key: sha256 / hash of (document_content + config + prompt_version)
 * Prevents expensive duplicate LLM calls on unchanged lecture material.
 */

class LLMCache {
  private memoryCache = new Map<string, any>();
  private readonly prefix = 'clsg_cache_';

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  buildCacheKey(docText: string, config: any, promptVersion: string = 'v1'): string {
    const raw = `${docText}_${JSON.stringify(config || {})}_${promptVersion}`;
    return `${this.prefix}${this.simpleHash(raw)}`;
  }

  get<T>(key: string): T | null {
    // 1. Memory check
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T;
    }

    // 2. LocalStorage check (browser environment)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = window.localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          this.memoryCache.set(key, parsed);
          return parsed as T;
        }
      } catch (err) {
        console.warn('Cache read error:', err);
      }
    }

    return null;
  }

  set<T>(key: string, value: T): void {
    this.memoryCache.set(key, value);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        console.warn('Cache write error (storage quota):', err);
      }
    }
  }

  clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(this.prefix)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      } catch (err) {
        console.warn('Cache clear error:', err);
      }
    }
  }
}

export const llmCache = new LLMCache();
