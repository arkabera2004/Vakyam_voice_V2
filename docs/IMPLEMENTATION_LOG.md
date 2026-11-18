# Vakyam Voice V2 — Implementation Log

One entry per atomic commit or verified fact. States: IMPLEMENTED (code in repo), TESTED (automated tests pass locally), DEPLOYED (on the target environment), VERIFIED (observed working end to end), BLOCKED, NOT STARTED. Newest at the bottom.

## 2026-11-17 — Phase 0: discovery and baseline

### Repository identity (VERIFIED)
- Path `~/Desktop/Wayam AI/vakyam`; branch `main` tracks `v2/main`; `v2` = `github.com/arkabera2004/Vakyam_voice_V2.git`; `origin` = WayamAI/Vakyam-Voice and is never pushed to.
- HEAD at start: `0863393`, local == remote. Working tree clean except the user's untracked `Screenshot 2026-11-13 at 17.37.52.png` and `docs/vakyam/`, which are never staged.

### Baseline gates on `0863393` (TESTED)
| Gate | Result |
|---|---|
| `tsc -p tsconfig.app.json` / `tsconfig.node.json` | PASS / PASS |
| `eslint .` | 0 errors, 0 warnings |
| `vitest run` | 11 files, 26 tests, 0 skipped |
| `vite build` | PASS |
| `deno check` realtime-token | PASS |
| `npm audit --omit=dev --audit-level=high` | exit 0 (5 moderate, build-time) |
| `npm audit` (all) | 17: 2 critical, 1 high, 14 moderate, all dev tooling (vitest 5 needs Vite ≥ 6) |
| `playwright test` | 20 passed |
| `scripts/check-auth-settings.sh` | **FAIL**: `disable_signup=false` on `eshtcyzraxojwkzqgqld` |

### Live environment (VERIFIED by REST probe with the publishable key)
- Tables present: `profiles` (200). Absent: `voice_sessions`, `organisations`, `org_members`, `agents`, `calls`, `audit_log` (404). None of the three 2026-11-16 migrations is applied.
- Storage: no buckets defined in the repo; bucket listing endpoint answered 200 to the anon role (verify in dashboard that no bucket is public).
- Edge function `realtime-token` deployed in an older form (answers 401 to unauthenticated POST); the rate-limit/speech-only version at HEAD is NOT DEPLOYED.

### Access available in this environment (BLOCKED items)
- No Docker → no local Supabase stack, no `supabase test db`.
- No `supabase login` / `SUPABASE_ACCESS_TOKEN` → no `db push`, no `functions deploy`, no `gen types`, no secrets.
- Supabase MCP connector: permission denied on this project.
- No Azure secrets locally → no live voice verification.
- Dashboard access (signup switch, SMTP) is the user's.

### Decisions recorded
- The 2026-11-16 migrations are unapplied everywhere, so they are edited in place (roles, helpers) rather than layered with ALTER migrations. Once any migration is applied, only additive migrations follow.
- Role model: `super_admin`, `org_admin`, `supervisor`, `agent`, `qa_analyst`, organisation-level, single source in `src/domain/roles.ts` and SQL helpers.
- Domain rules (session state machine, consent gate, retention eligibility, permissions) are written as framework-free modules under `src/domain/` with unit tests, so they are TESTED even while persistence is BLOCKED.

### Commits (2026-11-16 → 2026-11-17 session 1)
| SHA | Change | Tests | Push |
|---|---|---|---|
| `4f235a6` | feat(db): five agreed roles, permission tiers and call state columns | SQL parse only | verified |
| `ff2ef6b` | feat(domain): permission matrix as the single source for roles | vitest | verified |
| `1a34019` | feat(domain): voice session state machine | vitest | verified |
| `ac7135d` | feat(db): voice platform schema, state transitions, buckets and pgTAP tests | SQL parse only; pgTAP NOT executed | verified |

## 2026-11-17 — Continuation session 2

### Phase 0: recovery audit (VERIFIED)
- Local HEAD == `v2/main` == `ac7135d` at start. Untracked `src/domain/{consent,retention}*.ts` were complete and passing. The invite-user, retention-sweep and `_shared/auth.ts` files the earlier transcript mentioned never existed on disk.
- Full report: `docs/CONTINUATION_STATUS.md`.
- Baseline on `ac7135d` + domain files: vitest 15 files / 40 tests pass; tsc app+node pass; eslint 0/0.
- Live project probe: `disable_signup=false` still; only `profiles` exists; no buckets; function answers 401 unauthenticated. Supabase MCP connector denied; CLI has no token. Docker Desktop installed but daemon was not running (started this session).

