# Vakyam Voice V2 — Executive Summary (Production Readiness Audit)

Date: 2026-11-16 · Repo: `arkabera2004/Vakyam_voice_V2` (`v2/main`) · Audited at `5e56660`

## Status vocabulary used across all audit documents

| Word | Meaning |
|---|---|
| IMPLEMENTED | Code exists |
| VERIFIED | Tested in this audit and observed working with real data paths |
| PARTIALLY VERIFIED | Part of the workflow observed; full path not proven |
| MOCKED | Simulated or constant data/behaviour |
| BLOCKED | Could not be tested: missing access, credentials or hardware |
| NOT IMPLEMENTED | Missing |
| FAILED | Tested and found not working |

## What Vakyam Voice contains today

1. **A real, working voice agent demo** (`/voice`): Supabase login → edge function mints a short-lived Azure OpenAI Realtime token with Meera's prompt bound server-side → browser WebRTC call → optional Azure Speech Indian voice. Azure keys never reach the browser. The member account and resort inventory Meera talks about are **mock text** injected into the prompt; the session has **no tools**, so holds and cases are narrated, not executed.
2. **A 13-screen supervisor console** (`/console`): Home, Live calls, Call detail, Warm transfers, Call review, QA scorecards, Agent studio, Tools, Routing, Knowledge, Compliance, Analytics, Alerts. Every screen is visually complete and interactive. **Every screen is a demo**: data comes from constants in the page files, and every change (decisions, gates, PII toggles, adapters, campaigns, dictionary, persona, voice, disclosure, audit log) is written to one `localStorage` key. There are no tables, no roles, no organisations, no telephony, no CRM, no recordings, no server-side audit log, no email, no scheduler.
3. **Infrastructure**: Supabase Auth + one `profiles` table (RLS per user, never read by the app) + one edge function; deploy configs for Azure Static Web Apps, Vercel and Docker/nginx; 18 pure-function unit tests.

## What is genuinely functional (VERIFIED)

- Email/password login, wrong-credential rejection, session restore, logout.
- Route guard: signed-out users are redirected to `/login` from `/console/*` and `/voice`.
- `realtime-token` authorization: unauthenticated and anon-key callers get 401.
- RLS on `profiles` hides rows from anon.
- All console routes render with zero browser console errors; 404 page works.
- CSV export mechanism, search, sort, policy tester and routing simulator (pure functions, unit-tested).

## What is demo-only (MOCKED)

All 13 console screens and every control on them; the agent's "system access"; every integration name on the Tools screen; compliance status text; analytics numbers; the AI-cost widget.

## What is incomplete or missing (NOT IMPLEMENTED)

Tenant/organisation model and roles; persistence of any console data; call records, transcripts and recordings; realtime tool calling; telephony; CRM adapters; password reset; rate limiting; monitoring; integration/E2E tests; CI quality gates (the only workflow deploys).

## Critical risks

| # | Risk | Severity |
|---|---|---|
| 1 | **Public signup is enabled** on the live Supabase project (`disable_signup: false`), contradicting the README. Anyone with the bundled publishable key can register and reach the console and the Azure token endpoint. | P0 |
| 2 | **No rate limit** on Azure session minting; console previews also mint full Realtime sessions. Unbounded cost exposure per account. | P0 |
| 3 | **`.env` is tracked** with an explicit `!.env` ignore rule, and the local copy is being extended with Azure secret key names. One careless commit publishes secrets. | P0 |
| 4 | **Compliance screen asserts controls that do not exist** (DPDP alignment, data region, PII redaction, deletion within 7 days). A client could rely on them. | P1 |
| 5 | **Audit log is client-side, resettable and attributed to a fictional user.** | P1 |
| 6 | 12 production-tree npm vulnerabilities including a direct `react-router-dom` high (open-redirect XSS). | P1 |

## Is it ready for a client?

**No.** It is ready as a **sales demo** for a single presenter on a single browser, with the three P0 items fixed first (they take hours, not weeks). It is **not** deployable for a real client organisation: there is no backend behind the console, no tenant isolation, and no real call data.

## Counts

| Metric | Value |
|---|---|
| Routes registered / verified in browser | 17 / 17 (see FRONTEND_ROUTE_AUDIT) |
| Network operations discovered | 13 |
| Endpoint probes run / passed / failed / blocked | 8 run · 6 pass · 1 fail (signup enabled) · 1 inconclusive; live voice path blocked |
| Features audited | 26 |
| Fully verified features | 5 |
| Partially verified | 2 |
| Mock/demo features | 15 |
| Not implemented | 1 (+1 pending logo assets) |
| Gap register | 35 items: P0 4 · P1 10 · P2 14 · P3 7 |
| Unit tests | 18/18 pass; 0 integration; 0 E2E |

## Recommended next steps

1. Fix the three P0 security/cost items now (signup off, rate limit + speech-only token path, untrack `.env`).
2. Decide the first client's scope: which console screens must be real for launch. The gap register assumes all of them.
3. Build the domain schema with organisation-scoped RLS, then move the console off `localStorage` one screen at a time.
4. Give the realtime agent real tools and persist calls, so Live/Review/QA show actual traffic.
5. Add CI quality gates and a Playwright suite before any of the above merges.

The full plan, with ordering and acceptance criteria, is in `NEXT_IMPLEMENTATION_PROMPT.md`.

## Document index

- `COMPLETE_FEATURE_AUDIT.md` — 26 features, status and evidence
- `FRONTEND_ROUTE_AUDIT.md` — 17 routes, browser results
- `API_ENDPOINT_AUDIT.md` — 13 network operations, probes
- `BACKEND_DATABASE_AUDIT.md` — schema, RLS, persistence, tenancy
- `INTEGRATION_AUDIT.md` — every integration classified A–F
- `SECURITY_AUDIT.md` — findings by severity
- `TEST_EXECUTION_REPORT.md` — commands, outputs, vulnerabilities
- `PRODUCTION_GAP_REGISTER.md` — 35 prioritised issues
- `NEXT_IMPLEMENTATION_PROMPT.md` — self-contained prompt for the next session
