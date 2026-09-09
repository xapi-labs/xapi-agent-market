import React, { useState } from 'react';
import { useApiKey } from './key-store.jsx';
import { createApiKey } from './services.js';
import { useT } from './i18n.jsx';

export function KeyGate({ onEnter, onBack }) {
  const { apiKey, pendingKey, saveKey } = useApiKey();
  const { locale } = useT();
  const zh = locale === 'zh';
  const [value, setValue] = useState(pendingKey || apiKey);
  const [generated, setGenerated] = useState(!!pendingKey);
  const [backedUp, setBackedUp] = useState(false);
  const [visible, setVisible] = useState(!!pendingKey);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const key = value.trim();

  const create = async () => {
    setBusy('create'); setError(''); setNotice('');
    try {
      const next = await createApiKey();
      // Show the returned key even if this browser refuses localStorage.
      setValue(next); setGenerated(true); setVisible(true); setBackedUp(false);
      saveKey(next, false);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(''); }
  };

  const backup = async (mode) => {
    if (!key || busy) return;
    setBusy(mode); setError(''); setNotice('');
    try {
      if (mode === 'copy') {
        await navigator.clipboard.writeText(key);
      } else {
        const url = URL.createObjectURL(new Blob([`XAPI_KEY=${key}\n`], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url; link.download = 'xapi-agent-market-key.txt';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setBackedUp(true);
      setNotice(mode === 'copy'
        ? (zh ? 'API Key 已复制，可以进入市场。' : 'API key copied. You can enter the market.')
        : (zh ? '密钥文件已开始下载，可以进入市场。' : 'Key download started. You can enter the market.'));
    } catch {
      setError(zh ? '复制失败，请使用「下载密钥」保存后进入。' : 'Could not copy. Use Download key to save it before entering.');
    } finally { setBusy(''); }
  };

  const enter = event => {
    event.preventDefault();
    if (!key || busy || (generated && !backedUp)) return;
    try { saveKey(key, true); onEnter?.(); }
    catch { setError(zh ? '浏览器无法保存 API Key，请允许此站点使用本地存储后重试。' : 'Your browser could not save the API key. Allow local storage and try again.'); }
  };

  return <main className="key-page">
    <section className="key-intro">
      <div className="micro">xAPI · AGENT MARKET</div>
      <h1>{zh ? <>一个 Key，<br />连接链上 Agent。</> : <>One key.<br />Onchain intelligence.</>}</h1>
      <p>{zh ? '发现并调用流动性、交易、收益和风险分析 Agent。输入你的 xAPI Key，或立即创建一个。' : 'Discover agents for liquidity, trading, yield and risk. Bring your xAPI key, or create one in seconds.'}</p>
      <div className="key-steps">
        <div><span>01</span>{zh ? '输入或创建 API Key' : 'Bring or create a key'}</div>
        <div><span>02</span>{zh ? '复制或下载新密钥' : 'Copy or download your new key'}</div>
        <div><span>03</span>{zh ? '选择 Agent，发起调用' : 'Choose an agent and run it'}</div>
      </div>
    </section>
    <section className="key-card card">
      <div className="micro">{generated ? (zh ? '保存你的密钥' : 'SAVE YOUR KEY') : (zh ? '开始使用' : 'GET STARTED')}</div>
      <h2>{generated ? (zh ? '先备份，再进入' : 'Keep a copy. Then enter.') : (zh ? '准备好你的 API Key' : 'Your key to the market')}</h2>
      <p>{generated ? (zh ? '新密钥已创建。请先复制或下载到本地，再进入 Agent 市场。' : 'Your new key is ready. Copy it or download it before entering Agent Market.') : (zh ? 'API Key 保存在此浏览器中，用于后续 Agent 调用。' : 'Your API key is saved in this browser and used for agent calls.')}</p>
      <form onSubmit={enter}>
        <label className="key-label" htmlFor="api-key">xAPI API Key</label>
        <div className="key-input-row">
          <input id="api-key" className="input mono" type={visible ? 'text' : 'password'} autoComplete="off" spellCheck={false}
            value={value} readOnly={generated} disabled={!!busy} placeholder={zh ? '粘贴你的 xAPI Key' : 'Paste your xAPI key'}
            onChange={event => { setValue(event.target.value); setBackedUp(false); setError(''); setNotice(''); }} />
          <button className="btn btn-sm" type="button" onClick={() => setVisible(!visible)}>{visible ? (zh ? '隐藏' : 'Hide') : (zh ? '显示' : 'Show')}</button>
        </div>
        {generated && <div className="key-backup-actions">
          <button className="btn" type="button" disabled={!!busy} onClick={() => backup('copy')}>{zh ? '复制密钥' : 'Copy key'}</button>
          <button className="btn" type="button" disabled={!!busy} onClick={() => backup('download')}>{zh ? '下载密钥' : 'Download key'}</button>
        </div>}
        {error && <p className="key-error" role="alert">{error}</p>}
        {notice && <p className="key-success" role="status">{notice}</p>}
        <button className="btn btn-primary key-enter" type="submit" disabled={!key || !!busy || (generated && !backedUp)}>{zh ? '进入 Agent 市场' : 'Enter Agent Market'} <span aria-hidden="true">↗</span></button>
      </form>
      {!generated && <>
        <div className="key-divider"><span>{zh ? '还没有 API Key？' : 'No API key yet?'}</span></div>
        <button className="btn key-create" type="button" disabled={!!busy} onClick={create}>{busy === 'create' ? (zh ? '创建中…' : 'Creating…') : (zh ? '通过 xAPI 快速创建' : 'Quick create with xAPI')}</button>
      </>}
      <button className="btn key-create wallet-entry" type="button" disabled={!!busy} onClick={onBack}>{zh ? '返回市场 · 无需 API Key' : 'Back to market · no API key needed'}</button>
      <p className="key-footnote">{zh ? '密钥只存储在此浏览器中，并在调用时发送至 xAPI 网关。清除浏览器数据会移除本地密钥。' : 'Your key stays in this browser and is sent to the xAPI gateway when you run an agent. Clearing browser data removes your local key.'}</p>
    </section>
  </main>;
}
