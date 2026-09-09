import { afterEach, describe, expect, it, vi } from 'vitest';
import { XApi, createApiKey } from './services.js';
import deployment from '../vercel.json';

afterEach(() => vi.unstubAllGlobals());
describe('standalone gateway', () => {
  it.each([
    ['grid-trading-agent', 'agent-market-grid'],
    ['yield-optimisation-agent', 'agent-market-yield'],
    ['health-factor-monitoring-agent', 'agent-market-health'],
    ['liquidity-rebalancing-agent', 'agent-market-liquidity'],
  ])('routes %s and its relay identity to the published service', async (catalog, relay) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))));
    const source = `/gateway/${catalog}/:path*`;
    expect(deployment.rewrites.find(route => route.source === source)?.destination)
      .toBe(`https://${relay}.p.test.xapi.to/:path*`);
    for (const host of [catalog, relay]) {
      await XApi.gateway.invoke({ host: `${host}.p.test.xapi.to`, path: '/x402', apiKey: 'saved-key', body: { prompt: 'test', input: {} } });
    }
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [url, request] of fetch.mock.calls) {
      expect(url).toBe(`/gateway/${catalog}/x402`);
      expect(request).toMatchObject({ method: 'POST', credentials: 'omit', headers: { 'xapi-key': 'saved-key' } });
    }
  });
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
