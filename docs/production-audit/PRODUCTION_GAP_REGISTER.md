# Vakyam Voice V2 — Production Gap Register

## Status after the 2026-11-16 implementation session

| Item | Status | Commit(s) | Remaining |
|---|---|---|---|
| GAP-S-01 signup | **Code done, switch pending** | `16964bc` | Flip "Allow new users to sign up" off in the dashboard; CI job `auth-settings` fails until then |
| GAP-S-02 rate limit | **Code done, deploy pending** | `ee31e74`, `b8032da` | Apply `voice_sessions` migration, deploy function, set `VOICE_SESSIONS_PER_HOUR` |
| GAP-D-03 `.env` tracked | **Done** | `dcafc2d` | — |
| GAP-F-01 schema foundation | **Written, apply pending** | `448bc2e` | `supabase db push`, run pgTAP, regenerate types |
| GAP-B-01 roles/tenant (SPA) | **Part 1 done** (`useOrg`, real name) | `9cc8dfb` | Role-gated controls once `org_members` exists |
| GAP-S-03 audit log server-side | Schema + `log_audit()` written | `448bc2e` | Wire screens (blocked on apply) |
| GAP-S-04 compliance claims | **Done** | `860305b` | Verify Azure regions when wiring real retention |
| GAP-S-05 Tools token field | **Done** | `9b36217` | — |
| GAP-S-06 password reset | **Done** (UI + Supabase calls) | `2304816` | Configure SMTP/template |
| GAP-S-07 headers/CSP | **Done** | `c685dc6` | Smoke-test a voice call after deploy |
| GAP-S-08 generic 500 + CORS | **Done** | `3ba3a0d` | Set `ALLOWED_ORIGIN` |
| GAP-B-02/03/04, GAP-F-02/03/04 | **Open, blocked** on the migration being applied | — | See NEXT_IMPLEMENTATION_PROMPT |
| GAP-B-05 previews spend realtime sessions | **Done** | `ee31e74`, `b8032da` | — |
| GAP-D-01 prod vulnerabilities | **Done** (0 high/critical) | `ef21bfe` | — |
| GAP-D-02 vitest major | **Open**: vitest 5 needs Vite ≥ 6 | — | Upgrade Vite + plugin-react-swc first |
| GAP-F-05 dates | **Done** (Home, Routing) | `c3daec3` | CallReview "yesterday" stays until real calls |
| GAP-F-06 /login redirect | **Done** | `5415e51` | — |
| GAP-F-07 bell / cost widget | **Done** (bell → alerts; cost labelled demo) | `dd38645` | Real cost needs usage data |
| GAP-F-08 router flags | **Done** | `581d6c6` | — |
| GAP-F-09 lint warnings | **Done** (0 warnings) | refactor commit after `cf6594f` | — |
| GAP-F-10 404 logging | **Done** | `7237f29` | — |
| GAP-F-11 function error bodies | **Done** | `9508ffb` | — |
| GAP-F-13 logo | **Done** (earlier) | `e4bb86e`… | Vector master for print |
| GAP-F-14 phone overflow | **Done** | `c38928a`, `f53b2bf` | — |
| GAP-F-15 Alerts nav | **Done** | `dd38645` | — |
| GAP-T-01 E2E tests | **Part 1 done** (public surface, 20 checks) | `cf6594f` | Signed-in screen tests need a CI test account |
| GAP-T-02 CI | **Done** | `9fcba7d` + later jobs | Set `VITE_SUPABASE_*` repository variables |
| GAP-O-01 monitoring/backups | **Open** | — | Needs a Sentry DSN and a backup decision |
| GAP-O-02 deploy target | **Open** | — | User decision: SWA, Vercel or Docker |

Original register follows.

Priority: **P0** must fix before any deployment · **P1** must fix before a client uses it · **P2** before wider rollout · **P3** improvement.

Status words follow EXECUTIVE_SUMMARY.md. "Verification required" states what the next session must show as evidence before closing the item.

## P0 — Critical

