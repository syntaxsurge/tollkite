After you finish each task, please provide a one-line GitHub commit message that
I can use to manually commit the changes you made. Keep the message focused only
on your changes from my latest prompt and your response, since I’ll be working
on this repository with multiple AI agents. When creating the commit message,
don’t rely on git diff or porcelain commands; instead, rely on my latest prompt
and your latest response to create the best commit message.

# Agent Playbook (Living Document)

This file is the authoritative reference for platform architecture and agent
expectations. It must always describe the current, production-ready state of the
system—never legacy behavior. Update this file alongside any material feature
change. Only capture structural, user-visible, or integration-impacting details;
omit trivia. When we remove/replace something, like a feature, I DO NOT want you
to document the removal or replacement here, but instead, if that feature is
documented here currently, I want you to just remove it if we done removal and
replace it with teh new feature if we did replacement. The reason is that I only
want to support latest versions of my application here without documenting the
previous iterations, this file should serve as the current machination
explanation of my codebase and not for changelogs. If any previous version
explanation is present here, then it should be removed. Do not also imply that
we just implemented a certain feature here, by using words like "we now have
this X feature" since I only want to imply that the features we have iin our
application was in here already initially, without any implications of the new
changes we made.

## Documentation Expectations

- Update this document whenever routes, flows, data contracts, or integration
  requirements change.
- Describe the latest behavior succinctly; avoid references to prior
  implementations.
- Skip minor cosmetic tweaks—limit entries to structural or behavioral updates
  that affect future engineering work.

## Engineering Principles

1. **Import cleanly, delete legacy.** Never add re‑exports or preserve legacy
   APIs. Always import from canonical sources and remove unused branches, empty
   blocks, or deprecated files during every change.

2. **Extend before you create.** Before writing new functions, components, or
   libraries, analyze existing ones in `src/lib`, shared UI, and feature
   modules. Check related files for possible extension points—props, return
   types, or configuration options. Prefer enhancing them by adding parameters
   or return variants rather than duplicating logic. Only build something new
   when there’s _no existing code_ that can be extended without harm.

3. **Simplify through reuse.** If you or the AI analysis discover that a piece
   of code can be simplified by calling an existing component, function, or
   library instead of re‑implementing logic, refactor it. Merge redundant
   utilities or components when their behavior overlaps and eliminate
   unnecessary abstractions. The codebase should always converge toward fewer,
   more capable building blocks.

4. **Be minimal and accessible.** All new pages and components should follow the
   modern, minimal UI style—clean, responsive, and accessible (ARIA labels,
   focus states, keyboard navigation, color contrast). Avoid over‑engineering or
   speculative flexibility.

5. **Type‑sound and consistent.** Run `pnpm typecheck` before merging. Maintain
   consistent naming, small API surfaces, and clear defaults. Remove unused
   files and ensure new or extended helpers live in canonical locations to
   encourage immediate reuse.

### Examples

- Instead of creating `formatDate2`, extend `formatDate` with
  `options: { locale?: string; format?: string }`.
- Replace custom loaders with an existing `Spinner` component configured via
  props rather than duplicating markup.
- If two button variants differ only in color and spacing, merge them into one
  component with configurable variants.
- When adding a new fetch utility, inspect existing APIs—if a related
  `fetchData` exists, add optional parameters or expand return types instead of
  building another function.

### Guiding Mindset

Analyze → Extend → Simplify → Delete. Every change should either improve
clarity, reduce duplication, or enable reuse. Only create new code when
absolutely necessary and back it with clear reasoning in the PR description.

# Next.js 15 App Router Project Structure Guide

You are an AI coding assistant that builds **production-grade, scalable Next.js
15 App Router** applications.

When creating or editing a project, assume this blueprint as the default unless
explicitly told otherwise:

- Use **Next.js 15** with the **App Router** under `src/app`.
- Use **TypeScript** everywhere (`.ts`, `.tsx`).
- Use a **`src/`-based layout**: application code under `src`, configuration at
  the project root.
- Treat components in `app/` as **Server Components by default**; add
  `"use client"` only when necessary.
- Use **`middleware.ts`** at `src/middleware.ts` to run logic before a request
  is completed (auth, redirects, rewrites, logging).
- Manage environment variables with **workspace-scoped `.env` files**:
  - Root `.env.local` / `.env.*` for the Next.js app and cross-cutting services.
  - `blockchain/.env` for Hardhat deployment secrets, with
    `blockchain/.env.example` as a template.
- Use **Convex** as the off-chain backend stack.
- Support a **Hardhat blockchain workspace** under `blockchain/` with a
  configured EVM-network `SubscriptionManager.sol` as the canonical Solidity
  contract and frontend subscription helpers in `src/lib/contracts/`.
- Keep **caching explicit** in Next.js 15:
  - `GET` Route Handlers are **not cached by default**.
  - `fetch` is **`no-store` by default** in many server contexts.
  - Opt into caching via route segment config (`dynamic`, `revalidate`, etc.)
    and `fetch` options.
  - Centralize caching decisions in a small number of modules instead of
    scattering them.

Everything below defines **where to place each file**, **what belongs in each
folder**, and **how to avoid redundant files**.

---

## 1. Target Project Tree (Baseline Template)

Use this as the **default template**. Extend or trim as needed. Folders marked
`# OPTIONAL` are add-ons.

