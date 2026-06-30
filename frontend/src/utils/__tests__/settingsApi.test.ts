import axios from 'axios';
import { requestSettingsApi } from '../settingsApi';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('requestSettingsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns response data and uses a timeout', async () => {
    mockedAxios.request.mockResolvedValueOnce({ data: { ok: true } } as never);

    const result = await requestSettingsApi({
      method: 'get',
      url: '/api/v2/account/profile',
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'get',
        url: '/api/v2/account/profile',
        timeout: 10000,
      })
    );
    expect(result).toEqual({ ok: true });
  });

  it('throws a user-friendly error for timed out requests', async () => {
    const timeoutError = new Error('timeout');
    (timeoutError as Error & { code?: string }).code = 'ECONNABORTED';
    mockedAxios.request.mockRejectedValueOnce(timeoutError);

    await expect(
      requestSettingsApi({ method: 'put', url: '/api/v2/account/profile' })
    ).rejects.toThrow('The request timed out. Please try again.');
  });
});
