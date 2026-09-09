import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createRunRecord, readRunHistory, saveRunHistory, runHistoryKey, restoreRunValues } from './run-history.js';

let memory;
beforeEach(() => {
  memory = new Map();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(key => memory.get(key) ?? null),
    setItem: vi.fn((key, value) => memory.set(key, value)),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('local completed run history', () => {
  it('persists outputs and receipts without payment credentials, keeping agents separate', () => {
    const response = { ok: true, status: 200, body: { output: '{"status":"ready"}' }, receipt: { transaction: '0x123', success: true }, apiKey: 'secret', headers: { 'payment-signature': 'signature' } };
    const record = createRunRecord({ pair: 'WBNB/USDT' }, response);
    saveRunHistory('grid-trading-agent', [record]);
    expect(readRunHistory('grid-trading-agent')[0]).toEqual(record);
    expect(readRunHistory('yield-optimisation-agent')).toEqual([]);
    expect(memory.get(runHistoryKey('grid-trading-agent'))).not.toMatch(/secret|signature/);
  });
  it('retains the newest 20 calls including failed HTTP responses', () => {
    const runs = Array.from({ length: 25 }, (_, i) => createRunRecord({ sequence: i }, { status: 502, ok: false, body: { error: 'upstream_failed' } }));
    saveRunHistory('grid', runs);
    expect(readRunHistory('grid')).toEqual(runs.slice(0, 20));
  });
  it('handles corrupt or unavailable storage and preserves old data on quota failure', () => {
    memory.set(runHistoryKey('grid'), 'broken-json');
    expect(readRunHistory('grid')).toEqual([]);
    const old = createRunRecord({}, { status: 200, body: {} });
    saveRunHistory('grid', [old]);
    localStorage.setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(() => saveRunHistory('grid', [])).toThrow('QuotaExceededError');
    expect(readRunHistory('grid')).toEqual([old]);
    localStorage.getItem.mockImplementation(() => { throw new Error('Disabled'); });
    expect(readRunHistory('grid')).toEqual([]);
  });
  it('restores known fields while supplying defaults for new or invalid fields', () => {
    const definition = { fields: [{ key: 'amount', value: '100' }, { key: 'risk', value: 'balanced' }] };
    expect(restoreRunValues(definition, { amount: 2500, risk: {}, unknown: 'ignored' })).toEqual({ amount: '2500', risk: 'balanced' });
  });
});
