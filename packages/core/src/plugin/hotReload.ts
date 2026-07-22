import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'eventemitter3';
import { PluginManager } from './pluginManager';
import { IPlugin, PluginManifestSchema } from './types';

/**
 * HotReloadWatcher monitors plugin directories for file changes
 * and automatically reloads plugins in development mode.
 */
export class HotReloadWatcher {
  private watcher: fs.FSWatcher | null = null;
  private pluginDir: string;
  private manager: PluginManager;
  private events: EventEmitter;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor(pluginDir: string, manager: PluginManager, events: EventEmitter) {
    this.pluginDir = pluginDir;
    this.manager = manager;
    this.events = events;
  }

  /**
   * Start watching the plugin directory for changes
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
    }

    try {
      // Use fs.watch as a simple file watcher (chokidar is available but fs.watch is built-in)
      this.watcher = fs.watch(this.pluginDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const ext = path.extname(filename);
        if (ext !== '.js' && ext !== '.ts' && ext !== '.json') return;

        // Debounce to avoid multiple reloads on save
        const existingTimer = this.debounceTimers.get(filename);
        if (existingTimer) clearTimeout(existingTimer);

        const timer = setTimeout(async () => {
          this.debounceTimers.delete(filename);
          await this.handleFileChange(filename, eventType);
        }, 500);

        this.debounceTimers.set(filename, timer);
      });

      this.events.emit('hotreload:started', { dir: this.pluginDir });
      console.log(`[hotreload] Watching plugin directory: ${this.pluginDir}`);
    } catch (error) {
      console.error(`[hotreload] Failed to start watcher:`, error);
    }
  }

  /**
   * Stop watching
   */
  stop(): void {
    this.isRunning = false;

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    this.events.emit('hotreload:stopped', {});
  }

  /**
   * Handle a file change event
   */
  private async handleFileChange(filename: string, eventType: string): Promise<void> {
    const fullPath = path.join(this.pluginDir, filename);
    const pluginName = path.basename(filename, path.extname(filename));

    try {
      // Check if this is a manifest file
      if (filename.endsWith('.json')) {
        await this.handleManifestChange(fullPath, pluginName);
        return;
      }

      // Check if this is a plugin source file
      if (filename.endsWith('.js') || filename.endsWith('.ts')) {
        await this.handlePluginSourceChange(fullPath, pluginName);
      }
    } catch (error) {
      console.error(`[hotreload] Error handling change for "${filename}":`, error);
      this.events.emit('hotreload:error', { filename, error });
    }
  }

  /**
   * Handle changes to plugin manifest files
   */
  private async handleManifestChange(fullPath: string, pluginName: string): Promise<void> {
    if (!fs.existsSync(fullPath)) {
      // Plugin manifest was deleted
      if (this.manager.has(pluginName)) {
        await this.manager.dispose(pluginName);
        this.events.emit('hotreload:removed', { name: pluginName });
      }
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const manifest = JSON.parse(content);

    // Validate manifest
    PluginManifestSchema.parse(manifest);

    this.events.emit('hotreload:manifest:changed', { name: pluginName, manifest });
  }

  /**
   * Handle changes to plugin source files
   */
  private async handlePluginSourceChange(fullPath: string, pluginName: string): Promise<void> {
    if (!fs.existsSync(fullPath)) return;

    // Clear require cache for this module
    delete require.cache[require.resolve(fullPath)];

    // If plugin is already loaded, dispose and reload
    if (this.manager.has(pluginName)) {
      await this.manager.dispose(pluginName);
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pluginModule = require(fullPath);
      const manifestPath = path.join(path.dirname(fullPath), 'manifest.json');

      let manifest: Record<string, unknown> = {
        name: pluginName,
        version: { major: 0, minor: 1, patch: 0 },
        description: '',
        author: '',
        compatibility: { minCoreVersion: '0.1.0' },
      };

      if (fs.existsSync(manifestPath)) {
        const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        manifest = { ...manifest, ...JSON.parse(manifestContent) };
      }

      await this.manager.register(manifest, pluginModule);
      await this.manager.init(pluginName);
      await this.manager.activate(pluginName);

      this.events.emit('hotreload:reloaded', { name: pluginName });
      console.log(`[hotreload] Plugin "${pluginName}" reloaded successfully`);
    } catch (error) {
      console.error(`[hotreload] Failed to reload plugin "${pluginName}":`, error);
      this.events.emit('hotreload:error', { name: pluginName, error });
    }
  }
}