### GAP-S-01 Public signup is enabled on the live Supabase project
- Category: Security / Auth
- Description: `GET /auth/v1/settings` returns `"disable_signup": false`. The README (section "Client accounts") says signups must be turned off. The publishable key ships in the bundle, so anyone can self-register, confirm by email, log in to the console and call `realtime-token` to spend Azure credit.
- Business impact: uncontrolled access to the client console and uncontrolled Azure spend.
- Technical impact: `ProtectedRoute` trusts any Supabase user; the edge function trusts any user.
- Affected: `/login`, `/console/*`, `/voice`, edge function E01.
- Files: Supabase dashboard (Authentication → Sign In / Providers → "Allow new users to sign up"); `README.md`.
- Dependencies: none.
- Fix: disable signup in the dashboard; add a repeatable check (a script or test that asserts `disable_signup === true` against `/auth/v1/settings`).
- Acceptance: settings endpoint returns `disable_signup: true`; a signup POST with a syntactically valid synthetic address returns the "Signups not allowed" error.
- Verification required: curl output pasted into TEST_EXECUTION_REPORT.

### GAP-S-02 No rate limit or quota on `realtime-token`
- Category: Security / Cost
- Description: each POST mints an Azure Realtime client secret (`index.ts:54`) and optionally a Speech token. No per-user or global limit; the console's voice previews also call it (`speak.ts:52`).
- Impact: one leaked or malicious account can run up Azure cost without bound.
- Files: `supabase/functions/realtime-token/index.ts`.
- Fix: per-user token bucket (e.g. a `voice_sessions` table with RLS, count in last hour), reject above N; separate lightweight "speech-token" path for console previews (see GAP-B-05).
- Acceptance: 11th request within an hour from one user returns 429; previews no longer create Realtime sessions.
- Verification: curl loop with a test JWT; Azure usage log shows no Realtime session for a console preview.

### GAP-D-03 `.env` is tracked and the ignore rule explicitly un-ignores it; local copy is accumulating Azure secret names
- Category: Secrets
- Description: `.gitignore` has `!.env`; `git ls-files .env` lists it; the working-tree diff adds `AZURE_OPENAI_API_KEY`, `AZURE_SPEECH_KEY`, etc. as keys. One `git add .` would publish Azure secrets.
- Fix: remove `!.env` from `.gitignore`, `git rm --cached .env`, keep `.env.example`; move Azure values to `supabase/.env.local` (already gitignored). Add a pre-commit secret scan (gitleaks) to CI.
- Acceptance: `.env` absent from `git ls-files`; CI secret scan passes on history or history is documented as scrubbed.
- Verification: `git ls-files .env` empty; gitleaks report.

### GAP-F-01 Every console screen runs on hard-coded or localStorage data
- Category: Backend / Data
- Description: Home, Live calls, Call detail, Transfers, Review, QA, Studio, Tools, Routing, Knowledge, Compliance, Analytics, Alerts render constants from `.tsx` files; every mutation goes to `localStorage['vakyam-console-v1']` (`store.tsx`). No table exists for any of it.
- Business impact: a client would be shown a fictional Club Mahindra desk. Nothing they change is shared with colleagues or survives a browser reset.
- Fix: define the real domain model (orgs, users, roles, agents, prompt versions, calls, transcripts, recordings, transfers, qa_scores, rubrics, adapters, campaigns, knowledge_sources, policy_gates, disclosure_versions, pii_settings, audit_log, deletion_requests) as Supabase migrations with RLS by `org_id`; replace `useConsole` state with server reads/writes.
- Acceptance: each screen reads from the DB; two users in one org see the same state; a user in another org sees none of it.
- Verification: integration tests against a Supabase branch; RLS tests with two JWTs.

## P1 — High

### GAP-S-03 Audit log is client-side, editable, and attributed to a fixed fictional supervisor
- Files: `store.tsx:81` (`SUPERVISOR = "Kavita Rao"`), `ConsoleShell.tsx:174-177`.
- Fix: server-side append-only `audit_log` table written via RPC with `auth.uid()`; display the real user's name from `profiles`.
- Acceptance: audit rows cannot be edited or deleted by any client role; "Reset demo" no longer exists or is admin-only.

