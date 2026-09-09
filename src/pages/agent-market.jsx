import React, { useEffect, useMemo, useRef, useState } from 'react';
import { XIcons, XPrim } from '../primitives.jsx';
import { XApi } from '../services.js';
import { XShell } from '../shell.jsx';
import { useT } from '../i18n.jsx';
import { useApiKey } from '../key-store.jsx';
import { agentCopy, localizedAgentValues, fieldPlaceholder, resultStatus } from '../agent-copy.js';

const AGENT_MARKERS = new Set([
  'agent',
  'agents',
  'agent-studio',
  'a2a',
  'erc-8004',
  'erc-8183',
]);

const BSC = '56';

const textField = (key, label, value = '', options = {}) => ({
  key,
  label,
  value,
  type: 'text',
  ...options,
});

const numberField = (key, label, value, options = {}) => ({
  key,
  label,
  value: String(value),
  type: 'number',
  ...options,
});

const selectField = (key, label, value, options, extra = {}) => ({
  key,
  label,
  value,
  type: 'select',
  options,
  ...extra,
});

const textareaField = (key, label, value = '', options = {}) => ({
  key,
  label,
  value,
  type: 'textarea',
  ...options,
});

const TOKEN_ADDRESSES = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
};

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative', zhLabel: '保守' },
  { value: 'balanced', label: 'Balanced', zhLabel: '均衡' },
  { value: 'aggressive', label: 'Aggressive', zhLabel: '进取' },
];

const ASSET_OPTIONS = ['USDT', 'USDC', 'WBNB'].map((value) => ({ value, label: value }));

const pairTokens = (pair) => {
  const symbols = String(pair || '').toUpperCase().split(/\s*[\/-]\s*/).filter(Boolean);
  if (symbols.length !== 2) return {};
  return compact({
    baseTokenAddress: TOKEN_ADDRESSES[symbols[0]],
    quoteTokenAddress: TOKEN_ADDRESSES[symbols[1]],
  });
};

