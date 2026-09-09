const PREFIX = 'xapi-agent-market.runs.v1:';
export const MAX_SAVED_RUNS = 20;
export const runHistoryKey = agentId => PREFIX + encodeURIComponent(agentId);

export function readRunHistory(agentId) {
  try {
    const data = JSON.parse(localStorage.getItem(runHistoryKey(agentId)));
    if (data?.version !== 1 || !Array.isArray(data.runs)) return [];
    return data.runs.filter(run => typeof run?.id === 'string' && typeof run.completedAt === 'string'
      && run.values && typeof run.values === 'object' && !Array.isArray(run.values)
      && run.response && typeof run.response.status === 'number' && 'body' in run.response).slice(0, MAX_SAVED_RUNS);
  } catch { return []; }
}

export function createRunRecord(values, response) {
  // Persist only inputs, returned data and settlement receipts. Request headers,
  // API keys, payment signatures and unsigned quotes are never part of a record.
  return JSON.parse(JSON.stringify({
    id: crypto.randomUUID(), completedAt: new Date().toISOString(), values,
    response: { ok: response.ok, status: response.status, body: response.body, latency: response.latency, receipt: response.receipt ?? null },
  }));
}

export function saveRunHistory(agentId, runs) {
  localStorage.setItem(runHistoryKey(agentId), JSON.stringify({ version: 1, runs: runs.slice(0, MAX_SAVED_RUNS) }));
}

export function restoreRunValues(definition, saved = {}) {
  return Object.fromEntries((definition?.fields || []).map(field => [field.key,
    typeof saved[field.key] === 'string' || typeof saved[field.key] === 'number' ? String(saved[field.key]) : field.value,
  ]));
}
