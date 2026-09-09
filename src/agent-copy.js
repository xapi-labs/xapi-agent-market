// Localized product copy for the four curated agents. Other catalog entries
// retain their provider-supplied name and description.
export const AGENT_COPY = {
  grid: {
    en: { name: 'Grid Trading Agent', description: 'Build an unsigned grid-order plan from market data and your risk limits.', prompt: 'Build a neutral seven-day grid using live market evidence and do not place any orders.' },
    zh: { name: '网格交易 Agent', description: '结合市场行情与风险限制，生成有明确边界的网格订单方案，不签名或执行交易。', prompt: '根据实时市场数据制定中性的七天网格策略，不下单或执行任何交易。' },
  },
  yield: {
    en: { name: 'Yield Optimisation Agent', description: 'Compare DeFi opportunities and plan liquidity allocation around your risk preferences.', prompt: 'Find durable BNB Chain yield while retaining daily liquidity.' },
    zh: { name: '收益优化 Agent', description: '比较 DeFi 收益机会，根据风险偏好规划资金分配，在收益与流动性之间取得平衡。', prompt: '寻找 BNB Chain 上可持续的收益机会，同时保留日常流动性。' },
  },
  health: {
    en: { name: 'Health Factor Monitoring Agent', description: 'Assess lending-position health and review an unsigned plan to reduce liquidation risk.', prompt: 'Assess liquidation risk and show the smallest unsigned mitigation that raises the health factor above 1.80.' },
    zh: { name: '健康因子监控 Agent', description: '分析借贷仓位的健康状况与清算风险，提供未签名的风险缓解方案。', prompt: '评估清算风险，给出将健康因子提高到 1.80 以上所需的最小调整方案，不签名或执行交易。' },
  },
  rebalancing: {
    en: { name: 'Liquidity Rebalancing Agent', description: 'Plan concentrated-liquidity ranges and rebalancing while accounting for your risk limits.', prompt: 'Propose a balanced concentrated-liquidity range and keep enough capital outside the position for gas and re-entry.' },
    zh: { name: '流动性再平衡 Agent', description: '结合风险限制规划集中流动性区间与仓位调整，预留 Gas 和再次入场所需资金。', prompt: '建议均衡的集中流动性区间，并在仓位之外预留足够资金用于 Gas 和再次入场。' },
  },
};

export function agentCopy(service, definition, locale) {
  return AGENT_COPY[definition?.kind]?.[locale] || {
    name: service?.name || definition?.title || '',
    description: service?.description || '',
  };
}

// Translate only untouched example prompts; preserve all user-authored input.
export function localizedAgentValues(definition, values, locale) {
  const copy = AGENT_COPY[definition?.kind];
  if (!copy || ![copy.en.prompt, copy.zh.prompt].includes(values.objective)) return values;
  return { ...values, objective: copy[locale]?.prompt || copy.en.prompt };
}

const ZH_PLACEHOLDERS = {
  'e.g. 1000 USDT supplied on Venus': '例如：在 Venus 存入 1000 USDT',
  'Optional, e.g. Venus': '选填，例如 Venus',
  'Optional, e.g. WBNB': '选填，例如 WBNB',
};
export const fieldPlaceholder = (field, locale) => locale === 'zh'
  ? ZH_PLACEHOLDERS[field.placeholder] || field.placeholder
  : field.placeholder;

export function resultStatus(status = 'complete', locale) {
  const labels = {
    complete: ['Complete', '已完成'],
    completed: ['Complete', '已完成'],
    success: ['Complete', '已完成'],
    needs_input: ['More information needed', '需要补充信息'],
    blocked: ['Unable to proceed', '暂时无法继续'],
    error: ['Run failed', '运行失败'],
  };
  return labels[status]?.[locale === 'zh' ? 1 : 0] || status;
}
