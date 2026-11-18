# Vakyam Voice V2 — Security Audit

No credential values appear in this document.

## 1. Authentication and session

| Item | Finding | Evidence | Severity |
|---|---|---|---|
| Login | Supabase email + password. Errors surfaced via toast. | `AuthContext.tsx:52-55`, `Login.tsx:33-45` | Info |
| Session storage | `localStorage`, `persistSession`, `autoRefreshToken` | `client.ts:11-15` | Low: XSS would expose the refresh token; standard for Supabase SPAs |
| Logout | `supabase.auth.signOut()` | `AuthContext.tsx:57-59` | Info |
| Password reset | **Not implemented.** No UI, no call to `resetPasswordForEmail` | grep | Medium (client cannot recover accounts without an admin) |
| MFA | Not implemented | — | Low for demo, Medium for client |
| Already-authenticated user visiting `/login` | Form still renders; no redirect | `Login.tsx` has no `user` check | Low |
| Signup | No UI. README instructs disabling signups in Supabase dashboard; live check in API_ENDPOINT_AUDIT E13 | README "Client accounts" | Must verify |
| Authentication bypass | **None found.** `ProtectedRoute` is the only gate and it checks `user` from the Supabase session. No env flag, no `localStorage` override, no test hook. | `ProtectedRoute.tsx:20`; grep for `bypass`, `DEMO_AUTH`, `skipAuth` returns nothing | Pass |

## 2. Authorization and tenancy

| Item | Finding | Severity |
|---|---|---|
| Roles | None. Every signed-in user is rendered as "Kavita Rao, Floor supervisor" (`ConsoleShell.tsx:176`) and all actions are attributed to `SUPERVISOR = "Kavita Rao"` (`store.tsx:81`) | High for client use: audit log attribution is fictional |
| Tenant isolation | None. No tenant column, no per-org data (see BACKEND_DATABASE_AUDIT §5) | Critical for multi-client, N/A for single demo |
| Edge function authorization | Any signed-in user can mint unlimited Azure sessions; no rate limit, no per-user quota | High (cost abuse by any one account) |
| RLS | `profiles`: SELECT/UPDATE/INSERT own row only; no DELETE policy. Correct for what exists | Pass |

## 3. Secrets and configuration

