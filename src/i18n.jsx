// Tiny i18n primitive — no library dependency. A flat dictionary keyed by dotted paths
// (e.g. "nav.discover"), plus a React context that exposes `t(key)` and `setLocale(lang)`.
// Selected locale persists to localStorage. Translations are sourced from xapi-new's
// i18n/locales/{en,zh}/* JSON files so technical-term phrasing stays consistent across the
// two frontends (Console / 控制台, Workspace / 工作区, etc.).
//
// To add a new key: drop the same path into both `en` and `zh` blocks below. To add a third
// locale: extend `LOCALES` and add a third block. The runtime falls back to `en` if a key
// is missing in the active locale, then to the literal key string.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react';

export const LOCALES = ['en', 'zh'];

const dict = {
  en: {
    'agentMarket.eyebrow': 'BNB Chain · Smart Money Era',
    'agentMarket.title': 'Find the right agent for every onchain decision.',
    'agentMarket.body':
      'Discover and call agents for rebalancing, grid trading, yield optimisation, and health-factor monitoring.',
    'agentMarket.trust.perCall': 'One request, one result',
    'agentMarket.trust.readOnly': 'Read-only tools',
    'agentMarket.trust.stateless': 'No retained conversation',
    'agentMarket.flow.label': 'Invocation flow',
    'agentMarket.flow.input': 'Provide intent and context',
    'agentMarket.flow.run': 'Agent reads approved data',
    'agentMarket.flow.result': 'Review the unsigned result',
    'agentMarket.catalog.eyebrow': 'Live catalog',
    'agentMarket.catalog.title': 'Choose an agent',
    'agentMarket.search': 'Search agents',
    'agentMarket.sort.label': 'Sort agents',
    'agentMarket.sort.popular': 'Most popular',
    'agentMarket.sort.new': 'Recently added',
    'agentMarket.role.rebalancing': 'Liquidity strategy',
    'agentMarket.role.grid': 'Trading strategy',
    'agentMarket.role.yield': 'Yield strategy',
    'agentMarket.role.health': 'Position risk',
    'agentMarket.role.general': 'Onchain agent',
    'agentMarket.live': 'LIVE',
    'agentMarket.stateless': 'Stateless',
    'agentMarket.billing': 'Billing',
    'agentMarket.perCall': 'Per call',
    'agentMarket.perToken': 'Per token',
    'agentMarket.calls': 'Calls',
    'agentMarket.open': 'Open agent',
    'agentMarket.descriptionFallback': 'A bounded onchain agent available through the xAPI gateway.',
    'agentMarket.empty.title': 'No agents are listed yet',
    'agentMarket.empty.body': 'Published Agent Studio deployments appear here after they are bound to an active Marketplace service.',
    'agentMarket.noMatch.title': 'No matching agents',
    'agentMarket.noMatch.body': 'Try a different name, task, or protocol.',
    'agentMarket.error.title': 'Agent catalog unavailable',
    'agentMarket.error.body': 'The marketplace could not be loaded. Please try again shortly.',
    'agentMarket.filter.label': 'Filter agent categories',
    'agentMarket.filter.all': 'All agents',
    'agentMarket.filter.rebalancing': 'Rebalancing',
    'agentMarket.filter.grid': 'Grid trading',
    'agentMarket.filter.yield': 'Yield optimisation',
    'agentMarket.filter.health': 'Health factor',
    'agentMarket.detail.back': 'Agent marketplace',
    'agentMarket.detail.notFound': 'This agent is not available.',
    'agentMarket.detail.loadError': 'The agent could not be loaded.',
    'agentMarket.detail.runError': 'The agent invocation failed.',
    'agentMarket.detail.walletInvalid': 'Enter a valid 0x EVM wallet address.',
    'agentMarket.detail.requiredFields': 'Complete the required fields',
    'agentMarket.detail.runtime': 'Runtime',
    'agentMarket.detail.mode': 'Execution',
    'agentMarket.detail.payment': 'Billing',
    'agentMarket.detail.safety': 'Fund access',
    'agentMarket.detail.erc8004': 'ERC-8004 identity',
    'agentMarket.detail.agentWallet': 'Agent wallet',
    'agentMarket.detail.viewIdentity': 'View ERC-8004 identity on BscScan',
    'agentMarket.detail.viewWallet': 'View agent wallet on BscScan',
    'agentMarket.detail.configureEyebrow': 'Activation context',
    'agentMarket.detail.configure': 'Configure this run',
    'agentMarket.detail.resetDemo': 'Reset sample',
    'agentMarket.detail.demoNotice': 'Required fields define the execution boundary. Use the prompt to express goals and preferences; live market and wallet facts are read through approved tools when available.',
    'agentMarket.detail.oneRequest': 'One isolated request',
    'agentMarket.detail.noExecution': 'The result is advisory and unsigned. No transaction is submitted.',
    'agentMarket.detail.run': 'Run agent',
    'agentMarket.detail.setKey': 'Set XAPI_KEY',
    'agentMarket.detail.cancel': 'Cancel',
    'agentMarket.detail.execution': 'What happens next',
    'agentMarket.detail.ready': 'Ready to analyse',
    'agentMarket.detail.running': 'Reading data and reasoning',
    'agentMarket.detail.step1': 'Validate the supplied strategy limits',
    'agentMarket.detail.step2': 'Read only the approved BNB Chain data',
    'agentMarket.detail.step3': 'Return a bounded, unsigned action plan',
    'agentMarket.detail.executionNote': 'Your xAPI key is sent only to the Marketplace Gateway. It is never forwarded to the Agent Worker or data providers.',
    'agentMarket.result.actions': 'Action plan',
    'agentMarket.result.eyebrow': 'Agent result',
    'agentMarket.result.missing': 'Missing information',
    'agentMarket.result.risks': 'Risk warnings',
    'agentMarket.result.assumptions': 'Assumptions',
    'agentMarket.result.raw': 'Raw response',

  },
  zh: {
    'agentMarket.eyebrow': 'BNB Chain · Smart Money Era',
    'agentMarket.title': '找到对的 Agent，做出更聪明的链上决策。',
    'agentMarket.body': '一站发现并调用再平衡、网格交易、收益优化与健康因子 Agent。',
    'agentMarket.trust.perCall': '一次请求，一次结果',
    'agentMarket.trust.readOnly': '只读工具',
    'agentMarket.trust.stateless': '不保留会话',
    'agentMarket.flow.label': '调用流程',
    'agentMarket.flow.input': '提供意图与上下文',
    'agentMarket.flow.run': 'Agent 查询授权数据',
    'agentMarket.flow.result': '审阅未签名结果',
    'agentMarket.catalog.eyebrow': '在线目录',
    'agentMarket.catalog.title': '选择一个 Agent',
    'agentMarket.search': '搜索 Agent',
    'agentMarket.sort.label': 'Agent 排序',
    'agentMarket.sort.popular': '最受欢迎',
    'agentMarket.sort.new': '最近添加',
    'agentMarket.role.rebalancing': '流动性策略',
    'agentMarket.role.grid': '交易策略',
    'agentMarket.role.yield': '收益策略',
    'agentMarket.role.health': '仓位风险',
    'agentMarket.role.general': '链上 Agent',
    'agentMarket.live': '在线',
    'agentMarket.stateless': '无状态',
    'agentMarket.billing': '计费方式',
    'agentMarket.perCall': '按次调用',
    'agentMarket.perToken': '按 Token',
    'agentMarket.calls': '调用量',
    'agentMarket.open': '打开 Agent',
    'agentMarket.descriptionFallback': '通过 xAPI 网关调用的受限链上 Agent。',
    'agentMarket.empty.title': '暂无已上架 Agent',
    'agentMarket.empty.body': 'Agent Studio 部署绑定到已激活的 Marketplace 服务后会显示在这里。',
    'agentMarket.noMatch.title': '没有匹配的 Agent',
    'agentMarket.noMatch.body': '请尝试其他名称、任务或协议关键词。',
    'agentMarket.error.title': 'Agent 目录暂不可用',
    'agentMarket.error.body': '市场数据加载失败，请稍后重试。',
    'agentMarket.filter.label': '筛选 Agent 类别',
    'agentMarket.filter.all': '全部 Agent',
    'agentMarket.filter.rebalancing': '流动性再平衡',
    'agentMarket.filter.grid': '网格交易',
    'agentMarket.filter.yield': '收益优化',
    'agentMarket.filter.health': '健康因子',
    'agentMarket.detail.back': 'Agent 市场',
    'agentMarket.detail.notFound': '这个 Agent 当前不可用。',
    'agentMarket.detail.loadError': 'Agent 加载失败。',
    'agentMarket.detail.runError': 'Agent 调用失败。',
    'agentMarket.detail.walletInvalid': '请输入有效的 0x EVM 钱包地址。',
    'agentMarket.detail.requiredFields': '请填写必填字段',
    'agentMarket.detail.runtime': '运行环境',
    'agentMarket.detail.mode': '执行方式',
    'agentMarket.detail.payment': '计费方式',
    'agentMarket.detail.safety': '资金权限',
    'agentMarket.detail.erc8004': 'ERC-8004 身份',
    'agentMarket.detail.agentWallet': 'Agent 钱包',
    'agentMarket.detail.viewIdentity': '在 BscScan 查看 ERC-8004 身份',
    'agentMarket.detail.viewWallet': '在 BscScan 查看 Agent 钱包',
    'agentMarket.detail.configureEyebrow': '激活上下文',
    'agentMarket.detail.configure': '配置本次运行',
    'agentMarket.detail.resetDemo': '重置示例',
    'agentMarket.detail.demoNotice': '必填字段定义本次执行边界；Prompt 用于表达目标与偏好。实时行情和钱包事实会在可用时通过授权的只读工具查询。',
    'agentMarket.detail.oneRequest': '一次独立请求',
    'agentMarket.detail.noExecution': '结果仅供参考且未签名，不会提交任何交易。',
    'agentMarket.detail.run': '运行 Agent',
    'agentMarket.detail.setKey': '设置 XAPI_KEY',
    'agentMarket.detail.cancel': '取消',
    'agentMarket.detail.execution': '接下来会发生什么',
    'agentMarket.detail.ready': '可以开始分析',
    'agentMarket.detail.running': '正在读取数据并分析',
    'agentMarket.detail.step1': '校验本次策略和风险限制',
    'agentMarket.detail.step2': '只读查询授权的 BNB Chain 数据',
    'agentMarket.detail.step3': '返回受限且未签名的行动方案',
    'agentMarket.detail.executionNote': '你的 xAPI Key 只发送到 Marketplace Gateway，不会转发给 Agent Worker 或数据提供方。',
    'agentMarket.result.actions': '行动方案',
    'agentMarket.result.eyebrow': 'Agent 结果',
    'agentMarket.result.missing': '缺少的信息',
    'agentMarket.result.risks': '风险提示',
    'agentMarket.result.assumptions': '分析假设',
    'agentMarket.result.raw': '原始响应',

  },
};

