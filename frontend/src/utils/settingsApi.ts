import axios, { AxiosRequestConfig } from 'axios';

const DEFAULT_TIMEOUT_MS = 10000;

export interface SettingsApiOptions extends Omit<AxiosRequestConfig, 'timeout'> {
  timeout?: number;
}

export const requestSettingsApi = async <T = unknown>(options: SettingsApiOptions): Promise<T> => {
  const controller = new AbortController();
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await axios.request<T>({
      ...options,
      timeout: timeoutMs,
      signal: controller.signal,
    });
    return response.data;
  } catch (error: unknown) {
    if (
      axios.isAxiosError(error) &&
      (error.code === 'ECONNABORTED' || error.name === 'CanceledError' || error.message === 'canceled')
    ) {
      throw new Error('The request timed out. Please try again.');
    }

    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message || 'Request failed.';
      throw new Error(message);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
