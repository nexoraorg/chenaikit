import { randomUUID } from "crypto";
import {
  FeatureFlag,
  FeatureFlagCreateInput,
  FeatureFlagUpdateInput,
  FlagContext,
  FlagEvaluation,
  AuditEntry,
} from "../models/FeatureFlag";
import { log } from "../utils/logger";

interface FlagAnalytics {
  evaluations: number;
  lastEvaluated: Date | null;
  evaluationHistory: Array<{ value: unknown; timestamp: Date }>;
  overrideCount: number;
}

export class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private auditLog: AuditEntry[] = [];
  private analytics: Map<string, FlagAnalytics> = new Map();
  private evaluationCount: number = 0;
  private startTime: Date = new Date();

  constructor() {
    this.seedDefaultFlags();
  }

  private seedDefaultFlags(): void {
    const defaults: FeatureFlagCreateInput[] = [
      {
        key: "enable_new_dashboard",
        name: "New Dashboard",
        description: "Enable the new dashboard UI",
        type: "boolean",
        enabled: false,
        defaultValue: false,
        tags: ["ui", "dashboard"],
      },
      {
        key: "enable_analytics_v2",
        name: "Analytics v2",
        description: "Enable analytics version 2",
        type: "boolean",
        enabled: false,
        defaultValue: false,
        tags: ["analytics"],
      },
      {
        key: "maintenance_mode",
        name: "Maintenance Mode",
        description: "Global maintenance mode kill switch",
        type: "kill_switch",
        enabled: false,
        defaultValue: false,
        tags: ["system", "infrastructure"],
      },
    ];

    for (const input of defaults) {
      const flag = FeatureFlag.create(input);
      this.flags.set(flag.key, flag);
      this.analytics.set(flag.key, {
        evaluations: 0,
        lastEvaluated: null,
        evaluationHistory: [],
        overrideCount: 0,
      });
    }
  }

  createFlag(input: FeatureFlagCreateInput): FeatureFlag {
    if (this.flags.has(input.key)) {
      throw new Error(`Flag with key '${input.key}' already exists`);
    }

    const flag = FeatureFlag.create(input);
    // Override the ID with a proper UUID (FeatureFlag.create uses randomUUID already)
    this.flags.set(flag.key, flag);
    this.analytics.set(flag.key, {
      evaluations: 0,
      lastEvaluated: null,
      evaluationHistory: [],
      overrideCount: 0,
    });

    this.addAuditEntry("create", flag.key, undefined, {
      type: flag.type,
      enabled: flag.enabled,
    });

    log.info("Feature flag created", {
      key: flag.key,
      type: flag.type,
      enabled: flag.enabled,
    });
    return flag;
  }

  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  updateFlag(key: string, input: FeatureFlagUpdateInput): FeatureFlag {
    const flag = this.flags.get(key);
    if (!flag) {
      throw new Error(`Flag with key '${key}' not found`);
    }

    const changes: Record<string, unknown> = {};
    for (const [prop, value] of Object.entries(input)) {
      if (value !== undefined && (flag as any)[prop] !== value) {
        changes[prop] = value;
      }
    }

    flag.applyUpdate(input);
    this.flags.set(key, flag);

    this.addAuditEntry("update", key, undefined, changes);

    log.info("Feature flag updated", { key, changes: Object.keys(changes) });
    return flag;
  }

  deleteFlag(key: string): void {
    if (!this.flags.has(key)) {
      throw new Error(`Flag with key '${key}' not found`);
    }

    this.flags.delete(key);
    this.analytics.delete(key);

    this.addAuditEntry("delete", key, undefined, { deleted: true });

    log.info("Feature flag deleted", { key });
  }

  toggleFlag(key: string): FeatureFlag {
    const flag = this.flags.get(key);
    if (!flag) {
      throw new Error(`Flag with key '${key}' not found`);
    }

    flag.enabled = !flag.enabled;
    flag.version++;
    flag.updatedAt = new Date();
    this.flags.set(key, flag);

    this.addAuditEntry("toggle", key, undefined, { enabled: flag.enabled });

    log.info("Feature flag toggled", { key, enabled: flag.enabled });
    return flag;
  }

  evaluateFlag(key: string, context: FlagContext = {}): FlagEvaluation {
    const flag = this.flags.get(key);
    if (!flag) {
      return {
        flagKey: key,
        value: false,
        reason: `Flag '${key}' not found`,
        source: "default",
        timestamp: new Date(),
      };
    }

    this.evaluationCount++;
    const analytics = this.analytics.get(key);
    if (analytics) {
      analytics.evaluations++;
      analytics.lastEvaluated = new Date();
    }

    const result = this.resolveFlagValue(flag, context);

    this.addAuditEntry("evaluate", key, context.userId, {
      value: result.value,
      source: result.source,
    });

    return result;
  }

  evaluateFlags(context: FlagContext = {}): FlagEvaluation[] {
    const results: FlagEvaluation[] = [];
    for (const [key] of this.flags) {
      results.push(this.evaluateFlag(key, context));
    }
    return results;
  }

  evaluateFlagsByKeys(
    keys: string[],
    context: FlagContext = {},
  ): FlagEvaluation[] {
    return keys.map((key) => this.evaluateFlag(key, context));
  }

  setOverride(key: string, value: unknown): void {
    const flag = this.flags.get(key);
    if (!flag) {
      throw new Error(`Flag with key '${key}' not found`);
    }

    flag.overrides = { ...flag.overrides, _global: value };
    flag.version++;
    flag.updatedAt = new Date();
    this.flags.set(key, flag);

    const analytics = this.analytics.get(key);
    if (analytics) {
      analytics.overrideCount++;
    }

    this.addAuditEntry("update", key, undefined, { overrideSet: true, value });

    log.info("Feature flag override set", { key, value });
  }

  clearOverride(key: string): void {
    const flag = this.flags.get(key);
    if (!flag) return;

    delete flag.overrides._global;
    flag.version++;
    flag.updatedAt = new Date();
    this.flags.set(key, flag);
  }

  getAnalytics(key: string): FlagAnalytics | undefined {
    return this.analytics.get(key);
  }

  getAllAnalytics(): Array<{ key: string; analytics: FlagAnalytics }> {
    return Array.from(this.analytics.entries()).map(([key, analytics]) => ({
      key,
      analytics,
    }));
  }

  getAuditLog(limit: number = 100): AuditEntry[] {
    return this.auditLog.slice(-limit).reverse();
  }

  getSystemMetrics(): {
    totalFlags: number;
    enabledFlags: number;
    totalEvaluations: number;
    uptime: number;
    auditEntries: number;
  } {
    const enabledFlags = Array.from(this.flags.values()).filter(
      (f) => f.enabled,
    ).length;
    return {
      totalFlags: this.flags.size,
      enabledFlags,
      totalEvaluations: this.evaluationCount,
      uptime: Date.now() - this.startTime.getTime(),
      auditEntries: this.auditLog.length,
    };
  }

  private resolveFlagValue(
    flag: FeatureFlag,
    context: FlagContext,
  ): FlagEvaluation {
    // 1. Check if flag is a kill switch
    if (flag.type === "kill_switch" && flag.enabled) {
      return {
        flagKey: flag.key,
        value: true,
        reason: "Kill switch is active",
        source: "default",
        timestamp: new Date(),
      };
    }

    // 2. Check global override
    if (flag.overrides._global !== undefined) {
      return {
        flagKey: flag.key,
        value: flag.overrides._global,
        reason: "Global override applied",
        source: "override",
        timestamp: new Date(),
      };
    }

    // 3. Check user-specific override
    if (context.userId && flag.overrides[context.userId] !== undefined) {
      return {
        flagKey: flag.key,
        value: flag.overrides[context.userId],
        reason: `Override for user '${context.userId}'`,
        source: "override",
        timestamp: new Date(),
      };
    }

    // 4. Check if flag is disabled
    if (!flag.enabled) {
      return {
        flagKey: flag.key,
        value: flag.defaultValue,
        reason: "Flag is disabled, returning default value",
        source: "default",
        timestamp: new Date(),
      };
    }

    // 5. Check scheduling
    if (!flag.isScheduledActive()) {
      return {
        flagKey: flag.key,
        value: flag.defaultValue,
        reason: "Flag is outside its scheduled window",
        source: "schedule",
        timestamp: new Date(),
      };
    }

    // 6. Check dependencies
    const depCheck = flag.isDependencySatisfied(this.flags);
    if (!depCheck.satisfied) {
      return {
        flagKey: flag.key,
        value: flag.defaultValue,
        reason: `Dependencies not satisfied: ${depCheck.missing.join(", ")}`,
        source: "dependency",
        timestamp: new Date(),
      };
    }

    // 7. Evaluate targeting rules
    if (flag.targeting.length > 0) {
      const targetingResult = this.evaluateTargeting(flag, context);
      if (targetingResult !== null) {
        return {
          flagKey: flag.key,
          value: targetingResult,
          reason: "Targeting rule matched",
          source: "targeting",
          timestamp: new Date(),
        };
      }
      // User doesn't match any targeting rule - return default value
      return {
        flagKey: flag.key,
        value: flag.defaultValue,
        reason: "User does not match targeting rules",
        source: "default",
        timestamp: new Date(),
      };
    }

    // 8. Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const userId = context.userId || context.ip || "anonymous";
      const hash = this.simpleHash(`${flag.key}:${userId}`) % 100;
      if (hash >= flag.rolloutPercentage) {
        return {
          flagKey: flag.key,
          value: flag.defaultValue,
          reason: `User '${userId}' is not in the ${flag.rolloutPercentage}% rollout`,
          source: "rollout",
          timestamp: new Date(),
        };
      }
    }

    // 9. Resolve multivariate / A/B test variants
    if (flag.type === "multivariate" || flag.type === "ab_test") {
      if (flag.variants.length > 0) {
        const userId = context.userId || context.ip || "anonymous";
        const hash = this.simpleHash(`${flag.key}:${userId}`);
        const totalWeight = flag.variants.reduce((sum, v) => sum + v.weight, 0);
        let target = hash % totalWeight;

        for (const variant of flag.variants) {
          target -= variant.weight;
          if (target < 0) {
            return {
              flagKey: flag.key,
              value: variant.value,
              reason: `Variant '${variant.name}' assigned (${variant.weight}/${totalWeight})`,
              source: "targeting",
              timestamp: new Date(),
            };
          }
        }
      }
    }

    // 10. Return flag value (boolean/kill_switch = true, multivariate/remote_config = defaultValue)
    return {
      flagKey: flag.key,
      value:
        flag.type === "boolean" || flag.type === "kill_switch"
          ? true
          : flag.defaultValue,
      reason:
        flag.type === "boolean" || flag.type === "kill_switch"
          ? "Flag is enabled"
          : "Default value returned",
      source: "default",
      timestamp: new Date(),
    };
  }

  private evaluateTargeting(
    flag: FeatureFlag,
    context: FlagContext,
  ): unknown | null {
    for (const rule of flag.targeting) {
      switch (rule.type) {
        case "user": {
          if (context.userId && rule.values.includes(context.userId)) {
            return this.getTargetingValue(flag);
          }
          break;
        }
        case "segment": {
          if (
            context.segments &&
            context.segments.some((s) => rule.values.includes(s))
          ) {
            return this.getTargetingValue(flag);
          }
          break;
        }
        case "percentage": {
          const userId = context.userId || context.ip || "anonymous";
          const hash = this.simpleHash(`${flag.key}:targeting:${userId}`) % 100;
          const percentage = parseInt(rule.values[0] || "0", 10);
          if (hash < percentage) {
            return this.getTargetingValue(flag);
          }
          break;
        }
        case "property": {
          if (
            rule.property &&
            context.properties?.[rule.property] !== undefined
          ) {
            const propValue = String(context.properties[rule.property]);
            if (rule.values.includes(propValue)) {
              return this.getTargetingValue(flag);
            }
          }
          break;
        }
      }
    }
    return null;
  }

  private getTargetingValue(flag: FeatureFlag): unknown {
    if (flag.type === "multivariate" || flag.type === "ab_test") {
      return flag.variants[0]?.value ?? flag.defaultValue;
    }
    return true;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private addAuditEntry(
    action: AuditEntry["action"],
    flagKey: string,
    actor?: string,
    changes?: Record<string, unknown>,
  ): void {
    const entry: AuditEntry = {
      id: randomUUID(),
      action,
      flagKey,
      actor,
      changes,
      timestamp: new Date(),
    };
    this.auditLog.push(entry);
  }
}

export const featureFlagService = new FeatureFlagService();
