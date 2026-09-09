import React, { createContext, useContext, useEffect, useState } from 'react';

const RouteContext = createContext(null);
const currentRoute = () => {
  const match = window.location.pathname.match(/^\/agents\/([^/]+)\/?$/);
  if (match) {
    try { return { page: 'agent-detail', params: { id: decodeURIComponent(match[1]) } }; } catch { /* malformed path */ }
  }
  return { page: window.location.pathname === '/key' ? 'key' : 'agents', params: {} };
};

export function RouteProvider({ children }) {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const pop = () => setRoute(currentRoute());
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const navigate = (page, params = {}) => {
    const path = page === 'agent-detail' ? `/agents/${encodeURIComponent(params.id)}` : page === 'key' ? '/key' : '/';
    window.history.pushState(null, '', path);
    setRoute(currentRoute());
    window.scrollTo(0, 0);
  };
  return <RouteContext.Provider value={{ route, navigate }}>{children}</RouteContext.Provider>;
}

export const XShell = { useRoute: () => useContext(RouteContext), RouteProvider };
