import React, { useEffect, useRef, useState } from 'react';
import { WagmiProvider, useAccount, useConnect, useDisconnect } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './wagmi-config.js';
import { quoteAgentPayment, payAgentQuote } from './payments.js';
import { signAgentPayment } from './payment-wallet.js';

const queryClient = new QueryClient();
const messages = {
  PAYMENT_UNAVAILABLE: ['该接口暂未提供钱包支付报价，请使用 API Key。', 'Wallet payment is unavailable for this endpoint. Use an API key.'],
  BASE_UNAVAILABLE: ['当前网关未开放 Base USDC 支付，请选择 B402 或 API Key。', 'The gateway does not currently offer Base USDC. Choose B402 or API key.'],
  B402_UNAVAILABLE: ['当前网关未提供 B402 支付选项。', 'The gateway does not currently offer B402.'],
  PAYMENT_RESOURCE_MISMATCH: ['支付报价与当前接口不一致，请刷新后重试。', 'The payment quote does not match this endpoint. Refresh and try again.'],
  QUOTE_EXPIRED: ['报价已过期，请重新获取。', 'Quote expired. Get a new quote.'],
  QUOTE_CHANGED: ['报价已变更，请重新获取。', 'Quote changed. Get a new quote.'],
  WALLET_REQUIRED: ['请先连接钱包。', 'Connect a wallet first.'],
  WALLET_CHANGED: ['钱包账户或网络已变更，请重新获取报价。', 'Wallet account or network changed. Get a new quote.'],
  APPROVAL_FAILED: ['代币授权未成功，请查看钱包交易记录。', 'Token approval failed. Check the transaction in your wallet.'],
};
export const paymentError = (error, zh) => {
  if (messages[error?.message]) return messages[error.message][zh ? 0 : 1];
  if (/reject|denied|cancel/i.test(error?.message || '')) return zh ? '已取消钱包操作。' : 'Wallet request canceled.';
  return error?.shortMessage || error?.message || (zh ? '支付未完成。' : 'Payment did not complete.');
};