### GAP-S-04 Compliance screen asserts controls that do not exist
- Description: "DPDP aligned", "Data region India", "Leaves region never", PII redaction toggles, deletion request "purged within 7 days", TRAI DLT "Synced" are literals (`Compliance.tsx:85-127`).
- Impact: a client may rely on these; legal exposure.
- Fix: either remove the claims or back each one with a real control and show its real status. Verify Azure resource regions. Do not ship compliance text without a signed-off control.
- Acceptance: every compliance statement maps to a verifiable backend fact or is removed.

### GAP-S-05 Tools "Configure" accepts a secret and discards it while claiming server-side storage
- Files: `Tools.tsx:67-76, 176-183`.
- Fix: remove the field until a secret store exists; when built, store via an edge function into Supabase Vault, never return it.
- Acceptance: no password-type input without a backing write.

### GAP-S-06 No password reset
- Fix: add `supabase.auth.resetPasswordForEmail` flow and a `/reset` route; configure Supabase email templates/SMTP.
- Acceptance: reset email received and new password works, verified in staging.

### GAP-B-01 Tenant isolation and roles do not exist
- Depends on GAP-F-01. Add `organisations`, `org_members(role)`; JWT custom claim or lookup; RLS on every table by `org_id`; UI role gating (supervisor vs agent vs admin).
- Acceptance: cross-org read returns zero rows under RLS tests.

### GAP-B-02 The realtime agent has no tools; holds, cases and lookups are narrated from mock text
- Files: `index.ts:58-64` (no `tools` in session), `inventory.ts`.
- Fix: define realtime function tools (`lookup_member`, `check_availability`, `place_hold`, `create_case`, `log_call`, `handoff`) handled by an edge function or backend that calls the client's systems; keep a mock implementation behind a flag for demos.
- Acceptance: a hold placed on a call appears in a `holds` table and in the console.

### GAP-B-03 No call records, transcripts or recordings are stored
- Fix: on session start, insert a `calls` row; stream transcript events to `transcripts`; store recordings only after consent design review.
- Acceptance: a completed `/voice` call appears on the Live/Review screens.

### GAP-B-04 Telephony, CRM, campaign and DLT integrations are UI only
- Files: `Tools.tsx`, `Routing.tsx`.
- Fix: scope which are in the first client release; implement real adapters; remove rows for the rest.
- Acceptance: "Run connection tests" performs a real health call and shows real latency.

### GAP-D-01 Runtime dependency vulnerabilities (`react-router-dom` high: open-redirect XSS)
- Fix: `npm audit fix`; re-run lint/test/build.
- Acceptance: `npm audit --omit=dev` reports 0 high/critical.

### GAP-F-02 Agent Studio controls are not connected to the deployed agent
- Description: prompt versions, persona, dictionary, voice, speed, warmth never reach `realtime-token`.
- Fix: store agent config server-side (GAP-F-01), have the function read the live version's prompt/voice from the DB instead of `prompt.ts` constants and env.
- Acceptance: changing the voice in Studio changes the voice on the next `/voice` call.

## P2 — Medium

### GAP-F-03 Call review ignores the `?call=` parameter
- Files: `QAScorecards.tsx:150` navigates to `/console/review?call=4801`; `CallReview.tsx` always shows 4790. Browser-confirmed.
- Fix: read `useSearchParams` and load the selected call (requires GAP-B-03 for real data).
- Acceptance: opening call 4801 from QA shows call 4801.

### GAP-F-04 QA rubric weights are component state and are lost on refresh
- Files: `QAScorecards.tsx:46`.
- Fix: persist with the rubric model.

### GAP-F-05 Hard-coded dates and times
- "Thursday, 12 November, 14:10 IST" (`Home.tsx:51`), "now 14:10" (`Routing.tsx:97`), "yesterday 16:12" (`CallReview.tsx:71`), analytics day labels.
- Fix: derive from real data or `new Date()`.

### GAP-F-06 `/login` renders the form for an already-signed-in user
- Fix: redirect to `/console` when `user` is set.

### GAP-F-07 Notifications bell has no handler; AI cost widget is static
- Files: `ConsoleShell.tsx:162-171, 193-195`.
- Fix: implement or remove.

