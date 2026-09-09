import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './app.jsx';
import { KEY_STORAGE } from './key-store.jsx';

let memory;
let storage;
const reply = data => Promise.resolve(new Response(JSON.stringify({ data }), { status: 200 }));

beforeEach(() => {
  memory = new Map([['xapi-agent-market.locale', 'en']]);
  storage = {
    getItem: vi.fn(key => memory.get(key) ?? null),
    setItem: vi.fn((key, value) => memory.set(key, value)),
    removeItem: vi.fn(key => memory.delete(key)),
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('fetch', vi.fn(() => reply([])));
  vi.stubGlobal('scrollTo', vi.fn());
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue() } });
  window.history.replaceState(null, '', '/');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('local API key entry', () => {
  it('allows wallet entry without creating or storing an API key', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter with wallet payment · x402 / B402' }));
    await screen.findByText('Choose an agent');
    expect(memory.has(KEY_STORAGE)).toBe(false);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/xapi/api-services']);
    expect(screen.getByRole('button', { name: 'Add API key' })).toBeTruthy();
  });
  it('stores an existing key locally without any authentication request', async () => {
    render(<App />);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('xAPI API Key'), { target: { value: '  existing-key  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter Agent Market' }));
    await screen.findByText('Choose an agent');
    expect(JSON.parse(memory.get(KEY_STORAGE))).toEqual({ key: 'existing-key', ready: true });
    expect(fetch.mock.calls.every(([url]) => url === '/xapi/api-services')).toBe(true);
  });

  it('requires a successful copy of a new key before entry and never creates a login session', async () => {
    fetch.mockImplementation(url => reply(url.endsWith('/register') ? { apiKey: 'new-key', accessToken: 'must-not-save' } : []));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Quick create with xAPI' }));
    await screen.findByText('Keep a copy. Then enter.');
    expect(screen.getByRole('button', { name: 'Enter Agent Market' }).disabled).toBe(true);
    expect(JSON.parse(memory.get(KEY_STORAGE))).toEqual({ key: 'new-key', ready: false });
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Denied'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy key' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Enter Agent Market' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Copy key' }));
    await screen.findByRole('status');
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('new-key');
    fireEvent.click(screen.getByRole('button', { name: 'Enter Agent Market' }));
    await screen.findByText('Choose an agent');
    expect(memory.has('xapi_access_token')).toBe(false);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/xapi/auth/register', '/xapi/api-services']);
  });

  it('restores a pending key after refresh and allows downloading it before entry', async () => {
    memory.set(KEY_STORAGE, JSON.stringify({ key: 'pending-key', ready: false }));
    const createURL = vi.fn(() => 'blob:key');
    const NativeURL = globalThis.URL;
    class TestURL extends NativeURL {}
    TestURL.createObjectURL = createURL;
    TestURL.revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', TestURL);
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<App />);
    expect(screen.getByLabelText('xAPI API Key').value).toBe('pending-key');
    expect(screen.getByRole('button', { name: 'Enter Agent Market' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Download key' }));
    await screen.findByRole('status');
    expect(createURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(download).toHaveBeenCalledOnce();
    expect(download.mock.instances[0].download).toBe('xapi-agent-market-key.txt');
    fireEvent.click(screen.getByRole('button', { name: 'Enter Agent Market' }));
    await screen.findByText('Choose an agent');
  });

  it('keeps entry blocked when local storage fails', () => {
    storage.setItem.mockImplementation(() => { throw new Error('Quota'); });
    render(<App />);
    fireEvent.change(screen.getByLabelText('xAPI API Key'), { target: { value: 'existing-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter Agent Market' }));
    expect(screen.getByRole('alert').textContent).toContain('could not save');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows registration errors without opening the market', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ message: 'Too many requests' }), { status: 429 }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Quick create with xAPI' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Too many requests');
    expect(screen.getByRole('button', { name: 'Enter Agent Market' }).disabled).toBe(true);
  });

  it('removes the local key and returns to entry', async () => {
    memory.set(KEY_STORAGE, JSON.stringify({ key: 'saved-key', ready: true }));
    render(<App />);
    await screen.findByText('Choose an agent');
    fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));
    expect(screen.getByLabelText('xAPI API Key').value).toBe('');
    expect(memory.has(KEY_STORAGE)).toBe(false);
  });

  it('uses the entered key for an agent call after entering through a deep link', async () => {
    window.history.replaceState(null, '', '/agents/grid-trading-agent');
    const service = { name: 'Grid Trading Agent', host: 'grid-trading-agent.p.test.xapi.to', isAgentStudioService: true };
    fetch.mockImplementation(url => url.startsWith('/gateway/')
      ? Promise.resolve(new Response(JSON.stringify({ result: { summary: 'Plan ready' } })))
      : reply(service));
    render(<App />);
    fireEvent.change(screen.getByLabelText('xAPI API Key'), { target: { value: 'caller-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter Agent Market' }));
    const run = await screen.findByRole('button', { name: /Run agent/i });
    fireEvent.click(run);
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url === '/gateway/grid-trading-agent/x402')).toBe(true));
    const [, request] = fetch.mock.calls.find(([url]) => url.startsWith('/gateway/'));
    expect(request.headers['xapi-key']).toBe('caller-key');
    expect(request.headers.Authorization).toBeUndefined();
    expect(request.credentials).toBe('omit');
    expect(JSON.parse(request.body).input.chainId).toBe('56');
  });
});
