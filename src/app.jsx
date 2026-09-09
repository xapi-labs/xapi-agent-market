import React from 'react';
import { AgentDetailPage, AgentMarketPage } from './pages/agent-market.jsx';
import { ApiKeyProvider, useApiKey } from './key-store.jsx';
import { KeyGate } from './key-gate.jsx';
import { I18nProvider, useT } from './i18n.jsx';
import { XShell } from './shell.jsx';

function MarketApp() {
  const { apiKey, pendingKey } = useApiKey();
  const { route, navigate } = XShell.useRoute();
  const { locale, setLocale } = useT();
  const zh = locale === 'zh';
  return <>
    <header className="market-header">
      <a className="market-brand" href="/" onClick={event => { event.preventDefault(); navigate('agents'); }}><span className="brand-mark">x</span> Agent Market <span className="brand-by">by xAPI</span></a>
      <nav aria-label={zh ? '主导航' : 'Main navigation'}>
        <span className="market-environment">{zh ? '测试环境' : 'Test environment'}</span>
        <button className="btn btn-sm" onClick={() => setLocale(zh ? 'en' : 'zh')}>{zh ? 'English' : '中文'}</button>
      </nav>
    </header>
    {route.page === 'key'
      ? <KeyGate key={pendingKey ? 'pending' : 'input'} onBack={() => navigate('agents')} onEnter={() => navigate('agents')} />
      : route.page === 'agent-detail'
        ? <AgentDetailPage key={`${route.params.id}:${apiKey}`} />
        : <AgentMarketPage />}
    <footer className="market-footer">Agent Market <span>{zh ? '技术支持：' : 'Powered by '}<a href="https://xapi.to" target="_blank" rel="noreferrer">xAPI</a></span></footer>
  </>;
}

export function App() {
  return <I18nProvider><ApiKeyProvider><XShell.RouteProvider><MarketApp /></XShell.RouteProvider></ApiKeyProvider></I18nProvider>;
}
