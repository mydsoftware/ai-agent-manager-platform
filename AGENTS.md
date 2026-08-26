# AGENTS.md — Project Memory

## Product Vision (مدیریت ایجنت)
Platform where a customer submits a Persian request (e.g., «سایت در زمینه ماهواره مرکزی میخوام»):
1. Orchestrator searches existing specialist agents (keyword/specialty matching)
2. If none match → LLM generates a NEW specialist agent (name/prompt/keywords/tools) and registers it
3. Runs ReAct agentic loop (tools + memory)
4. Quality loop: LLM-as-Judge + deterministic HTML validation → issues feed next cycle until pass or max cycles
5. Site-builder agents save HTML via `save_page` → public preview link `/api/pages/:slug`
NOT a marketplace — selling agents between users was removed by owner decision.
Core specialists seeded per tenant: seo / webdev (سایت‌ساز) / wordpress / programming. All have agentic loops. Seeds auto-refresh on boot (prompts/tools).

## Owner & Accounts
- GitHub repo: mydsoftware/ai-agent-manager-platform (owner communicates in Persian/Farsi)
- Admin promotion ONLY via `ADMIN_EMAILS` env at register time (hardcoded email removed)
- Free tier: tenant starts with 100 credits; 1000 IRR = 1 credit

## Architecture (flat app, no monorepo)
- `api/index.ts` — Hono app, basePath `/api`, all routes (auth JWT/bcrypt, agents CRUD raw-SQL insert, orchestrator, billing, api-keys x-api-key auth, pages preview, admin)
- `api/runtime.ts` — metered runs: atomic credit RESERVE before LLM (`updateMany credits >= X`), settle/refund after; never negative
- `api/orchestrator.ts` — matching (MATCH_THRESHOLD=0.34), generateSpecialist, ensureSpecialistSeeds (upsert), quality loop combining verifyOutput + validateHtml
- `api/pages.ts` — GeneratedPage storage, extractHtml (fenced/bare), validateHtml (23 balanced tags + doctype/head/body/title), pageDb client
- `api/tools.ts` — registry: json_echo, current_time, web_search, save_page, html_validate
- `api/billing.ts` — stub gateway only outside production (`PAYMENT_STUB_AUTO_SUCCESS=true`); real gateway adapter pending domain
- `api/server.ts` — Node server serves API + static ./public (single-origin self-host)
- `public/dashboard.html` — full RTL dashboard SPA (tabs: overview, orchestrator SSE, specialists, pages, agents+runs+memory, live run SSE, billing, api keys, tools, settings w/ API base switch). `config.js` reads localStorage `aam_api_base`
- Prisma schema single source: `prisma/schema.prisma`; migrations hand-written SQL in prisma/migrations/
- Deploy targets: Vercel (outputDirectory public + db push packages/db→root schema FIXED, uses root now), Render (build also runs db push), GitHub Pages (pages.yml deploys ./public)

## Critical Conventions
- Credits: reserve BEFORE any LLM call; settle = max(1, ceil(tokens/1000)); overage clamps via GREATEST(0,...)
- Streaming endpoints MUST persist AgentRun + deduct credits (openMeteredRun)
- JWT fail-closed in production; dev fallback secret only when NODE_ENV!=production
- Rate limits are in-memory (fine for MVP; Redis listed as future work)
- After ANY schema change: run `npx prisma generate --schema prisma/schema.prisma` (needs placeholder DATABASE_URL set) then typecheck

## ⚠️ Gotchas
- NEVER edit files via PowerShell Get-Content/Set-Content — it corrupts UTF-8 Persian text (mojibake). Use file Edit tools or git checkout restore.
- PowerShell 5.1: no `&&`, use `if ($?) {}`. `gh` needs PATH refresh: `$env:Path=[System.Environment]::GetEnvironmentVariable("Path","Machine")+";"+[System.Environment]::GetEnvironmentVariable("Path","User")`
- Stray node processes hold port/DLL on Windows: kill before re-running server/prisma generate
- CI requires `npm ci` lockfile (package-lock.json committed); test:security script must exist
- Tests: vitest, 39 passing. tsconfig covers api/**+tests/** only

## Env Vars (see .env.example)
DATABASE_URL · JWT_SECRET · ADMIN_EMAILS · CORS_ORIGINS · OPENAI_API_KEY/OPENROUTER_API_KEY/LLM_* · SEARCH_API_URL/KEY · PAYMENT_PROVIDER(=stub) · PAYMENT_STUB_AUTO_SUCCESS

## Roadmap (agreed order)
1. Real payment gateway adapter after domain purchase (Zarinpal-style redirect/callback into PAYMENT_PROVIDER)
2. Distributed rate limit (Upstash Redis) for serverless
3. Email verification + password reset + stronger password policy
4. More real tools: code execution/screenshot for webdev, WordPress deploy, real SEO analysis
5. Platform commission model if selling returns
6. Replace tautological security tests with real DB integration tests (docker-compose exists)

## Status @ 2026-08-26
All P0 done (security+billing stub+metering+api-key auth), marketplace built then REMOVED per pivot, orchestrator live, site tools live, full dashboard deployed. CI green (3 workflows). Pages live: https://mydsoftware.github.io/ai-agent-manager-platform/