| Date | Phase | SHA | Message | Changed | Tests | Result | Push |
|---|---|---|---|---|---|---|---|
| 2026-11-17 | 0 | `9d1fe0c` | feat(domain): recording consent gate and retention planning | 4 files under `src/domain/` | `vitest run` | 40/40 | `git ls-remote v2` = `9d1fe0c` |
| 2026-11-17 | 0 | `104ae71` | fix(roles): make the SPA use the five-role permission matrix | `useOrg.ts(.test)`, `types.ts`, `ConsoleShell.tsx`, `MobileSupervisor.tsx` | tsc, eslint, `vitest run` | 40/40 | `git ls-remote v2` = `104ae71` |
| 2026-11-17 | 2 | `4305291` | feat(functions): shared caller authentication, permissions and HTTP helpers | `supabase/functions/_shared/{auth,permissions,http}.ts(.test)` | `vitest run`, `deno check` | 53/53 | `git ls-remote v2` = `4305291` |
| 2026-11-17 | 2 | `78628fd` | feat(db): invitation lifecycle, membership status and acceptance trigger | `20261117120000_invitation_lifecycle.sql`, `invitations.test.sql` | SQL parse only; pgTAP NOT executed (Docker daemon unresponsive) | 14 assertions written | `git ls-remote v2` = `78628fd` |
| 2026-11-17 | 2 | `d51add3` | feat(auth): invite-user Edge Function with validation and revocation | `supabase/functions/invite-user/*` | `vitest run`, `deno check` | 57/57 | `git ls-remote v2` = `d51add3` |
| 2026-11-17 | 2 | `1f52990` | feat(auth): invitation acceptance page at /accept | `src/pages/AcceptInvitation.tsx`, `App.tsx` | tsc, eslint, `vitest run`, `npm run build` | 57/57 | `git ls-remote v2` = `1f52990` |
| 2026-11-17 | 7 | `091f6aa` | feat(db): legal hold on recordings and transcripts, retention run records | `20261117130000_retention_legal_hold.sql`, `retention.test.sql` | SQL parse only; pgTAP NOT executed | 9 assertions written | `git ls-remote v2` = `091f6aa` |
| 2026-11-17 | 7 | `f450800` | feat(functions): retention-sweep applies recording and transcript policy | `retention-sweep/index.ts`, `_shared/retention.ts(.test)`, `domain/retention.ts(.test)` | `vitest run`, `deno check` | 57/57 | `git ls-remote v2` = `f450800` |
| 2026-11-17 | 2 | `ffa9c73` | fix(roles): make canAssignRole live in the domain, not only its mirror | `domain/roles.ts(.test)`, `_shared/permissions.test.ts` | `vitest run` | 58/58 | `git ls-remote v2` = `ffa9c73` |
| 2026-11-17 | 2/12 | `ed50113` | feat(console): real Team screen for invitations and membership | `pages/console/Team.tsx`, `nav.ts`, `ConsoleShell.tsx`, `App.tsx`, `types.ts` | tsc, eslint, `vitest run`, `npm run build` | 58/58 | `git ls-remote v2` = `ed50113` |

### Session 2 end-of-session summary (see `docs/CONTINUATION_STATUS.md` for full detail)
- Baseline: 19 test files / 58 unit tests pass, tsc clean, eslint 0/0, production build passes.
- Standing blocker discovered: Docker Desktop's backend processes have been running since 28 Oct without ever answering `docker info` — a hung daemon, not a slow one. No pgTAP suite (4 files, 56 assertions total across `rls`, `voice_platform`, `invitations`, `retention`) has ever actually executed; all are SQL-parse-verified only.
- Still blocked as before: Supabase access token (no `db push`/`functions deploy`/`gen types --linked`), public signup still enabled on the live project, no SMTP configured, no consent wording supplied.
- Next smallest task: Phase 6 — wire `useVoiceAgent.ts`/`Index.tsx` to create and advance a real `calls` row per session (needs an org/agent lookup the voice page does not currently do).

## 2026-11-17/18 — Session 3: browser call persistence and agent-driven realtime-token

