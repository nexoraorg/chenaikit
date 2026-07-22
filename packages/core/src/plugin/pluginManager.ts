import { EventEmitter } from 'eventemitter3';
import { z } from 'zod';
import * as semver from 'semver';
import { HookSystem } from './hookSystem';
import {
  IPlugin,
  PluginState,
  PluginStatus,
  PluginCoreAPI,
  HookType,
  HookHandler,
  PluginManifestSchema,
} from './types';
import { HotReloadWatcher } from './hotReload';

const CORE_VERSION = '0.1.0';

/**
 * Creates a sandboxed proxy that wraps the core API for plugin isolation.
 * Restricts access to only allowed resources based on plugin permissions.
 */
function createSandboxedAPI(plugin: IPlugin, events: EventEmitter, hooks: HookSystem): PluginCoreAPI {
  const permissions = plugin.meta.permissions || [];

  const hasPermission = (resource: string, action: string): boolean => {
    return permissions.some(
      (p) => p.resource === resource && p.actions.includes(action as any)
    );
  };

  const proxyConfig = new Proxy(
    { store: {} as Record<string, unknown> },
    {
      get(target, prop) {
        if (prop === 'get') {
          return (key: string) => (target.store as Record<string, unknown>)[key];
        }
        if (prop === 'set') {
          return (key: string, value: unknown) => {
            if (hasPermission('config', 'write')) {
              (target.store as Record<string, unknown>)[key] = value;
            }
          };
        }
        return undefined;
      },
    }
  );

  return {
    logger: {
      info: (msg: string, meta?: Record<string, unknown>) => {
        console.log(`[plugin:${plugin.meta.name}] INFO: ${msg}`, meta || '');
      },
      warn: (msg: string, meta?: Record<string, unknown>) => {
        console.warn(`[plugin:${plugin.meta.name}] WARN: ${msg}`, meta || '');
      },
      error: (msg: string, meta?: Record<string, unknown>) => {
        console.error(`[plugin:${plugin.meta.name}] ERROR: ${msg}`, meta || '');
      },
      debug: (msg: string, meta?: Record<string, unknown>) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[plugin:${plugin.meta.name}] DEBUG: ${msg}`, meta || '');
        }
      },
    },
    config: proxyConfig as any,
    db: hasPermission('db', 'execute')
      ? {
          query: async (query: string, params?: unknown[]) => {
            events.emit('plugin:db:query', { plugin: plugin.meta.name, query });
            return [];
          },
          execute: async (query: string, params?: unknown[]) => {
            events.emit('plugin:db:execute', { plugin: plugin.meta.name, query });
            return undefined;
          },
        }
      : undefined,
    api: {
      get: async (path: string, params?: Record<string, unknown>) => {
        if (!hasPermission('api', 'read')) throw new Error('API read not permitted');
        return { path, params };
      },
      post: async (path: string, body?: unknown) => {
        if (!hasPermission('api', 'write')) throw new Error('API write not permitted');
        return { path, body };
      },
      put: async (path: string, body?: unknown) => {
        if (!hasPermission('api', 'write')) throw new Error('API write not permitted');
        return { path, body };
      },
      delete: async (path: string) => {
        if (!hasPermission('api', 'write')) throw new Error('API write not permitted');
        return { path };
      },
    },
    events,
    hooks: {
      register: (hookType: HookType, handler: HookHandler, priority?: number) => {
        if (!hasPermission('hooks', 'write')) {
          throw new Error('Hook registration not permitted for this plugin');
        }
        hooks.register(hookType, handler, priority || 0, plugin.meta.name);
      },
      unregister: (hookType: HookType, handler: HookHandler) => {
        hooks.unregister(hookType, handler);
      },
    },
  };
}

interface PluginInstance {
  plugin: IPlugin;
  api: PluginCoreAPI;
  startedAt: Date;
  errorCount: number;
  memorySnapshot: number;
}

/**
 * PluginManager: central registry that manages plugin lifecycle, validation,
 * sandboxing, hot-reloading, and dependency resolution.
 */
export class PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private pluginDir: string;
  private hooks: HookSystem;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private events: any;
  private hotReloader: HotReloadWatcher | null = null;
  private configValidators: Map<string, z.ZodObject<any>> = new Map();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(pluginDir: string = './plugins', events?: any) {
    this.pluginDir = pluginDir;
    this.events = events || (new EventEmitter() as any);
    this.hooks = new HookSystem(this.events as any);
  }

  getHookSystem(): HookSystem {
    return this.hooks;
  }

  getEvents(): any {
    return this.events;
  }

  /**
   * Register a plugin by its manifest and module
   */
  async register(manifest: Record<string, unknown>, pluginModule: { default?: IPlugin } | IPlugin): Promise<IPlugin> {
    // Validate manifest with Zod schema
    const parsedManifest = PluginManifestSchema.parse(manifest);

    if (this.plugins.has(parsedManifest.name)) {
      throw new Error(`Plugin "${parsedManifest.name}" is already registered`);
    }

    // Check version compatibility
    const minVersion = parsedManifest.compatibility.minCoreVersion;
    if (!semver.satisfies(CORE_VERSION, `>=${minVersion}`)) {
      throw new Error(
        `Plugin "${parsedManifest.name}" requires core >=${minVersion}, current is ${CORE_VERSION}`
      );
    }
    if (parsedManifest.compatibility.maxCoreVersion) {
      if (!semver.satisfies(CORE_VERSION, `<=${parsedManifest.compatibility.maxCoreVersion}`)) {
        throw new Error(
          `Plugin "${parsedManifest.name}" requires core <=${parsedManifest.compatibility.maxCoreVersion}`
        );
      }
    }

    // Resolve dependencies
    if (parsedManifest.dependencies) {
      for (const dep of parsedManifest.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(
            `Plugin "${parsedManifest.name}" requires dependency "${dep}" which is not registered`
          );
        }
      }
    }

    // Get plugin instance
    const plugin: IPlugin = 'default' in pluginModule && pluginModule.default ? pluginModule.default : pluginModule as IPlugin;

    // Override meta with validated manifest
    (plugin as any).meta = {
      ...plugin.meta,
      ...parsedManifest,
    };

    const api = createSandboxedAPI(plugin, this.events as any, this.hooks);

    this.plugins.set(parsedManifest.name, {
      plugin,
      api,
      startedAt: new Date(),
      errorCount: 0,
      memorySnapshot: 0,
    });

    // Call lifecycle hook
    if (plugin.onRegister) {
      await plugin.onRegister(api);
    }

    this.events.emit('plugin:registered', { name: parsedManifest.name, version: parsedManifest.version });
    return plugin;
  }

  /**
   * Initialize a plugin
   */
  async init(name: string): Promise<void> {
    const instance = this.plugins.get(name);
    if (!instance) throw new Error(`Plugin "${name}" not found`);

    const { plugin, api } = instance;

    if (plugin.onInit) {
      try {
        await plugin.onInit(api);
      } catch (error) {
        instance.errorCount++;
        throw error;
      }
    }
  }

  /**
   * Activate a plugin
   */
  async activate(name: string): Promise<void> {
    const instance = this.plugins.get(name);
    if (!instance) throw new Error(`Plugin "${name}" not found`);

    const { plugin, api } = instance;

    if (plugin.onActivate) {
      try {
        await plugin.onActivate(api);
      } catch (error) {
        instance.errorCount++;
        throw error;
      }
    }

    this.events.emit('plugin:activated', { name });
  }

  /**
   * Deactivate a plugin
   */
  async deactivate(name: string): Promise<void> {
    const instance = this.plugins.get(name);
    if (!instance) throw new Error(`Plugin "${name}" not found`);

    const { plugin, api } = instance;

    if (plugin.onDeactivate) {
      try {
        await plugin.onDeactivate(api);
      } catch (error) {
        instance.errorCount++;
        throw error;
      }
    }

    this.events.emit('plugin:deactivated', { name });
  }

  /**
   * Dispose a plugin and clean up resources
   */
  async dispose(name: string): Promise<void> {
    const instance = this.plugins.get(name);
    if (!instance) throw new Error(`Plugin "${name}" not found`);

    const { plugin, api } = instance;

    // Deactivate first if active
    await this.deactivate(name);

    if (plugin.onDispose) {
      try {
        await plugin.onDispose(api);
      } catch (error) {
        instance.errorCount++;
        console.error(`[plugin] Error disposing "${name}":`, error);
      }
    }

    // Clean up hooks
    this.hooks.unregisterPlugin(name);

    this.plugins.delete(name);
    this.events.emit('plugin:disposed', { name });
  }

  /**
   * Execute a hook (before and after)
   */
  async executeHook(hookType: HookType, args: Record<string, unknown>, result?: unknown): Promise<void> {
    await this.hooks.executeBefore(hookType, args);
    await this.hooks.executeAfter(hookType, args, result);
  }

  /**
   * Get plugin status for monitoring
   */
  getStatus(name: string): PluginStatus | null {
    const instance = this.plugins.get(name);
    if (!instance) return null;

    return {
      name: instance.plugin.meta.name,
      version: `${instance.plugin.meta.version.major}.${instance.plugin.meta.version.minor}.${instance.plugin.meta.version.patch}`,
      state: PluginState.ACTIVE,
      uptime: Date.now() - instance.startedAt.getTime(),
      memoryUsage: process.memoryUsage?.()?.heapUsed || 0,
      errorCount: instance.errorCount,
    };
  }

  /**
   * List all registered plugins with status
   */
  list(): PluginStatus[] {
    const statuses: PluginStatus[] = [];
    for (const name of this.plugins.keys()) {
      const status = this.getStatus(name);
      if (status) statuses.push(status);
    }
    return statuses;
  }

  /**
   * Get a plugin instance
   */
  get(name: string): IPlugin | undefined {
    return this.plugins.get(name)?.plugin;
  }

  /**
   * Check if a plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Start hot-reload watcher for development
   */
  startHotReload(): void {
    if (this.hotReloader) return;

    this.hotReloader = new HotReloadWatcher(this.pluginDir, this, this.events);
    this.hotReloader.start();
    this.events.emit('plugin:hotreload:started', { dir: this.pluginDir });
  }

  /**
   * Stop hot-reload watcher
   */
  stopHotReload(): void {
    if (this.hotReloader) {
      this.hotReloader.stop();
      this.hotReloader = null;
      this.events.emit('plugin:hotreload:stopped', {});
    }
  }

  /**
   * Dispose all plugins and clean up
   */
  async disposeAll(): Promise<void> {
    this.stopHotReload();
    for (const name of this.plugins.keys()) {
      await this.dispose(name).catch((err) =>
        console.error(`[plugin] Error disposing "${name}":`, err)
      );
    }
    this.hooks.clear();
    this.plugins.clear();
  }
}