function PaymentControls({ host, provider, getBody, bodyKey, locale, onResult, onRunning }) {
  const zh = locale === 'zh';
  const { address } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [quote, setQuote] = useState(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const controller = useRef(null);
  const locked = useRef(false);
  const [clock, setClock] = useState(Date.now());
  const option = quote?.options.find(item => item.id === selected);
  const expired = quote && clock - quote.createdAt > 60000;
  useEffect(() => { setQuote(null); setReceipt(null); setError(''); }, [host, provider, bodyKey, address]);
  useEffect(() => {
    if (!quote) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [quote]);
  useEffect(() => () => controller.current?.abort(), []);

  const getQuote = async () => {
    if (locked.current) return;
    locked.current = true; setBusy('quote'); setError(''); setQuote(null); setReceipt(null);
    controller.current = new AbortController();
    onRunning(true);
    try {
      const next = await quoteAgentPayment({ host, body: getBody(), provider, signal: controller.current.signal });
      setQuote(next); setSelected(next.options[0].id); setClock(Date.now());
    } catch (cause) { if (cause.name !== 'AbortError') setError(paymentError(cause, zh)); }
    finally { locked.current = false; setBusy(''); onRunning(false); }
  };

  const pay = async () => {
    if (locked.current || !quote || !option) return;
    locked.current = true; setBusy('pay'); setError(''); setReceipt(null); onRunning(true);
    controller.current = new AbortController();
    try {
      const result = await payAgentQuote({ quote, optionId: selected, signPayment: signAgentPayment, signal: controller.current.signal });
      setReceipt(result.receipt);
      if (!result.ok) {
        const detail = result.body?.message || result.body?.error || `HTTP ${result.status}`;
        setError(`${zh ? '调用未成功，请核对支付记录后再重试。' : 'Call failed. Check payment history before retrying.'} ${typeof detail === 'string' ? detail : ''}`);
      } else { onResult(result); }
    } catch (cause) {
      setError(paymentError(cause, zh) + (cause instanceof TypeError ? (zh ? ' 若已签名，请先核对钱包支付记录，避免重复付款。' : ' If already signed, check your wallet before paying again.') : ''));
    } finally { setQuote(null); locked.current = false; setBusy(''); onRunning(false); }
  };

  const connect = async connector => {
    setError('');
    try { await connectAsync({ connector }); } catch (cause) { setError(paymentError(cause, zh)); }
  };
  const transaction = receipt?.transaction || receipt?.transactionHash || receipt?.txHash;
  return <div className="wallet-payment">
    <p>{zh ? '钱包按次支付。本次请求不携带 API Key，也不会扣除账户余额。' : 'Pay per call from your wallet. This request uses no API key or account balance.'}</p>
    <p className="payment-network-note">{provider === 'x402' ? 'Base · USDC' : 'BSC · U / USD1 / USDT / USDC'} · {zh ? '主网资产（真实资金）' : 'Mainnet assets (real funds)'}</p>
    <div className="wallet-connection">
      {address ? <><span className="mono">{address.slice(0, 6)}…{address.slice(-4)}</span><button className="btn btn-sm" disabled={!!busy} onClick={() => disconnectAsync().catch(cause => setError(paymentError(cause, zh)))}>{zh ? '断开钱包' : 'Disconnect'}</button></>
        : <div className="wallet-connectors"><span>{zh ? '连接支付钱包' : 'Connect payment wallet'}</span>{connectors.map(connector => <button className="btn btn-sm" disabled={isPending || !!busy} key={connector.uid} onClick={() => connect(connector)}>{connector.name}</button>)}{!connectors.length && <span>{zh ? '请安装支持 EVM 的钱包扩展。' : 'Install an EVM wallet extension.'}</span>}</div>}
    </div>
    <button className="btn" disabled={!!busy || isPending} onClick={getQuote}>{busy === 'quote' ? (zh ? '获取报价中…' : 'Getting quote…') : (zh ? '查看本次调用报价' : 'Get quote for this call')}</button>
    {quote && <div className="payment-quote">
      <label>{zh ? '支付资产' : 'Payment asset'}<select className="input" value={selected} disabled={!!busy} onChange={event => setSelected(event.target.value)}>{quote.options.map(item => <option key={item.id} value={item.id}>{item.symbol} · {item.chain}</option>)}</select></label>
      <strong className="payment-amount">{option?.amount} {option?.symbol}</strong>
      <span>{zh ? '本次调用费用 · 不含可能产生的网络费' : 'Cost for this call · network fees may apply'}</span>
      <span className="payment-recipient">{zh ? '收款地址：' : 'Recipient: '}{option?.requirements.payTo}</span>
      {option?.method === 'permit2-exact' && <p>{zh ? '如需代币授权，钱包会先请求 Permit2 授权，额度为本次费用；授权交易需要 BNB 网络费。随后签署本次付款。' : 'If needed, approve Permit2 for this call’s amount first (BNB gas required), then sign this payment.'}</p>}
      <button className="btn btn-primary" disabled={!!busy || !address || expired} onClick={pay}>{busy === 'pay' ? (zh ? '等待钱包及调用结果…' : 'Waiting for wallet and result…') : expired ? (zh ? '报价已过期' : 'Quote expired') : (zh ? `确认支付 ${option?.amount} ${option?.symbol} 并运行` : `Pay ${option?.amount} ${option?.symbol} and run`)}</button>
      {!address && <span>{zh ? '请先连接钱包，再获取最新报价。' : 'Connect a wallet, then get a fresh quote.'}</span>}
    </div>}
    {busy === 'pay' && <p role="status">{zh ? '请完成钱包中的确认。付款后请等待调用结果，避免重复支付。' : 'Confirm in your wallet, then wait for the result to avoid duplicate payments.'}</p>}
    {error && <div className="agent-run-error" role="alert">{error}</div>}
    {receipt && <div className="payment-receipt" role="status"><strong>{receipt.success === false ? (zh ? '支付结算未成功' : 'Settlement failed') : (zh ? '支付回执' : 'Payment receipt')}</strong>{transaction && <span className="mono">{transaction}</span>}</div>}
  </div>;
}

export default function WalletPayment(props) {
  return <WagmiProvider config={wagmiConfig}><QueryClientProvider client={queryClient}><PaymentControls {...props} /></QueryClientProvider></WagmiProvider>;
}
