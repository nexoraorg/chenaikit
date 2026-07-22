import { IPlugin, PluginMeta, PluginCoreAPI } from '../types';

export class CustomValidatorPlugin implements IPlugin {
  readonly meta: PluginMeta = {
    name: 'custom-validator',
    version: { major: 1, minor: 0, patch: 0 },
    description: 'Adds custom validation rules for forms and API inputs',
    author: 'ChenAIKit Team',
    compatibility: { minCoreVersion: '0.1.0' },
    permissions: [
      { resource: 'hooks', actions: ['read', 'write'] },
      { resource: 'config', actions: ['read', 'write'] },
    ],
  };

  readonly state = 'registered' as any;

  async onInit(api: PluginCoreAPI): Promise<void> {
    // Register validation hooks
    api.hooks.register('validation:before', this.beforeValidation.bind(this), 5, this.meta.name);
    api.logger.info('Custom validator plugin initialized');
  }

  async onActivate(api: PluginCoreAPI): Promise<void> {
    api.logger.info('Custom validator plugin activated');
  }

  async onDeactivate(api: PluginCoreAPI): Promise<void> {
    api.logger.info('Custom validator plugin deactivated');
  }

  async onDispose(api: PluginCoreAPI): Promise<void> {
    api.logger.info('Custom validator plugin disposed');
  }

  async beforeValidation(context: any): Promise<any> {
    const { args } = context;
    
    // Add custom validation: ensure email fields contain @
    if (args.field === 'email' && typeof args.value === 'string') {
      if (!args.value.includes('@')) {
        context.error = new Error('Invalid email format');
        throw context.error;
      }
    }

    return context;
  }

  validateConfig(config: Record<string, unknown>): Error | null {
    if (config.rules && !Array.isArray(config.rules)) {
      return new Error('rules must be an array');
    }
    return null;
  }

  getConfigSchema(): Record<string, string> {
    return {
      rules: 'Array<ValidationRule> - Custom validation rules',
      strictMode: 'boolean - Enable strict validation',
    };
  }
}

export default CustomValidatorPlugin;