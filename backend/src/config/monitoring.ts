import { MonitoringConfig } from '../types/monitoring';

// Helper function to get boolean from env
const getBooleanFromEnv = (key: string, defaultValue: boolean = false): boolean => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

// Helper function to get number from env with default
const getNumberFromEnv = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper function to get float from env with default
const getFloatFromEnv = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const monitoringConfig: MonitoringConfig = {
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT === 'simple' ? 'simple' : 'json',
    console: getBooleanFromEnv('LOG_CONSOLE', true),
    file: getBooleanFromEnv('LOG_FILE', false),
    filePath: process.env.LOG_FILE_PATH || 'logs/app.log',
    maxFiles: getNumberFromEnv('LOG_MAX_FILES', 14),
    maxSize: process.env.LOG_MAX_SIZE || '20m',
  },
  metrics: {
    enabled: getBooleanFromEnv('METRICS_ENABLED', true),
    prefix: process.env.METRICS_PREFIX || 'chenaikit',
    port: getNumberFromEnv('METRICS_PORT', 9090),
    defaultLabels: {
      service: process.env.SERVICE_NAME || 'chenaikit-backend',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
    },
  },
  tracing: {
    enabled: getBooleanFromEnv('TRACING_ENABLED', false),
    serviceName: process.env.SERVICE_NAME || 'chenaikit-backend',
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    sampleRate: getFloatFromEnv('TRACE_SAMPLE_RATE', 0.1),
  },
  healthCheck: {
    enabled: getBooleanFromEnv('HEALTH_CHECK_ENABLED', true),
    timeout: getNumberFromEnv('HEALTH_CHECK_TIMEOUT', 5000),
    interval: getNumberFromEnv('HEALTH_CHECK_INTERVAL', 30000),
  },
  alerting: {
    enabled: getBooleanFromEnv('ALERTING_ENABLED', false),
    errorThreshold: getNumberFromEnv('ALERT_ERROR_THRESHOLD', 10),
    latencyThreshold: getNumberFromEnv('ALERT_LATENCY_THRESHOLD', 5000),
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
  },
};

export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isTest = process.env.NODE_ENV === 'test';

// Environment validation and warnings
export function validateEnvironment(): void {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for required configurations in production
  if (isProduction) {
    if (!process.env.SENTRY_DSN) {
      warnings.push('SENTRY_DSN not configured - error tracking disabled in production');
    }

    if (!getBooleanFromEnv('TRACING_ENABLED', false)) {
      warnings.push('TRACING_ENABLED is false - distributed tracing disabled in production');
    }

    if (!getBooleanFromEnv('LOG_FILE', false)) {
      warnings.push('LOG_FILE is false - file logging disabled in production');
    }
  }

  // Log warnings and errors
  warnings.forEach(warning => console.warn(`⚠️  ${warning}`));
  errors.forEach(error => console.error(`❌ ${error}`));

  if (warnings.length > 0 || errors.length > 0) {
    console.log('\n📋 See .env.example for all available configuration options');
  }
}

let shutdownFn: (() => Promise<void>) | null = null;

export async function initializeMonitoring() {
  // Initialize Sentry (optional)
  try {
    const dsn = process.env.SENTRY_DSN;
    if (dsn) {
      const Sentry = require('@sentry/node');
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.2),
      });
    }
  } catch (e: any) {
    console.warn('Sentry init skipped or failed', { error: e?.message });
  }

  // Initialize OpenTelemetry (optional)
  try {
    const enableOtel = process.env.OTEL_ENABLED === 'true';
    if (enableOtel) {
      const { NodeSDK } = require('@opentelemetry/sdk-node');
      const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

      const traceExporter = new OTLPTraceExporter({
        // Uses env OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS, etc. if set
      });

      const sdk = new NodeSDK({
        traceExporter,
        instrumentations: [getNodeAutoInstrumentations()],
      });

      await sdk.start();
      shutdownFn = async () => {
        try { await sdk.shutdown(); } catch { /* noop */ }
      };
    }
  } catch (e: any) {
    console.warn('OpenTelemetry init skipped or failed', { error: e?.message });
  }
}

export async function shutdownMonitoring() {
  if (shutdownFn) {
    try { await shutdownFn(); } catch { /* noop */ }
  }
}