| Item | Finding | Severity |
|---|---|---|
| `.env` is tracked in git | `.gitignore` contains `!.env`, and `git ls-files .env` lists it. The committed file holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` only. These are publishable by design and also ship in the JS bundle. | Low today |
| Uncommitted local `.env` edit | The working-tree `.env` has been reformatted to list Azure secret **names** (`AZURE_OPENAI_API_KEY`, `AZURE_SPEECH_KEY`, …) under a comment. If values are filled in and the file is committed, real secrets land in a public-ish repo. This audit did not read values. | **High risk of accident**: move these to `supabase/.env.local` (gitignored) as README says, and remove `!.env` from `.gitignore` |
| Secrets in the frontend bundle | Only `VITE_*` Supabase values. Azure keys are read via `Deno.env` in the function only (`index.ts:20-33`) | Pass |
| Secrets in repo history | Not scanned beyond `.env`; recommend `gitleaks` before any public release | Unverified |
| Error messages | Function returns the config error text to the client (`"AZURE_OPENAI_RESOURCE is not configured"`) | Low |
| CORS | `Access-Control-Allow-Origin: *` on the function (`index.ts:5-8`). Acceptable because a user JWT is still required; tighten to the app origin for production | Low |
| Security headers | SWA config sets `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy: microphone=(self)`; nginx config sets none; no CSP anywhere | Medium |

## 4. Data handling

| Item | Finding | Severity |
|---|---|---|
| Recording and transcript access | No recordings or transcripts exist server-side; the console's are fiction. "PII redaction" toggles alter nothing but a localStorage flag (`Compliance.tsx:33-38`) | Info (but the UI implies controls that do not exist: High for client trust) |
| "DPDP aligned", "Data region India", "Leaves region never" | Static text (`Compliance.tsx:98-104`). Realtime audio goes to whatever Azure region `AZURE_OPENAI_RESOURCE` is in; Speech to `AZURE_SPEECH_REGION`. Not verified by this audit | **High**: unverifiable compliance claims shown to users |
| Deletion request | Writes an audit row only; purges nothing | High (if presented to a client as a DPDP control) |
| Audit log | Client-side, editable, resettable ("Reset demo") | High for governance claims |
| Tools "Configure" token field | Accepts a secret in a `type="password"` input and discards it while the toast says it is "stored server side" (`Tools.tsx:67-76`). Users may paste real CRM secrets into a demo | Medium (deceptive UX) |
| Logging | `NotFound.tsx:8` logs every unknown path with `console.error`; voice failures logged with `console.error` including the error object. No PII logged | Low |
| Call cap | 10-minute hard stop on calls (`useVoiceAgent.ts:16`) | Pass |

## 5. Dependencies

`npm audit` at audit time: **12 vulnerabilities (10 high, 2 moderate)** reported by npm. Of those sampled, `source-map-js` (high, event-loop DoS via crafted source maps) and `yaml` (moderate) are **build-time** transitive dependencies (PostCSS/Tailwind), not shipped to the browser. Full breakdown pending in TEST_EXECUTION_REPORT.md. None of the runtime deps (`@supabase/supabase-js`, `react`, `react-router-dom`, `microsoft-cognitiveservices-speech-sdk`, `lucide-react`) were flagged in the sampled output.

## 6. Findings by severity

- **Critical**: none that affects the current single-tenant demo. For client use: no tenant isolation (SEC-01).
- **High**: SEC-02 unlimited Azure session minting per user; SEC-03 unverifiable compliance claims in UI; SEC-04 audit log is client-side and resettable; SEC-05 `.env` tracked with `!.env` ignore rule while Azure secret names are being added locally.
- **Medium**: SEC-06 no password reset; SEC-07 no CSP / headers on nginx path; SEC-08 Tools token field discards secrets while claiming storage.
- **Low**: SEC-09 config error text in 500 body; SEC-10 CORS `*`; SEC-11 `/login` reachable while signed in; SEC-12 session in localStorage.

## 7. 2026-11-18 addendum — session 3 security review

Scope: static review of every migration and Edge Function added since the findings above (roles, invitations, calls, retention, transcripts, evaluations, CRM). Most SEC-01 through SEC-06 above are now resolved by that work (roles, tenant isolation, rate limiting, consent/retention fail-safes); this addendum covers only what changed.

### RLS coverage: complete
Every one of the 39 tables across all migrations has Row Level Security enabled — verified by extracting every `CREATE TABLE public.X` and every `ALTER TABLE public.X ENABLE ROW LEVEL SECURITY` (including the three dynamic `FOREACH`/`EXECUTE format(...)` loops in `20261116150000` and `20261117100000`) and confirming the two sets match exactly. No table was created without a corresponding RLS policy.

### SECURITY DEFINER functions: all gate on the caller's role
Every function running as `SECURITY DEFINER` (`start_call`, `advance_call`, `append_transcript_segment`, `submit_evaluation`, `add_evaluation_review`, `set_legal_hold`, `set_member_status`, `enqueue_crm_sync`, `log_audit`, the trigger functions) was individually re-read to confirm it checks `can_manage_org`/`can_edit_org`/`can_review_org` or an explicit row-ownership match (`started_by = auth.uid()`) before acting, and that the tenant check is parameterised by the row's own `org_id` rather than a caller-supplied value that could name a different organisation. No privilege-escalation path found.

### Finding: query-string injection via unvalidated UUIDs — fixed, commit `11ae57b`
`realtime-token`'s `callId` and `crm-test-connection`'s `integrationId` were taken from the request body and interpolated directly into a PostgREST URL (`?id=eq.<value>`) without validating they were well-formed UUIDs first. Since that query string is itself a filter expression, a crafted value containing `&` or `,` could inject additional filter operators. RLS still bounds which rows are reachable underneath, so the impact was contained, but the input should never have reached that URL unvalidated. Added `isUuid()` in `_shared/http.ts`, applied at both sites, and de-duplicated `invite-user/validate.ts`'s equivalent regex against it.

### Finding: ambiguous-column bugs — fixed, commit `bbeb511` (see `docs/IMPLEMENTATION_LOG.md`)
Not a security vulnerability, but a correctness/availability risk worth recording here: PL/pgSQL's default `variable_conflict = error` means a bare identifier that matches both a function parameter and a table column raises `column reference "x" is ambiguous` at execution time, not at migration time, so SQL parsing (the only check available without Docker) could not catch it. Found in `append_transcript_segment` (already shipped unexecuted, fixed in place since nothing is deployed) and caught before shipping in `submit_evaluation`. Every function across every migration was re-audited line by line for the same pattern; none remain. New functions (`enqueue_crm_sync`) adopt parameter names that never exactly match a column name, as a second layer of defence beyond aliasing.

### Not newly reviewed this pass
Dependency audit (`npm audit`), CSP/header configuration, and the `.env` tracking question are unchanged from the original audit above; re-verify them before any deployment rather than assuming they still hold.

## 8. 2026-11-18 addendum — complete-project master prompt security review

### Finding: documented recording-playback rule was never actually enforced — fixed, commit `c7c62e8`
`src/domain/roles.ts`'s `canPlayRecording()` has always documented that an agent may play back the recording of a call they personally started, in addition to reviewers. The storage RLS policy on the `recordings` bucket only ever checked `can_review_org()`, with no such exception — an agent could never actually hear their own call. Found by comparing the documented domain rule against the actually-enforced policy while reviewing the new signed-URL playback added to `CallReview.tsx` this session, rather than assuming the two agreed. `can_play_recording_object()` now mirrors the TypeScript rule exactly in SQL, and the storage policy uses it. 7 pgTAP assertions.

### RLS and SECURITY DEFINER re-review
Every table and function touched or added this session (`crm_integrations`, `crm_sync_jobs`, `consent_policies`, `retention_policies`, `pii_settings`, `deletion_requests`, `audit_log`, `approve_consent_policy`, `can_play_recording_object`) was re-checked against the same two invariants established in the §7 addendum: every table has RLS enabled (all were already covered by the original migrations; none of this session's work added a new table without one), and every `SECURITY DEFINER` function gates on the caller's role against the row's own `org_id` rather than a caller-supplied value. No further ambiguous-column instances were found in the three new functions added this session (`approve_consent_policy`, `guard_consent_policy_content`, `can_play_recording_object`) — all were written with the by-now-established convention of parameter names that never exactly match a column name, plus full table aliasing.

### Client-side signed URL generation (CallReview.tsx)
`supabase.storage.from(bucket).createSignedUrl(...)` is called unconditionally from the client for any call the screen loads; this is safe because the Storage API itself enforces `storage.objects` RLS using the caller's JWT — a caller without playback rights simply receives no signed URL (handled as "no recording" in the UI), rather than the client needing to pre-check permission itself. No client-side-only authorization exists here.

### Not newly reviewed this pass (again)
Dependency audit, CSP/headers, `.env` tracking, and anything not touched by this session's Tools/Compliance/Live-calls/Call-review/Agent-Studio work.
- **Informational**: no auth bypass present; RLS correct on the one table; Azure keys never reach the browser.
