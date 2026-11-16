# NEXT SESSION PROMPT — VAKYAM VOICE V2 PRODUCTION READINESS IMPLEMENTATION

> **Progress note (2026-11-16 implementation session, commits `9fcba7d` → `117fbd4`).** Done: CI quality gates + gitleaks + signup check; `.env` untracked; `realtime-token` rate limit, speech-only path, generic 500, CORS origin; organisation-scoped schema, demo seed and pgTAP tests (written, **not applied**); `useOrg()` with real profile name; password reset; `npm audit fix` (0 high/critical in prod); CSP/headers; Tools and Compliance honest labelling; login redirect; phone overflow; Alerts nav; router flags; lint 0 warnings; Playwright public-surface suite. See `PRODUCTION_GAP_REGISTER.md` status table and `TEST_EXECUTION_REPORT.md` §7.
>
> **Before any further code, a human with access must:** (1) turn off "Allow new users to sign up" in the Supabase dashboard and confirm `bash scripts/check-auth-settings.sh` passes; (2) `npx supabase login && npx supabase link --project-ref eshtcyzraxojwkzqgqld && npx supabase db push`, then `npx supabase test db` with a local stack, then `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts`; (3) `npx supabase functions deploy realtime-token` and `npx supabase secrets set VOICE_SESSIONS_PER_HOUR=10 ALLOWED_ORIGIN=<app origin>`; (4) set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` as GitHub repository **variables** so the CI `auth-settings` and `e2e` jobs run. Items 6–9 and 13 below start only after step 2.

Copy everything below this line into a fresh Claude Code session. It is self-contained.

---

You are continuing development of **Vakyam Voice V2**, a Vite + React 18 + TypeScript + Tailwind 3 single-page app with Supabase Auth and one Supabase Edge Function (`realtime-token`) that brokers Azure OpenAI Realtime voice sessions for an AI concierge called "Meera". A 13-screen supervisor console lives under `/console`.

## Project facts (verified 2026-11-16)

- Local path: `~/Desktop/Wayam AI/vakyam`
- Remote to push to: `v2` → `https://github.com/arkabera2004/Vakyam_voice_V2.git`, branch `main`. (`origin` points at `WayamAI/Vakyam-Voice`; do not push there.)
- Audit baseline commit: `5e56660` plus the audit docs commit that follows it.
- Scripts: `npm run dev` (Vite, port 8080 by default), `npm run build`, `npm run lint`, `npm test` (vitest), `npm run preview`.
- Quality baseline: tsc clean, eslint 0 errors / 5 warnings, 18/18 unit tests pass, build passes.
- Supabase project ref: `eshtcyzraxojwkzqgqld`. Frontend env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (see `.env.example`). Function secrets (set with `supabase secrets set`, never committed): `AZURE_OPENAI_RESOURCE`, `AZURE_OPENAI_API_KEY`, `AZURE_REALTIME_DEPLOYMENT`, `AZURE_REALTIME_VOICE`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `AZURE_SPEECH_VOICE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- Working-tree items that belong to the user and must never be staged: `.env` (modified), `Screenshot 2026-11-13 at 17.37.52.png`.
- Key files: `src/App.tsx` (routes), `src/components/ProtectedRoute.tsx`, `src/contexts/AuthContext.tsx`, `src/console/store.tsx` (localStorage state), `src/console/ConsoleShell.tsx`, `src/pages/console/*.tsx` (13 screens), `src/hooks/useVoiceAgent.ts`, `src/lib/speechOutput.ts`, `src/console/speak.ts`, `supabase/functions/realtime-token/{index,prompt,inventory}.ts`, `supabase/migrations/*.sql` (one table: `profiles`).

## What the audit found (read `docs/production-audit/` first)

Read, in this order: `EXECUTIVE_SUMMARY.md`, `PRODUCTION_GAP_REGISTER.md`, `SECURITY_AUDIT.md`, `BACKEND_DATABASE_AUDIT.md`, `COMPLETE_FEATURE_AUDIT.md`, `API_ENDPOINT_AUDIT.md`, `INTEGRATION_AUDIT.md`, `FRONTEND_ROUTE_AUDIT.md`, `TEST_EXECUTION_REPORT.md`.

One-paragraph version: authentication, route guarding and the voice-session broker are real and verified. **Everything in the console is a demo**: all 13 screens render constants and persist changes to `localStorage` under one key, with no tables, no roles, no tenant model, no telephony, no CRM, no recordings and no server-side audit log. The realtime agent has no tools; it narrates a mock inventory. Public signup is enabled on the live Supabase project although the README says otherwise. `.env` is tracked with an explicit `!.env` ignore rule. There are 12 production-tree npm vulnerabilities including a direct `react-router-dom` high.

## Non-negotiable rules

1. Do not start a new project, rewrite the architecture, or replace the component system.
2. Never commit `.env`, secrets, screenshots, or the user's untracked files. Never print `.env` values.
3. Never add an authentication bypass, even temporarily.
4. Do not convert simulated features into claims of live integrations. Where a feature stays mock, label it as mock in the UI.
5. Atomic commits: one logical change per commit, conventional commit messages, push each to `v2 main` immediately, verify with `git ls-remote v2 refs/heads/main`. No force-push, no amend of pushed commits, no `git add .`.
6. Test after each change: `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm test`, `npm run build`. Add a test for every bug fix and every new non-trivial logic path.
7. Do not perform destructive operations on the live Supabase project. Use a Supabase branch or a local `supabase start` stack for migrations, then apply to production only after review.
8. Report honestly: VERIFIED only with evidence; BLOCKED with the reason.

## Phases — do them in order, finishing all P0 before any P1

### Phase 0 — Discovery (no changes)
Inspect `git status`, remotes, branch, last 10 commits, `package.json`, and re-read the audit docs. Confirm the dev server command and port. Confirm nothing in the gap register has already been fixed.

### Phase 1 — P0
1. **GAP-S-01** Disable public signup. If you have dashboard or Management API access, turn it off; otherwise write a script `scripts/check-auth-settings.sh` that fails when `disable_signup` is false, add it to CI, and STOP and ask the user to flip the switch. Acceptance: `GET /auth/v1/settings` shows `disable_signup: true`.
2. **GAP-D-03** Untrack `.env`: remove `!.env` from `.gitignore`, `git rm --cached .env` (file stays on disk), confirm `.env.example` is complete, add a gitleaks (or `trufflehog`) step to CI. Acceptance: `git ls-files .env` is empty; CI secret scan green.
3. **GAP-S-02** Rate-limit `realtime-token`: migration creating `public.voice_sessions(id, user_id, created_at, kind)` with RLS (insert/select own rows); the function inserts a row per issued token and rejects with 429 when the caller has more than N (default 10) in the last hour. Add a `speechOnly` request flag that returns only the Speech token without creating a Realtime session (also closes GAP-B-05), and make `src/console/speak.ts` use it. Acceptance: curl loop shows 429; console previews no longer call Azure `client_secrets`.
4. **GAP-F-01 (foundation only in this phase)** Design and apply the domain schema with RLS by organisation: `organisations`, `org_members(user_id, org_id, role)`, `agents`, `agent_versions`, `calls`, `call_turns`, `transfers`, `qa_scores`, `rubrics`, `adapters`, `campaigns`, `knowledge_sources`, `policy_gates`, `disclosure_versions`, `pii_settings`, `audit_log` (append-only, written via `security definer` RPC that stamps `auth.uid()`), `deletion_requests`. Seed one demo organisation with the data currently hard-coded in `src/console/store.tsx` and the page constants so the demo keeps working. Add RLS tests (two users, two orgs). Acceptance: migrations apply cleanly on a branch; RLS tests pass.

### Phase 2 — P1
5. **GAP-B-01** Role and tenant plumbing in the SPA: a `useOrg()` hook, real user name from `profiles`, role-gated controls, remove "Kavita Rao" literals.
6. **GAP-S-03** Replace `useConsole` localStorage writes with server reads/writes screen by screen, in this order: Compliance (audit log, PII, disclosure, deletion requests), Knowledge (gates, sources, versions), Agent Studio (versions, persona, dictionary, voice), Tools (adapters, with GAP-S-05 fix: remove the token field until Vault-backed), Routing (campaigns), QA (reviewers, rubric weights — closes GAP-F-04), Home/Transfers/Alerts (decisions). Keep "Reset demo" only for users with role `admin` of the demo org, or remove it. One commit per screen.
7. **GAP-F-02** Make the edge function read the live `agent_versions` row (prompt text, voice, speed) for the caller's org instead of `prompt.ts` constants and env; keep `prompt.ts` as the seed.
8. **GAP-B-03** Persist calls: insert a `calls` row when a `/voice` session starts, update on end; stream `call_turns` from the data-channel text events; show real calls on Live calls and Call review (closes GAP-F-03 by reading `?call=`).
9. **GAP-B-02** Add realtime function tools to the session (`lookup_member`, `check_availability`, `place_hold`, `create_case`, `log_call`, `handoff`) handled by a new edge function `agent-tools`, with a mock provider behind `AGENT_TOOLS_PROVIDER=mock` and a documented interface for real providers. Tool calls write to the tables above so the console's tool trace becomes real.
10. **GAP-S-04** Compliance copy: remove or back every claim. Verify Azure resource regions and print the real region from the function.
11. **GAP-S-06** Password reset flow (`/reset`), Supabase email template configured.
12. **GAP-D-01** `npm audit fix`; verify; commit.
13. **GAP-B-04** Decide with the user which integrations are in scope for the first client; implement real health checks for those; mark the rest "Not available" in the UI.

### Phase 3 — P2
14. GAP-F-05 real dates; GAP-F-06 `/login` redirect when signed in; GAP-F-07 bell and cost widget; GAP-F-14 phone-width horizontal overflow on Home and QA; GAP-S-07 headers/CSP; GAP-S-08 generic 500s + CORS origin; GAP-T-01 Playwright suite (login, guard, each screen, voice mock) + vitest for `useVoiceAgent`; GAP-T-02 PR CI workflow; GAP-O-01 Sentry + backups; GAP-O-02 single deploy target documented; GAP-D-02 vitest major upgrade.

### Phase 4 — P3
15. GAP-F-08 router future flags; GAP-F-09 lint warnings; GAP-F-10 404 logging; GAP-F-15 Alerts route sidebar state; GAP-F-11 surface function error bodies; GAP-F-13 new logo once the user supplies the official tile PNG/SVG and horizontal lockup (do not crop from screenshots).

## Dependencies
- 5 depends on 4. 6 depends on 4 and 5. 7, 8, 9 depend on 4. 8 depends on 7 for voice settings. 9 depends on 8 for call rows. 10 is independent. 13 depends on 6 (Tools screen on the server).

## Verification you must produce at the end
- Updated `docs/production-audit/TEST_EXECUTION_REPORT.md` with every command and result.
- `npm audit --omit=dev` at 0 high/critical.
- Playwright run output.
- RLS test output with two orgs.
- `git log --oneline` of all commits and `git ls-remote v2 refs/heads/main` matching local HEAD.
- A list of anything left BLOCKED and why.
