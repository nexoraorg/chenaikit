// Mock winston before importing logger
jest.mock('winston', () => {
  const mockLog = jest.fn();
  const mockLogger = { log: mockLog };
  const winston = {
    createLogger: jest.fn(() => mockLogger),
    format: {
      combine: jest.fn(() => ({})),
      timestamp: jest.fn(() => ({})),
      errors: jest.fn(() => ({})),
      metadata: jest.fn(() => ({})),
      json: jest.fn(() => ({})),
      colorize: jest.fn(() => ({})),
      printf: jest.fn(() => ({})),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
  return { ...winston, default: winston };
});

jest.mock('winston-transport', () => {
  return jest.fn().mockImplementation(() => ({ log: jest.fn() }));
});

// Mock loggingConfig to use predictable values
jest.mock('../../config/logging', () => ({
  loggingConfig: {
    level: 'debug',
    format: 'json',
    console: true,
    file: false,
    filePath: 'logs/app.log',
    errorFilePath: 'logs/error.log',
    maxFiles: 14,
    maxSize: '20m',
    samplingRate: 1,
    externalService: { enabled: false },
  },
}));

jest.mock('../../config/monitoring', () => ({
  monitoringConfig: {
    logging: { level: 'info', format: 'json', console: true, file: false },
    metrics: { enabled: true, prefix: 'test', port: 9090, defaultLabels: { service: 'test', environment: 'test' } },
    tracing: { enabled: false, serviceName: 'test', sampleRate: 0 },
    healthCheck: { enabled: false, timeout: 0, interval: 0 },
    alerting: { enabled: false, errorThreshold: 0, latencyThreshold: 0 },
  },
}));

import { Logger, Timer, log } from '../../utils/logger';
import winston from 'winston';

const getWinstonLog = () => (winston.createLogger as jest.Mock).mock.results[0].value.log as jest.Mock;

describe('Logger', () => {
  beforeEach(() => {
    getWinstonLog().mockClear();
  });

  it('logs info messages', () => {
    log.info('test message');
    expect(getWinstonLog()).toHaveBeenCalledWith('info', 'test message', expect.any(Object));
  });

  it('logs warn messages', () => {
    log.warn('a warning');
    expect(getWinstonLog()).toHaveBeenCalledWith('warn', 'a warning', expect.any(Object));
  });

  it('logs errors with Error object', () => {
    const err = new Error('oops');
    log.error('failed', err);
    expect(getWinstonLog()).toHaveBeenCalledWith(
      'error', 'failed',
      expect.objectContaining({ error: expect.objectContaining({ message: 'oops' }) })
    );
  });

  it('creates a child logger with merged context', () => {
    const child = log.child({ requestId: 'abc' });
    child.info('child msg');
    expect(getWinstonLog()).toHaveBeenCalledWith(
      'info', 'child msg', expect.objectContaining({ requestId: 'abc' })
    );
  });

  it('audit logs bypass sampling', () => {
    const logger = new Logger(0); // sampling rate 0 – nothing should be logged except audit
    logger.audit('user.login', { userId: 'u1' });
    expect(getWinstonLog()).toHaveBeenCalledWith(
      'info', 'Audit: user.login', expect.objectContaining({ audit: true })
    );
  });

  it('performance logs a slow-op warning', () => {
    log.performance('db.query', 1500);
    const calls = getWinstonLog().mock.calls.map((c: any[]) => c[0]);
    expect(calls).toContain('warn');
  });

  it('security logs use warn level', () => {
    log.security('brute-force-detected', { ip: '1.2.3.4' });
    expect(getWinstonLog()).toHaveBeenCalledWith('warn', expect.stringContaining('Security Event'), expect.any(Object));
  });

  it('setContext / clearContext', () => {
    const logger = new Logger();
    logger.setContext({ service: 'svc' });
    logger.info('ctx msg');
    expect(getWinstonLog()).toHaveBeenCalledWith('info', 'ctx msg', expect.objectContaining({ service: 'svc' }));
    logger.clearContext();
    getWinstonLog().mockClear();
    logger.info('no ctx');
    const callArg = getWinstonLog().mock.calls[0][2] as Record<string, unknown>;
    expect(callArg.service).toBeUndefined();
  });
});

describe('Timer', () => {
  it('returns duration and calls performance log', () => {
    const logger = new Logger();
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    const timer = new Timer('op.test', logger);
    const duration = timer.end();
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(infoSpy).toHaveBeenCalled();
  });

  it('endWithResult returns the result', () => {
    const timer = new Timer('op', log);
    const result = timer.endWithResult(42);
    expect(result).toBe(42);
  });

  it('endAsync resolves and logs success', async () => {
    const timer = new Timer('op.async', log);
    const result = await timer.endAsync(Promise.resolve('done'));
    expect(result).toBe('done');
  });

  it('endAsync rejects and rethrows', async () => {
    const timer = new Timer('op.fail', log);
    await expect(timer.endAsync(Promise.reject(new Error('fail')))).rejects.toThrow('fail');
  });
});
