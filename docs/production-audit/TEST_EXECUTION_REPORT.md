# Vakyam Voice V2 — Test Execution Report

> **Implementation session, 2026-11-16 (after the audit).** Results for the remediation commits `9fcba7d`…HEAD are in section 7 at the end. Sections 1–6 are the audit baseline and are kept as written.

All commands run on 2026-11-16 from `~/Desktop/Wayam AI/vakyam` at HEAD `5e56660` (plus untracked `docs/`). Nothing was piped through `grep` to hide failures; where output is trimmed, the pass/fail line is reproduced verbatim.

## 1. Quality gates

| # | Command | Result | Detail |
|---|---|---|---|
| Q1 | `npx tsc --noEmit -p tsconfig.app.json` | **PASS** | exit 0, no diagnostics |
| Q2 | `npx tsc --noEmit -p tsconfig.node.json` | **PASS** | exit 0 |
| Q3 | `npm run lint` (`eslint .`) | **PASS with warnings** | At session start: `✖ 6 problems (1 error, 5 warnings)`. The error (`tailwind.config.ts:67 no-require-imports`) was fixed in commit `5e56660`. After the fix: `✖ 5 problems (0 errors, 5 warnings)`. Remaining warnings are all `react-refresh/only-export-components` in `button.tsx`, `store.tsx` (3), `AuthContext.tsx` |
| Q4 | `npm test` (`vitest run`) | **PASS** | `Test Files 8 passed (8)`, `Tests 18 passed (18)`, 0 skipped, 0 failed, duration 1.07 s |
| Q5 | `npm run build` (`vite build`) | **PASS** | `✓ built in 3.21s`. Largest chunks: `index-*.js` 446 kB (133 kB gzip), `speechOutput-*.js` 384 kB (83 kB gzip, lazy) |
| Q6 | `npm audit` | **23 vulnerabilities**: 2 critical, 15 high, 6 moderate | See §3 |
| Q7 | `npm audit --omit=dev` | **12 vulnerabilities**: 0 critical, 10 high, 2 moderate | See §3 |
| Q8 | Integration / E2E test suites | **NONE EXIST** | No Playwright/Cypress config in repo. The previous session's "headless Playwright" run was ad hoc and not committed |

## 2. Unit test inventory (what the 18 tests actually cover)

| File | Tests | What it proves | What it does not prove |
|---|---|---|---|
| `src/console/store.test.ts` | 2 | Default state shape; `nowLabel` formatting | Persistence, reducer behaviour, cross-screen updates |
| `src/console/speak.test.ts` | 1 | `pickVoice` locale preference | Any audio playback, Azure path |
| `src/console/search.test.ts` | 4 | Pure search over static arrays | — |
| `src/console/export.test.ts` | 2 | CSV quoting/joining | Browser download |
| `src/console/data/policy.test.ts` | ~4 | Regex policy answers against gate map | Anything the real agent says |
| `src/console/data/routing.test.ts` | ~2 | Rule precedence in `routeCall` | Real routing |
| `src/console/data/sortCalls.test.ts` | ~2 | Sort orders | — |
| `src/console/data/transcripts.test.ts` | ~1 | Generated transcript shape | — |

Coverage of real business paths: **zero**. No test touches `AuthContext`, `ProtectedRoute`, `useVoiceAgent`, `speechOutput`, the edge function, or any page component. All tests are pure-function tests over mock data. No flaky or skipped tests observed.

## 3. Dependency audit detail

Production tree (`--omit=dev`), 12 findings:

| Package | Severity | Direct? | Runtime-relevant? | Advisory (short) | Fix |
|---|---|---|---|---|---|
| react-router-dom / react-router / @remix-run/router | high | react-router-dom is DIRECT | **Yes** (shipped) | XSS via open redirects; unexpected external redirect via untrusted paths | `npm audit fix` (non-major) |
| nanoid | high | transitive | likely shipped (postcss dep chain; check bundle) | infinite loop with negative size | fix |
| postcss | high | DIRECT (dev usage) | build-time | XSS via unescaped `</style>` in stringify | fix |
| postcss-selector-parser, source-map-js, yaml, brace-expansion, glob, minimatch, picomatch | high/moderate | transitive | build-time only | ReDoS / DoS classes | fix |

