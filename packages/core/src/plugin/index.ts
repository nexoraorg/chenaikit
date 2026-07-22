/**
 * Plugin Architecture Module
 * 
 * Provides a complete plugin system with lifecycle management, hook system,
 * sandboxed isolation, hot-reloading, and configuration validation.
 * 
 * @module @chenaikit/core/plugin
 */

export { PluginManager } from './pluginManager';
export { HookSystem } from './hookSystem';
export { HotReloadWatcher } from './hotReload';
export * from './types';