| Date | Phase | SHA | Message | Changed | Tests | Result | Push |
|---|---|---|---|---|---|---|---|
| 2026-11-17 | 1 | — | Docker recovery attempted: `docker desktop restart`/`start` both run; restart explicitly failed (`context deadline exceeded` stopping two hung backend processes alive since 28 Oct) | — | — | BLOCKED, documented | n/a |
| 2026-11-18 | 2 | `7ac2f98` | feat(db): start_call() resolves org, agent and permission server-side | `20261117140000_start_call.sql`, `calls.test.sql` | SQL parse only; pgTAP NOT executed (Docker) | 9 assertions written | `git ls-remote v2` = `7ac2f98` |
| 2026-11-18 | 2 | `27d4f3d` | feat(voice): callSession module for call persistence, with tests | `src/lib/callSession.ts(.test)` | `vitest run` | 66/66 | `git ls-remote v2` = `27d4f3d` |
| 2026-11-18 | 2 | `2a37ebd` | feat(voice): persist the real browser call lifecycle to the database | `useVoiceAgent.ts` | `vitest run`, `tsc`, `eslint`, `npm run build` | 66/66 | `git ls-remote v2` = `2a37ebd` |
| 2026-11-18 | 2 | `b1f57f4` | feat(functions): call-sweep as the safety net for abandoned calls | `supabase/functions/call-sweep/index.ts` | `deno check`, `vitest run` | 66/66 | `git ls-remote v2` = `b1f57f4` |
| 2026-11-18 | 3 | `f9c902e` | feat(voice): agentConfig merges a published agent_version over the seed | `realtime-token/agentConfig.ts(.test)` | `vitest run`, `deno check` | 73/73 | `git ls-remote v2` = `f9c902e` |
| 2026-11-18 | 3 | `a040173` | feat(voice): realtime-token uses the call's own agent configuration | `realtime-token/{index,limits}.ts(.test)`, `useVoiceAgent.ts` | `vitest run`, `deno check`, `tsc`, `eslint`, `npm run build` | 73/73 | `git ls-remote v2` = `a040173` |

### Session 3, Phase 4 (part 1 and 2): consent resolution and transcript persistence

| Date | Phase | SHA | Message | Changed | Tests | Result | Push |
|---|---|---|---|---|---|---|---|
| 2026-11-18 | 4 | `c8335f2` | feat(db): resolve consent at call creation | `20261117150000_call_consent_resolution.sql`, `calls.test.sql` | SQL parse only; pgTAP NOT executed | 12 assertions written | `git ls-remote v2` = `c8335f2` |
| 2026-11-18 | 4 | `ddad3bf` | feat(db): append_transcript_segment(), finalised on a terminal call | `20261118100000_transcript_segments.sql`, `transcripts.test.sql` | SQL parse only; pgTAP NOT executed | 10 assertions written | `git ls-remote v2` = `ddad3bf` |
| 2026-11-18 | 4 | `409a2ab` | feat(voice): persist the agent's spoken turns as transcript segments | `src/lib/callSession.ts(.test)`, `useVoiceAgent.ts` | `vitest run`, `tsc`, `eslint`, `npm run build` | 76/76 | `git ls-remote v2` = `409a2ab` |

### Session 3 summary
- Baseline: 21 test files / 76 unit tests pass, tsc clean (app+node), eslint 0/0, production build passes, every Edge Function Deno-checks clean.
- Docker: exhausted every sanctioned remediation path (`open -a Docker`, `osascript quit app`, `docker desktop restart`, `docker desktop start`); the official restart command itself reports failure to stop the hung backend. This needs the user to force-quit Docker Desktop (Activity Monitor) or restart the machine — force-killing processes directly is outside what this session may do.
- Phase 2 (browser call persistence), Phase 3 (agent-driven realtime-token) and the server-side half of Phase 4 (consent resolution, agent-turn transcript persistence) are code-complete and unit-tested; none is deployed or verified against the live Supabase project or real Azure credentials.
- Explicitly not attempted, with reasons recorded in `docs/CONTINUATION_STATUS.md`: audio recording upload, the member's (caller's) transcript turns, and how a member's verbal consent is captured — the first two need a real browser/live Azure session this environment cannot provide, the third needs a product decision.
- Next task: a product decision on consent capture, then recording upload once that and a verifiable browser/Azure path exist; independently, Phase 6 (evaluation workflow) or wiring Agent Studio to real data can proceed without either.

