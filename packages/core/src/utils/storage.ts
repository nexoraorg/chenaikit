/**
 * Storage utilities for browser and Node.js
 */

/**
 * Storage interface
 */
export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

/**
 * Memory storage implementation
 */
class MemoryStorage implements Storage {
  private data: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.data.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

/**
 * Get storage instance based on environment
 */
export function getStorage(): Storage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  
  if (typeof global !== 'undefined' && global.localStorage) {
    return global.localStorage;
  }
  
  return new MemoryStorage();
}

/**
 * Storage wrapper with JSON serialization
 */
export class JSONStorage {
  private storage: Storage;
  private prefix: string;

  constructor(storage?: Storage, prefix = 'chenaikit_') {
    this.storage = storage || getStorage();
    this.prefix = prefix;
  }

  /**
   * Get item with JSON parsing
   */
  get<T = any>(key: string): T | null {
    try {
      const item = this.storage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.warn(`Failed to parse stored item ${key}:`, error);
      return null;
    }
  }

  /**
   * Set item with JSON serialization
   */
  set<T = any>(key: string, value: T): void {
    try {
      this.storage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to store item ${key}:`, error);
      throw error;
    }
  }

  /**
   * Remove item
   */
  remove(key: string): void {
    this.storage.removeItem(this.prefix + key);
  }

  /**
   * Check if item exists
   */
  has(key: string): boolean {
    return this.storage.getItem(this.prefix + key) !== null;
  }

  /**
   * Clear all items with prefix
   */
  clear(): void {
    if (this.storage.clear) {
      this.storage.clear();
    } else {
      // Fallback for storage without clear method
      const keys = this.getAllKeys();
      keys.forEach(key => this.remove(key));
    }
  }

  /**
   * Get all keys with prefix
   */
  getAllKeys(): string[] {
    if (this.storage instanceof MemoryStorage) {
      return Array.from((this.storage as MemoryStorage)['data'].keys())
        .filter(key => key.startsWith(this.prefix))
        .map(key => key.substring(this.prefix.length));
    }
    
    // For localStorage, we can't enumerate keys directly
    return [];
  }

  /**
   * Get storage size in bytes (approximate)
   */
  getSize(): number {
    let size = 0;
    const keys = this.getAllKeys();
    
    keys.forEach(key => {
      const item = this.storage.getItem(this.prefix + key);
      if (item) {
        size += key.length + item.length;
      }
    });
    
    return size;
  }
}

/**
 * Cache with TTL support
 */
export class CacheStorage<T = any> extends JSONStorage {
  private ttl: number;

  constructor(ttl = 300000, storage?: Storage, prefix = 'cache_') { // 5 minutes default
    super(storage, prefix);
    this.ttl = ttl;
  }

  /**
   * Set item with TTL
   */
  set(key: string, value: T, customTtl?: number): void {
    const expires = Date.now() + (customTtl || this.ttl);
    const item = {
      value,
      expires,
    };
    
    super.set(key, item);
  }

  /**
   * Get item, return null if expired
   */
  get(key: string): T | null {
    const item = super.get<{ value: T; expires: number }>(key);
    
    if (!item) {
      return null;
    }
    
    if (Date.now() > item.expires) {
      this.remove(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Clean expired items
   */
  clean(): void {
    const keys = this.getAllKeys();
    const now = Date.now();
    
    keys.forEach(key => {
      const item = super.get<{ value: T; expires: number }>(key);
      if (item && now > item.expires) {
        this.remove(key);
      }
    });
  }

  /**
   * Check if item exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

/**
 * Session storage wrapper
 */
export function getSessionStorage(): Storage {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }
  
  return new MemoryStorage();
}

/**
 * Create session-based JSON storage
 */
export function createSessionStorage(prefix = 'chenaikit_session_'): JSONStorage {
  return new JSONStorage(getSessionStorage(), prefix);
}

/**
 * Create cache storage
 */
export function createCacheStorage<T = any>(ttl?: number): CacheStorage<T> {
  return new CacheStorage<T>(ttl);
}
