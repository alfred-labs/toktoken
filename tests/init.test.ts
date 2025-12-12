import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkBackendHealth } from '../src/init.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('checkBackendHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should succeed when health endpoint returns 200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await expect(checkBackendHealth('http://localhost:8000', 'test')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/health',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should succeed when health endpoint returns 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(checkBackendHealth('http://localhost:8000', 'test')).resolves.toBeUndefined();
  });

  it('should try models endpoint if health fails', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    await expect(checkBackendHealth('http://localhost:8000', 'test')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(
      'http://localhost:8000/v1/models',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should throw if all endpoints fail', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Connection refused'));

    await expect(checkBackendHealth('http://localhost:8000', 'test'))
      .rejects.toThrow('Backend test unreachable at http://localhost:8000');
  });

  it('should throw if endpoints return non-ok status', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(checkBackendHealth('http://localhost:8000', 'test'))
      .rejects.toThrow('Backend test unreachable');
  });
});