```txt
.
├─ public/
│  ├─ favicon.ico
│  ├─ icons/
│  └─ images/
├─ blockchain/                   # OPTIONAL: smart-contract workspace (only if using blockchain)
│  ├─ .env.example               # Template for blockchain/.env (Hardhat secrets)
│  ├─ contracts/
│  │  └─ SubscriptionManager.sol # Source of truth for paid plans
│  ├─ scripts/
│  │  └─ deploySubscriptionManager.ts
│  ├─ hardhat.config.ts
│  ├─ package.json
│  ├─ artifacts/                 # generated (gitignored)
│  └─ cache/                     # generated (gitignored)
├─ convex/                       # Convex backend (schema + functions)
│  ├─ schema.ts
│  ├─ functions/
│  └─ auth/
├─ scripts/                      # One-off CLIs and dev helpers
│  ├─ convex-dev.cjs             # Starts Convex dev server
│  ├─ disable-sentry.cjs         # Disables Sentry for local/dev builds
│  └─ reset-convex.ts            # Resets Convex tables via admin mutation
├─ infra/                        # IaC: Terraform/Pulumi/Docker/etc.
├─ docs/                         # Architecture docs, ADRs, runbooks
├─ e2e/                          # Playwright/Cypress tests
├─ .github/
│  └─ workflows/                 # CI/CD pipelines
├─ .gitignore                    # Git ignore rules
├─ package.json
├─ next.config.js                # Next.js config
├─ tsconfig.json                 # TypeScript config
├─ postcss.config.js             # PostCSS/Tailwind pipeline
├─ tailwind.config.ts            # Tailwind theme (if used)
├─ .eslintrc.json                # ESLint config
├─ .env.example                  # Documented root env variables (Next.js + services)
├─ next-env.d.ts                 # Generated by Next
└─ src/
   ├─ app/
   │  ├─ (marketing)/            # Marketing / public routes
   │  │  ├─ layout.tsx
   │  │  ├─ page.tsx
   │  │  └─ ...
   │  ├─ (app)/                  # Authenticated workspace routes
   │  │  ├─ layout.tsx
   │  │  ├─ dashboard/
   │  │  │  ├─ page.tsx
   │  │  │  └─ components/
   │  │  └─ settings/
   │  │     ├─ page.tsx
   │  │     └─ components/
   │  ├─ (auth)/                 # Sign-in / sign-up / reset flows
   │  │  ├─ layout.tsx
   │  │  ├─ sign-in/
   │  │  │  └─ page.tsx
   │  │  └─ sign-up/
   │  │     └─ page.tsx
   │  ├─ api/                    # Route Handlers (server-only endpoints)
   │  │  ├─ auth/
   │  │  │  └─ route.ts
   │  │  ├─ webhooks/
   │  │  │  └─ route.ts
   │  │  └─ health/
   │  │     └─ route.ts
   │  ├─ layout.tsx              # Root layout (wraps entire app)
   │  ├─ page.tsx                # "/" route (usually marketing home)
   │  ├─ loading.tsx             # Root loading UI
   │  ├─ error.tsx               # Root segment error boundary
   │  ├─ global-error.tsx        # Global error boundary
   │  ├─ not-found.tsx           # 404 for App Router
   │  ├─ manifest.ts             # Dynamic web app manifest
   │  ├─ sitemap.ts              # Dynamic sitemap
   │  └─ robots.ts               # Dynamic robots.txt
   ├─ components/                # Cross-route, reusable UI
   │  ├─ ui/                     # Design-system primitives (Button, Input, Dialog)
   │  ├─ layout/                 # Shells, navbars, sidebars, footers
   │  ├─ data-display/           # Charts, tables, cards, lists
   │  ├─ feedback/               # Toasts, alerts, skeletons, spinners
   │  └─ form/                   # Reusable form controls & wrappers
   ├─ features/                  # Vertical domain slices
   │  └─ <feature>/
   │     ├─ components/          # Feature-specific UI (forms, panels, modals)
   │     ├─ hooks/               # Feature hooks
   │     ├─ services/            # Feature data access & orchestration
   │     ├─ state/               # Feature-level stores
   │     ├─ types/               # Feature-only types
   │     └─ tests/               # Feature tests (if not colocated)
   ├─ hooks/                     # Shared hooks reusable across features/routes
   ├─ lib/                       # Framework-agnostic helpers & integrations
   │  ├─ api/                    # Fetch clients, server actions, API SDKs
   │  ├─ auth/                   # Auth/session helpers, guards
   │  ├─ cache/                  # Caching helpers, cache tags
   │  ├─ config/                 # Runtime config builders/constants
   │  ├─ db/                     # Convex client adapters
   │  │  └─ convex/
   │  │     └─ client.ts
   │  ├─ contracts/              # OPTIONAL: frontend smart-contract integration
   │  │  ├─ abi/                 # ABI JSON files imported by the frontend
   │  │  ├─ clients/             # Typed contract clients (viem/wagmi/ethers)
   │  │  └─ addresses.ts         # Chain → contract address mapping
   │  ├─ env/                    # Zod-validated environment variables
   │  ├─ observability/          # Logging, tracing, metrics
   │  ├─ queue/                  # Background job clients
   │  ├─ security/               # Crypto, permissions, rate limiting
   │  ├─ storage/                # File/object storage adapters
   │  ├─ utils/                  # Pure helpers (dates, formatting, ids)
   │  └─ validation/             # Zod/Yup schemas used across app
   ├─ services/                  # Cross-cutting service clients (email, payments)
   ├─ state/                     # Global app-level stores (rare)
   ├─ types/
   │  ├─ domain/                 # Domain model types shared across features
   │  ├─ api/                    # DTOs and API contracts
   │  └─ global.d.ts             # Global type declarations, module shims
   ├─ styles/
   │  ├─ globals.css             # Imported once in app/layout.tsx
   │  ├─ tailwind.css            # Tailwind entry (if applicable)
   │  └─ tokens.css              # CSS tokens (or tokens.ts)
   ├─ content/
   │  ├─ mdx/                    # MD/MDX content (blog, docs, marketing)
   │  └─ locales/                # i18n translation files
   ├─ assets/
   │  ├─ images/                 # Importable images (non-direct URL)
   │  ├─ icons/                  # SVGs, icon sprites
   │  └─ fonts/                  # Self-hosted fonts
   ├─ mocks/
   │  ├─ msw/                    # MSW handlers for dev/tests
   │  ├─ data/                   # Fixture data / factories
   │  └─ handlers.ts             # MSW setup
   ├─ tests/
   │  ├─ setup/                  # Jest/Vitest/Playwright setup
   │  └─ utils/                  # Shared test helpers
   ├─ workers/
   │  ├─ edge/                   # Edge-specific workers/helpers
   │  └─ queue/                  # Background job processors
   ├─ middleware.ts              # Next.js Middleware (runs before routes)
   ├─ instrumentation.ts         # Server-side instrumentation
   └─ instrumentation-client.ts  # Client-side instrumentation
```

---

## 2. Placement Rules for New Files and Folders

When adding or modifying code, follow these steps.

### 2.1 Determine the correct layer

1. **Route UI**  
   → `src/app/**`
2. **Shared UI** (reused across routes/features)  
   → `src/components/**`
3. **Feature-specific UI or domain logic**  
   → `src/features/<feature>/**`
4. **Hook**
   - Feature-specific → `src/features/<feature>/hooks`
   - Cross-cutting → `src/hooks`
5. **Data access / env / caching / auth / contracts / utilities**
   - Cross-cutting infra → `src/lib/**`
   - Domain workflow → `src/features/<feature>/services`
6. **Vendor service client** (payments, email, analytics)  
   → `src/services/**`
7. **Global app state**  
   → `src/state/**` (only if truly global)
8. **Smart-contract code/tooling**
   - Solidity contracts → `blockchain/contracts`
   - Hardhat config and deployment scripts → `blockchain/**`
   - Frontend ABIs/addresses/clients → `src/lib/contracts/**`
9. **Environment configuration**
   - Next.js app + services → root `.env.*` + `src/lib/env/**`
   - Blockchain tooling → `blockchain/.env` (template:
     `blockchain/.env.example`)

### 2.2 Prefer extending existing modules over creating new ones

Before creating a new helper or service file:

1. Search existing modules:
   - `src/lib/utils`
   - `src/lib/api`
   - `src/lib/env`
   - `src/lib/db`
   - `src/lib/contracts`
   - `src/features/<feature>/services`
2. If similar behavior exists:
   - Extend the existing module:
     - Add a new function or overload.
     - Add options/parameters.
     - Add code paths that preserve existing behavior by default.