const STORAGE_KEY = 'xapi-agent-market.locale';

const detectInitialLocale = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LOCALES.includes(saved)) return saved;
  } catch {}
  // Browser language: zh-CN / zh-TW / zh → zh; everything else → en.
  if (
    typeof navigator !== 'undefined' &&
    navigator.language &&
    /^zh\b/i.test(navigator.language)
  )
    return 'zh';
  return 'en';
};

const I18nCtx = createContext(null);

export const I18nProvider = ({ children }) => {
  const [locale, setLocale] = useState(detectInitialLocale);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {}
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      // Optional 2nd arg `vars` does {placeholder} → value substitution.
      // Kept tiny on purpose — no plural rules, no ICU. If a string needs
      // pluralization, write two keys and pick at call site.
      t: (key, vars) => {
        const table = dict[locale] || dict.en;
        const raw =
          table[key] != null
            ? table[key]
            : dict.en[key] != null
              ? dict.en[key]
              : key;
        if (!vars) return raw;
        return raw.replace(/\{(\w+)\}/g, (_, name) =>
          vars[name] != null ? String(vars[name]) : `{${name}}`,
        );
      },
    }),
    [locale],
  );

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
};

export const useT = () => {
  const ctx = useContext(I18nCtx);
  if (!ctx) {
    // Allow `useT` outside a provider (returns identity) so primitives can call it without
    // forcing every test/render path through the provider. Real app always has the provider.
    return {
      locale: 'en',
      setLocale: () => {},
      t: (k, vars) => {
        const raw = dict.en[k] != null ? dict.en[k] : k;
        if (!vars) return raw;
        return raw.replace(/\{(\w+)\}/g, (_, name) =>
          vars[name] != null ? String(vars[name]) : `{${name}}`,
        );
      },
    };
  }
  return ctx;
};
