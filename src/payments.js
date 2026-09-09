import { decodePaymentRequiredHeader, decodePaymentResponseHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import { formatUnits } from 'viem';
import { agentGatewayRoute } from './services.js';

export const PAYMENT_ASSETS = [
  { id: 'base-usdc', provider: 'x402', symbol: 'USDC', chain: 'Base', chainId: 8453, network: 'eip155:8453', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, method: 'eip3009' },
  { id: 'bsc-u', provider: 'b402', symbol: 'U', chain: 'BSC', chainId: 56, network: 'eip155:56', address: '0xcE24439F2d9C6a2289F741120FE202248B666666', decimals: 18, method: 'eip3009' },
  { id: 'bsc-usd1', provider: 'b402', symbol: 'USD1', chain: 'BSC', chainId: 56, network: 'eip155:56', address: '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d', decimals: 18, method: 'eip3009' },
  { id: 'bsc-usdt', provider: 'b402', symbol: 'USDT', chain: 'BSC', chainId: 56, network: 'eip155:56', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, method: 'permit2-exact' },
  { id: 'bsc-usdc', provider: 'b402', symbol: 'USDC', chain: 'BSC', chainId: 56, network: 'eip155:56', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, method: 'permit2-exact' },
];

export function acceptedPaymentOptions(challenge, provider) {
  if (challenge?.x402Version !== 2 || !Array.isArray(challenge.accepts)) return [];
  return PAYMENT_ASSETS.filter(asset => asset.provider === provider).flatMap(asset => {
    const requirements = challenge.accepts.find(r => r.scheme === 'exact' && r.network === asset.network
      && r.asset?.toLowerCase() === asset.address.toLowerCase()
      && (r.extra?.assetTransferMethod || 'eip3009') === asset.method
      && /^\d+$/.test(r.amount) && BigInt(r.amount) > 0n
      && /^0x[\da-f]{40}$/i.test(r.payTo)
      && (asset.method !== 'permit2-exact' || /^0x[\da-f]{40}$/i.test(r.extra?.spenderAddress)));
    return requirements ? [{ ...asset, requirements, amount: formatUnits(BigInt(requirements.amount), asset.decimals) }] : [];
  });
}

export async function quoteAgentPayment({ host, body, provider, signal }) {
  const route = agentGatewayRoute(host);
  const bodyText = JSON.stringify(body);
  const response = await fetch(route.url, { method: 'POST', credentials: 'omit', headers: { 'content-type': 'application/json' }, body: bodyText, signal });
  const header = response.headers.get('payment-required');
  if (response.status !== 402 || !header) throw new Error('PAYMENT_UNAVAILABLE');
  const challenge = decodePaymentRequiredHeader(header);
  const resource = new URL(challenge.resource?.url);
  const expected = new URL(route.upstream);
  // The gateway may advertise http behind its TLS proxy. Never navigate to that URL;
  // preserve the signed resource verbatim and always POST through our HTTPS rewrite.
  if (!['http:', 'https:'].includes(resource.protocol) || resource.host !== expected.host || resource.pathname !== expected.pathname || resource.search || resource.username || resource.password) {
    throw new Error('PAYMENT_RESOURCE_MISMATCH');
  }
  const options = acceptedPaymentOptions(challenge, provider);
  if (!options.length) throw new Error(provider === 'x402' ? 'BASE_UNAVAILABLE' : 'B402_UNAVAILABLE');
  return { ...route, bodyText, challenge, options, createdAt: Date.now() };
}

export async function payAgentQuote({ quote, optionId, signPayment, signal }) {
  const option = quote.options.find(item => item.id === optionId);
  if (!option || Date.now() - quote.createdAt > 60000) throw new Error('QUOTE_EXPIRED');
  signal?.throwIfAborted();
  const payload = await signPayment(quote.challenge, option, signal);
  signal?.throwIfAborted();
  const started = performance.now();
  // Exactly one paid retry of the frozen request. No API key, session cookie,
  // automatic balance fallback, or automatic second payment on upstream failure.
  const response = await fetch(quote.url, {
    method: 'POST', credentials: 'omit', signal,
    headers: { 'content-type': 'application/json', 'payment-signature': encodePaymentSignatureHeader(payload) },
    body: quote.bodyText,
  });
  let receipt = null;
  const receiptHeader = response.headers.get('payment-response');
  try { if (receiptHeader) receipt = decodePaymentResponseHeader(receiptHeader); } catch { /* Keep the execution response. */ }
  const raw = await response.text();
  let body; try { body = JSON.parse(raw); } catch { body = raw; }
  return { ok: response.ok, status: response.status, body, receipt, latency: Math.round(performance.now() - started) };
}
