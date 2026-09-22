// src/services/llm/apiKeyService.ts
/**
 * Service for managing Gemini API Key in browser localStorage and environment.
 * Ensures the application runs 100% in Online LLM mode.
 */

const STORAGE_KEY = 'CLSG_GEMINI_API_KEY';

type KeyChangeListener = (newKey: string) => void;
const listeners: Set<KeyChangeListener> = new Set();

export const apiKeyService = {
  getApiKey(): string {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && stored.trim()) {
        return stored.trim();
      }
    }

    if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
      return String(process.env.GEMINI_API_KEY).trim();
    }

    return '';
  },

  setApiKey(key: string): void {
    const trimmed = key.trim();
    if (typeof window !== 'undefined' && window.localStorage) {
      if (trimmed) {
        window.localStorage.setItem(STORAGE_KEY, trimmed);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    listeners.forEach((listener) => listener(trimmed));
  },

  hasApiKey(): boolean {
    return this.getApiKey().length > 0;
  },

  subscribe(listener: KeyChangeListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  async validateKey(keyToTest: string): Promise<{ valid: boolean; message: string }> {
    const key = keyToTest.trim();
    if (!key) {
      return { valid: false, message: 'Vui lòng nhập API Key.' };
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': key
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Ping test. Reply with OK' }] }]
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.error?.message || `Lỗi HTTP ${res.status}`;
        return { valid: false, message: `API Key không hợp lệ: ${msg}` };
      }

      return { valid: true, message: 'API Key hoạt động chính xác và đã kết nối thành công tới Gemini!' };
    } catch (err: any) {
      return { valid: false, message: `Lỗi kết nối mạng: ${err.message || 'Không thể liên lạc với máy chủ Google.'}` };
    }
  }
};
