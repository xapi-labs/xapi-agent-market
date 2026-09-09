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

The interface defaults to English regardless of browser language. Users can switch between English and Chinese in the header; an explicit choice is remembered in this browser.

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

## Quick-start prompt for AI agents

Copy the following prompt into an AI assistant with HTTP and wallet tooling. Replace the final task with your own objective. Opening the marketplace requires no login; payment is needed only when invoking a paid Agent.

```text
You can use xAPI Agent Market to call four onchain analysis agents. Choose the
appropriate endpoint for my objective:

1. Grid Trading Agent
   POST https://agent-market-grid.p.test.xapi.to/x402
   Required input fields: pair, capital_asset, capital_quote, risk_profile.

2. Yield Optimisation Agent
   POST https://agent-market-yield.p.test.xapi.to/x402
   Required input fields: asset, amount, risk_profile.

3. Health Factor Monitoring Agent
   POST https://agent-market-health.p.test.xapi.to/x402
   Required input field: walletAddress.

4. Liquidity Rebalancing Agent
   POST https://agent-market-liquidity.p.test.xapi.to/x402
   Required input fields: pool, capital_amount, capital_asset.

REQUEST FORMAT
- Send POST with Content-Type: application/json.
- Use {"prompt":"The objective and constraints","input":{...agent parameters}}.
- These profiles analyze BNB Smart Chain. Set chainId to the string "56".
- risk_profile must be conservative, balanced, or aggressive.
- Use decimal strings for capital and amount fields, without currency symbols.
- Ask me for missing required inputs. Never invent wallet addresses, holdings,
  market prices, or evidence. Use only a public wallet address I provide.
- Never request, expose, or store a wallet private key or seed phrase.

PAYMENT AND AUTHENTICATION
- No login or account creation is required for wallet payment.
- First send the request without an API key or payment signature. On HTTP 402,
  decode the base64 JSON in PAYMENT-REQUIRED and inspect its accepts entries.
- Use only a network, asset, transfer method, and amount actually offered by
  that challenge. Do not assume that Base USDC is available or silently switch
  to another network or token.
- Present the selected network, token, exact amount, recipient, and any token
  approval or gas requirements. Obtain my confirmation before signing payment.
- x402 supports Base USDC; B402 supports the BSC stablecoin options advertised
  by the gateway. U/USD1 use EIP-3009; BSC USDT/USDC use Permit2 when the quote
  specifies permit2-exact. Follow the quote's transfer method.
- For Permit2, request only the approval needed for this call and wait for a
  successful approval receipt before signing the payment authorization.
- Use a compatible x402 v2 client and the connected wallet to create the
  payment payload. Preserve the challenge's resource verbatim, keep the original
  POST body unchanged, and retry the same HTTPS endpoint with the encoded
  PAYMENT-SIGNATURE header. The challenge's resource is signed metadata, not
  a URL to navigate to or a reason to downgrade the HTTP transport.
- If I explicitly provide an xAPI test-environment API key, you may instead
  send it in the xapi-key header to pay from account balance. Never send an
  API key and PAYMENT-SIGNATURE together. Keep credentials out of URLs and logs.
- If HTTP access or compatible wallet signing is unavailable, explain what
  is missing. Do not claim that an invocation or payment succeeded.
- Do not automatically pay again after a timeout, network error, or upstream
  failure. Check the available payment receipt and call status first.
- This is the xAPI test environment, but wallet payments use real mainnet funds.

RESULTS
- Parse the response JSON. If output is a JSON-encoded string, parse it again.
- HTTP 200 does not guarantee a complete plan. Inspect statuses such as ready,
  needs_input, and warning; report missing inputs and limitations explicitly.
- Summarize the findings, proposed actions, supporting evidence, assumptions,
  and risks in English unless I request another language.
- Decode PAYMENT-RESPONSE when present and report the settlement result and
  transaction identifier. Distinguish payment success from Agent success.
- Keep a local record of request parameters, returned results, and payment
  receipts using the available local storage. Do not store payment signatures
  or credentials. Reopening a saved result must never trigger another payment.
- These agents produce analysis and unsigned plans. Do not place orders,
  rebalance positions, or execute the proposed onchain actions. A confirmed
  call-fee payment does not authorize execution of the resulting strategy.

MY TASK
Build a neutral seven-day grid plan for WBNB/USDT on BNB Chain, with a capital
budget of 1,000 USDT and a balanced risk profile. Keep some capital in reserve.
Do not place any orders.
```

### Example request: Grid Trading Agent

Save this body as `grid-request.json`:

```json
{
  "prompt": "Build a neutral seven-day grid plan using current market evidence. Keep some capital in reserve and do not place any orders.",
  "input": {
    "chain": "BNB Smart Chain",
    "chainId": "56",
    "pair": "WBNB/USDT",
    "capital_asset": "USDT",
    "capital_quote": "1000",
    "risk_profile": "balanced"
  }
}
```

Request a payment challenge without logging in or signing a payment:

```sh
curl --include \
  --request POST \
  'https://agent-market-grid.p.test.xapi.to/x402' \
  --header 'Content-Type: application/json' \
  --data-binary @grid-request.json
```

An HTTP 402 response with `PAYMENT-REQUIRED` is the expected unpaid response. It contains the live quote; this command alone does not authorize payment or complete a paid invocation. Use the wallet flow above to sign and retry. In the web UI, completed results and payment receipts are saved in the current browser's local history, with up to 20 runs per Agent.

## Verification

`npm test` covers the inherited Agent definitions and BscScan identities, existing-key entry without login, generated-key copy/download gating, pending-key recovery, clipboard/storage/registration failures, removal, deep links, invocation headers, cancellation and untrusted gateway rejection.

The deployed site can be smoke-tested through `/xapi/api-services` and `/agents/grid-trading-agent`. Never commit real keys, downloads, browser storage or registration response payloads.

Initial deployment verification (2026-09-09): 25 tests passed, production build passed, homepage/deep link/catalog/detail returned HTTP 200, and the live catalog included four Agent Studio services. A single test registration returned HTTP 201; its returned key was used for a real Grid Trading Agent invocation through the deployed rewrite, returning HTTP 200. The agent returned `needs_input` with `verified_model_output` missing rather than an actionable plan. This is an upstream evidence-validation result, not a frontend or authentication failure. The smoke test placed no orders and submitted no blockchain transactions.
