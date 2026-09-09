# xAPI Agent Market

Independent React + Vite frontend extracted from the latest `xapi-frontend-v2/dev`. See [SOURCE.md](SOURCE.md) for the exact source commit. This repository has its own entry point, dependencies, key storage and deployment; it does not import or deploy the xAPI console.

Live site: https://xapi-agent-market.vercel.app

Private repository: https://github.com/xapi-labs/xapi-agent-market

## Run

```sh
npm ci
npm run dev
npm test
npm run build
```

The local site runs at `http://localhost:5178`. `vercel.json` is the single source of truth for upstream routing, also consumed by the Vite development proxy and the gateway host allowlist. No API keys or other secrets belong in build configuration.

## Optional API key

The home page and Agent deep links open directly, without login, registration, a wallet connection, or an API key. An API key is optional and is configured only when the user explicitly opens `/key`. Missing, pending, invalid local storage, or removed keys never block browsing. Calls without an API key default to B402 wallet payment.

- An existing API key is trimmed and saved locally; entry does not validate it against an authentication endpoint. Invalid/revoked keys are reported by the gateway when an agent is called.
- Quick create calls xAPI `POST /api/auth/register` exactly once per click and uses only the returned API key. It does not call `/auth/login/apikey`, fetch `/auth/me`, or save access/refresh tokens.
- New keys are stored as pending until the user successfully copies them or starts a local `.txt` download, then explicitly enters. A refresh restores the pending key and still requires backup.
- `localStorage["xapi-agent-market.key.v1"]` is scoped to this site's origin. The header has no API key or login controls. Clearing browser data removes the key.
- Agent invocations send the saved key as `xapi-key` to the matching xAPI gateway through a same-origin deployment rewrite. Keys are never included in URLs or catalog requests. Requests omit cookies.

## Deployment

Completed calls are stored in `localStorage` under `xapi-agent-market.runs.v1:<agent-id>`, with the latest 20 runs per Agent. Inputs, returned bodies and payment receipts restore on refresh; the result selector can reopen older runs. Restoring never invokes an Agent or signs/pays again. Request credentials and payment signatures are excluded. A storage error leaves the result visible and warns the user; an unsuccessful write preserves previously saved records. History is local to this browser and origin and is removed when site data is cleared.

Deploy this repository as a **new Vercel project** named `xapi-agent-market`, using the Vite preset, `npm run build` and `dist` output. Do not link it to the main xAPI frontend project.

```sh
vercel link --project xapi-agent-market
vercel --prod
```

The initial deployment uses **xAPI test**: `api.test.xapi.to` and the four `*.p.test.xapi.to` agent gateways. These agents were present in the test catalog and absent from production when extracted. The UI identifies this environment explicitly. Use a key from the test environment.

The current Vercel Hobby project is deployed through the CLI. Vercel rejected Git integration because this is an organization-owned private repository; pushing to GitHub does **not** automatically deploy. Run `vercel --prod` after pushing a validated update, or configure a supported deployment plan/integration separately.

External rewrites handle browser CORS without modifying the backend. Gateway rewrites are restricted to the four configured Agent hosts. To add another agent host, add its gateway rewrite. To promote to production, first verify the agents are available there, update the destinations in `vercel.json` and the environment label in `src/app.jsx`, rebuild and redeploy. Test and production keys are not interchangeable.

Agent invocations now target the published relay services below. Existing catalog identities and page links use the same routes, and both original and relay hosts are accepted by the gateway allowlist. The browser's saved key is sent as `xapi-key`.

| Agent | POST endpoint |
|---|---|
| Grid trading | `https://agent-market-grid.p.test.xapi.to/x402` |
| Yield optimisation | `https://agent-market-yield.p.test.xapi.to/x402` |
| Health factor | `https://agent-market-health.p.test.xapi.to/x402` |
| Liquidity rebalancing | `https://agent-market-liquidity.p.test.xapi.to/x402` |

### Wallet payments

Users open the market directly, then choose API Key, x402 (Base USDC), or B402 (BSC U/USD1/USDT/USDC) on the Agent page. Wallet support is lazy-loaded and adapts `xapi-frontend-v2/src/wallet.js` and its wagmi connector configuration. Optional mobile WalletConnect requires `VITE_WALLET_CONNECT_PROJECT_ID`; browser extensions and Coinbase Wallet are configured by default.

The wallet flow requests a live `PAYMENT-REQUIRED` quote without credentials, shows the exact asset/amount/recipient, and signs only after the user confirms. It preserves the quoted JSON body and resource when retrying once with `PAYMENT-SIGNATURE`. API key and payment signature are never combined, no automatic balance fallback runs, and a failed paid request is never automatically paid again. B402 Permit2 approval uses the call amount (not a blanket approval); approval receipts must succeed before signing. Payment receipts are shown when supplied by the gateway.

The xAPI environment is test, but wallet assets are **mainnet funds**. Live checks on 2026-09-09 returned B402 quotes for all four endpoints (0.1 token) and no Base USDC option. Base support is implemented and remains unavailable until the gateway advertises it; the client never silently substitutes another network or token. Signed payload creation is tested with mocked wallet actions; no real wallet payment was made during development.

## Verification

`npm test` covers the inherited Agent definitions and BscScan identities, existing-key entry without login, generated-key copy/download gating, pending-key recovery, clipboard/storage/registration failures, removal, deep links, invocation headers, cancellation and untrusted gateway rejection.

The deployed site can be smoke-tested through `/xapi/api-services` and `/agents/grid-trading-agent`. Never commit real keys, downloads, browser storage or registration response payloads.

Initial deployment verification (2026-09-09): 25 tests passed, production build passed, homepage/deep link/catalog/detail returned HTTP 200, and the live catalog included four Agent Studio services. A single test registration returned HTTP 201; its returned key was used for a real Grid Trading Agent invocation through the deployed rewrite, returning HTTP 200. The agent returned `needs_input` with `verified_model_output` missing rather than an actionable plan. This is an upstream evidence-validation result, not a frontend or authentication failure. The smoke test placed no orders and submitted no blockchain transactions.
