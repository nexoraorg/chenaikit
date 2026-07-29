import express from 'express';
import request from 'supertest';
import { gzipSync } from 'zlib';
import {
  applyCompressionMiddleware,
  configureRouteCompression,
  compressionRequestErrorHandler,
} from '../compression';
import { compressionStatistics } from '../../utils/compressionUtils';

describe('compression middleware', () => {
  beforeEach(() => compressionStatistics.reset());

  function app() {
    const instance = express();
    applyCompressionMiddleware(instance);
    instance.use(express.json());
    instance.get('/large', (_req, res) => res.json({ value: 'x'.repeat(5000) }));
    instance.get('/small', (_req, res) => res.json({ value: 'small' }));
    instance.get('/disabled', configureRouteCompression({ enabled: false }),
      (_req, res) => res.json({ value: 'x'.repeat(5000) }));
    instance.post('/echo', (req, res) => res.json(req.body));
    instance.use(compressionRequestErrorHandler);
    return instance;
  }

  it('negotiates gzip and skips small or disabled responses', async () => {
    const large = await request(app()).get('/large').set('Accept-Encoding', 'gzip');
    expect(large.headers['content-encoding']).toBe('gzip');
    expect(large.headers.vary).toContain('Accept-Encoding');
    expect(compressionStatistics.snapshot().bytesSaved).toBeGreaterThan(0);

    const brotli = await request(app()).get('/large').set('Accept-Encoding', 'br');
    expect(brotli.headers['content-encoding']).toBe('br');

    const small = await request(app()).get('/small').set('Accept-Encoding', 'gzip');
    expect(small.headers['content-encoding']).toBeUndefined();

    const disabled = await request(app()).get('/disabled').set('Accept-Encoding', 'gzip');
    expect(disabled.headers['content-encoding']).toBeUndefined();
  });

  it('decompresses gzip JSON request bodies', async () => {
    const body = gzipSync(Buffer.from(JSON.stringify({ compressed: true })));
    const test = request(app()).post('/echo')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip');
    test.write(body);
    const response = await test;
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ compressed: true });
    expect(compressionStatistics.snapshot().compressedRequests).toBe(1);
  });

  it('rejects unsupported and invalid compressed requests', async () => {
    const unsupported = await request(app()).post('/echo').set('Content-Encoding', 'zstd').send('body');
    expect(unsupported.status).toBe(415);
    expect(unsupported.body.error.code).toBe('UNSUPPORTED_CONTENT_ENCODING');

    const invalid = await request(app())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send(Buffer.from('not gzip'));
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_COMPRESSED_BODY');
  });
});
