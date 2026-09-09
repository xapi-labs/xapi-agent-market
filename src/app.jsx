import React, { useState } from 'react';
import { AgentDetailPage, AgentMarketPage } from './pages/agent-market.jsx';
import { ApiKeyProvider, useApiKey } from './key-store.jsx';
import { KeyGate } from './key-gate.jsx';
import { I18nProvider, useT } from './i18n.jsx';
import { XShell } from './shell.jsx';

function MarketApp() {
  const { apiKey, pendingKey, clearKey } = useApiKey();
  const { route, navigate } = XShell.useRoute();
  const { locale, setLocale } = useT();
  const [error, setError] = useState('');
  const zh = locale === 'zh';
  return <>
    <header className="market-header">
      <a className="market-brand" href="/" onClick={event => { event.preventDefault(); navigate('agents'); }}><span className="brand-mark">x</span> Agent Market <span className="brand-by">by xAPI</span></a>
      <nav aria-label={zh ? '主导航' : 'Main navigation'}>
        <span className="market-environment">{zh ? '测试环境' : 'Test environment'}</span>
        <button className="btn btn-sm" onClick={() => setLocale(zh ? 'en' : 'zh')}>{zh ? 'English' : '中文'}</button>
        {apiKey && <>
          <button className="btn btn-sm" onClick={() => navigate('key')}>{zh ? '更换 Key' : 'Change key'}</button>
          <button className="btn btn-sm" onClick={() => {
            try { clearKey(); setError(''); navigate('agents'); }
            catch { setError(zh ? '无法移除本地密钥，请检查浏览器存储设置。' : 'Could not remove the key. Check browser storage settings.'); }
          }}>{zh ? '移除本地 Key' : 'Remove key'}</button>
        </>}
      </nav>
    </header>
    {error && <p role="alert" className="key-error">{error}</p>}
    {!apiKey || route.page === 'key'
      ? <KeyGate key={pendingKey ? 'pending' : 'input'} onEnter={() => { if (route.page === 'key') navigate('agents'); }} />
      : route.page === 'agent-detail'
        ? <AgentDetailPage key={`${route.params.id}:${apiKey}`} />
        : <AgentMarketPage />}
    <footer className="market-footer">Agent Market <span>{zh ? '技术支持：' : 'Powered by '}<a href="https://xapi.to" target="_blank" rel="noreferrer">xAPI</a></span></footer>
  </>;
}

export function App() {
  return <I18nProvider><ApiKeyProvider><XShell.RouteProvider><MarketApp /></XShell.RouteProvider></ApiKeyProvider></I18nProvider>;
}
