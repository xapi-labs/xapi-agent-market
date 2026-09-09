// wagmi config — single source of truth for chains, transports, and connectors.
//
// Connectors mirror xapi-new (main.tsx) plus an optional WalletConnect entry:
//   - injected()       → any browser-extension wallet (MetaMask, OKX, Rabby, Phantom EVM, …)
//                        Per EIP-6963 wagmi auto-discovers each installed wallet as a
//                        separate connector entry, so the picker UI shows them individually.
//   - coinbaseWallet() → Coinbase Wallet SDK (browser extension OR mobile via QR)
//   - walletConnect()  → mobile / standalone wallets that scan a QR code (only registered
//                        when VITE_WALLET_CONNECT_PROJECT_ID is set; otherwise omitted).
//
// Chains: Base (mainnet, x402 payment target) + BSC (matches xapi-new). Transports default
// to public RPC; for production swap http() to http('https://your-rpc.example/...').
import { createConfig, http } from 'wagmi';
import { base, bsc } from 'wagmi/chains';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';

const wcProjectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '';

const connectors = [
  injected(),
  coinbaseWallet({ appName: 'xAPI Agent Market' }),
];

if (wcProjectId) {
  connectors.push(walletConnect({
    projectId: wcProjectId,
    showQrModal: true,
    metadata: {
      name: 'xAPI',
      description: 'xAPI: API Platform for Agents',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://xapi.to',
      icons: ['https://xapi.to/fav.png'],
    },
  }));
}

export const wagmiConfig = createConfig({
  chains: [base, bsc],
  connectors,
  transports: {
    [base.id]: http(),
    [bsc.id]: http(),
  },
  // Wagmi defaults: ssr=false (we're SPA), multiInjectedProviderDiscovery=true (EIP-6963 on).
});