export const AGENT_DEFINITIONS = {
  'liquidity-rebalancing-agent': {
    kind: 'rebalancing',
    title: 'Liquidity Rebalancing Agent',
    category: 'Liquidity',
    fields: [
      textField('pool', 'Liquidity pool', 'WBNB / USDT · 0.25%', { required: true, wide: true }),
      numberField('capital_amount', 'Capital amount', 1000, { required: true, min: 0 }),
      selectField('capital_asset', 'Capital asset', 'USDT', ASSET_OPTIONS, { required: true }),
      textareaField(
        'objective',
        'What should the agent optimise?',
        'Propose a balanced concentrated-liquidity range and keep enough capital outside the position for gas and re-entry.',
        { required: true, wide: true, maxLength: 2000 },
      ),
    ],
    build(values) {
      const tokenAddresses = pairTokens(values.pool.split('·')[0]);
      return compact({
        chain: 'BNB Smart Chain',
        chainId: BSC,
        pool: values.pool,
        capital_amount: decimal(values.capital_amount),
        capital_asset: values.capital_asset,
        risk_profile: 'balanced',
        market_snapshot: tokenAddresses.baseTokenAddress && tokenAddresses.quoteTokenAddress ? {
          token0: String(values.pool).split(/[\/·]/)[0].trim(),
          token1: String(values.pool).split(/[\/·]/)[1]?.trim(),
          token0_address: tokenAddresses.baseTokenAddress,
          token1_address: tokenAddresses.quoteTokenAddress,
        } : undefined,
      });
    },
  },
  'grid-trading-agent': {
    kind: 'grid',
    title: 'Grid Trading Agent',
    category: 'Trading',
    fields: [
      textField('pair', 'Trading pair', 'WBNB / USDT', { required: true, wide: true }),
      selectField('capital_asset', 'Capital asset', 'USDT', ASSET_OPTIONS, { required: true }),
      numberField('capital_quote', 'Capital amount', 1000, { required: true, min: 0 }),
      selectField('risk_profile', 'Risk tolerance', 'balanced', RISK_OPTIONS, { required: true }),
      textareaField(
        'objective',
        'What should the agent optimise?',
        'Build a neutral seven-day grid using live market evidence and do not place any orders.',
        { required: true, wide: true, maxLength: 2000 },
      ),
    ],
    build(values) {
      return compact({
        chain: 'BNB Smart Chain',
        chainId: BSC,
        venue: 'PancakeSwap v3',
        pair: values.pair,
        ...pairTokens(values.pair),
        capital_asset: values.capital_asset,
        capital_quote: decimal(values.capital_quote),
        risk_profile: values.risk_profile,
      });
    },
  },
  'yield-optimisation-agent': {
    kind: 'yield',
    title: 'Yield Optimisation Agent',
    category: 'Yield',
    fields: [
      selectField('asset', 'Principal asset', 'USDT', ASSET_OPTIONS, { required: true }),
      numberField('amount', 'Principal amount', 1000, { required: true, min: 0 }),
      selectField('risk_profile', 'Risk preference', 'balanced', RISK_OPTIONS, { required: true }),
      selectField('asset_universe', 'Allowed assets', 'stable_only', [
        { value: 'stable_only', label: 'Stablecoins only', zhLabel: '仅稳定币' },
        { value: 'bluechip_allowed', label: 'Stablecoins and blue chips', zhLabel: '稳定币与主流资产' },
        { value: 'any_supported_asset', label: 'Any supported asset', zhLabel: '允许其他支持资产' },
      ]),
      numberField('max_protocol_share_pct', 'Max per protocol (%)', '', { min: 1, max: 100 }),
      numberField('max_lock_days', 'Max lock (days)', '', { min: 0 }),
      textareaField('existing_yield_assets', 'Existing yield assets', '', {
        placeholder: 'e.g. 1000 USDT supplied on Venus',
        wide: true,
        maxLength: 2000,
      }),
      textareaField(
        'objective',
        'What should the agent optimise?',
        'Find durable BNB Chain yield while retaining daily liquidity.',
        { required: true, wide: true, maxLength: 2000 },
      ),
    ],
    build(values) {
      return compact({
        chain: 'BNB Smart Chain',
        chainId: BSC,
        asset: values.asset,
        assetTokenAddress: TOKEN_ADDRESSES[values.asset],
        amount: decimal(values.amount),
        risk_profile: values.risk_profile,
        asset_universe: values.asset_universe,
        existing_yield_assets: values.existing_yield_assets,
        constraints: {
          max_protocol_share_pct: number(values.max_protocol_share_pct),
          max_lock_days: number(values.max_lock_days),
        },
      });
    },
  },
  'health-factor-monitoring-agent': {
    kind: 'health',
    title: 'Health Factor Monitoring Agent',
    category: 'Risk',
    fields: [
      textField('walletAddress', 'Wallet address', '', { placeholder: '0x…', required: true, wide: true }),
      textField('protocol', 'Protocol', '', { placeholder: 'Optional, e.g. Venus' }),
      textField('collateral_asset', 'Collateral asset', '', { placeholder: 'Optional, e.g. WBNB' }),
      textareaField(
        'objective',
        'What should the agent analyse?',
        'Assess liquidation risk and show the smallest unsigned mitigation that raises the health factor above 1.80.',
        { required: true, wide: true, maxLength: 2000 },
      ),
    ],
    build(values) {
      return compact({
        walletAddress: values.walletAddress,
        chain: 'BNB Smart Chain',
        chainId: BSC,
        protocol: values.protocol,
        collateral_asset: values.collateral_asset,
      });
    },
  },
};

const AGENT_SUFFIXES = Object.keys(AGENT_DEFINITIONS);

const decimal = (value) => {
  const text = String(value ?? '').trim();
  return text === '' ? undefined : text;
};

const number = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const compact = (value) => {
  if (Array.isArray(value)) return value.map(compact).filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return value === '' ? undefined : value;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, compact(item)])
      .filter(([, item]) => item !== undefined),
  );
};

export const agentSlug = (service) => String(
  service?.hostPrefix || service?.host || service?.slug || service?.name || '',
).trim().toLowerCase().split('.')[0].replace(/\s+/g, '-');

export const resolveAgentDefinition = (serviceOrSlug) => {
  const slug = typeof serviceOrSlug === 'string' ? serviceOrSlug : agentSlug(serviceOrSlug);
  return AGENT_DEFINITIONS[slug] || null;
};

export const initialAgentValues = (definition) => Object.fromEntries(
  (definition?.fields || []).map((field) => [field.key, field.value]),
);

export const missingRequiredAgentFields = (definition, values) => (
  (definition?.fields || []).filter((field) => (
    field.required && String(values?.[field.key] ?? '').trim() === ''
  ))
);

export const buildAgentInvocationBody = (definition, values) => ({
  input: definition.build(values),
  prompt: String(values.objective || '').trim(),
});

