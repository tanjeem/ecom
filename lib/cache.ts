import fs from 'fs';
import path from 'path';

// Store the cache in .next/dashboard-cache.json so it persists across dev server runs
const CACHE_FILE = path.join(process.cwd(), '.next', 'dashboard-cache.json');

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class FileCache {
  private memoryStore = new Map<string, CacheEntry<any>>();
  private initialized = false;

  private init() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const fileContent = fs.readFileSync(CACHE_FILE, 'utf8');
        const data = JSON.parse(fileContent);
        const now = Date.now();
        for (const [key, entry] of Object.entries(data)) {
          const typedEntry = entry as CacheEntry<any>;
          if (now < typedEntry.expiresAt) {
            this.memoryStore.set(key, typedEntry);
          }
        }
      }
    } catch (e) {
      console.warn('[Cache] Failed to load cache from file:', e);
    }
  }

  private saveToFile() {
    try {
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data: Record<string, CacheEntry<any>> = {};
      const now = Date.now();
      for (const [key, entry] of this.memoryStore.entries()) {
        if (now < entry.expiresAt) {
          data[key] = entry;
        }
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf8');
    } catch (e) {
      console.warn('[Cache] Failed to save cache to file:', e);
    }
  }

  get<T>(key: string): T | null {
    this.init();
    const entry = this.memoryStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      this.saveToFile();
      return null;
    }
    return entry.value as T;
  }

  set(key: string, value: any, ttlMs: number): void {
    this.init();
    this.memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    this.saveToFile();
  }

  clear(): void {
    this.memoryStore.clear();
    try {
      if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
      }
      console.log('[Cache] Cache cleared successfully.');
    } catch (e) {
      console.warn('[Cache] Failed to delete cache file:', e);
    }
  }

  delete(key: string): void {
    this.init();
    this.memoryStore.delete(key);
    this.saveToFile();
  }
}

export const dashboardCache = new FileCache();
