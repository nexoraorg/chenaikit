import { EventEmitter } from 'eventemitter3';
import { HookType, HookContext, HookHandler } from './types';

interface HookEntry {
  handler: HookHandler;
  priority: number;
  pluginName: string;
}

/**
 * Hook system that manages before/after hooks for all major operations.
 * Hooks are executed in priority order (higher priority first).
 */
export class HookSystem {
  private hooks: Map<HookType, HookEntry[]> = new Map();
  private events: EventEmitter;

  constructor(events?: EventEmitter) {
    this.events = events || new EventEmitter();
  }

  /**
   * Register a hook handler for a specific hook type
   */
  register(hookType: HookType, handler: HookHandler, priority: number = 0, pluginName?: string): void {
    if (!this.hooks.has(hookType)) {
      this.hooks.set(hookType, []);
    }

    const entries = this.hooks.get(hookType)!;
  entries.push({ handler, priority, pluginName: pluginName || 'unknown' });
  entries.sort((a, b) => b.priority - a.priority);

  this.events.emit('hook:registered', { hookType, pluginName: pluginName || 'unknown', priority });
  }

  /**
   * Unregister a specific hook handler
   */
  unregister(hookType: HookType, handler: HookHandler): boolean {
    const entries = this.hooks.get(hookType);
    if (!entries) return false;

    const index = entries.findIndex((e) => e.handler === handler);
    if (index === -1) return false;

    entries.splice(index, 1);
    if (entries.length === 0) {
      this.hooks.delete(hookType);
    }

    return true;
  }

  /**
   * Unregister all hooks for a specific plugin
   */
  unregisterPlugin(pluginName: string): number {
    let count = 0;
    for (const [hookType, entries] of this.hooks.entries()) {
      const filtered = entries.filter((e) => e.pluginName !== pluginName);
      count += entries.length - filtered.length;
      if (filtered.length === 0) {
        this.hooks.delete(hookType);
      } else {
        this.hooks.set(hookType, filtered);
      }
    }
    return count;
  }

  /**
   * Execute all 'before' hooks for a given operation
   */
  async executeBefore(hookType: HookType, args: Record<string, unknown>): Promise<HookContext> {
    const context: HookContext = {
      pluginName: 'system',
      hookType,
      timestamp: new Date(),
      args,
    };

    const beforeType = `${hookType.split(':')[0]}:before` as HookType;
    const entries = this.hooks.get(beforeType) || [];

    for (const entry of entries) {
      try {
        const result = await entry.handler({ ...context, pluginName: entry.pluginName });
        Object.assign(context, result);
      } catch (error) {
        context.error = error as Error;
        this.events.emit('hook:error', {
          hookType: beforeType,
          pluginName: entry.pluginName,
          error,
        });
        throw error;
      }
    }

    return context;
  }

  /**
   * Execute all 'after' hooks for a given operation
   */
  async executeAfter(
    hookType: HookType,
    args: Record<string, unknown>,
    result?: unknown
  ): Promise<HookContext> {
    const context: HookContext = {
      pluginName: 'system',
      hookType,
      timestamp: new Date(),
      args,
      result,
    };

    const afterType = `${hookType.split(':')[0]}:after` as HookType;
    const entries = this.hooks.get(afterType) || [];

    for (const entry of entries) {
      try {
        const hookResult = await entry.handler({ ...context, pluginName: entry.pluginName });
        Object.assign(context, hookResult);
      } catch (error) {
        context.error = error as Error;
        this.events.emit('hook:error', {
          hookType: afterType,
          pluginName: entry.pluginName,
          error,
        });
      }
    }

    return context;
  }

  /**
   * Get all registered hook types
   */
  getRegisteredHooks(): HookType[] {
    return Array.from(this.hooks.keys());
  }

  /**
   * Get all handlers for a specific hook type
   */
  getHandlers(hookType: HookType): HookEntry[] {
    return this.hooks.get(hookType) || [];
  }

  /**
   * Get hook count for a plugin
   */
  getPluginHookCount(pluginName: string): number {
    let count = 0;
    for (const entries of this.hooks.values()) {
      count += entries.filter((e) => e.pluginName === pluginName).length;
    }
    return count;
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear();
  }
}