export const parseAgentOutput = (body) => {
  let candidate = body;
  if (candidate && typeof candidate === 'object' && 'output' in candidate) candidate = candidate.output;
  for (let attempts = 0; attempts < 2 && typeof candidate === 'string'; attempts += 1) {
    const text = candidate.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { candidate = JSON.parse(text); } catch { return { raw: candidate }; }
  }
  return candidate && typeof candidate === 'object' ? candidate : { raw: candidate };
};

/**
 * Compatibility classifier for the public marketplace payload.
 *
 * New backends can expose an explicit Agent Studio marker. The name suffix is
 * retained only for marketplace rows created before that field existed (the
 * four BNB competition agents currently use it).
 */
export const isAgentMarketService = (service) => {
  if (!service || typeof service !== 'object') return false;
  if (AGENT_SUFFIXES.includes(agentSlug(service))) return true;
  if (
    service.isAgentStudioService === true ||
    service.agentStudioDeployment ||
    service.agent?.runtime
  ) return true;

  const category = String(service.category || '').trim().toLowerCase();
  if (category === 'agent' || category === 'agents' || category === 'agent marketplace') return true;

  const tags = Array.isArray(service.tags)
    ? service.tags.map((tag) => String(tag).trim().toLowerCase())
    : [];
  if (tags.some((tag) => AGENT_MARKERS.has(tag))) return true;

  return /\bagent\s*$/i.test(String(service.name || '').trim());
};

export const agentIdentity = (service) => {
  const erc8004 = service?.agent?.erc8004;
  const walletAddress = String(
    erc8004?.agentWalletAddress || service?.agent?.walletAddress || '',
  ).trim();
  const agentId = String(erc8004?.agentId || '').trim();
  if (!walletAddress && !agentId) return null;
  return {
    agentId,
    agentRegistry: String(erc8004?.agentRegistry || '').trim(),
    walletAddress,
    network: String(erc8004?.network || service?.agent?.network || '').trim(),
  };
};

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const bscScanIdentityParts = (identity) => {
  const registry = String(identity?.agentRegistry || '').trim();
  const caipMatch = /^eip155:(56|97):(0x[a-fA-F0-9]{40})$/.exec(registry);
  const plainRegistry = EVM_ADDRESS_PATTERN.test(registry) ? registry : '';
  const network = String(identity?.network || '').trim().toLowerCase();
  const chainId = caipMatch?.[1]
    || (network.includes('testnet') ? '97' : network.includes('bsc') ? '56' : '');
  const registryAddress = caipMatch?.[2] || plainRegistry;
  const baseUrl = chainId === '56'
    ? 'https://bscscan.com'
    : chainId === '97'
      ? 'https://testnet.bscscan.com'
      : '';

  return { baseUrl, registryAddress };
};

export const bscScanAgentIdentityUrl = (identity) => {
  const agentId = String(identity?.agentId || '').trim();
  const { baseUrl, registryAddress } = bscScanIdentityParts(identity);
  if (!baseUrl || !registryAddress || !/^\d+$/.test(agentId)) return '';
  return `${baseUrl}/nft/${registryAddress}/${agentId}`;
};

export const bscScanAgentWalletUrl = (identity) => {
  const walletAddress = String(identity?.walletAddress || '').trim();
  const { baseUrl } = bscScanIdentityParts(identity);
  if (!baseUrl || !EVM_ADDRESS_PATTERN.test(walletAddress)) return '';
  return `${baseUrl}/address/${walletAddress}`;
};

export const compactWalletAddress = (address) => {
  const value = String(address || '').trim();
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
};

const agentKind = (service) => {
  const definition = resolveAgentDefinition(service);
  if (definition) return definition.kind;
  const haystack = `${service?.name || ''} ${service?.description || ''} ${(service?.tags || []).join(' ')}`.toLowerCase();
  if (/grid/.test(haystack)) return 'grid';
  if (/yield|optimis|optimiz/.test(haystack)) return 'yield';
  if (/health.factor|liquidation|lending/.test(haystack)) return 'health';
  if (/rebalanc|liquidity/.test(haystack)) return 'rebalancing';
  return 'general';
};

const agentRole = (service, t) => {
  return t(`agentMarket.role.${agentKind(service)}`);
};

const agentCalls = (service) => Number(service?.totalHits ?? service?.calls30d ?? 0) || 0;