3. Only create new files when:
   - Responsibility is clearly distinct.
   - Extending existing modules would reduce clarity.

### 2.3 Server vs client boundaries

- Do **not** import:
  - `src/lib/db/**`,
  - `src/lib/env/**`,
  - `blockchain/**`  
    in client-only components or hooks.
- Client components may:
  - Call server actions in `src/lib/api`.
  - Use contract clients designed for the browser.
- Secrets, DB access, and low-level contract deployment logic must stay in:
  - Server Components.
  - Route handlers.
  - Server actions.
  - Scripts.
  - Feature services invoked from server contexts.

### 2.4 Routing-specific decisions

- Use route groups `(marketing)`, `(app)`, `(auth)` to organize sections.
- Use dynamic segments `[id]` for resource-specific pages.
- Introduce additional route groups as needed (`(admin)`, `(studio)`, etc.).
- Keep URLs stable; refactor internals via groups and feature refactors rather
  than URL churn.

### 2.5 Caching and performance (Next.js 15)

- Centralize expensive logic in:
  - `src/lib/cache`, `src/lib/db`, or feature services.
- Remember:
  - `GET` Route Handlers are uncached by default.
  - `fetch` defaults to no-store in many server scenarios.
- Opt into caching explicitly using:
  - Route config (`dynamic`, `revalidate`).
  - `fetch` options.
- Avoid copy-pasting caching logic; prefer shared helpers.

### 2.6 Database and services

- Convex schema and functions live under `convex/`.
- Convex client helpers live under `src/lib/db/convex/client.ts`.
- Domain-specific data workflows belong in feature services or Convex functions.

### 2.7 Blockchain workspace (if present)

- Keep all Solidity in `blockchain/contracts`.
- Use Hardhat scripts to compile/deploy `SubscriptionManager.sol`.
- Keep frontend subscription address and price env values in root `.env.local`.
- Never import from `blockchain/**` in the Next.js runtime; rely on
  `src/lib/contracts/**`.

**KEEP THE HEADINGS CONTENTS BELOW UPDATED:**

# Platform Summary

## Pages

- `/` (marketing home)
- `/pricing` (settlement-token API marketplace pricing and fee split)
- `/developers`, `/developers/docs` (developer onboarding and gateway docs)
- `/privacy`, `/terms`
- `/dashboard`, `/agents`, `/agents/new`, `/agents/[runId]`, `/marketplace`,
  `/marketplace/[slug]`, `/orders`, `/orders/new`, `/orders/[orderId]`,
  `/receipts/[receiptId]`, `/provider`, `/provider/products`,
  `/provider/products/new`, `/provider/products/[productId]`, `/provider/usage`,
  `/profile`, `/billing`, `/settings` (wallet-protected app pages)
- `/proofs/[proofId]` (public autonomous agent proof page)
- `/admin`, `/admin/users`, `/admin/products`, `/admin/orders`, `/admin/agents`,
  `/admin/receipts`, `/admin/subscriptions`, `/admin/operations`
  (wallet-protected admin pages for allowlisted wallets)

## API endpoints

- `POST /api/auth` and `DELETE /api/auth` — create or clear the wallet session
  cookies used by protected app routes and return the connected wallet's Convex
  user profile when available; successful browser wallet connections redirect
  public-page users to `/dashboard` after the session is synced.
- `GET /api/health` — returns readiness checks for the configured EVM network,
  x402, wallet onboarding, external API forwarding, marketplace listings, and
  receipts.
- `POST /api/webhooks` — records inbound webhook events to Convex with source,
  event type, sanitized headers, raw payload text, and parsed JSON payload when
  available.
- `GET /api/settings/profile` and `PUT /api/settings/profile` — read and persist
  wallet-scoped creator profile settings in the Convex `users` table, enforce
  unique usernames across saved profiles, and return profile validation errors
  for onboarding and settings pages.
- `GET /api/admin/access` — verifies that the active browser wallet matches the
  wallet session cookie and an allowlisted admin address before the header
  renders the admin shortcut.
- `POST /api/admin/users/bulk-delete` — allows admin wallets to delete selected
  user directory rows through the shared server-fed table bulk action contract.
- `POST /api/admin/products/bulk-delete` — allows admin wallets to delete
  selected provider-created products through the shared server-fed table; static
  public data products are not removed by this endpoint.
- `POST /api/admin/orders/bulk-delete` — allows admin wallets to delete selected
  marketplace order records from the persisted admin ledger.
- `POST /api/providers/self/products` — validates provider API product input,
  schema JSON, upstream endpoint URL, upstream auth, async polling mappings,
  runtime model, price, agent readiness, and visibility; resolves the listing
  owner wallet, payout wallet, provider name, and provider slug from the
  connected wallet's completed Convex user profile; then records a
  provider-created marketplace listing and returns the accepted product
  response.
- `PATCH /api/providers/self/products/[slug]/status` — updates an owner-matched
  provider product lifecycle state between draft, published, and paused for
  management workflows.
- `DELETE /api/providers/self/products/[slug]` — deletes a provider-created API
  product owned by the connected wallet from the Convex provider catalog and
  removes it from provider management and marketplace discovery.
- `POST /api/providers/self/products/bulk-delete` — deletes selected
  provider-created API products owned by the connected wallet from the Convex
  provider catalog; seeded admin-owned products are ignored by the product
  store.
- `POST /api/orders` — validates a buyer API request payload and returns a
  payment-required order record with a stable provider idempotency key for the
  selected marketplace product.
- `GET /api/orders/[orderId]` — returns an order lifecycle record and reconciles
  active async provider jobs through the shared provider-status sync before
  responding.
- `GET /api/orders/[orderId]/provider-status` — polls a provider adapter for
  long-running job status, compares final credit-metered usage with the prepaid
  quote, locks results that require a metered delta, returns the latest provider
  payload plus the sanitized upstream request trace, persists only compact
  status/result metadata for response bodies, and stores the latest poll attempt
  or poll error on the order for refresh-stable diagnostics.
  `POST /api/orders/[orderId]/provider-status` retries the provider call for
  paid failed orders that still have a retryable/refundable settled request,
  without creating a second buyer payment.
- `GET /api/receipts/[receiptId]` — returns a settlement receipt record.
- `POST /api/credits/accounts` — creates or returns a managed credit account and
  managed-credit API key for a wallet.
- `POST /api/credits/top-ups` — records a settlement-token top-up transaction
  hash and increases the wallet's managed credit balance.
- `POST /api/credits/products/[slug]/call` — calls a product with a API key,
  reserves managed credits before provider work starts, releases the reservation
  on provider failure, settles lower final usage back to the credit balance,
  sends a stable provider idempotency key to upstream POST endpoints, and
  records a receipt linked to the top-up transaction.
- `GET /api/agents/runs` and `POST /api/agents/runs` — list and create
  autonomous agent runs with optional template ID, objective, source context,
  owner wallet, budget cap, max paid actions, and tool selection mode. AI
  selection resolves the current agent-ready catalog server-side; manual
  selection accepts an explicit bounded tool slug list.
