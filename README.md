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

## Key entry

- An existing API key is trimmed and saved locally; entry does not validate it against an authentication endpoint. Invalid/revoked keys are reported by the gateway when an agent is called.
- Quick create calls xAPI `POST /api/auth/register` exactly once per click and uses only the returned API key. It does not call `/auth/login/apikey`, fetch `/auth/me`, or save access/refresh tokens.
- New keys are stored as pending until the user successfully copies them or starts a local `.txt` download, then explicitly enters. A refresh restores the pending key and still requires backup.
- `localStorage["xapi-agent-market.key.v1"]` is scoped to this site's origin. Users can change or remove it from the header. Clearing browser data removes the key.
- Agent invocations send the saved key as `xapi-key` to the matching xAPI gateway through a same-origin deployment rewrite. Keys are never included in URLs or catalog requests. Requests omit cookies.

## Deployment

Deploy this repository as a **new Vercel project** named `xapi-agent-market`, using the Vite preset, `npm run build` and `dist` output. Do not link it to the main xAPI frontend project.

```sh
vercel link --project xapi-agent-market
vercel --prod
```

The initial deployment uses **xAPI test**: `api.test.xapi.to` and the four `*.p.test.xapi.to` agent gateways. These agents were present in the test catalog and absent from production when extracted. The UI identifies this environment explicitly. Use a key from the test environment.

The current Vercel Hobby project is deployed through the CLI. Vercel rejected Git integration because this is an organization-owned private repository; pushing to GitHub does **not** automatically deploy. Run `vercel --prod` after pushing a validated update, or configure a supported deployment plan/integration separately.

External rewrites handle browser CORS without modifying the backend. Gateway rewrites are restricted to the four configured Agent hosts. To add another agent host, add its gateway rewrite. To promote to production, first verify the agents are available there, update the destinations in `vercel.json` and the environment label in `src/app.jsx`, rebuild and redeploy. Test and production keys are not interchangeable.

## Verification

`npm test` covers the inherited Agent definitions and BscScan identities, existing-key entry without login, generated-key copy/download gating, pending-key recovery, clipboard/storage/registration failures, removal, deep links, invocation headers, cancellation and untrusted gateway rejection.

The deployed site can be smoke-tested through `/xapi/api-services` and `/agents/grid-trading-agent`. Never commit real keys, downloads, browser storage or registration response payloads.

Initial deployment verification (2026-09-09): 25 tests passed, production build passed, homepage/deep link/catalog/detail returned HTTP 200, and the live catalog included four Agent Studio services. A single test registration returned HTTP 201; its returned key was used for a real Grid Trading Agent invocation through the deployed rewrite, returning HTTP 200. The agent returned `needs_input` with `verified_model_output` missing rather than an actionable plan. This is an upstream evidence-validation result, not a frontend or authentication failure. The smoke test placed no orders and submitted no blockchain transactions.
