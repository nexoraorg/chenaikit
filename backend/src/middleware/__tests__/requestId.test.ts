import { Request, Response } from 'express';
import { requestIdMiddleware, REQUEST_ID_HEADER } from '../../middleware/requestId';

function makeReqRes(headers: Record<string, string> = {}) {
  const responseHeaders: Record<string, string> = {};
  const req = { headers } as unknown as Request;
  const res = {
    setHeader: (name: string, value: string) => { responseHeaders[name] = value; },
  } as unknown as Response;
  return { req, res, responseHeaders };
}

describe('requestIdMiddleware', () => {
  it('generates a UUID when no request id header is provided', () => {
    const { req, res } = makeReqRes();
    requestIdMiddleware(req, res, () => {});
    expect(req.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('reuses the incoming x-request-id header', () => {
    const existingId = 'my-trace-id-123';
    const { req, res } = makeReqRes({ [REQUEST_ID_HEADER]: existingId });
    requestIdMiddleware(req, res, () => {});
    expect(req.id).toBe(existingId);
  });

  it('echoes the request id in the response header', () => {
    const { req, res, responseHeaders } = makeReqRes();
    requestIdMiddleware(req, res, () => {});
    expect(responseHeaders['X-Request-Id']).toBe(req.id);
  });

  it('calls next()', () => {
    const { req, res } = makeReqRes();
    const next = jest.fn();
    requestIdMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
