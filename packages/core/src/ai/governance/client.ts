import {
  CounterfactualRequest,
  CounterfactualResponse,
  ExplainRequest,
  GovernanceApiError,
  GovernanceClientOptions,
  LocalExplanation,
  ModelCard,
  ModelEvaluationReport,
  RegisteredEvaluation,
} from './types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ModelGovernanceClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: GovernanceClientOptions) {
    if (!options.baseUrl.trim()) {
      throw new Error('baseUrl is required');
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    if (!this.fetchImplementation) {
      throw new Error('A Fetch API implementation is required');
    }
  }

  async registerEvaluation(
    versionId: string,
    report: ModelEvaluationReport
  ): Promise<RegisteredEvaluation> {
    return this.request<RegisteredEvaluation>(
      'POST',
      `/ml-models/versions/${encodeURIComponent(versionId)}/evaluations`,
      report
    );
  }

  async getLatestEvaluation(versionId: string): Promise<RegisteredEvaluation | null> {
    return this.request<RegisteredEvaluation | null>(
      'GET',
      `/ml-models/versions/${encodeURIComponent(versionId)}/evaluations/latest`
    );
  }

  async explain(versionId: string, request: ExplainRequest): Promise<LocalExplanation> {
    return this.request<LocalExplanation>(
      'POST',
      `/ml-models/versions/${encodeURIComponent(versionId)}/explain`,
      request,
      request.timeoutMs
    );
  }

  async counterfactuals(
    versionId: string,
    request: CounterfactualRequest
  ): Promise<CounterfactualResponse> {
    return this.request<CounterfactualResponse>(
      'POST',
      `/ml-models/versions/${encodeURIComponent(versionId)}/counterfactuals`,
      request,
      request.timeoutMs
    );
  }

  async getModelCard(versionId: string): Promise<ModelCard> {
    return this.request<ModelCard>(
      'GET',
      `/ml-models/versions/${encodeURIComponent(versionId)}/model-card`
    );
  }

  async downloadModelCard(versionId: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImplementation(
        `${this.baseUrl}/ml-models/versions/${encodeURIComponent(versionId)}/model-card`,
        {
          method: 'GET',
          headers: this.headers('text/markdown'),
          signal: controller.signal,
        }
      );
      if (!response.ok) {
        await this.throwResponseError(response);
      }
      return response.text();
    } catch (error) {
      if (error instanceof GovernanceApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GovernanceApiError('Governance request timed out', 408, 'REQUEST_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private headers(accept = 'application/json'): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: accept,
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    timeoutOverride?: number
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = Math.min(Math.max(timeoutOverride ?? this.timeoutMs, 1), 120_000);
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        await this.throwResponseError(response);
      }
      const envelope = (await response.json()) as ApiEnvelope<T>;
      if (!envelope.success) {
        throw new GovernanceApiError(
          envelope.error?.message ?? 'Governance request failed',
          response.status,
          envelope.error?.code,
          envelope.error?.details
        );
      }
      return envelope.data;
    } catch (error) {
      if (error instanceof GovernanceApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GovernanceApiError('Governance request timed out', 408, 'REQUEST_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private async throwResponseError(response: Response): Promise<never> {
    let message = `Governance request failed with status ${response.status}`;
    let code: string | undefined;
    let details: unknown;
    try {
      const payload = await response.json() as {
        error?: { message?: string; code?: string; details?: unknown };
        message?: string;
      };
      message = payload.error?.message ?? payload.message ?? message;
      code = payload.error?.code;
      details = payload.error?.details;
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new GovernanceApiError(message, response.status, code, details);
  }
}
