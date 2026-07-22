import { IPlugin, PluginMeta, PluginCoreAPI } from '../types';

/**
 * WebhookPlugin - dispatches events to external webhooks.
 * Demonstrates plugin capabilities with event handling and config management.
 */
export class WebhookPlugin implements IPlugin {
  readonly meta: PluginMeta = {
    name: 'webhook-dispatcher',
    version: { major: 1, minor: 0, patch: 0 },
    description: 'Dispatches validation and API call events to configured webhooks',
    author: 'ChenAIKit Team',
    compatibility: { minCoreVersion: '0.1.0' },
    permissions: [
      { resource: 'hooks', actions: ['read', 'write'] },
      { resource: 'api', actions: ['read', 'write'] },
      { resource: 'config', actions: ['read', 'write'] },
    ],
  };

  readonly state = 'registered' as any;

  private webhookUrl?: string;
  private retryCount = 3;

  constructor(private api: PluginCoreAPI) {}

  async onInit(api: PluginCoreAPI): Promise<void> {
    this.webhookUrl = api.config.get('webhook.url') as string | undefined;
    if (!this.webhookUrl) {
      api.logger.warn('Webhook URL not configured');
    }

    // Register hooks for validation and API events
    api.hooks.register('validation:after', this.handleValidationAfter.bind(this), 10, this.meta.name);
    api.hooks.register('api:after', this.handleApiAfter.bind(this), 10, this.meta.name);
  }

  async onActivate(api: PluginCoreAPI): Promise<void> {
    api.logger.info('Webhook dispatcher plugin activated');
  }

  async onDeactivate(api: PluginCoreAPI): Promise<void> {
    api.logger.info('Webhook dispatcher plugin deactivated');
  }

  async onDispose(api: PluginCoreAPI): Promise<void> {
    api.logger.info('Webhook dispatcher plugin disposed');
  }

  validateConfig(config: Record<string, unknown>) {
    // Simple validation: ensure webhook URL is present
    if (config.url && typeof config.url !== 'string') {
      return new Error('webhook.url must be a string') as any;
    }
    return null;
  }

  getConfigSchema() {
    // Return a simple schema description
    return {
      url: 'string (optional) - Webhook endpoint URL',
      retryCount: 'number (optional) - Number of retries on failure',
    };
  }

  private async handleValidationAfter(context: any): Promise<any> {
    if (!this.webhookUrl) return context;

    const event = {
      type: 'validation:after',
      timestamp: new Date().toISOString(),
      data: context.args,
      result: context.result,
    };

    await this.dispatch(event);
    return context;
  }

  private async handleApiAfter(context: any): Promise<any> {
    if (!this.webhookUrl) return context;

    const event = {
      type: 'api:after',
      timestamp: new Date().toISOString(),
      path: context.args.path,
      method: 'POST',
      result: context.result,
    };

    await this.dispatch(event);
    return context;
  }

  private async dispatch(event: Record<string, unknown>): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`Webhook responded with ${response.status}`);
      }
    } catch (error) {
      this.api.logger.error('Failed to dispatch webhook', { error });
    }
  }
}

export default WebhookPlugin;