## 2026-11-18 — Session 3 continued, on "do the Docker work later, complete the other works"

| Date | Phase | SHA | Message | Changed | Tests | Result | Push |
|---|---|---|---|---|---|---|---|
| 2026-11-18 | — | `bbeb511` (2 commits) | fix: ambiguous-column bug in append_transcript_segment(); feat: evaluation workflow | `20261118100000_transcript_segments.sql` (fix), `20261118110000_evaluation_workflow.sql`, `evaluations.test.sql` | `vitest run`; SQL parse only, pgTAP NOT executed | 76/76; 15 new assertions | `git ls-remote v2` = `bbeb511` |
| 2026-11-18 | 8 | `33dc52c` (2 commits) | feat: CRM connector framework -- enqueue_crm_sync, test connection, sync worker | `20261118120000_crm_sync_queue.sql`, `crm_sync.test.sql`, `crm-test-connection/index.ts`, `crm-sync-worker/index.ts` | `vitest run`, `deno check` | 76/76; 9 new assertions | `git ls-remote v2` = `33dc52c` |

### Notable: a real bug was caught, not just written tests for

While writing `submit_evaluation()`, I recognised the same bug class I had just shipped unexecuted in `append_transcript_segment()` (commit `ddad3bf`): PL/pgSQL's `variable_conflict = error` default means an unqualified identifier that matches **both** a function parameter and a table column being scanned raises `column reference "x" is ambiguous` **at execution time**, not at migration time. SQL parsing — the only verification available without Docker — cannot catch this. Found and fixed three instances (`append_transcript_segment`'s `call_id`, `submit_evaluation`'s `template_id` and a nested `transcripts` subquery), then re-audited every other function in the repository line by line to confirm no further instances exist, and adopted a naming convention for new functions (parameter names that never exactly match a column name) to prevent recurrence. See `docs/production-audit/SECURITY_AUDIT.md` update and commit `bbeb511` for detail.

### Scope note

Per the user's explicit instruction, Docker/local-pgTAP-execution recovery was deliberately deferred this session; all five new pgTAP files (`calls`, `transcripts`, `evaluations`, `crm_sync`, plus the extended `calls` consent assertions) remain SQL-parse-verified and line-by-line reviewed, but never executed. This is the standing verification gap across the whole session, not specific to any one phase.

## 2026-11-18 — Session 3 continued again: reviewer assignment and QA Scorecards wiring

| Date | Phase | SHA | Message | Changed | Tests | Result | Push |
|---|---|---|---|---|---|---|---|
| 2026-11-18 | 6 | `01751d5` | feat(db): reviewer assignment and flagging for the evaluation queue | `20261118130000_evaluation_review_assignment.sql`, `evaluation_assignment.test.sql` | SQL parse only; pgTAP NOT executed | 10 assertions written | `git ls-remote v2` = `01751d5` |
| 2026-11-18 | 10 | `b79a7c2` | feat(console): wire QA scorecards to real evaluations, not demo data | `types.ts`, `QAScorecards.tsx` | tsc, eslint, `vitest run`, `npm run build` | 78/78 | `git ls-remote v2` = `b79a7c2` |

### Summary
Replaced QAScorecards.tsx's fictional per-prompt-version heatmap, fixed flagged-call list and hardcoded reviewer names with real data: criterion averages computed from `evaluation_scores`, actually-flagged `evaluations` (below their template's `pass_threshold`, now computed server-side), and a reviewer dropdown backed by the org's real `evaluations.review`-tier members. Deliberately did not build an "edit rubric weights" flow: `evaluation_criteria` is read by `submit_evaluation()`, so editing it in place would silently reinterpret every past score computed under the old weights; a real fix needs template versioning (a new `evaluation_templates` row, not an edit), which is future scope, not something to fake. Baseline: 22 test files, 78 unit tests, tsc clean, eslint 0/0, build passes.

## 2026-11-18 — Agent Studio: backend and frontend integration