- `GET /api/agents/runs/[runId]` — returns agent run status, paid actions,
  deliverables, receipts, and proof state; paid async actions with an active
  order are reconciled through the order provider-status endpoint so completed
  provider result URLs surface on the run page without storing full provider
  response bodies in Convex.
- `DELETE /api/agents/runs/[runId]` — stops future execution for an autonomous
  agent run, removes it from the workspace run list, and attempts to cancel and
  refund unused vault budget when applicable.
- `POST /api/agents/runs/bulk-delete` — deletes selected agent runs from the
  current server-side run store and attempts the same stop/refund behavior as
  single-run deletion for each selected row.
- `POST /api/agents/runs/[runId]/funding/prepare` — prepares a production agent
  run vault funding payload with run ID, settlement token, vault address, budget
  amount, authorized agent signer, and expiry.
- `POST /api/agents/runs/[runId]/funding/confirm` — records the wallet funding
  and approval transactions for a production agent run budget.
- `GET /api/agents/runs/[runId]/ledger` — returns the agent budget ledger events
  for funding, spend, refunds, and proof context.
- `POST /api/agents/runs/[runId]/refund` — records or submits unused budget
  refund state after a production run reaches a terminal state.
- `POST /api/agents/runs/[runId]/execute` — runs the autonomous workflow,
  calling selected product x402 product endpoints with the configured funded
  production agent spender, using the current app origin for hosted x402 calls,
  preparing the agent signer's settlement-token payment authorization when required,
  and returning detailed payment or provider failures for action diagnostics.
- `POST /api/agents/runs/[runId]/attest` — hashes completed run metadata and
  writes the proof to the configured AgentRunAttestor when available.
- `GET /api/proofs/[proofId]` — returns a public proof package for a completed
  autonomous agent run.
- `GET /api/x402/products/[slug]/call` and `POST /api/x402/products/[slug]/call`
  — protect product calls with x402, return HTTP 402 payment requirements for
  unpaid requests, quote credit-metered requests before payment, verify and
  settle signed payment-token transfers through the configured facilitator,
  start credit-metered async provider work only after settlement, send the
  order's provider idempotency key to upstream POST endpoints, return paid
  provider responses or pollable job records, attach receipt metadata, and use
  the generic `x-app-order-id` request header to bind hosted calls to existing
  gateway orders.
- `POST /api/x402/orders/[orderId]/claim` — protects metered result release with
  x402 when final provider usage exceeds the prepaid quote, settles the delta in
  the configured settlement token, unlocks the stored provider result, and
  records a delta receipt.
- `POST /api/providers/openapi/preview` — imports a hosted or uploaded OpenAPI
  JSON/YAML document and returns paid-listing candidates with inferred endpoint
  URL, method, auth type, schemas, reference payload, async polling paths, and
  result mapping.
- External HTTP provider calls save a sanitized provider request trace on the
  order record, including method, upstream URL, query/body payload, redacted
  request headers, the order idempotency header for upstream POST creation
  calls, response status, selected response headers, and the provider response
  preview. Order detail pages render this trace in a collapsed JSON diagnostic
  panel so listing owners can reproduce upstream calls without exposing provider
  secrets.
- `GET /api/openapi.json` — returns the OpenAPI document.
- `GET /api/reference` — serves the Scalar API reference for the OpenAPI
  document.

## Architecture Overview

- Next.js 15 App Router under `src/app` with `(marketing)` and `(app)` route
  groups.
- Convex backend in `convex/` with marketplace tables for users, providers, API
  products, product versions, orders, receipts, API requests, webhook events,
  usage events, payouts, autonomous agent runs, agent actions, agent proofs,
  saved examples, and reviews; client helper in `src/lib/db/convex/client.ts`.
  Database seeding lives in `scripts/seed-database.ts` for wallet-scoped users
  and associated provider profiles, plus `scripts/seed-admin-tools.ts` for
  public provider-owned marketplace tools.
- Hardhat blockchain workspace in `blockchain/` with
  `contracts/SubscriptionManager.sol` plus `contracts/AgentRunAttestor.sol` for
  on-chain proof hashes and `contracts/ApiPaymentEscrow.sol` for prepaid
  credit-metered API payments plus `contracts/AgentRunVault.sol` for user-funded
  autonomous agent budgets. Current contract addresses are
  `NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS=0x9a667b845034dDf18B7a5a9b50e2fe8CD4e6e2C1`,
  `NEXT_PUBLIC_AGENT_ATTESTOR_ADDRESS=0x761D0dbB45654513AdF1BF6b5D217C0f8B3c5737`,
  `NEXT_PUBLIC_API_PAYMENT_ESCROW_ADDRESS=0x27E9062ee91A0D60De39984346cAeD53bE68024c`,
  and
  `NEXT_PUBLIC_AGENT_RUN_VAULT_ADDRESS=0x158E396020b4A86f351D766fC7748C862c493b6B`.
- Shared UI primitives in `src/components/ui` and layout shells in
  `src/components/layout`.
- Shared JSON rendering lives in `src/components/data-display/json-viewer.tsx`
  with default copy support, collapsible diagnostics, error-tone rendering for
  raw failure text, and nested JSON string normalization for provider responses,
  sanitized provider request traces, request previews, agent deliverables, and
  public proof payloads.
- Shared server-fed table rendering lives in
  `src/components/data-display/server-data-table.tsx` with URL-driven search,
  sorting, pagination, optional current-page row selection, and optional bulk
  actions. Sortable headers use a shared icon-led sort button that shows
  unsorted, ascending, and descending states. Selectable tables render a master
  checkbox in the first header column for selecting all rows on the current
  server-paginated page, plus a compact bulk-action toolbar above the table.
  Table search, sort, pagination, and filter controls update the URL with
  client-side router pushes that preserve scroll position so server-fed table
  interactions feel local instead of page-jumping. Pages with multiple
  independent tables use prefixed query parameters so each table can be
  searched, sorted, and paginated without resetting neighboring tables.
  Selection is enabled only for tables that need row-level or bulk operations,
  and the shared selection controller supports current-page master selection
  plus controlled selection state for custom workflows. Bulk selection renders
  as an active command bar; destructive actions such as delete/remove use red
  buttons and red confirmation affordances across every server-fed table.
  Server-side query helpers live in `src/lib/table/server-table.ts` and are used
  by agent templates/runs, marketplace products, orders, and provider product
  management.