### GAP-B-05 Console voice previews mint a Realtime session to obtain a Speech token
- Files: `speak.ts:49-66`, `index.ts:53-72`.
- Fix: add a `?speechOnly=1` path (or separate function) that returns only the Speech token.

### GAP-S-07 Missing security headers / CSP on nginx and SWA
- Fix: add CSP, HSTS, frame-ancestors to `nginx.conf` and `staticwebapp.config.json`.

### GAP-S-08 Function returns configuration error text and uses CORS `*`
- Fix: generic 500 message, log details server-side; restrict origin.

### GAP-T-01 No integration or E2E tests; unit tests cover only mock helpers
- Fix: Playwright suite for login, route guard, each console screen, one voice-session mock; vitest for `useVoiceAgent` with mocked `fetch`; RLS tests.
- Acceptance: CI runs them on every PR.

### GAP-T-02 No CI for lint/test/build
- `.github/workflows/azure-static-web-app.yml` only builds and deploys. Add a PR workflow that runs `tsc`, `eslint`, `vitest`, `build`, `npm audit --omit=dev`.

### GAP-O-01 No monitoring, error reporting, or backups documented
- Fix: Sentry (or equivalent) in the SPA and function; Supabase PITR/backups confirmed; alert on function 5xx rate.

### GAP-O-02 Deployment target ambiguity
- Three targets (SWA, Vercel, Docker). Pick one for the client, document env and secrets per environment, confirm which GitHub repo's workflow is live.

### GAP-D-02 Dev-tooling vulnerabilities need a vitest major upgrade
- Fix: `vitest@5.1.0` (major); verify the 8 test files still pass.

### GAP-F-14 Horizontal page scroll on phones for Home and QA scorecards
- Evidence: 390 px emulation, `document.documentElement.scrollWidth` 397 on `/console` and 558 on `/console/qa` versus a 386 px viewport. `QAScorecards.tsx:103-161` renders two `w-full` tables without an `overflow-x-auto` wrapper; Home overflows by 11 px.
- Fix: wrap tables in `Panel className="overflow-x-auto"` with `min-w`, as Home's table already does; find the 11 px overflow on Home (likely the KPI grid `gap-x-8` at `grid-cols-2`).
- Acceptance: no route has `scrollWidth > innerWidth` at 390 px; add a Playwright viewport assertion.

## P3 — Low

### GAP-F-08 React Router v7 future-flag warnings on every navigation
- Fix: enable `v7_startTransition` and `v7_relativeSplatPath` in `BrowserRouter future={}`.

### GAP-F-09 ESLint `react-refresh/only-export-components` warnings (5)
- Fix: move non-component exports (`buttonVariants`, `useConsole`, `DEFAULT_STATE`, `useAuth`) to separate files.

### GAP-F-10 404 page logs `console.error` for every unknown path
- Fix: `console.warn` or remove.

### GAP-F-11 Supabase `functions.invoke` error message not surfaced to the user
- `useVoiceAgent.ts:122-125`: shows "Edge Function returned a non-2xx status code" instead of the function's `error` body.
- Fix: read `error.context.json()` for FunctionsHttpError.

### GAP-F-12 Login video asset missing (`public/auth-flow.mp4`)
- Optional; fallback works.

### GAP-F-13 New official Vakyam logo — DONE 2026-11-16 (commits e4bb86e…ea024ef)
- Tile, dark lockup, favicon.ico, apple-touch-icon and og image live under `public/brand/` and `public/`; old Wayam marks removed. Remaining limitation: assets were extracted from a lossless Retina screenshot of the design page (tile 246 px vs 256 px source, lockup 772 px). Ask for the vector master before print or large hero use.

### GAP-F-15 `/console/alerts` has no active state in the desktop sidebar
- The route exists only in `MOBILE_TABS` (`ConsoleShell.tsx:92-97`), not in `NAV`. On desktop the page renders with no highlighted item.
- Fix: add it to `NAV` or redirect desktop visitors to `/console`.

## Counts

| Priority | Items |
|---|---|
| P0 | 4 (GAP-S-01, GAP-S-02, GAP-D-03, GAP-F-01) |
| P1 | 10 |
| P2 | 14 |
| P3 | 7 |
| **Total** | **35** |
