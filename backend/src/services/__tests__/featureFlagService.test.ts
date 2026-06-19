import { FeatureFlagService } from '../featureFlagService';

jest.mock('../../utils/logger');

describe('FeatureFlagService', () => {
  let featureFlagService: FeatureFlagService;

  beforeEach(() => {
    featureFlagService = new FeatureFlagService();
  });

  describe('createFlag', () => {
    it('should create a boolean flag', () => {
      const flag = featureFlagService.createFlag({
        key: 'test_flag',
        name: 'Test Flag',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
      });

      expect(flag.key).toBe('test_flag');
      expect(flag.name).toBe('Test Flag');
      expect(flag.type).toBe('boolean');
      expect(flag.enabled).toBe(true);
      expect(flag.version).toBe(1);
    });

    it('should create a multivariate flag with variants', () => {
      const flag = featureFlagService.createFlag({
        key: 'theme_selector',
        name: 'Theme Selector',
        type: 'multivariate',
        enabled: true,
        defaultValue: 'light',
        variants: [
          { name: 'Light', value: 'light', weight: 50 },
          { name: 'Dark', value: 'dark', weight: 30 },
          { name: 'Auto', value: 'auto', weight: 20 },
        ],
      });

      expect(flag.key).toBe('theme_selector');
      expect(flag.variants).toHaveLength(3);
      expect(flag.variants[0].name).toBe('Light');
    });

    it('should create a kill switch flag', () => {
      const flag = featureFlagService.createFlag({
        key: 'emergency_stop',
        name: 'Emergency Stop',
        type: 'kill_switch',
        enabled: true,
        defaultValue: false,
      });

      expect(flag.type).toBe('kill_switch');
    });

    it('should throw when creating duplicate flag', () => {
      featureFlagService.createFlag({
        key: 'dup_flag',
        name: 'Duplicate Flag',
        type: 'boolean',
        enabled: false,
        defaultValue: false,
      });

      expect(() => {
        featureFlagService.createFlag({
          key: 'dup_flag',
          name: 'Duplicate Flag',
          type: 'boolean',
          enabled: false,
          defaultValue: false,
        });
      }).toThrow("Flag with key 'dup_flag' already exists");
    });

    it('should create an AB test flag', () => {
      const flag = featureFlagService.createFlag({
        key: 'new_checkout',
        name: 'New Checkout Flow',
        type: 'ab_test',
        enabled: true,
        defaultValue: 'control',
        variants: [
          { name: 'Control', value: 'control', weight: 50 },
          { name: 'Variant', value: 'variant', weight: 50 },
        ],
      });

      expect(flag.type).toBe('ab_test');
      expect(flag.variants).toHaveLength(2);
    });
  });

  describe('getFlag', () => {
    it('should return undefined for non-existent flag', () => {
      const flag = featureFlagService.getFlag('nonexistent');
      expect(flag).toBeUndefined();
    });

    it('should return created flag by key', () => {
      featureFlagService.createFlag({
        key: 'my_flag',
        name: 'My Flag',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
      });

      const flag = featureFlagService.getFlag('my_flag');
      expect(flag).toBeDefined();
      expect(flag!.name).toBe('My Flag');
    });
  });

  describe('getAllFlags', () => {
    it('should return all flags including seeded defaults', () => {
      const allFlags = featureFlagService.getAllFlags();
      const keys = allFlags.map((f) => f.key);

      expect(keys).toContain('enable_new_dashboard');
      expect(keys).toContain('maintenance_mode');
    });

    it('should return newly created flags', () => {
      featureFlagService.createFlag({
        key: 'custom_flag',
        name: 'Custom',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
      });

      const allFlags = featureFlagService.getAllFlags();
      const keys = allFlags.map((f) => f.key);
      expect(keys).toContain('custom_flag');
    });
  });

  describe('updateFlag', () => {
    it('should update flag properties', () => {
      featureFlagService.createFlag({
        key: 'update_me',
        name: 'Original Name',
        type: 'boolean',
        enabled: false,
        defaultValue: false,
      });

      const updated = featureFlagService.updateFlag('update_me', {
        name: 'Updated Name',
        enabled: true,
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.enabled).toBe(true);
      expect(updated.version).toBe(2);
    });

    it('should throw when updating non-existent flag', () => {
      expect(() => {
        featureFlagService.updateFlag('ghost', { name: 'Ghost' });
      }).toThrow("Flag with key 'ghost' not found");
    });
  });

  describe('deleteFlag', () => {
    it('should delete an existing flag', () => {
      featureFlagService.createFlag({
        key: 'delete_me',
        name: 'Delete Me',
        type: 'boolean',
        enabled: false,
        defaultValue: false,
      });

      featureFlagService.deleteFlag('delete_me');
      expect(featureFlagService.getFlag('delete_me')).toBeUndefined();
    });

    it('should throw when deleting non-existent flag', () => {
      expect(() => {
        featureFlagService.deleteFlag('phantom');
      }).toThrow("Flag with key 'phantom' not found");
    });
  });

  describe('toggleFlag', () => {
    it('should toggle flag from enabled to disabled', () => {
      featureFlagService.createFlag({
        key: 'toggle_test',
        name: 'Toggle Test',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
      });

      const toggled = featureFlagService.toggleFlag('toggle_test');
      expect(toggled.enabled).toBe(false);

      const toggledAgain = featureFlagService.toggleFlag('toggle_test');
      expect(toggledAgain.enabled).toBe(true);
    });
  });

  describe('evaluateFlag', () => {
    it('should return default value for disabled flag', () => {
      featureFlagService.createFlag({
        key: 'disabled_flag',
        name: 'Disabled',
        type: 'boolean',
        enabled: false,
        defaultValue: false,
      });

      const result = featureFlagService.evaluateFlag('disabled_flag');
      expect(result.value).toBe(false);
      expect(result.source).toBe('default');
    });

    it('should return true for enabled boolean flag', () => {
      featureFlagService.createFlag({
        key: 'enabled_flag',
        name: 'Enabled',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
      });

      const result = featureFlagService.evaluateFlag('enabled_flag');
      expect(result.value).toBe(true);
    });

    it('should return override value when set', () => {
      featureFlagService.createFlag({
        key: 'override_flag',
        name: 'Override',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
      });

      featureFlagService.setOverride('override_flag', true);
      const result = featureFlagService.evaluateFlag('override_flag');
      expect(result.value).toBe(true);
      expect(result.source).toBe('override');
    });

    it('should respect user-specific overrides', () => {
      featureFlagService.createFlag({
        key: 'user_flag',
        name: 'User Flag',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
      });

      featureFlagService.updateFlag('user_flag', {
        overrides: { 'user-123': true },
      });

      const result = featureFlagService.evaluateFlag('user_flag', { userId: 'user-123' });
      expect(result.value).toBe(true);
      expect(result.source).toBe('override');

      const otherResult = featureFlagService.evaluateFlag('user_flag', { userId: 'other-user' });
      expect(otherResult.value).toBe(true);
      expect(otherResult.source).not.toBe('override');
    });

    it('should evaluate targeting by user', () => {
      featureFlagService.createFlag({
        key: 'targeted_flag',
        name: 'Targeted',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
        targeting: [{ type: 'user', values: ['premium-user'] }],
      });

      const result = featureFlagService.evaluateFlag('targeted_flag', { userId: 'premium-user' });
      expect(result.value).toBe(true);
      expect(result.source).toBe('targeting');

      const otherResult = featureFlagService.evaluateFlag('targeted_flag', { userId: 'free-user' });
      expect(otherResult.value).toBe(false);
    });

    it('should evaluate targeting by segment', () => {
      featureFlagService.createFlag({
        key: 'segment_flag',
        name: 'Segment',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
        targeting: [{ type: 'segment', values: ['beta'] }],
      });

      const result = featureFlagService.evaluateFlag('segment_flag', { segments: ['beta'] });
      expect(result.value).toBe(true);
      expect(result.source).toBe('targeting');
    });

    it('should evaluate targeting by property', () => {
      featureFlagService.createFlag({
        key: 'property_flag',
        name: 'Property',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
        targeting: [{ type: 'property', values: ['mobile'], property: 'platform' }],
      });

      const result = featureFlagService.evaluateFlag('property_flag', {
        properties: { platform: 'mobile' },
      });
      expect(result.value).toBe(true);
      expect(result.source).toBe('targeting');
    });

    it('should respect rollout percentage', () => {
      featureFlagService.createFlag({
        key: 'rollout_flag',
        name: 'Rollout',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
        rolloutPercentage: 0,
      });

      const result = featureFlagService.evaluateFlag('rollout_flag', { userId: 'any-user' });
      expect(result.value).toBe(false);
      expect(result.source).toBe('rollout');
    });

    it('should respect scheduling', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 10);

      featureFlagService.createFlag({
        key: 'future_flag',
        name: 'Future',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
        schedule: { startDate: futureDate },
      });

      const result = featureFlagService.evaluateFlag('future_flag');
      expect(result.value).toBe(false);
      expect(result.source).toBe('schedule');
    });

    it('should evaluate kill switch', () => {
      featureFlagService.createFlag({
        key: 'kill_it',
        name: 'Kill Switch',
        type: 'kill_switch',
        enabled: true,
        defaultValue: false,
      });

      const result = featureFlagService.evaluateFlag('kill_it');
      expect(result.value).toBe(true);
      expect(result.source).toBe('default');
    });

    it('should handle dependencies', () => {
      featureFlagService.createFlag({
        key: 'parent',
        name: 'Parent',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
      });

      featureFlagService.createFlag({
        key: 'child',
        name: 'Child',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
        dependencies: ['parent'],
      });

      const result = featureFlagService.evaluateFlag('child');
      expect(result.value).toBe(true);

      featureFlagService.toggleFlag('parent');

      const resultAfter = featureFlagService.evaluateFlag('child');
      expect(resultAfter.value).toBe(false);
      expect(resultAfter.source).toBe('dependency');
    });

    it('should return fallback for non-existent flag', () => {
      const result = featureFlagService.evaluateFlag('ghost_flag');
      expect(result.value).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  describe('evaluateFlags', () => {
    it('should evaluate all flags', () => {
      const results = featureFlagService.evaluateFlags();
      const keys = results.map((r) => r.flagKey);

      expect(keys).toContain('enable_new_dashboard');
      expect(keys).toContain('maintenance_mode');
    });
  });

  describe('evaluateFlagsByKeys', () => {
    it('should evaluate specific flags', () => {
      featureFlagService.createFlag({
        key: 'alpha',
        name: 'Alpha',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
      });

      featureFlagService.createFlag({
        key: 'beta',
        name: 'Beta',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
      });

      const results = featureFlagService.evaluateFlagsByKeys(['alpha']);
      expect(results).toHaveLength(1);
      expect(results[0].flagKey).toBe('alpha');
    });
  });

  describe('setOverride / clearOverride', () => {
    it('should set and clear global override', () => {
      featureFlagService.createFlag({
        key: 'overridden',
        name: 'Overridden',
        type: 'boolean',
        enabled: false,
        defaultValue: true,
      });

      featureFlagService.setOverride('overridden', false);
      let evalResult = featureFlagService.evaluateFlag('overridden');
      expect(evalResult.value).toBe(false);
      expect(evalResult.source).toBe('override');

      featureFlagService.clearOverride('overridden');
      evalResult = featureFlagService.evaluateFlag('overridden');
      expect(evalResult.value).toBe(true);
    });
  });

  describe('getAuditLog', () => {
    it('should log create actions', () => {
      featureFlagService.createFlag({
        key: 'audited_flag',
        name: 'Audited',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
      });

      const log = featureFlagService.getAuditLog();
      const createEntry = log.find((e) => e.flagKey === 'audited_flag' && e.action === 'create');
      expect(createEntry).toBeDefined();
    });

    it('should log toggle actions', () => {
      featureFlagService.createFlag({
        key: 'toggle_audit',
        name: 'Toggle Audit',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
      });

      featureFlagService.toggleFlag('toggle_audit');

      const log = featureFlagService.getAuditLog();
      const toggleEntry = log.find((e) => e.flagKey === 'toggle_audit' && e.action === 'toggle');
      expect(toggleEntry).toBeDefined();
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics', () => {
      const metrics = featureFlagService.getSystemMetrics();

      expect(metrics.totalFlags).toBeGreaterThanOrEqual(3);
      expect(metrics.totalEvaluations).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