- Shared site header in `src/components/layout/site-header.tsx` across marketing
  and app shells, with app logo branding, public navigation, theme controls, a
  server-verified admin shortcut for allowlisted active wallets, and an avatar
  account menu. The account menu shows wallet-scoped profile identity and
  dashboard/profile/settings shortcuts only when a wallet is connected, and
  keeps the active RainbowKit wallet control available without occupying
  persistent header space. Connected wallets must complete the profile
  onboarding overlay with a full name, unique username, and email before
  continuing through the app; the overlay stays open while users type and closes
  only after the completed profile is saved. The onboarding overlay embeds the
  active RainbowKit wallet control so users can disconnect a wrong wallet before
  creating a profile. Profile data powers creator identity displays on
  marketplace, provider, receipt, and agent surfaces. Creator profile settings
  persist through `/api/settings/profile` into the Convex `users` table and
  hydrate client displays through `src/hooks/use-user-settings.ts`; browser
  localStorage is not used for profile persistence. The profile page and header
  account menu also read the connected wallet's native network-token balance and
  configured stablecoin balance on the configured EVM chain through
  `src/hooks/use-wallet-balances.ts`, so displayed balances follow the active
  settlement token and network environment.
- The app favicon is generated from the app logo and lives only at
  `src/app/favicon.ico`; the shared logo path is resolved from
  `NEXT_PUBLIC_APP_LOGO_PATH` through `src/lib/config/site.ts` and defaults to
  `public/images/tollkite-logo.png`. The web app manifest is generated from
  `src/app/manifest.ts` and uses the shared site config for app name and logo.
- Authenticated app routes use compact icon-led sidebars in
  `src/components/layout/app-sidebar.tsx` and
  `src/components/layout/admin-sidebar.tsx` for workspace and admin navigation.
- Marketplace product registry, provider-created listings, product schemas,
  upstream auth metadata, async polling mappings, prices, x402 flags, and
  dashboard metrics live in `src/features/marketplace/products.ts`; reusable
  marketplace cards live in `src/features/marketplace/product-card.tsx`.
  Subscription plan metadata and tier fee splits live in
  `src/lib/contracts/subscription.ts`: Free providers keep 95%, Base providers
  keep 97%, and Plus providers keep 99% of successful paid calls. Marketplace
  orders, settlement receipts, and managed credit accounts persist to Convex
  snapshot-backed ledger rows, and provider call counts, success rates, gross
  volume, platform fees, and earnings are derived from those order and receipt
  ledgers instead of static product counters. Receipt builders resolve the
  provider profile plan through `src/features/marketplace/provider-fees.ts`,
  default to Free when no saved plan exists, and store the provider plan,
  platform fee bps, provider share bps, platform fee amount, and provider amount
  on successful receipts. Seeded provider public data wrappers for Wikipedia
  search, Hacker News trend search, GitHub repository search, npm package
  search, OpenAlex research search, and GDELT news search use no upstream
  account or API key, stay x402-protected as paid Marketplace products, are
  upserted into Convex with the configured allowlisted admin wallet, and are
  agent-ready for no-key public-data runs. Marketplace and product pages show
  the creator identity card with avatar, name, username, and wallet address for
  these products and provider-created listings. These products execute through
  the dedicated `src/features/provider-adapters/public-data/adapter.ts` adapter,
  which normalizes provider-specific request parameters, applies bounded
  upstream timeouts, and uses no-key public fallback sources for providers that
  rate limit, reject narrow queries, or return temporary gateway errors.
  Provider-created listings persist to Convex `apiProducts` rows linked to a
  Convex `providers` record for the connected user, with the full marketplace
  product configuration stored as a product snapshot for marketplace,
  provider-dashboard, gateway, and x402 runtime reads. Draft, paused, and
  published products are shared across machines through Convex. Provider product
  records derive creator identity and payout wallet from the connected Convex
  user profile instead of accepting owner wallet, receiving wallet, or provider
  display name in the listing form. Provider dashboards and product management
  filter by the profile wallet stored on each product, and payout settlement
  uses the same profile wallet.
