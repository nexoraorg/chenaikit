export interface CompressionSnapshot {
  responses: number; compressedResponses: number; uncompressedBytes: number;
  transferredBytes: number; bytesSaved: number; savingsPercent: number;
  requests: number; compressedRequests: number; requestErrors: number;
}
class CompressionStatistics {
  private responses = 0; private compressedResponses = 0; private uncompressedBytes = 0;
  private transferredBytes = 0; private requests = 0; private compressedRequests = 0;
  private requestErrors = 0;
  recordResponse(raw: number, transferred: number, compressed: boolean): void {
    this.responses++; this.uncompressedBytes += raw; this.transferredBytes += transferred;
    if (compressed) this.compressedResponses++;
  }
  recordRequest(compressed: boolean): void { this.requests++; if (compressed) this.compressedRequests++; }
  recordRequestError(): void { this.requestErrors++; }
  snapshot(): CompressionSnapshot {
    const bytesSaved = Math.max(0, this.uncompressedBytes - this.transferredBytes);
    return {
      responses: this.responses, compressedResponses: this.compressedResponses,
      uncompressedBytes: this.uncompressedBytes, transferredBytes: this.transferredBytes,
      bytesSaved, savingsPercent: this.uncompressedBytes ? bytesSaved / this.uncompressedBytes * 100 : 0,
      requests: this.requests, compressedRequests: this.compressedRequests, requestErrors: this.requestErrors,
    };
  }
  reset(): void {
    this.responses = this.compressedResponses = this.uncompressedBytes = this.transferredBytes = 0;
    this.requests = this.compressedRequests = this.requestErrors = 0;
  }
}
export const compressionStatistics = new CompressionStatistics();
export function byteLength(chunk: unknown, encoding?: Parameters<typeof Buffer.byteLength>[1]): number {
  if (chunk === undefined || chunk === null) return 0;
  if (Buffer.isBuffer(chunk)) return chunk.length;
  if (chunk instanceof Uint8Array) return chunk.byteLength;
  return Buffer.byteLength(String(chunk), encoding);
}
