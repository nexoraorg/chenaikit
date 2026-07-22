import { z } from 'zod';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventEmitter = any;

/**
 * Plugin lifecycle states
 */
export enum PluginState {
  REGISTERED = 'registered',
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  DEACTIVATING = 'deactivating',
  DEACTIVATED = 'deactivated',
  ERROR = 'error',
  DISPOSED = 'disposed',
}

/**
 * Plugin version compatibility
 */
export interface PluginVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Core API version this plugin requires
 */
export interface PluginCompatibility {
  minCoreVersion: string;
  maxCoreVersion?: string;
}

/**
 * Hook types available in the system
 */
export type HookType =
  | 'validation:before'
  | 'validation:after'
  | 'api:before'
  | 'api:after'
  | 'db:before'
  | 'db:after'
  | 'transform:before'
  | 'transform:after'
  | 'auth:before'
  | 'auth:after'
  | 'plugin:init'
  | 'plugin:activate'
  | 'plugin:deactivate'
  | 'plugin:dispose';

/**
 * Hook execution context
 */
export interface HookContext {
  pluginName: string;
  hookType: HookType;
  timestamp: Date;
  args: Record<string, unknown>;
  result?: unknown;
  error?: Error;
}

/**
 * Plugin configuration schema (validated with Zod)
 */
export interface PluginConfig {
  enabled: boolean;
  settings: Record<string, unknown>;
  permissions: string[];
}

/**
 * Plugin permission model
 */
export interface PluginPermission {
  resource: string;
  actions: ('read' | 'write' | 'execute' | 'admin')[];
}

/**
 * Plugin metadata
 */
export interface PluginMeta {
  name: string;
  version: PluginVersion;
  description: string;
  author: string;
  license?: string;
  homepage?: string;
  repository?: string;
  compatibility: PluginCompatibility;
  permissions: PluginPermission[];
  dependencies?: string[];
}

/**
 * Hook handler function
 */
export type HookHandler = (context: HookContext) => Promise<HookContext> | HookContext;

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  before: Record<string, HookHandler[]>;
  after: Record<string, HookHandler[]>;
}

/**
 * Core API exposed to plugins via proxy (sandboxed)
 */
export interface PluginCoreAPI {
  logger: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
    debug: (msg: string, meta?: Record<string, unknown>) => void;
  };
  config: {
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => void;
  };
  db?: {
    query: (query: string, params?: unknown[]) => Promise<unknown[]>;
    execute: (query: string, params?: unknown[]) => Promise<unknown>;
  };
  api: {
    get: (path: string, params?: Record<string, unknown>) => Promise<unknown>;
    post: (path: string, body?: unknown) => Promise<unknown>;
    put: (path: string, body?: unknown) => Promise<unknown>;
    delete: (path: string) => Promise<unknown>;
  };
  events: EventEmitter;
  hooks: {
    register: (hookType: HookType, handler: HookHandler, priority?: number, pluginName?: string) => void;
    unregister: (hookType: HookType, handler: HookHandler) => void;
  };
}

/**
 * Plugin interface - all plugins must implement this
 */
export interface IPlugin {
  readonly meta: PluginMeta;
  readonly state: PluginState;

  /**
   * Called when plugin is registered
   */
  onRegister?(api: PluginCoreAPI): Promise<void> | void;

  /**
   * Called during initialization
   */
  onInit?(api: PluginCoreAPI): Promise<void> | void;

  /**
   * Called when plugin is activated
   */
  onActivate?(api: PluginCoreAPI): Promise<void> | void;

  /**
   * Called when plugin is deactivated
   */
  onDeactivate?(api: PluginCoreAPI): Promise<void> | void;

  /**
   * Called when plugin is disposed (cleanup resources)
   */
  onDispose?(api: PluginCoreAPI): Promise<void> | void;

  /**
   * Validate plugin configuration
   */
  validateConfig?(config: Record<string, unknown>): Error | null;

  /**
   * Get plugin configuration schema (optional descriptive schema)
   */
  getConfigSchema?(): Record<string, string>;

  /**
   * Handle hot-reload notification
   */
  onHotReload?(api: PluginCoreAPI): Promise<void> | void;
}

/**
 * Plugin manifest (package.json-like structure for plugins)
 */
export const PluginManifestSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.object({
    major: z.number().int().min(0),
    minor: z.number().int().min(0),
    patch: z.number().int().min(0),
  }),
  description: z.string().default(''),
  author: z.string().default('unknown'),
  license: z.string().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().optional(),
  compatibility: z.object({
    minCoreVersion: z.string(),
    maxCoreVersion: z.string().optional(),
  }),
  permissions: z.array(
    z.object({
      resource: z.string(),
      actions: z.array(z.enum(['read', 'write', 'execute', 'admin'])),
    })
  ).default([]),
  dependencies: z.array(z.string()).optional(),
  main: z.string().default('index.js'),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/**
 * Plugin status for monitoring
 */
export interface PluginStatus {
  name: string;
  version: string;
  state: PluginState;
  uptime: number;
  memoryUsage: number;
  errorCount: number;
  lastError?: string;
  configErrors?: string[];
}