- Autonomous agent templates, OpenAI planning and synthesis, deterministic
  fallback planning, run storage, funded budget ledgers, paid action execution,
  proof hashing, status labels, and UI clients live in `src/features/agents`.
  Agent runs and proof records persist to Convex snapshot-backed run and proof
  rows so recent runs, statuses, funding ledgers, paid-action diagnostics,
  receipts, and proofs remain visible across machines. Template definitions live
  in `src/features/agents/templates.ts` and include reusable objectives,
  context, budgets, action limits, tool strategy, and deliverables for launch,
  research, documentation, readiness, and creative workflows, including
  video-first launch campaigns that combine public data scans with async
  media-generation tools when budget allows. Agent runs require the owner to
  fund the `AgentRunVault` with the configured settlement token before the
  configured agent signer can execute x402 paid actions. The run detail client
  funds through the browser EIP-1193 wallet provider, requests the MetaMask
  account when needed, switches or adds the configured EVM network, checks the
  connected wallet's settlement-token balance and vault allowance, submits the
  token approval when needed, verifies receipt success, then submits `fundRun`
  and verifies the funding receipt before confirming the run server-side.
  Funding confirmation and execution both verify the run against the current
  deployed vault's `budgetOf` state, so stale local funding records from an old
  vault reset to an unfunded state instead of attempting `recordSpend`. Before
  each paid action, the gateway advances the quoted settlement-token amount from
  the vault to the agent signer with `recordSpend`, verifies the signer's
  balance with bounded polling after the `recordSpend` receipt is confirmed,
  verifies any token-transfer prerequisites required by the configured x402
  transfer method, and then executes the hosted x402 call from the same origin
  that triggered the run. If a pre-settlement failure
  occurs after the vault advance, or if an escrowed provider failure refunds the
  x402 payment back to the signer, the gateway returns the settlement token to
  the vault and records `recordSpendRefund`; if x402 settlement already moved
  funds from the signer to async escrow but escrow accounting cannot be
  recorded, the gateway does not attempt a signer return and instead keeps the
  action spent with escrow handoff diagnostics. Unrecovered settlement or refund
  failures stay counted as spent and remain visible in diagnostics. Running
  executions persist planner and per-action progress as tools move from quoted
  to paid to terminal states, and the run detail client auto-polls
  `GET /api/agents/runs/[runId]` while the run is executing or attesting so
  users can watch async progress without a manual refresh. Paid action failures
  preserve the response body, settlement guidance, and provider details in
  action diagnostics. Async provider actions use the same
  `/api/orders/[orderId]/provider-status` polling path as marketplace orders;
  queued and processing media jobs remain incomplete until the provider returns
  a terminal result, refund state, or completed project URL. Agent-paid x402
  calls include the agent run ID in gateway order and receipt records so
  provider dashboards and usage pages count autonomous tool calls in the same
  revenue ledger as browser and developer API calls. x402 payment requirements
  use the settlement token's EIP-712 domain metadata in
  `NEXT_PUBLIC_PAYMENT_TOKEN_NAME`, `NEXT_PUBLIC_PAYMENT_TOKEN_SYMBOL`,
  `NEXT_PUBLIC_PAYMENT_TOKEN_LABEL`, `NEXT_PUBLIC_PAYMENT_TOKEN_VERSION`, and
  `NEXT_PUBLIC_PAYMENT_TOKEN_DECIMALS`; the configured settlement token address
  comes from `NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS`, and
  `NEXT_PUBLIC_PAYMENT_TOKEN_TRANSFER_METHOD=eip3009` selects the x402 EVM
  transfer mode used in payment requirements for `transferWithAuthorization`
  payment signature flows. Signed x402 payloads, payment authorization checks, agent vault
  funding, and escrow reserves must use that token metadata for facilitator
  verification and settlement. Server-submitted vault writes, escrow writes,
  agent-signer payment authorizations, and agent-signer settlement-token returns
  apply an explicit EIP-7623 floor-safe gas limit with a 1.5x buffer before
  broadcasting to the configured Kite RPC. Retryable pre-broadcast payment RPC
  failures use exponential backoff, promote any returned EIP-7623 floor value to
  the next retry's minimum gas limit, record each attempt on the action, wait
  for successful transaction receipts, and avoid retrying after a transaction
  hash is accepted so vault spends are not duplicated. Agent-paid x402 calls
  retry retryable pre-response settlement and gateway failures three times with
  fresh signed payloads; once a paid endpoint returns a provider/order response,
  the gateway does not submit a second x402 payment for the same vault advance.
  Escrow reserve, release, and refund writes use a higher floor-safe gas budget
  than simple vault writes because `ApiPaymentEscrow.reservePayment` performs
  role checks, storage writes, and token balance reads. They retry retryable RPC
  failures and full-gas receipt reverts before surfacing escrow handoff
  diagnostics. Async provider failures with transient HTTP status codes or
  transient gateway language stay reserved for up to three provider retries
  before the order becomes terminal and refund recovery begins. Refund recovery
  reads the vault's live spent amount before calling `recordSpendRefund` so
  retries and partially recovered failures do not request a larger refund than
  the current vault state can accept, and it checks the backend agent signer's
  settlement-token balance before submitting a return transfer so diagnostics
  distinguish signer USDT shortages from the owner wallet's native gas balance.
  Direct run reads refresh from Convex by run ID before using the in-memory run
  cache so polling clients see the latest persisted progress across server
  runtimes. Agent action progress records the settled x402 order/receipt and the
  provider's initial response as soon as the paid request is accepted, then
  keeps async media actions in `paid` state while polling for the terminal
  provider output. The latest async provider-status poll is stored on the action
  with attempt number, timestamp, polling URL, request method, headers, path
  parameters, HTTP status, order state, result-release state, external job ID,
  result URL when present, and compact response metadata; each new backend poll
  replaces the prior visible snapshot instead of growing an unbounded history.
  The run page refreshes running, attesting, and active paid async runs every
  eight seconds, reconciles stale paid actions through the provider-status
  endpoint using the configured public app origin, auto-resumes remaining
  planned tools after an async action reaches a terminal state, renders the
  latest async poll as a compact live-status disclosure without poll-number
  timeline rows, summarizes each tool's quote, phase, vault spend, order, and
  status in collapsed-by-default tool cards, and keeps compact request/response
  JSON inside expandable diagnostics. Receipt, settlement, and vault transaction
  links render as icon actions in each tool card header. Payment transaction
  attempts render in expandable chronological per-action diagnostics with step
  numbers, per-step retry numbers, gas limit, retry delay, message, and
  transaction link when available. Funding, skipped tools, planner receipts, and
  deliverable diagnostics live as collapsed sections at the bottom of the final
  deliverable card. Long provider, gateway, and contract failure text stays
  inside expandable copyable diagnostics with user-facing summaries for budget,
  gas-floor, agent signer settlement-token balance, contract, refund, and tool
  failures; run-control error banners appear only for failed runs or failed tool
  actions, so recovered retry errors do not remain visible while tools continue
  processing. AgentRunVault over-budget errors show funded, spent, available,
  and attempted tool-spend context before the raw error. Public provider result
  links render as compact host/path previews instead of full-width raw URLs.
  Agent and marketplace snapshots persisted to Convex keep result URLs, job IDs,
  statuses, pricing, and escrow metadata, but compact provider response bodies
  before saving. When `AGENT_LLM_API_KEY` is configured, the agent uses the
  OpenAI Responses API with `AGENT_LLM_MODEL` or `gpt-5.2` to select tools,
  generate request payloads, skip unrelated tools, reserve one affordable media
  tool when the objective or template requires video output, set a budget
  strategy, and synthesize the final launch pack from completed paid responses
  and receipts. When no paid action completes in production, the run remains
  failed and presents diagnostics instead of treating generated copy as verified
  output. When the key is absent, the deterministic fallback ranks the allowed
  marketplace tools from the objective and source context while preserving
  required media-tool selection for video workflows. Both planner modes record
  the prompt, model or fallback label, rationale, skipped tools, selected tools,
  funding ledger, and synthesis metadata in run deliverables, action cards, and
  proof payloads.
- `/agents` is a tabbed command center that opens on recent runs and also
  exposes a templates tab. Both tabs use separate server-fed tables with search,
  sorting, and pagination; recent runs support current-page row selection and
  bulk deletion through the shared confirmation dialog, while each run row uses
  a three-dot action menu for opening or deleting the run. Successful single and
  bulk deletes remove affected rows from the current table immediately and then
  refresh server data. Templates omit selection controls. `/agents/new`
  configures objective, source context, owner wallet from the connected wallet
  session, budget cap, max paid actions, and allowed paid tools in a single
  vertical four-step flow: goal, tools, funded budget, and review. Blank runs
  start with empty objective/context fields; template links prefill those fields
  from the selected template; marketplace tool links open manual mode with that
  tool selected. Tool access defaults to “AI decides from all agent-ready
  tools,” which resolves the catalog server-side instead of sending every tool
  slug to the browser. Manual mode uses a server-paginated, searchable, sortable
  tool table with the shared current-page master checkbox. Manual mode selects
  one available tool by default when opened and blocks run creation unless at
  least one tool remains selected; `/agents/[runId]` funds production runs
  through the agent budget vault, executes the ranked plan, shows planner
  mode/model, selected and skipped tools, planner rationale, budget ledger,
  receipt links, per-tool request and response JSON, extracted tool output
  previews, Markdown-rendered deliverables, a final output section that renders
  detected text, image, video, and result-link deliverables at the bottom of the
  run page, unused refund controls with visible refund transaction explorer
  links, and writes on-chain proof attestations.
- `/proofs/[proofId]` publicly displays non-sensitive autonomous run proof
  metadata, proof hash, receipt IDs, budget funding and refund metadata, total
  USDT spend, attestation transaction, and explorer link.
- Provider adapters live in `src/features/provider-adapters`; the registry uses
  the generic external HTTP adapter for provider-created listings. The external
  HTTP adapter forwards paid requests to the configured upstream endpoint,
  applies bearer, API-key, query-key, or basic auth server-side, removes empty
  optional request fields from listing schema-generated payloads before quoting
  or forwarding, extracts external job IDs, result URLs, public project handoff
  URLs, and clone URLs through configured and conventional JSON paths, and polls
  provider status endpoints for async products. Credit-metered async providers
  always receive `billingMode: "external_prepaid"` plus generic external prepaid
  metadata with order, receipt, buyer, requested billing mode, and settlement
  references so provider APIs can report estimated, charged, and refunded usage
  without importing gateway settlement logic. Provider listings with server-side
  auth requirements must have their upstream secret configured before the
  gateway creates payable orders or x402 payment requirements.