Dev-only (excluded by `--omit=dev`): `vitest`/`tinypool`/`@vitest/mocker` (2 critical + 1 moderate; fix requires vitest 5.1.0 **major**), `vite` (high, dev server file serving), `esbuild` (moderate), `browserslist`, `flatted`, `js-yaml`, `ajv`, `@humanfs/node`.

Action: `npm audit fix` resolves everything except the vitest major; schedule that separately. Logged as GAP-D-01/02.

## 4. Endpoint probes (curl, synthetic data only; no account created, no mutation)

Host `eshtcyzraxojwkzqgqld.supabase.co`. Publishable key read from `.env` into a shell variable and never printed.

| Probe | Request | Response | Verdict |
|---|---|---|---|
| E01-a | `POST /functions/v1/realtime-token` no headers | `401` | PASS (unauthenticated rejected) |
| E01-b | same with `Authorization: Bearer <publishable key>` + `apikey` | `401 {"error":"Unauthorized"}` | PASS (anon key alone rejected, as `index.ts:36-45` intends) |
| E01-c | `OPTIONS` with `Origin: http://localhost:5181` | `200` | PASS (CORS preflight served) |
| E01-d | `GET` with apikey | `401 {"error":"Unauthorized"}` | PASS (no method check, but auth gate still holds) |
| E01-e | `POST` with a valid user JWT | **not run** (each success spends an Azure Realtime session) | UNVERIFIED by choice; code reviewed |
| E05 | `POST /auth/v1/token?grant_type=password` with `nobody@example.com` / wrong password | `400 {"error_code":"invalid_credentials"}` | PASS |
| E06 | `POST /auth/v1/signup` with `…@example.invalid` | `400 email_address_invalid` | INCONCLUSIVE (Supabase rejected the TLD before evaluating signup policy). Replaced by E08 |
| E07 | `GET /rest/v1/profiles?select=id` with anon key | `200 []` | PASS (RLS hides rows from anon) |
| E08 | `GET /auth/v1/settings` | `"disable_signup":false`, `"mailer_autoconfirm":false`, email provider on, every OAuth provider off, anonymous users off | **FAIL vs README**: public signup is **enabled** on the live project. Anyone with the bundle's publishable key can register (email confirmation required) and then sign into the console and call `realtime-token`. P0, GAP-S-01 |

