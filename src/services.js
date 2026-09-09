import deployment from '../vercel.json';

// Only the configured xAPI gateway hosts can receive a user's key.
const gateways = new Map(deployment.rewrites
  .filter(({ source }) => source.startsWith('/gateway/'))
  .map(({ source, destination }) => [new URL(destination).host, source.replace('/:path*', '')]));

async function readJson(response) {
  const value = await response.json().catch(() => null);
  if (!response.ok || !value || value.success === false) {
    const message = value?.message || value?.error?.message || `Request failed (HTTP ${response.status})`;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return value.data ?? value;
}

export async function createApiKey() {
  const response = await fetch('/xapi/auth/register', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const result = await readJson(response);
  if (typeof result.apiKey !== 'string' || !result.apiKey.trim()) {
    throw new Error('xAPI did not return an API key. Please try again.');
  }
  return result.apiKey.trim();
}

export const XApi = {
  apiSvc: {
    async listMarketplace() {
      return readJson(await fetch('/xapi/api-services', { credentials: 'omit' }));
    },
    async get(id) {
      return readJson(await fetch(`/xapi/api-services/${encodeURIComponent(id)}`, { credentials: 'omit' }));
    },
  },
  helpers: {
    apiSlug: service => service?.host?.split('.')[0] || service?.id || '',
  },
  gateway: {
    async invoke({ host, method = 'POST', path, body, apiKey, signal }) {
      const base = gateways.get(host);
      if (!base || path !== '/x402') throw new Error('This agent gateway is not configured for this market.');
      if (!apiKey?.trim()) throw new Error('Add an xAPI key to run this agent.');
      const started = performance.now();
      const response = await fetch(`${base}${path}`, {
        method,
        credentials: 'omit',
        headers: { 'content-type': 'application/json', 'xapi-key': apiKey.trim() },
        body: JSON.stringify(body),
        signal,
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return {
        ok: response.ok,
        status: response.status,
        body: data,
        latency: Math.round(performance.now() - started),
      };
    },
  },
};
