import React, { createContext, useContext, useEffect, useState } from 'react';

export const KEY_STORAGE = 'xapi-agent-market.key.v1';
const KeyContext = createContext(null);

export function readSavedKey() {
  try {
    const record = JSON.parse(localStorage.getItem(KEY_STORAGE));
    if (typeof record?.key !== 'string' || !record.key.trim()) return null;
    return { key: record.key.trim(), ready: record.ready === true };
  } catch { return null; }
}

export function ApiKeyProvider({ children }) {
  const [record, setRecord] = useState(readSavedKey);
  useEffect(() => {
    const sync = event => {
      if (event.key === KEY_STORAGE || event.key === null) setRecord(readSavedKey());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const saveKey = (key, ready) => {
    const next = { key: key.trim(), ready };
    if (!next.key || /\s/.test(next.key)) throw new Error('Please enter an API key without spaces.');
    // A failed local write must never open the market or claim the key is saved.
    localStorage.setItem(KEY_STORAGE, JSON.stringify(next));
    setRecord(next);
  };
  const clearKey = () => {
    localStorage.removeItem(KEY_STORAGE);
    setRecord(null);
  };
  return <KeyContext.Provider value={{
    apiKey: record?.ready ? record.key : '',
    pendingKey: record && !record.ready ? record.key : '',
    saveKey,
    clearKey,
  }}>{children}</KeyContext.Provider>;
}

export const useApiKey = () => useContext(KeyContext) || { apiKey: '', pendingKey: '' };
