import { randomUUID } from 'crypto';

export type FlagType = 'boolean' | 'multivariate' | 'remote_config' | 'ab_test' | 'kill_switch';

export type TargetingType = 'user' | 'segment' | 'percentage' | 'property';

export interface TargetingRule {
  type: TargetingType;
  values: string[];
  property?: string;
}

export interface FlagVariant {
  name: string;
  value: unknown;
  weight: number;
}

export interface FlagSchedule {
  startDate?: Date;
  endDate?: Date;
  timezone?: string;
}

export interface FeatureFlagCreateInput {
  key: string;
  name: string;
  description?: string;
  type: FlagType;
  enabled: boolean;
  defaultValue: unknown;
  variants?: FlagVariant[];
  targeting?: TargetingRule[];
  rolloutPercentage?: number;
  dependencies?: string[];
  schedule?: FlagSchedule;
  overrides?: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface FeatureFlagUpdateInput {
  name?: string;
  description?: string;
  type?: FlagType;
  enabled?: boolean;
  defaultValue?: unknown;
  variants?: FlagVariant[];
  targeting?: TargetingRule[];
  rolloutPercentage?: number;
  dependencies?: string[];
  schedule?: FlagSchedule;
  overrides?: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface FlagContext {
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  segments?: string[];
  properties?: Record<string, unknown>;
}

export interface AuditEntry {
  id: string;
  action: 'create' | 'update' | 'delete' | 'toggle' | 'evaluate';
  flagKey: string;
  actor?: string;
  changes?: Record<string, unknown>;
  timestamp: Date;
}

export interface FlagEvaluation {
  flagKey: string;
  value: unknown;
  reason: string;
  source: 'default' | 'override' | 'targeting' | 'dependency' | 'rollout' | 'schedule';
  timestamp: Date;
}

export class FeatureFlag {
  constructor(
    public id: string,
    public key: string,
    public name: string,
    public description: string,
    public type: FlagType,
    public enabled: boolean,
    public defaultValue: unknown,
    public variants: FlagVariant[],
    public targeting: TargetingRule[],
    public rolloutPercentage: number,
    public dependencies: string[],
    public schedule: FlagSchedule | null,
    public overrides: Record<string, unknown>,
    public tags: string[],
    public metadata: Record<string, unknown>,
    public version: number,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  static create(input: FeatureFlagCreateInput): FeatureFlag {
    return new FeatureFlag(
      randomUUID(),
      input.key,
      input.name,
      input.description || '',
      input.type,
      input.enabled,
      input.defaultValue,
      input.variants || [],
      input.targeting || [],
      input.rolloutPercentage ?? 100,
      input.dependencies || [],
      input.schedule || null,
      input.overrides || {},
      input.tags || [],
      input.metadata || {},
      1,
      new Date(),
      new Date()
    );
  }

  applyUpdate(input: FeatureFlagUpdateInput): void {
    if (input.name !== undefined) this.name = input.name;
    if (input.description !== undefined) this.description = input.description;
    if (input.type !== undefined) this.type = input.type;
    if (input.enabled !== undefined) this.enabled = input.enabled;
    if (input.defaultValue !== undefined) this.defaultValue = input.defaultValue;
    if (input.variants !== undefined) this.variants = input.variants;
    if (input.targeting !== undefined) this.targeting = input.targeting;
    if (input.rolloutPercentage !== undefined) this.rolloutPercentage = input.rolloutPercentage;
    if (input.dependencies !== undefined) this.dependencies = input.dependencies;
    if (input.schedule !== undefined) this.schedule = input.schedule;
    if (input.overrides !== undefined) this.overrides = input.overrides;
    if (input.tags !== undefined) this.tags = input.tags;
    if (input.metadata !== undefined) this.metadata = input.metadata;
    this.version++;
    this.updatedAt = new Date();
  }

  isScheduledActive(): boolean {
    const now = new Date();
    if (this.schedule?.startDate && new Date(this.schedule.startDate) > now) return false;
    if (this.schedule?.endDate && new Date(this.schedule.endDate) < now) return false;
    return true;
  }

  isDependencySatisfied(flags: Map<string, FeatureFlag>): { satisfied: boolean; missing: string[] } {
    const missing: string[] = [];
    for (const depKey of this.dependencies) {
      const dep = flags.get(depKey);
      if (!dep || !dep.enabled || !dep.isScheduledActive()) {
        missing.push(depKey);
      }
    }
    return { satisfied: missing.length === 0, missing };
  }
}