const AgentSkeleton = () => (
  <div className="agent-market-card card">
    <div className="row gap-2" style={{ alignItems: 'center' }}>
      <span className="skeleton" style={{ width: 42, height: 42, borderRadius: 9 }} />
      <div style={{ flex: 1 }}>
        <span className="skeleton" style={{ width: '56%', height: 12, display: 'block' }} />
        <span className="skeleton" style={{ width: '32%', height: 9, marginTop: 7, display: 'block' }} />
      </div>
    </div>
    <span className="skeleton" style={{ width: '100%', height: 10, marginTop: 20, display: 'block' }} />
    <span className="skeleton" style={{ width: '78%', height: 10, marginTop: 7, display: 'block' }} />
    <div className="row gap-2" style={{ marginTop: 20 }}>
      <span className="skeleton" style={{ width: 58, height: 20, borderRadius: 10 }} />
      <span className="skeleton" style={{ width: 48, height: 20, borderRadius: 10 }} />
    </div>
  </div>
);

export const AgentMarketPage = () => {
  const { navigate } = XShell.useRoute();
  const { locale, t } = useT();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('popular');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    XApi.apiSvc.listMarketplace()
      .then((rows) => {
        if (cancelled) return;
        setServices((Array.isArray(rows) ? rows : []).filter(isAgentMarketService));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let rows = needle
      ? services.filter((service) => (
        `${service.name || ''} ${service.description || ''} ${['en', 'zh'].map(lang => { const copy = agentCopy(service, resolveAgentDefinition(service), lang); return `${copy.name} ${copy.description}`; }).join(' ')} ${(service.tags || []).join(' ')}`
          .toLowerCase()
          .includes(needle)
      ))
      : services;
    if (category !== 'all') rows = rows.filter((service) => agentKind(service) === category);
    if (sort === 'popular') rows = [...rows].sort((a, b) => agentCalls(b) - agentCalls(a));
    if (sort === 'new') rows = [...rows].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return rows;
  }, [category, query, services, sort]);

  const openAgent = (service) => navigate('agent-detail', { id: XApi.helpers.apiSlug(service) });

  return (
    <main className="agent-market-page">
      <section className="agent-market-hero">
        <div className="agent-market-hero-grid">
          <div>
            <div className="micro">{t('agentMarket.eyebrow')}</div>
            <h1>{t('agentMarket.title')}</h1>
            <p>{t('agentMarket.body')}</p>
            <div className="row gap-2 agent-market-trust" style={{ flexWrap: 'wrap' }}>
              <span className="tag"><XIcons.IconZap size={11} /> {t('agentMarket.trust.perCall')}</span>
              <span className="tag"><XIcons.IconShield size={11} /> {t('agentMarket.trust.readOnly')}</span>
              <span className="tag"><XIcons.IconCpu size={11} /> {t('agentMarket.trust.stateless')}</span>
            </div>
          </div>
          <div className="agent-market-flow card" aria-label={t('agentMarket.flow.label')}>
            <div className="micro">{t('agentMarket.flow.label')}</div>
            <div className="agent-market-flow-step"><span>01</span><strong>{t('agentMarket.flow.input')}</strong></div>
            <div className="agent-market-flow-line" />
            <div className="agent-market-flow-step"><span>02</span><strong>{t('agentMarket.flow.run')}</strong></div>
            <div className="agent-market-flow-line" />
            <div className="agent-market-flow-step"><span>03</span><strong>{t('agentMarket.flow.result')}</strong></div>
          </div>
        </div>
      </section>

      <section className="agent-market-catalog">
        <div className="row between agent-market-toolbar">
          <div>
            <div className="micro">{t('agentMarket.catalog.eyebrow')}</div>
            <h2>{t('agentMarket.catalog.title')}</h2>
          </div>
          <div className="row gap-2 agent-market-controls">
            <label className="agent-market-search hairline">
              <XIcons.IconSearch size={14} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('agentMarket.search')}
                aria-label={t('agentMarket.search')}
              />
            </label>
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={t('agentMarket.sort.label')}>
              <option value="popular">{t('agentMarket.sort.popular')}</option>
              <option value="new">{t('agentMarket.sort.new')}</option>
            </select>
          </div>
        </div>

        <div className="agent-market-filters" aria-label={t('agentMarket.filter.label')}>
          {['all', 'rebalancing', 'grid', 'yield', 'health'].map((item) => (
            <button
              key={item}
              type="button"
              className={`agent-market-filter ${category === item ? 'active' : ''}`}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              {t(`agentMarket.filter.${item}`)}
            </button>
          ))}
        </div>

        {loading && (
          <div className="agent-market-cards">
            {Array.from({ length: 4 }).map((_, index) => <AgentSkeleton key={index} />)}
          </div>
        )}

        {!loading && error && (
          <div className="agent-market-empty card">
            <XIcons.IconInfo size={24} />
            <h3>{t('agentMarket.error.title')}</h3>
            <p>{t('agentMarket.error.body')}</p>
          </div>
        )}

        {!loading && !error && services.length === 0 && (
          <div className="agent-market-empty card">
            <XIcons.IconCpu size={28} />
            <h3>{t('agentMarket.empty.title')}</h3>
            <p>{t('agentMarket.empty.body')}</p>
          </div>
        )}

        {!loading && !error && services.length > 0 && visible.length === 0 && (
          <div className="agent-market-empty card">
            <XIcons.IconSearch size={24} />
            <h3>{t('agentMarket.noMatch.title')}</h3>
            <p>{t('agentMarket.noMatch.body')}</p>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="agent-market-cards apx-stagger-in">
            {visible.map((service) => {
              const calls = agentCalls(service);
              const copy = agentCopy(service, resolveAgentDefinition(service), locale);
              const identity = agentIdentity(service);
              const identityUrl = bscScanAgentIdentityUrl(identity);
              return (
                <article
                  key={service.id}
                  className="agent-market-card card card-h"
                  role="button"
                  tabIndex={0}
                  onClick={() => openAgent(service)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openAgent(service);
                    }
                  }}
                >
                  <div className="agent-market-card-meta">
                    <div className="micro-mono">{agentRole(service, t)}</div>
                    <span className="agent-market-live"><i />{t('agentMarket.live')}</span>
                  </div>
                  <div className="agent-market-card-heading">
                    <div className="agent-market-avatar">
                      {service.logoUrl
                        ? <img src={service.logoUrl} alt="" />
                        : <XIcons.IconCpu size={19} />}
                    </div>
                    <h3>{copy.name}</h3>
                  </div>

                  <p className="agent-market-description">
                    {copy.description || t('agentMarket.descriptionFallback')}
                  </p>

                  <div className="row gap-2 agent-market-badges" style={{ flexWrap: 'wrap' }}>
                    <span className="tag">x402</span>
                    <span className="tag">A2A</span>
                    <span className="tag">BNB Chain</span>
                    {identity?.agentId && (identityUrl ? (
                      <a
                        className="tag agent-market-identity-link"
                        href={identityUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={t('agentMarket.detail.viewIdentity')}
                        aria-label={`${t('agentMarket.detail.viewIdentity')}: ${identity.agentId}`}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        ERC-8004 #{identity.agentId} <XIcons.IconExternal size={9} />
                      </a>
                    ) : <span className="tag">ERC-8004 #{identity.agentId}</span>)}
                    <span className="tag">{t('agentMarket.stateless')}</span>
                  </div>

                  <div className="agent-market-card-footer row between">
                    <div>
                      <div className="micro">{t('agentMarket.billing')}</div>
                      <strong>{service.billingModel === 'PER_TOKEN' ? t('agentMarket.perToken') : t('agentMarket.perCall')}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="micro">{t('agentMarket.calls')}</div>
                      <strong className="mono">{XPrim.fmt(calls)}</strong>
                    </div>
                  </div>

                  <button className="btn btn-primary agent-market-open" onClick={(event) => { event.stopPropagation(); openAgent(service); }}>
                    {t('agentMarket.open')} <XIcons.IconArrowRight size={13} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};

const ZH_FIELD_LABELS = {
  walletAddress: '钱包地址',
  protocol: '协议',
  pool: '流动性池',
  venue: '交易场所',
  pair: '交易对',
  capital_amount: '本金数量',
  capital_asset: '本金资产',
  risk_profile: '风险偏好',
  asset_universe: '允许的资产范围',
  existing_yield_assets: '已有生息资产',
  collateral_asset: '抵押资产',
  objective: '你希望 Agent 做什么？',
  baseTokenAddress: '基础代币地址',
  quoteTokenAddress: '计价代币地址',
  asset: '资产',
  assetTokenAddress: '资产合约地址',
  current_price: '当前价格',
  range_lower: '当前区间下界',
  range_upper: '当前区间上界',
  lower_price: '网格下界',
  upper_price: '网格上界',
  liquidity_value_usd: '仓位价值（USD）',
  token0_share_pct: 'Token 0 占比（%）',
  token1_share_pct: 'Token 1 占比（%）',
  target_width_bps: '目标宽度（bps）',
  max_slippage_bps: '最大滑点（bps）',
  grid_count: '网格数量',
  capital_quote: '本金数量',
  base_inventory: '基础资产库存',
  amount: '本金数量',
  max_protocol_share_pct: '单协议最大占比（%）',
  max_risk_score: '最高风险分',
  max_lock_days: '最长锁定（天）',
  min_tvl_usd: '最低 TVL（USD）',
  gas_budget_usd: 'Gas 预算（USD）',
  collateral_amount: '抵押品数量',
  collateral_price_usd: '抵押品价格（USD）',
  liquidation_threshold_pct: '清算阈值（%）',
  debt_amount: '债务数量',
  debt_price_usd: '债务资产价格（USD）',
  target_health_factor: '目标健康因子',
  stress_drawdown_pct: '压力测试跌幅（%）',
};

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const agentResultSummary = (definition, result) => {
  if (!definition || !result || typeof result !== 'object') return [];
  if (definition.kind === 'rebalancing') {
    return [
      ['Plan type', result.plan_type],
      ['Rebalance', result.rebalance_needed],
      ['In range', result.current_position?.in_range],
      ['Proposed range', result.proposed_range ? `${displayValue(result.proposed_range.lower)} – ${displayValue(result.proposed_range.upper)}` : null],
    ];
  }
  if (definition.kind === 'grid') {
    return [
      ['Grid mode', result.grid?.mode],
      ['Levels', result.grid?.levels?.length],
      ['Orders', result.orders?.length],
      ['Allocated', result.capital_summary?.allocated_quote],
    ];
  }
  if (definition.kind === 'yield') {
    return [
      ['Estimated APR', result.estimated_portfolio_apr_pct == null ? null : `${result.estimated_portfolio_apr_pct}%`],
      ['Eligible markets', result.ranked_opportunities?.filter((item) => item?.eligible).length],
      ['Allocations', result.allocation?.length],
    ];
  }
  if (definition.kind === 'health') {
    return [
      ['Health factor', result.computed?.health_factor],
      ['Collateral', result.computed?.collateral_usd],
      ['Debt', result.computed?.debt_usd],
      ['Stress cases', result.stress_tests?.length],
    ];
  }
  return [];
};

const ResultList = ({ title, items }) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <section className="agent-result-section">
      <h3>{title}</h3>
      <div className="agent-result-list">
        {items.map((item, index) => (
          <div className="agent-result-row" key={`${title}-${index}`}>
            {typeof item === 'string' ? item : (
              <>
                <strong>{item.action || item.protocol || item.market || item.side || `#${index + 1}`}</strong>
                <span>{item.reason || item.amount || item.price || JSON.stringify(item)}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

const AgentResult = ({ definition, response }) => {
  const { locale, t } = useT();
  const result = parseAgentOutput(response?.body);
  const summary = agentResultSummary(definition, result).filter(([, value]) => value !== null && value !== undefined);
  const actions = result.unsigned_action_plan || result.mitigation_options || result.orders || result.allocation;
  return (
    <div className="agent-result card" aria-live="polite">
      <div className="row between agent-result-heading">
        <div>
          <div className="micro">{t('agentMarket.result.eyebrow')}</div>
          <h2>{resultStatus(result.status, locale)}</h2>
        </div>
        <div className="row gap-2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className="tag">{response.latency} ms</span>
          {response.body?.invocationId && <span className="tag mono">{response.body.invocationId}</span>}
        </div>
      </div>

      {summary.length > 0 && (
        <div className="agent-result-summary">
          {summary.map(([label, value]) => (
            <div key={label}>
              <span>{locale === 'zh' ? ({
                Rebalance: '需要再平衡',
                'Plan type': '方案类型',
                'In range': '当前是否在区间内',
                'Proposed range': '建议区间',
                'Grid mode': '网格模式',
                Levels: '价格层级',
                Orders: '订单数量',
                Allocated: '分配本金',
                'Estimated APR': '预计 APR',
                'Eligible markets': '符合条件的市场',
                Allocations: '资金分配',
                'Health factor': '健康因子',
                Collateral: '抵押品价值',
                Debt: '债务价值',
                'Stress cases': '压力场景',
              }[label] || label) : label}</span>
              <strong>{typeof value === 'boolean' && locale === 'zh' ? (value ? '是' : '否') : displayValue(value)}</strong>
            </div>
          ))}
        </div>
      )}

      <ResultList title={t('agentMarket.result.actions')} items={actions} />
      <ResultList title={t('agentMarket.result.missing')} items={result.missing_fields} />
      <ResultList title={t('agentMarket.result.risks')} items={result.risk_warnings} />
      <ResultList title={t('agentMarket.result.assumptions')} items={result.assumptions} />

      {result.raw !== undefined && (
        <div className="agent-result-raw-text">{String(result.raw)}</div>
      )}
      <details className="agent-result-raw">
        <summary>{t('agentMarket.result.raw')}</summary>
        <pre>{JSON.stringify(response.body, null, 2)}</pre>
      </details>
    </div>
  );
};

export const AgentDetailPage = () => {
  const { route, navigate } = XShell.useRoute();
  const { locale, t } = useT();
  const id = route.params?.id || '';
  const fallbackDefinition = resolveAgentDefinition(id);
  const [service, setService] = useState(null);
  const [definition, setDefinition] = useState(fallbackDefinition);
  const [values, setValues] = useState(() => initialAgentValues(fallbackDefinition));
  const [loadingService, setLoadingService] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState(null);
  const abortRef = useRef(null);
  const { apiKey } = useApiKey();
  const copy = agentCopy(service, definition, locale);
  const displayValues = localizedAgentValues(definition, values, locale);
  const identity = agentIdentity(service);
  const identityUrl = bscScanAgentIdentityUrl(identity);
  const walletUrl = bscScanAgentWalletUrl(identity);

  useEffect(() => {
    let cancelled = false;
    setLoadingService(true);
    XApi.apiSvc.get(id)
      .then((row) => {
        if (cancelled) return;
        const nextDefinition = resolveAgentDefinition(row) || fallbackDefinition;
        setService(row);
        setDefinition(nextDefinition);
        setValues(initialAgentValues(nextDefinition));
      })
      .catch((cause) => {
        if (!cancelled) setError(cause?.message || t('agentMarket.detail.loadError'));
      })
      .finally(() => { if (!cancelled) setLoadingService(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setResponse(null);
    setError('');
  };

  const runAgent = async () => {
    if (!definition || !service || running) return;
    const missingRequired = missingRequiredAgentFields(definition, values);
    if (missingRequired.length > 0) {
      const labels = missingRequired
        .map((field) => locale === 'zh' ? (ZH_FIELD_LABELS[field.key] || field.label) : field.label)
        .join(', ');
      setError(`${t('agentMarket.detail.requiredFields')}: ${labels}`);
      return;
    }
    const wallet = String(values.walletAddress || '').trim();
    if (wallet && !/^0x[A-Fa-f0-9]{40}$/.test(wallet)) {
      setError(t('agentMarket.detail.walletInvalid'));
      return;
    }
    if (!apiKey) {
      navigate('key');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError('');
    setResponse(null);
    try {
      const next = await XApi.gateway.invoke({
        host: service.host,
        method: 'POST',
        path: '/x402',
        headers: { 'content-type': 'application/json' },
        body: buildAgentInvocationBody(definition, displayValues),
        apiKey,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!next.ok) {
        const message = next.body?.message || next.body?.error?.message || next.body?.error || next.error || `HTTP ${next.status || 500}`;
        throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
      }
      setResponse(next);
    } catch (cause) {
      if (cause?.name !== 'AbortError') setError(cause?.message || t('agentMarket.detail.runError'));
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  };

  if (loadingService) {
    return <main className="agent-detail-page"><AgentSkeleton /></main>;
  }

  if (!definition || !service) {
    return (
      <main className="agent-detail-page">
        <button className="btn btn-sm" onClick={() => navigate('agents')}>← {t('agentMarket.detail.back')}</button>
        <div className="agent-market-empty card">
          <XIcons.IconInfo size={24} />
          <h2>{t('agentMarket.detail.notFound')}</h2>
        </div>
      </main>
    );
  }

  return (
    <main className="agent-detail-page">
      <button className="btn btn-sm agent-detail-back" onClick={() => navigate('agents')}>← {t('agentMarket.detail.back')}</button>
      <header className="agent-detail-hero">
        <div>
          <div className="micro">{agentRole(service, t)} · BNB Chain</div>
          <h1>{copy.name}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="agent-detail-proof card">
          <div><span>{t('agentMarket.detail.runtime')}</span><strong>Cloudflare WfP</strong></div>
          <div><span>{t('agentMarket.detail.mode')}</span><strong>{t('agentMarket.stateless')}</strong></div>
          <div><span>{t('agentMarket.detail.payment')}</span><strong>{t('agentMarket.perCall')}</strong></div>
          <div><span>{t('agentMarket.detail.safety')}</span><strong>{t('agentMarket.trust.readOnly')}</strong></div>
          {identity?.agentId && (
            <div>
              <span>{t('agentMarket.detail.erc8004')}</span>
              {identityUrl ? (
                <a
                  className="agent-detail-identity-link"
                  href={identityUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={t('agentMarket.detail.viewIdentity')}
                >
                  <strong>#{identity.agentId}</strong> <XIcons.IconExternal size={11} />
                </a>
              ) : <strong>#{identity.agentId}</strong>}
            </div>
          )}
          {identity?.walletAddress && (
            <div>
              <span>{t('agentMarket.detail.agentWallet')}</span>
              {walletUrl ? (
                <a
                  className="agent-detail-identity-link mono"
                  href={walletUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={`${t('agentMarket.detail.viewWallet')}: ${identity.walletAddress}`}
                >
                  <strong>{compactWalletAddress(identity.walletAddress)}</strong> <XIcons.IconExternal size={11} />
                </a>
              ) : (
                <strong className="mono" title={identity.walletAddress}>
                  {compactWalletAddress(identity.walletAddress)}
                </strong>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="agent-detail-layout">
        <section className="agent-config card">
          <div className="row between agent-config-heading">
            <div>
              <div className="micro">{t('agentMarket.detail.configureEyebrow')}</div>
              <h2>{t('agentMarket.detail.configure')}</h2>
            </div>
            <button className="btn btn-sm" type="button" onClick={() => {
              setValues(initialAgentValues(definition));
              setResponse(null);
              setError('');
            }}>{t('agentMarket.detail.resetDemo')}</button>
          </div>
          <p className="agent-config-note">{t('agentMarket.detail.demoNotice')}</p>
          <div className="agent-field-grid">
            {definition.fields.map((field) => (
              <label key={field.key} className={field.wide ? 'agent-field-wide' : ''}>
                <span>
                  {locale === 'zh' ? (ZH_FIELD_LABELS[field.key] || field.label) : field.label}
                  {field.required && <em className="agent-field-required" aria-hidden="true"> *</em>}
                </span>
                {field.type === 'select' ? (
                  <select
                    className="input"
                    value={displayValues[field.key] ?? ''}
                    required={field.required}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                  >
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {locale === 'zh' ? (option.zhLabel || option.label) : option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    className="input agent-prompt-input"
                    value={displayValues[field.key] ?? ''}
                    placeholder={fieldPlaceholder(field, locale)}
                    required={field.required}
                    maxLength={field.maxLength}
                    rows={4}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                  />
                ) : (
                  <input
                    className="input"
                    type={field.type}
                    min={field.min}
                    max={field.max}
                    value={displayValues[field.key] ?? ''}
                    placeholder={fieldPlaceholder(field, locale)}
                    required={field.required}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                  />
                )}
              </label>
            ))}
          </div>

          {error && <div className="agent-run-error"><XIcons.IconInfo size={14} /> {error}</div>}

          <div className="agent-run-footer">
            <div>
              <strong>{t('agentMarket.detail.oneRequest')}</strong>
              <span>{t('agentMarket.detail.noExecution')}</span>
            </div>
            {running ? (
              <button className="btn" type="button" onClick={() => abortRef.current?.abort()}>
                {t('agentMarket.detail.cancel')}
              </button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={runAgent}>
                <XIcons.IconZap size={13} /> {apiKey ? t('agentMarket.detail.run') : t('agentMarket.detail.setKey')}
              </button>
            )}
          </div>
        </section>

        <aside className="agent-execution card">
          <div className="micro">{t('agentMarket.detail.execution')}</div>
          <div className={`agent-execution-state ${running ? 'running' : ''}`}>
            <i />
            <strong>{running ? t('agentMarket.detail.running') : t('agentMarket.detail.ready')}</strong>
          </div>
          <ol>
            <li>{t('agentMarket.detail.step1')}</li>
            <li>{t('agentMarket.detail.step2')}</li>
            <li>{t('agentMarket.detail.step3')}</li>
          </ol>
          <p>{t('agentMarket.detail.executionNote')}</p>
        </aside>
      </div>

      {response && <AgentResult definition={definition} response={response} />}
    </main>
  );
};

export default AgentMarketPage;