- `/marketplace` lists published provider-created USDT-paid API products in the
  shared server-fed table with category filters, price badges, provider names,
  execution/result delivery context, agent-ready badges, and entry points for
  run-with-wallet, detail, and autonomous agent runs.
- `/marketplace/[slug]` displays product detail, request schema, response
  schema, copyable reference payload, full endpoint URL, raw 402 inspection
  curl, standalone x402 buyer integration code, execution mode, settlement
  model, result delivery model, Run with wallet entry point, Use from code
  anchor, and Use in agent run entry point.
- `/orders/new` shows selected product price, gateway endpoint, method,
  provider, connected buyer wallet, and a schema-driven request builder that
  generates validated fields from the product request schema, respects explicit
  required/optional markers from imported OpenAPI schemas, renders arrays as
  repeatable item controls, surfaces imported schema descriptions as field help,
  coerces arrays, objects, numbers, booleans, and URLs before quote requests,
  and keeps an advanced JSON preview before a payable API request is created.
  Failed preparation attempts show a compact readable error plus an expandable
  complete request/response payload so provider quote, validation, and pricing
  errors are visible and copyable during integration testing without cluttering
  the page. Successful preparation clears failure debug state, shows a short
  success status, stores the order in browser session storage, and redirects to
  the Run & Pay order page.
- `/orders/[orderId]` shows payment, escrow, provider job, result, receipt, and
  metered usage state. Provider responses include a collapsed sanitized upstream
  request trace with method, URL, query/body, redacted headers, response status,
  selected response headers, and provider response body so provider integrations
  can be debugged without exposing API secrets.
- `/provider` shows the connected wallet's owned provider revenue, API call
  volume, success rate, top product, recent request activity, product listing
  health, production narrative, and tiered provider revenue split.
- `/provider/products` lists provider API products in the shared server-fed
  table for the connected owner wallet with status context, price, call volume,
  gateway path, owner-scoped bulk deletion, and a per-row actions menu for
  managing or deleting individual provider-created listings with confirmation.
- `/provider/products/new` uses
  `src/features/marketplace/provider-product-form.tsx` and
  `src/features/marketplace/schemas.ts` to validate provider product metadata,
  schemas, upstream endpoint URL, upstream authentication requirements, async
  polling requirements, runtime model, fixed or credit-metered USDT pricing,
  connected-wallet owner profile, agent readiness, OpenAPI-imported operation
  defaults, and visibility before posting to the product API route. Provider
  form labels link to field-specific anchors on `/developers/docs` instead of
  hover-only help, including OpenAPI import, pricing, authentication, runtime,
  polling, schema, webhook, and agent-readiness documentation. The provider form
  uses the shared product input schema for client-side field errors before
  submission, and the API route uses the same schema as the server guard. The
  OpenAPI importer detects operation-level or document-level security schemes,
  credit fields such as `estimatedCredits`, and 202 Accepted job operations,
  links async job-creation operations to matching status endpoints from the
  imported spec, marks required provider auth and polling fields accurately, and
  preserves OpenAPI request-body required/optional field metadata and
  descriptions for provider test runs.
- `/provider/products/[productId]` is the provider API management workspace. It
  shows lifecycle controls for publishing, pausing, and returning products to
  draft, a launch checklist, payable schema-driven test runs, gateway endpoint
  copy support, product deletion, provider contract details, and
  request/response schema details.
- `/provider/usage` shows the connected wallet's provider API calls, USDT
  revenue, buyer wallets, request IDs, agent-run context, and status labels.
- `/orders` uses the shared server-fed table for buyer request search, sorting,
  pagination, status, amount, and order-opening actions. `/orders/[orderId]`
  shows buyer request lifecycle state using shared order status labels and
  descriptions from `src/features/marketplace/status.ts`; order detail pages
  sign x402 USDT payments with the connected browser wallet, check and submit
  the required payment-token payment authorization transaction when needed, verify
  USDT balance before asking for payment signatures, wait for the approval
  receipt and readable allowance, retry transient quote, allowance, signature,
  settlement, claim, and provider status errors with bounded exponential backoff
  while avoiding retries after receipt or payment artifacts are returned,
  display step-by-step wallet progress as a compact icon timeline with explorer
  links for submitted transactions, surface settlement failure guidance from the
  x402 facilitator, show payment failures as dedicated alert cards with copyable
  error text, keep long explanations inside collapsible details, separate direct
  API responses from async provider jobs, automatically poll provider status
  through the shared `useAutoPolling` hook when an order has an external job ID
  or a retryable provider outage, keep escrow reserved for retryable provider
  failures such as temporary 5xx, Cloudflare, timeout, rate-limit, or
  provider-marked retryable responses until the 24-hour retry window expires,
  complete async orders when a provider returns a completed status or cloneable
  handoff URL, keep manual polling available, keep 402 inspection as a
  diagnostic action, persist receipt metadata in browser session storage, show
  quote/reservation/final usage amounts for credit-metered calls, claim metered
  deltas through x402 before revealing locked results, show escrow
  reserve/release/refund transaction links when a credit-metered async payment
  uses escrow, and link to the settlement receipt and explorer transaction.
  Draft products stay hidden from public marketplace usage but can be tested
  through provider management by creating provider-test order records; locally
  persisted draft listings created before owner metadata exists can still be
  tested through matching order records. Browser session order snapshots use
  compact session-safe storage so large provider payloads cannot block the
  visible order state, and provider payload normalization removes malformed
  indexed-character maps while preserving handoff URLs and billing metadata.
- Marketplace products declare whether they are synchronous or asynchronous,
  whether settlement happens after a successful response, after job acceptance,
  or when a completed result is claimed, and whether results are returned
  directly, polled/webhooked, or revealed after completion.
- Marketplace products support fixed per-call USDT pricing and credit-metered
  pricing. Credit-metered products call a provider quote endpoint or read a
  deterministic credit field before x402 settlement, convert credits to USDT
  with a configured rate and multiplier, settle the quoted amount before
  expensive provider work starts, route asynchronous metered payments to
  ApiPaymentEscrow when configured, wait for settlement and reserve transaction
  receipts before provider work starts, check on-chain escrow state before
  refund or release attempts, refund escrowed payments when provider work fails
  before a usable result, release escrowed payments only after successful
  completion or result claim, compare final usage against the quote, lock
  results that need a delta payment, include failed quote response status and
  response body in pricing errors, and record quote, paid, actual, escrow, and
  release metadata on orders and receipts.
- `/receipts/[receiptId]` displays product, provider, buyer wallet, provider
  wallet, USDT amount, fee split, network, transaction hash, and explorer link
  for settled API calls.
- `/billing` displays workspace billing context, managed credit API-key
  creation, USDT top-up records, API-key debit history, payment readiness,
  autonomous agent spend, proof counts, and recent USDT receipt records.