| Date | Phase | SHA | Message | Changed | Tests | Result | Push |
|---|---|---|---|---|---|---|---|
| 2026-11-18 | 1 | `96b2b0d` | feat(db): agent_versions immutability trigger and publish_agent_version() | `20261118140000_agent_version_publishing.sql`, `agent_versions.test.sql` | SQL parse only; pgTAP NOT executed | 11 assertions written | `git ls-remote v2` = `96b2b0d` |
| 2026-11-18 | 1 | `2d7992d` | fix(voice): make the agent's stored voice choice actually affect calls | `realtime-token/agentConfig.ts(.test)`, `realtime-token/index.ts` | `vitest run`, `deno check` | 81/81 | `git ls-remote v2` = `2d7992d` |
| 2026-11-18 | 2-6 | `415115d` | feat(console): wire Agent Studio to real agents and agent_versions | `types.ts`, `AgentStudio.tsx` | tsc, eslint, `vitest run`, `npm run build` | 81/81 | `git ls-remote v2` = `415115d` |
| 2026-11-18 | 6 | `54ec617` | test(voice): unit test nextVersion, extracted to keep Fast Refresh clean | `src/lib/agentVersion.ts(.test)`, `AgentStudio.tsx` | tsc, eslint, `vitest run`, `npm run build` | 85/85 | `git ls-remote v2` = `54ec617` |

### Architectural decisions made, and why
- **No `status` column added to `agents` or `agent_versions`.** The existing design already distinguishes draft from published purely by whether a version's string matches `agents.live_version` — a pointer, not a flag. Adding a redundant status field would be an unnecessary schema change the master prompt explicitly asked to avoid, and the pointer model already satisfies "draft versions, published versions, version history" without it.
- **`agent_versions` is now database-enforced immutable.** The pre-existing `editors update agent_versions` RLS policy let anyone with edit rights change a row that a historical call may permanently reference via `calls.agent_version_id` — silently reinterpreting what that call actually used. Dropped that policy, added a `BEFORE UPDATE` trigger that refuses every update. "Save" in the UI is always an insert; "publish" only ever moves the `agents.live_version` pointer, which is safe to update since it is not itself a snapshot.
- **Fixed a latent, previously-undiscovered defect**: Agent Studio's voice picker (`aarti`/`marin`) had never actually affected a real call, because `resolveAgentConfig()` (added in session 3) only recognised genuine Azure voice identifiers and silently discarded the Studio's own cosmetic labels. Split the single voice override into a Speech-path one and a realtime-path one, and mapped the known labels to what each path actually expects.
- **Dropped the fictional cross-version QA comparison table** (the old "compare v7 with v6" modal showed invented numbers). Nothing in the current schema computes a real version-to-version score comparison without further design (it would need to join `calls.agent_version_id` to `evaluations.overall_score` and aggregate per version) — left as a documented future enhancement rather than faked.

### Verified
23 test files, 85 unit tests, TypeScript clean, ESLint 0 warnings, production build passes, Deno check clean on the touched Edge Function. **Not verified**: none of the new pgTAP assertions (agent_versions immutability, publish_agent_version permission boundaries) have executed against a real database — Docker remains deferred per explicit instruction. Nothing is deployed.

### Product decision still needed
None for this phase — the draft/published model, immutability, and voice-label mapping were all resolvable from the existing architecture without new input.

## 2026-11-18 — Cross-version QA comparison

| Date | Phase | SHA | Message | Changed | Tests | Result | Push |
|---|---|---|---|---|---|---|---|
| 2026-11-18 | — | `871d263` | feat(db): agent_version_score_summary() for cross-version QA comparison | `20261118150000_agent_version_score_summary.sql`, `agent_version_score_summary.test.sql` | SQL parse only; pgTAP NOT executed | 8 assertions written | `git ls-remote v2` = `871d263` |
| 2026-11-18 | — | `1624be0` | feat(console): real cross-version QA comparison in Agent Studio | `types.ts`, `AgentStudio.tsx` | tsc, eslint, `vitest run`, `npm run build` | 85/85 | `git ls-remote v2` = `1624be0` |

Replaces the fictional "compare v7 with v6" table Agent Studio's rewrite had intentionally dropped (see above) with a real one: `agent_version_score_summary()` averages `evaluations.overall_score` grouped by `calls.agent_version_id`, excluding a call with no evaluation yet and an evaluation whose `overall_score` is still NULL (in progress) rather than counting either as a zero. Read-only to any org member, since it exposes nothing not already visible by reading the underlying tables directly. "Compare scores" in the Versions panel renders it as a plain table, live version highlighted the same way the versions list already does. No product decision was needed; no new schema either, since `calls.agent_version_id` and `evaluations.overall_score` already existed from earlier session work — this was purely an aggregation query that plain PostgREST cannot express.

