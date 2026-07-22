import { IPlugin, PluginMeta, PluginCoreAPI } from '../types';

export class MetricsExporterPlugin implements IPlugin {
  readonly meta: PluginMeta = {
    name: 'metrics-exporter',
    version: { major: 1, minor: 0, patch: 0 },
    description: 'Exports application metrics to external monitoring systems',
    author: 'ChenAIKit Team',
    compatibility: { minCoreVersion: '0.1.0' },
    permissions: [
      { resource: 'hooks', actions: ['read', 'write'] },
      { resource: 'config', actions: ['read', 'write'] },
    ],
  };

  readonly state = 'registered' as any;

  private metrics: Record<string, number> = {};

  async onInit(api: PluginCoreAPI): Promise<void> {
    api.hooks.register('api:after', this.trackApiCall.bind(this), 5, this.meta.name);
    api.logger.info('Metrics exporter plugin initialized');
  }

  async onActivate(api: PluginCoreAPI): Promise<void> {
    api.logger.info('Metrics exporter plugin activated');
  }

  async onDeactivate(api: PluginCoreAPI): Promise<void> {
    api.logger.info('Metrics exporter plugin deactivated');
  }

  async onDispose(api: PluginCoreAPI): Promise<void> {
    api.logger.info('Metrics exporter plugin disposed');
  }

  private trackApiCall(context: any): Promise<any> {
    const path = context.args.path || 'unknown';
    this.metrics[path] = (this.metrics[path] || 0) + 1;
    return Promise.resolve(context);
  }

  getMetrics() {
    return { ...this.metrics };
  }

  validateConfig(config: Record<string, unknown>): Error | null {
    if (config.interval && typeof config.interval !== 'number') {
      return new Error('interval must be a number');
    }
    return null;
  }

  getConfigSchema(): Record<string, string> {
    return {
      interval: 'number - Export interval in seconds',
      endpoint: 'string - Metrics endpoint URL',
    };
  }
}

export default MetricsExporterPlugin;