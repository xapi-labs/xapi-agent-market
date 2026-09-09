import { afterEach, describe, expect, it, vi } from 'vitest';
import { XApi, createApiKey } from './services.js';

afterEach(() => vi.unstubAllGlobals());
describe('standalone gateway', () => {
  it('rejects an unconfigured host before sending any credential', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(XApi.gateway.invoke({ host: 'attacker.example', path: '/x402', apiKey: 'private-key' })).rejects.toThrow('not configured');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves an upstream failure for the agent UI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Insufficient balance' }), { status: 402 })));
    const result = await XApi.gateway.invoke({ host: 'grid-trading-agent.p.test.xapi.to', path: '/x402', apiKey: 'test-key', body: {} });
    expect(result).toMatchObject({ ok: false, status: 402, body: { message: 'Insufficient balance' } });
  });
  it('passes cancellation to the network request', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
    await expect(XApi.gateway.invoke({ host: 'grid-trading-agent.p.test.xapi.to', path: '/x402', apiKey: 'test-key', body: {}, signal: controller.signal })).rejects.toThrow('Aborted');
    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);
  });
  it('rejects a registration response with no usable key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }))));
    await expect(createApiKey()).rejects.toThrow('did not return an API key');
  });
});