Deployed-function existence: confirmed indirectly (E01 returns the function's own JSON body, not a Supabase 404).

## 5. Browser verification (Claude in Chrome, Chrome profile already signed in as a demo account)

Dev server: reused the already-running Vite instance at `http://localhost:5181` (pid 99501, cwd this repo). A second instance on 8081 (pid 53915) was used for the signed-out checks after removing only that origin's session token. No server was started or stopped.

| Check | Result |
|---|---|
| `/console` renders for a signed-in session without visiting `/login` | PASS (session restore) |
| Signed out: `/console/analytics` → `/login` | PASS |
| Signed out: `/voice` → `/login` | PASS |
| Wrong credentials on `/login` | PASS: destructive toast "Login failed — Invalid login credentials" |
| Console errors across routes | **0 errors**. Only warnings: two React Router v7 future-flag warnings per navigation |
| Failed network requests | none observed |
| All 17 routes loaded | PASS (16 signed in + 404); 1 content defect (`/console/review` ignores `?call=`) |
| Home decision workflow → audit row → badge → survives reload | PASS (localStorage only) |
| 390 px emulation | Alerts, Live detail, Login PASS; Home (397 px) and QA (558 px) overflow horizontally |
| Route-by-route results | see FRONTEND_ROUTE_AUDIT.md |

## 6. Blocked

| Item | Why |
|---|---|
| Live Azure voice call | Needs an interactive microphone session; automation cannot grant mic |
| Azure Speech preview path | Depends on function secrets; not exercised to avoid minting sessions |
| Supabase dashboard inspection via connector (tables, RLS, advisors, function list, logs) | Connector returned `You do not have permission to perform this action` for project `eshtcyzraxojwkzqgqld` |
| GitHub Actions deploy run | No run triggered; workflow only reviewed |

## 7. Implementation session results (2026-11-16, commits 9fcba7d → HEAD)

### 7.1 Quality gates at HEAD

| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `npm run lint` | PASS, **0 errors, 0 warnings** (was 5 warnings) |
| `npm test` (vitest 2.1.9) | PASS: 11 files, **26 tests**, 0 skipped (new: `limits.test.ts` ×4, `useOrg.test.ts` ×2, `clock.test.ts` ×2) |
| `npm run build` | PASS |
| `npm run test:e2e` (Playwright 1.65.1, chromium) | PASS: **20 passed** (10 tests × desktop + iPhone 13), 17.7 s, twice on fresh servers |
| `npx deno check supabase/functions/realtime-token/index.ts` | PASS |
| `npm audit --omit=dev --audit-level=high` | PASS, exit 0: **0 high / 0 critical**, 5 moderate (build-time) |
| `npm audit` (all) | 17 (14 moderate, 1 high, 2 critical), all in dev tooling: vitest 5 requires Vite 6+, project is on Vite 5 (GAP-D-02 open) |
| `bash scripts/check-auth-settings.sh` | **FAIL as intended**: `disable_signup=false` on the live project. Flip it in the dashboard and re-run |
| SQL syntax (libpg_query via pglast) | PASS for the 3 new migrations and the pgTAP file (5 + 36 + 17 + 28 statements) |
| `npx supabase test db` | **BLOCKED**: no Docker / local stack on this machine |

### 7.2 Browser verification (fresh dev server, signed-in demo session carried across ports)

| Check | Result |
|---|---|
| Sidebar shows the real profile name ("demo") from `profiles`; `org_members` 404s until the migration is applied and degrades to "No organisation yet" | PASS, 0 console errors |
| `/login` while signed in → `/console` | PASS |
| `/reset` email step; `/reset#type=recovery` fresh load → "Set new password" | PASS (also in Playwright) |
| Home date/greeting live ("Monday, 16 November, 20:45 IST", "Good evening"); Routing clock "now 20:46" | PASS |
| Compliance shows "Target policy" and "Demo data" pills instead of compliance claims | PASS |
| Tools Configure modal: no credential field, "Demo adapter" hint | PASS |
| Alerts active in sidebar; header bell links to `/console/alerts` | PASS |
| 390 px: `/console` and `/console/qa` document width equals viewport (was 397 and 558) | PASS |
| React Router future-flag warnings | gone |

### 7.3 Not run and why

| Item | Reason |
|---|---|
| Applying migrations `20261116140000`, `20261116150000`, `20261116150100` | No `supabase login`, no Docker, connector lacks project permission. Apply with `npx supabase link --project-ref eshtcyzraxojwkzqgqld && npx supabase db push`, then `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts` |
| pgTAP RLS tests | Same; run `npx supabase start && npx supabase test db` |
| Deploying `realtime-token` with the rate limit, speech-only path, generic errors and `ALLOWED_ORIGIN` | `npx supabase functions deploy realtime-token`; set `VOICE_SESSIONS_PER_HOUR` and `ALLOWED_ORIGIN` secrets. The 429 curl loop needs the deployed function and a user JWT |
| CSP smoke test of a real voice call | Needs a deploy with the new headers |
| Password-reset email delivery | Needs SMTP / template in the Supabase dashboard; no email was sent |
| Screens reading from the database (GAP-S-03 items 6–9, 13) | Blocked on the migration being applied; not started so as not to ship unverifiable code |
