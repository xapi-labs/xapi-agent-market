import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodePaymentRequiredHeader, decodePaymentSignatureHeader, encodePaymentResponseHeader } from '@x402/core/http';
import { PAYMENT_ASSETS, acceptedPaymentOptions, quoteAgentPayment, payAgentQuote } from './payments.js';

const host = 'grid-trading-agent.p.test.xapi.to';
const body = { prompt: 'Build a grid', input: { pair: 'WBNB/USDT' } };
const requirement = asset => ({ scheme: 'exact', network: asset.network, asset: asset.address, amount: asset.decimals === 6 ? '100000' : '100000000000000000', payTo: '0x1111111111111111111111111111111111111111', maxTimeoutSeconds: 300, extra: { name: asset.symbol, version: '1', assetTransferMethod: asset.method, spenderAddress: '0x2222222222222222222222222222222222222222' } });
const challenge = (assets = PAYMENT_ASSETS) => ({ x402Version: 2, resource: { url: 'http://agent-market-grid.p.test.xapi.to/x402' }, accepts: assets.map(requirement) });
const respondQuote = value => new Response('{}', { status: 402, headers: { 'payment-required': encodePaymentRequiredHeader(value) } });
afterEach(() => vi.unstubAllGlobals());

describe('per-call payment', () => {
  it('keeps Base and BSC tokens separate and uses their correct decimals', () => {
    expect(acceptedPaymentOptions(challenge(), 'x402').map(x => [x.id, x.amount])).toEqual([['base-usdc', '0.1']]);
    expect(acceptedPaymentOptions(challenge(), 'b402').map(x => x.amount)).toEqual(['0.1', '0.1', '0.1', '0.1']);
  });
  it('does not fall back to a different network or unknown token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respondQuote(challenge(PAYMENT_ASSETS.slice(1)))));
    await expect(quoteAgentPayment({ host, body, provider: 'x402' })).rejects.toThrow('BASE_UNAVAILABLE');
    const unsupported = challenge(); unsupported.accepts[0].asset = '0x9999999999999999999999999999999999999999';
    expect(acceptedPaymentOptions(unsupported, 'x402')).toEqual([]);
  });
  it('rejects a challenge for a different recipient API before any signing', async () => {
    const wrong = challenge(); wrong.resource.url = 'https://attacker.example/x402';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respondQuote(wrong)));
    await expect(quoteAgentPayment({ host, body, provider: 'b402' })).rejects.toThrow('PAYMENT_RESOURCE_MISMATCH');
  });
  it('rejects an unconfigured gateway without sending a request', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(quoteAgentPayment({ host: 'attacker.example', body, provider: 'b402' })).rejects.toThrow('not configured');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('freezes the quoted body, signs once, sends no key or cookies, and decodes the receipt', async () => {
    const receipt = { success: true, transaction: '0x123', network: 'eip155:56', payer: '0x1111111111111111111111111111111111111111' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(respondQuote(challenge())).mockResolvedValueOnce(new Response('{"output":"ok"}', { headers: { 'payment-response': encodePaymentResponseHeader(receipt) } })));
    const mutable = structuredClone(body);
    const quote = await quoteAgentPayment({ host, body: mutable, provider: 'b402' });
    mutable.prompt = 'Changed later';
    const payload = { x402Version: 2, resource: quote.challenge.resource, accepted: quote.options[0].requirements, payload: { signature: '0xabc' } };
    const signPayment = vi.fn().mockResolvedValue(payload);
    const result = await payAgentQuote({ quote, optionId: 'bsc-u', signPayment });
    expect(signPayment).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
    for (const [url, request] of fetch.mock.calls) {
      expect(url).toBe('/gateway/grid-trading-agent/x402');
      expect(request.credentials).toBe('omit');
      expect(Object.keys(request.headers).map(x => x.toLowerCase())).not.toContain('xapi-key');
    }
    expect(decodePaymentSignatureHeader(fetch.mock.calls[1][1].headers['payment-signature'])).toEqual(payload);
    expect(result.receipt).toEqual(receipt);
  });
  it('stops on expired quotes, rejected signatures, and cancellation without paying', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respondQuote(challenge())));
    const quote = await quoteAgentPayment({ host, body, provider: 'x402' });
    const signPayment = vi.fn().mockRejectedValue(new Error('User rejected'));
    await expect(payAgentQuote({ quote: { ...quote, createdAt: Date.now() - 61000 }, optionId: 'base-usdc', signPayment })).rejects.toThrow('QUOTE_EXPIRED');
    expect(signPayment).not.toHaveBeenCalled();
    await expect(payAgentQuote({ quote, optionId: 'base-usdc', signPayment })).rejects.toThrow('User rejected');
    const controller = new AbortController();
    signPayment.mockImplementationOnce(async () => { controller.abort(); return {}; });
    await expect(payAgentQuote({ quote, optionId: 'base-usdc', signPayment, signal: controller.signal })).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('never retries a failed paid request automatically', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(respondQuote(challenge())).mockResolvedValueOnce(new Response('{"error":"upstream_timeout"}', { status: 502 })));
    const quote = await quoteAgentPayment({ host, body, provider: 'b402' });
    const result = await payAgentQuote({ quote, optionId: 'bsc-u', signPayment: vi.fn().mockResolvedValue({ x402Version: 2, payload: { signature: '0xabc' } }) });
    expect(result.status).toBe(502);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
