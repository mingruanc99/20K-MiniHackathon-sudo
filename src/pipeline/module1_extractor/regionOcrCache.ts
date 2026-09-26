// src/pipeline/module1_extractor/regionOcrCache.ts
/**
 * Persistent OCR cache keyed by the SHA-256 of the region crop, so each image costs Gemini tokens
 * (or VietOCR server time) once per browser, across rescans, re-uploads and projects.
 *
 * Stored in IndexedDB (localStorage is ~5 MB and the old 32-bit hash in llmCache collides).
 * Only good readings are stored: Gemini and VietOCR results with status "done". Tesseract readings
 * are free to redo and are what we fall back to when the better engines are down, so caching them
 * would pin a poor reading.
 * Bump CACHE_VERSION when the OCR prompt or the server's output format changes.
 * Every call degrades to a miss when IndexedDB or crypto.subtle is unavailable (tests, http origins).
 */
import type { RegionOcrResult } from '../../types';

const DB_NAME = 'clsg_region_ocr';
const STORE = 'readings';
const CACHE_VERSION = 'v1';
const CACHEABLE_ENGINES: RegionOcrResult['engine'][] = ['gemini', 'vietocr'];

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }
  return dbPromise;
}

export async function regionImageKey(image: { mimeType: string; data: string }): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const bytes = new TextEncoder().encode(`${CACHE_VERSION}|${image.mimeType}|${image.data}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getCachedReading(key: string | null): Promise<RegionOcrResult | null> {
  const db = key ? await openDb() : null;
  if (!db || !key) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result?.reading as RegionOcrResult) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putCachedReading(key: string | null, reading: RegionOcrResult): Promise<void> {
  if (!key || reading.status !== 'done' || !CACHEABLE_ENGINES.includes(reading.engine)) return;
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).put({ reading, saved_at: Date.now() }, key);
  } catch (err) {
    console.warn('OCR cache write failed:', err);
  }
}
