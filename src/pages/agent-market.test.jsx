import { describe, expect, it } from 'vitest';
import {
  agentIdentity,
  agentResultSummary,
  bscScanAgentIdentityUrl,
  bscScanAgentWalletUrl,
  buildAgentInvocationBody,
  compactWalletAddress,
  initialAgentValues,
  isAgentMarketService,
  missingRequiredAgentFields,
  parseAgentOutput,
  resolveAgentDefinition,
} from './agent-market.jsx';

describe('Agent Marketplace service classification', () => {
  it('prefers explicit backend Agent Studio markers', () => {
    expect(isAgentMarketService({ name: 'Worker', isAgentStudioService: true })).toBe(true);
    expect(isAgentMarketService({ name: 'Worker', agentStudioDeployment: { id: 'deployment-1' } })).toBe(true);
  });

  it('accepts agent categories and protocol tags', () => {
    expect(isAgentMarketService({ category: 'Agents' })).toBe(true);
    expect(isAgentMarketService({ tags: ['crypto', 'a2a'] })).toBe(true);
    expect(isAgentMarketService({ tags: ['agent-studio'] })).toBe(true);
  });

  it('keeps legacy competition services visible by their Agent suffix', () => {
    expect(isAgentMarketService({ name: 'Liquidity Rebalancing Agent', category: 'Crypto', tags: null })).toBe(true);
    expect(isAgentMarketService({ name: 'Health Factor Monitoring Agent', category: 'Crypto' })).toBe(true);
  });

  it('does not classify ordinary marketplace APIs as agents', () => {
    expect(isAgentMarketService({ name: 'Binance Web3 API', category: 'Crypto' })).toBe(false);
    expect(isAgentMarketService({ name: 'Agentic Search API', category: 'Search' })).toBe(false);
    expect(isAgentMarketService(null)).toBe(false);
  });
});

describe('Agent Marketplace activation helpers', () => {
  it('renders the ERC-8004 identity supplied by the serving deployment', () => {
    const walletAddress = '0x91eFa0F254239bC367DDE38F5ac9cF6F3b0AAC82';
    const service = {
      agent: {
        walletAddress,
        network: 'bsc-mainnet',
        erc8004: {
          agentId: '341284',
          agentRegistry: 'eip155:56:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
          network: 'bsc-mainnet',
          agentWalletAddress: walletAddress,
        },
      },
    };

    expect(agentIdentity(service)).toEqual({
      agentId: '341284',
      agentRegistry: 'eip155:56:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      walletAddress,
      network: 'bsc-mainnet',
    });
    expect(compactWalletAddress(walletAddress)).toBe('0x91eFa0…0AAC82');
    expect(bscScanAgentIdentityUrl(agentIdentity(service))).toBe(
      'https://bscscan.com/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/341284',
    );
    expect(bscScanAgentWalletUrl(agentIdentity(service))).toBe(
      `https://bscscan.com/address/${walletAddress}`,
    );
  });

  it('rejects malformed or unsupported identity links', () => {
    expect(bscScanAgentIdentityUrl({
      agentId: '../341284',
      agentRegistry: 'eip155:56:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      network: 'bsc-mainnet',
    })).toBe('');
    expect(bscScanAgentIdentityUrl({
      agentId: '341284',
      agentRegistry: 'eip155:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      network: 'ethereum-mainnet',
    })).toBe('');
    expect(bscScanAgentWalletUrl({
      walletAddress: 'javascript:alert(1)',
      network: 'bsc-mainnet',
    })).toBe('');
  });

  it('resolves each competition service from its gateway host', () => {
    expect(resolveAgentDefinition({ host: 'liquidity-rebalancing-agent.p.test.xapi.to' })?.kind).toBe('rebalancing');
    expect(resolveAgentDefinition({ host: 'grid-trading-agent.p.test.xapi.to' })?.kind).toBe('grid');
    expect(resolveAgentDefinition({ host: 'yield-optimisation-agent.p.test.xapi.to' })?.kind).toBe('yield');
    expect(resolveAgentDefinition({ host: 'health-factor-monitoring-agent.p.test.xapi.to' })?.kind).toBe('health');
  });

  it('builds a canonical BSC structured input from the guided form', () => {
    const definition = resolveAgentDefinition('grid-trading-agent');
    const input = definition.build(initialAgentValues(definition));

    expect(input).toMatchObject({
      chain: 'BNB Smart Chain',
      chainId: '56',
      venue: 'PancakeSwap v3',
      pair: 'WBNB / USDT',
      baseTokenAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      quoteTokenAddress: '0x55d398326f99059fF775485246999027B3197955',
      capital_asset: 'USDT',
      capital_quote: '1000',
      risk_profile: 'balanced',
    });
    expect(input).not.toHaveProperty('walletAddress');
    expect(input).not.toHaveProperty('current_price');
    expect(input).not.toHaveProperty('objective');
  });

  it('sends fixed parameters and the editable prompt as separate fields', () => {
    const definition = resolveAgentDefinition('grid-trading-agent');
    const values = initialAgentValues(definition);

    expect(buildAgentInvocationBody(definition, values)).toEqual({
      input: expect.not.objectContaining({ objective: expect.anything() }),
      prompt: values.objective,
    });
  });

  it('uses required fixed fields plus a prompt for every guided agent', () => {
    const expectedRequired = {
      'grid-trading-agent': ['pair', 'capital_asset', 'capital_quote', 'risk_profile', 'objective'],
      'yield-optimisation-agent': ['asset', 'amount', 'risk_profile', 'objective'],
      'liquidity-rebalancing-agent': ['pool', 'capital_amount', 'capital_asset', 'objective'],
      'health-factor-monitoring-agent': ['walletAddress', 'objective'],
    };

    for (const [slug, keys] of Object.entries(expectedRequired)) {
      const definition = resolveAgentDefinition(slug);
      expect(definition.fields.filter((field) => field.required).map((field) => field.key)).toEqual(keys);
      expect(definition.fields.some((field) => field.key === 'objective' && field.type === 'textarea')).toBe(true);
    }
  });

  it('reports missing required values before invoking the gateway', () => {
    const definition = resolveAgentDefinition('health-factor-monitoring-agent');
    const values = initialAgentValues(definition);

    expect(missingRequiredAgentFields(definition, values).map((field) => field.key)).toEqual(['walletAddress']);
    expect(missingRequiredAgentFields(definition, {
      ...values,
      walletAddress: '0x000000000000000000000000000000000000dEaD',
    })).toEqual([]);
  });

  it('unwraps the Worker output instead of showing a second JSON string', () => {
    expect(parseAgentOutput({
      agent: 'grid-trading',
      output: '{"status":"ready","orders":[{"side":"buy"}]}',
      invocationId: 'inv-1',
    })).toEqual({ status: 'ready', orders: [{ side: 'buy' }] });
  });

  it('keeps non-JSON model output inspectable', () => {
    expect(parseAgentOutput({ output: 'upstream returned text' })).toEqual({ raw: 'upstream returned text' });
  });

  it('builds category-specific result summaries', () => {
    const definition = resolveAgentDefinition('health-factor-monitoring-agent');
    expect(agentResultSummary(definition, {
      computed: { health_factor: '1.42', collateral_usd: '5000', debt_usd: '2500' },
      stress_tests: [{ collateral_drawdown_pct: 20 }],
    })).toEqual([
      ['Health factor', '1.42'],
      ['Collateral', '5000'],
      ['Debt', '2500'],
      ['Stress cases', 1],
    ]);
  });
});