## 2026-11-18 — Complete-project master prompt: Tools/CRM, Compliance, Live calls, Call review

| Date | Phase | SHA | Message | Changed | Tests | Result | Push |
|---|---|---|---|---|---|---|---|
| 2026-11-18 | 8 | `6c2b51b` | feat(console): wire Tools to real CRM integrations, drop fake vendor rows | `Tools.tsx`, `types.ts` | tsc, eslint, `vitest run`, `npm run build` | 85/85 | `git ls-remote v2` = `6c2b51b` |
| 2026-11-18 | 2 | `d2bde68` | feat(db): consent policy approval workflow with content immutability | `20261118160000_consent_policy_approval.sql`, `consent_policy_approval.test.sql` | SQL parse only; pgTAP NOT executed | 11 assertions written | `git ls-remote v2` = `d2bde68` |
| 2026-11-18 | 2/6 | `7d4e52a` | feat(console): wire Compliance to real consent, retention, PII and audit data | `Compliance.tsx`, `types.ts` | tsc, eslint, `vitest run`, `npm run build` | 85/85 | `git ls-remote v2` = `7d4e52a` |
| 2026-11-18 | 4 | `c7bc6d3` | feat(console): wire Live calls and Call review to real call data | `LiveCalls.tsx`, `CallReview.tsx`, `types.ts` | tsc, eslint, `vitest run`, `npm run build` | 85/85 | `git ls-remote v2` = `c7bc6d3` |

### What this closed
- **Tools**: six invented CRM vendors and a fabricated telephony panel replaced with the real `crm_integrations`/`crm_sync_jobs` tables and the already-built `crm-test-connection`/`enqueue_crm_sync` functions. "Run connection tests" used to literally say "(simulated)... no real adapter was contacted" in its own toast.
- **Compliance**: the single most fictional screen in the product — a static disclosure line, an invented 14-day/"17,806 calls" consent chart, a retention KV contradicting the real 365-day policy already in the database, PII toggles that reset on refresh, a fictional TRAI DLT panel, and a client-side-only audit log — rewired end to end to `consent_policies` (with a new `approve_consent_policy()` and the same content-immutability pattern as `agent_versions`), `retention_policies`, `pii_settings`, `deletion_requests` and the real `audit_log`.
- **Live calls / Call review**: GAP-F-03, open since the very first audit of this codebase, is finally closed — Call review now actually reads its `?call=` parameter instead of always showing the same hardcoded call. Both screens show real data with honest empty states; the waveform animation, callback-task system and CSAT badge were dropped rather than faked, since nothing backs them.

### Deliberately not attempted this pass, and why
`Home.tsx`'s "Needs you" decision queue (refund/upgrade approvals) has no backing table at all — building it would mean designing a new approval-workflow schema, not wiring existing data, and was out of scope for "connect to real backend" work. `LiveCallDetail.tsx` (needs a realtime subscription design), `WarmTransfer.tsx` and `Routing.tsx` (nothing creates the rows they would read), `Knowledge.tsx` (not consumed by the actual prompt pipeline), `Analytics.tsx` (explicitly deferred per instruction), and a Notifications UI (table exists, nothing creates/reads notifications yet) all remain demo or not implemented. Full list in `docs/production-audit/PRODUCTION_GAP_REGISTER.md`.

Baseline throughout: 23 test files, 85 unit tests, tsc clean, eslint 0 warnings, build passes. No pgTAP executed (Docker deferred per explicit instruction).

## 2026-11-18 — Recording capture/upload, notifications, LiveCallDetail realtime