- `/admin/products`, `/admin/orders`, `/admin/agents`, `/admin/receipts`,
  `/admin/subscriptions`, and `/admin/operations` provide allowlisted
  operational review for marketplace ownership, paid API request records,
  autonomous agent budgets and statuses, USDT settlement receipts, on-chain
  subscribers, deployment readiness, contract configuration, and provider
  adapter health. These pages use the shared server-fed table for scalable
  search, sorting, pagination, and scoped bulk actions where lists can grow.
- `/developers` and `/developers/docs` describe provider onboarding, OpenAPI
  import, x402 paid calls, fixed-price provider contracts, credit-metered
  quote-first provider contracts, external prepaid async job metadata, public
  handoff and clone URL result contracts, final usage delta handling, autonomous
  agent runs, on-chain proof attestations, gateway forwarding, receipt records,
  external HTTP adapter behavior, OpenAPI JSON, and the Scalar API reference.
  The developer docs page renders GitHub-flavored Markdown with `react-markdown`
  and `remark-gfm`, uses a sticky table of contents, and exposes stable section
  and field anchors used by provider form documentation links.
- Admin routes use `src/components/layout/admin-sidebar.tsx`; the users table is
  server-rendered from Convex user profiles plus admin allowlist metadata using
  URL search, filter, sort, and pagination parameters. It shows creator
  identity, wallet, email, role, subscription, status, and last seen metadata,
  and supports current-page selection with bulk deletion.
- Admin user row actions use three-dot menus with reusable responsive dialogs
  for editing user details, subscription tier, and destructive confirmations.
- Chain metadata, native currency labels, settlement-token metadata, x402
  network ID, and explorer URL generation are centralized in
  `src/lib/config/chains.ts`; the default app chain is configured through
  `NEXT_PUBLIC_EVM_CHAIN_ID`, `NEXT_PUBLIC_EVM_RPC_URL`,
  `NEXT_PUBLIC_EVM_EXPLORER_URL`, and `NEXT_PUBLIC_PAYMENT_TOKEN_*`.
- Operational readiness checks live in `src/lib/operations/readiness.ts` and
  feed `/api/health` plus the admin operations page, including agent signer,
  attestor, and public proof readiness.
- x402 network configuration uses the CAIP-2 identifier in
  `NEXT_PUBLIC_X402_NETWORK`; the resource server in
  `src/lib/x402/payment-resource-server.ts` registers the EVM `exact` scheme,
  protects product call routes, and resolves dollar-denominated prices to the
  configured payment token. When a compatible server settlement key is
  configured, the resource server uses an in-process facilitator signer with
  EIP-7623 floor-safe gas and retryable pre-broadcast settlement retries;
  otherwise it delegates settlement to `X402_FACILITATOR_URL`.
- Walkthrough and deployment documentation lives in `docs/demo-script.md` and
  `docs/deployment-checklist.md`.
- The admin subscriptions page reads SubscriptionManager balance, plan prices,
  paginated subscriber rows, treasury withdrawal support, and explorer links
  from the configured subscription chain.
- Admin access is limited to wallets listed in
  `NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES`.
- Global styling via `src/styles/globals.css` and `src/styles/tokens.css`, using
  Deep Ink, Electric Cyan, Agent Green, Proof Amber, and Cloud White brand
  tokens for light and dark themes.
- Wallet provider toggle via `NEXT_PUBLIC_WALLET_PROVIDER` with Thirdweb or
  RainbowKit integrations.
- Environment parsing treats blank optional values as unset so local optional
  URL fields do not fail validation.
- RainbowKit configuration uses the shared EVM chain registry when
  `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is configured, and initializes on the
  configured app chain.
- RainbowKit wallet controls live inside the shared header account menu, with
  account details, copy-address, and disconnect actions handled by the
  RainbowKit dialog.
- Wallet configuration helpers in `src/lib/wallet`.
- App route protection uses `src/middleware.ts`,
  `src/lib/auth/wallet-session.ts`, and
  `src/components/layout/protected-app-guard.tsx` to require an active wallet
  connection for `/dashboard`, `/agents`, `/marketplace`, `/orders`,
  `/receipts`, `/provider`, `/profile`, `/billing`, `/settings`, and `/admin`;
  admin routes also require an allowlisted wallet address.
- Wallet-auth redirects add an auth reason to the home page, which displays a
  dismissible notice through `src/components/feedback/auth-required-toast.tsx`.
- `src/components/providers/wallet-session-bridge.tsx` syncs wallet connect and
  disconnect events through `/api/auth`, redirects public-page wallet
  connections to `/dashboard`, and keeps server middleware cookies plus client
  profile hydration aligned with the active wallet.
- Creator identity settings are managed in `src/lib/settings/user-settings.ts`,
  persisted through Convex, and surfaced through the header account menu,
  settings, profile, dashboard, and billing components. The editable profile
  form contains only full name, username, and email; subscription tier changes
  are initiated from pricing and billing subscription flows.
- Server-readable admin user records and table controls live in
  `src/lib/admin/admin-users.ts`. Admin role membership is computed only from
  `NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES`; user profile records and admin user
  overrides cannot grant admin access.
- Pricing subscription checkout, billing renewal/cancellation controls, user
  payment history links, and admin subscription operations use
  `src/lib/contracts/subscription.ts`,
  `src/lib/contracts/subscription-admin.ts`, the chain registry, and the
  configured `NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS`.
- Route transitions show a top progress loader via `nextjs-toploader`. Client
  components that navigate programmatically use the `nextjs-toploader/app`
  router wrapper so `push` and `replace` redirects show the same loader as
  link-based navigation. `NavigationProgressEvents` starts the same loader for
  same-origin form submits and browser-level unload navigations so redirects
  outside `next/link` still show progress.
- Vercel deployment settings live in `vercel.json` with Next.js framework
  detection, `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm dev`. Git
  deployments are explicitly enabled for Git-connected Vercel projects so
  repository pushes can create deployments unless the Vercel project dashboard
  disables deployments for a branch. Vercel environment resets from `.env.local`
  use `scripts/sync-vercel-env.cjs` through the `vercel:env:sync:*` package
  scripts; the sync script requires an existing Vercel project link and does not
  pull remote environment variables into `.env.local`.
- Theme switching using `next-themes` with class-based dark mode.

## Core Commands

- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm lint`
- `pnpm lint:fix`
- `pnpm format`
- `pnpm format:code`
- `pnpm lint:all`
- `pnpm typecheck`
- `pnpm convex:dev`
- `pnpm convex:deploy`
- `pnpm convex:redeploy`
- `pnpm convex:reset`
- `pnpm contracts:deploy`
- `pnpm contracts:deploy:agent`
- `pnpm contracts:deploy:api-escrow`
- `pnpm x402:call <product-slug>`
- `pnpm --dir blockchain deploy:agent-attestor`
- `pnpm --dir blockchain deploy:api-escrow`
