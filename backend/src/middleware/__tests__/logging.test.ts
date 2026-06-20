import { Request, Response } from 'express';

// Mock the logger module before any imports that use it
jest.mock('../../utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    audit: jest.fn(),
    child: jest.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { log: mockLogger, Timer: jest.fn().mockImplementation(() => ({ end: jest.fn() })) };
});

jest.mock('../../utils/logRedaction', () => ({
  redactBody: jest.fn((b) => b),
  redactHeaders: jest.fn((h) => h),
}));

import {
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  auditLoggingMiddleware,
  userContextMiddleware,
  slowRequestMiddleware,
} from '../../middleware/logging';
import { log } from '../../utils/logger';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    id: 'req-1',
    method: 'GET',
    path: '/test',
    query: {},
    body: {},
    headers: { 'user-agent': 'jest' },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    startTime: Date.now(),
    logger: log as any,
    ...overrides,
  } as unknown as Request;
}

function makeRes(statusCode = 200): Response {
  const listeners: Record<string, Function[]> = {};
  return {
    statusCode,
    send: jest.fn(function (this: any, data: any) { return this; }),
    get: jest.fn(() => '100'),
    on: jest.fn((event: string, cb: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    }),
    emit: (event: string) => listeners[event]?.forEach(fn => fn()),
    _listeners: listeners,
  } as unknown as Response;
}

describe('requestLoggingMiddleware', () => {
  it('sets startTime and req.logger', () => {
    const req = makeReq({ id: 'req-abc' });
    const res = makeRes();
    const next = jest.fn();
    requestLoggingMiddleware(req, res, next);
    expect(req.startTime).toBeDefined();
    expect(req.logger).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('logs request completed for 2xx', () => {
    const req = makeReq();
    const res = makeRes(200);
    requestLoggingMiddleware(req, res, jest.fn());
    // middleware replaces res.send; calling it triggers the completion log
    res.send('ok');
    expect((req.logger as any).info).toHaveBeenCalledWith('Request completed', expect.any(Object));
  });

  it('logs warn for 4xx', () => {
    const req = makeReq();
    const res = makeRes(404);
    requestLoggingMiddleware(req, res, jest.fn());
    res.send('not found');
    expect((req.logger as any).warn).toHaveBeenCalled();
  });

  it('logs error for 5xx', () => {
    const req = makeReq();
    const res = makeRes(500);
    requestLoggingMiddleware(req, res, jest.fn());
    res.send('error');
    expect((req.logger as any).error).toHaveBeenCalled();
  });
});

describe('errorLoggingMiddleware', () => {
  it('calls next with the error', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();
    const err = new Error('boom');
    errorLoggingMiddleware(err, req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('auditLoggingMiddleware', () => {
  it('skips GET requests', () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    const next = jest.fn();
    auditLoggingMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    // audit should not be called for GET
    expect((log as any).audit).not.toHaveBeenCalled();
  });

  it('emits audit log for POST on finish', () => {
    const req = makeReq({ method: 'POST' });
    const res = makeRes(201);
    auditLoggingMiddleware(req, res, jest.fn());
    (res as any).emit('finish');
    expect((req.logger as any).audit).toHaveBeenCalledWith(
      'POST',
      expect.objectContaining({ path: '/test', statusCode: 201 })
    );
  });
});

describe('userContextMiddleware', () => {
  it('enriches req.logger with user context when user is present', () => {
    const req = makeReq({ user: { id: 'u1', role: 'admin' } } as any);
    userContextMiddleware(req, makeRes(), jest.fn());
    expect((req.logger as any).child).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', userRole: 'admin' })
    );
  });

  it('skips enrichment when no user', () => {
    const req = makeReq();
    // Clear call history on the shared mock before checking
    (req.logger as any).child.mockClear();
    userContextMiddleware(req, makeRes(), jest.fn());
    expect((req.logger as any).child).not.toHaveBeenCalled();
  });
});

describe('slowRequestMiddleware', () => {
  it('returns a function', () => {
    const mw = slowRequestMiddleware(500);
    expect(typeof mw).toBe('function');
  });

  it('calls next', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();
    slowRequestMiddleware(500)(req, res, next);
    expect(next).toHaveBeenCalled();
    (res as any).emit('finish');
  });
});