| Date | Phase | SHA | Message | Changed | Tests | Result | Push |
|---|---|---|---|---|---|---|---|
| 2026-11-18 | 7 | `cd41f49` | feat(db): create_recording(), fails safe on calls.recording_allowed | `20261118180000_recording_upload.sql`, `recording_upload.test.sql` | SQL parse only; pgTAP NOT executed | 9 assertions written | `git ls-remote v2` = `cd41f49` |
| 2026-11-18 | 7 | `c85c42a` | feat(voice): recording foundation — org/eligibility plumbing, mime/path helpers, SpeechOutput tap | `callSession.ts(.test)`, `callRecorder.ts(.test)`, `speechOutput.ts` | `vitest run` | 92/92 | `git ls-remote v2` = `c85c42a` |
| 2026-11-18 | 7 | `fe25203` | feat(voice): capture, mix and upload the real call recording | `useVoiceAgent.ts` | tsc, eslint, `vitest run`, `npm run build` | 92/92 | `git ls-remote v2` = `fe25203` |
| 2026-11-18 | — | `5739fe9` | feat(db): notify a reviewer when a flagged call is assigned to them | `20261118190000_notifications.sql`, `notifications.test.sql` | SQL parse only; pgTAP NOT executed | 6 assertions written | `git ls-remote v2` = `5739fe9` |
| 2026-11-18 | — | `d101623` | feat(console): real notifications screen and unread bell badge | `types.ts`, `useNotifications.ts`, `MobileSupervisor.tsx`, `ConsoleShell.tsx` | tsc, eslint, `vitest run`, `npm run build` | 95/95 | `git ls-remote v2` = `d101623` |
| 2026-11-18 | — | `acf4369` | feat(db): enable Realtime on calls and transcript_segments | `20261118200000_realtime_publication.sql` | SQL parse only; publication membership is not pgTAP-testable | — | `git ls-remote v2` = `acf4369` |
| 2026-11-18 | — | `8b6ab13` | feat(console): real live-call detail with a Realtime transcript | `LiveCallDetail.tsx` | tsc, eslint, `vitest run`, `npm run build` | 95/95 | `git ls-remote v2` = `8b6ab13` |

### What this closed
- **Recording capture/upload** (`GAP-C-13`, previously "NOT STARTED"): a call's microphone and remote/synthesized audio are now mixed into a `MediaStreamAudioDestinationNode` and recorded with `MediaRecorder`, uploaded to the `recordings` bucket on teardown, and registered via the new `create_recording()` RPC. The RPC fails safe — it refuses to create a row if `calls.recording_allowed` is false, mirroring the consent resolution already enforced at call start — and extends storage upload rights to the agent who started the call (the same ownership-or-editor exception already established for `append_transcript_segment`). Azure-session-specific behaviour is unverifiable without a live call, but the capture/mix/upload code itself uses only standard Web APIs (`MediaRecorder`, `AudioContext`, multi-consumer `MediaStream`) and was reasoned through, not guessed.
- **Notifications** (previously "NOT IMPLEMENTED (UI)"): `assign_evaluation_reviewer()` now inserts a `notifications` row when a flagged call is newly assigned to a reviewer (not on a no-op reassignment or a clear), and `MobileSupervisor.tsx`'s old fictional alert feed (refund-approval cards, a takeover button, a Freshdesk-retry card — none backed by any table) is replaced with a real list via the new `useNotifications()` hook. The sidebar bell in `ConsoleShell.tsx` now shows a real unread-count dot instead of a static icon.
- **`LiveCallDetail.tsx`** (previously "DEMO"): now fetches the real `calls`/`transcripts`/`transcript_segments` rows for its route id and opens a Supabase Realtime channel so new transcript segments and call-status changes stream in live. Required first adding `calls` and `transcript_segments` to the `supabase_realtime` publication — caught via `grep` before shipping, since nothing had ever enabled Realtime on either table. The old whisper/barge-in/takeover controls and fake "tool trace" were dropped, not faked: this product has no server-side audio-mixing architecture that would let a supervisor join or inject audio into a single-party browser call, and the realtime agent has no tools wired yet (`GAP-B-02`, still open).

### Deliberately not attempted this pass, and why
`WarmTransfer.tsx` still has no real trigger that creates a `transfers` row (no UI or call-flow does), so its read side has not yet been wired — it is next. `Routing.tsx` remains telephony-dependent and out of scope. `Knowledge.tsx`'s tables are still not consumed by the actual agent prompt pipeline. `Home.tsx`'s approval queue and `Analytics.tsx`'s invented-pricing widgets still need a product decision before any schema or UI work is appropriate. Caller-side transcript turns still need a live-Azure-only session-config change not verifiable in this environment.

Baseline throughout: 24 test files, 95 unit tests, tsc clean, eslint 0 warnings, build passes. No pgTAP executed (Docker deferred per explicit instruction).
