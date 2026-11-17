# Vakyam Voice V2 — Continuation Status

Recovery audit of the repository at the start of the 2026-11-17 continuation session. The filesystem and Git history were the source of truth; the previous session's transcript was treated as historical evidence only.

## Git state

| Item | Value |
|---|---|
| Repository | `~/Desktop/Wayam AI/vakyam`, branch `main` tracking `v2/main` |
| `v2` remote | `https://github.com/arkabera2004/Vakyam_voice_V2.git` (push target) |
| `origin` remote | `https://github.com/WayamAI/Vakyam-Voice.git` (never pushed to) |
| Local HEAD at audit start | `ac7135d` |
| Remote `v2/main` at audit start | `ac7135d` (identical, no divergence) |
| Last historically confirmed commit | `ac7135d` feat(db): voice platform schema, state transitions, buckets and pgTAP tests |
| Commits after `ac7135d` on the remote | none |
| HEAD after this audit | `104ae71` (two corrective/completion commits, both pushed and verified with `git ls-remote`) |

### Uncommitted changes at audit start
- None to tracked files.

### Untracked files at audit start
| File | Classification | Action |
|---|---|---|
| `src/domain/consent.ts`, `consent.test.ts` | Complete, tests pass | Committed as `9d1fe0c` |
| `src/domain/retention.ts`, `retention.test.ts` | Complete, tests pass | Committed as `9d1fe0c` |
| `Screenshot 2026-11-13 at 17.37.52.png` | User's file | Never staged |
| `docs/vakyam/VIDEO_NARRATION.md` | User's file | Never staged |

### Files reported by the previous session that do NOT exist
`supabase/functions/invite-user/*`, `supabase/functions/retention-sweep/*`, `supabase/functions/_shared/auth.ts`. They were never written to disk. They are built fresh in Phase 2 and Phase 7.

## Completed functionality (verified this session)

| Area | Evidence |
|---|---|
| Role matrix `src/domain/roles.ts` (5 roles, 7 capabilities) | `roles.test.ts` passes; SQL helpers `org_role`, `can_manage_org`, `can_edit_org`, `can_review_org` mirror the tiers |
| Session state machine `src/domain/sessionState.ts` | `sessionState.test.ts` passes; `advance_call()` in `20261117100000_voice_platform.sql` encodes the identical transition table |
| Consent gate `src/domain/consent.ts` | 3 tests pass; fails safe without an approved policy |
| Retention planning `src/domain/retention.ts` | 3 tests pass; dry-run unless `deletionEnabled`; boundary (exactly `retainDays` old) is eligible |
| Migrations written | `20260112` profiles; `20261116140000` voice_sessions; `20261116150000` domain schema; `20261116150100` demo seed; `20261117100000` voice platform |
| pgTAP tests written | `rls.test.sql` (15 assertions), `voice_platform.test.sql` (18 assertions) |
| Edge function `realtime-token` | Auth check, per-user rate limit, speech-only path, generic 500, CORS origin |
| Frontend | Login, password reset, route guard, 13 console screens (demo data, localStorage), `/voice` WebRTC call |
| CI | tsc, lint, vitest, build, audit, gitleaks, Playwright public surface, auth-settings check |

## Baseline quality gates (run 2026-11-17 on `ac7135d` + untracked domain files)

| Gate | Result |
|---|---|
| `vitest run` | 15 files, 40 tests, all pass |
| `tsc -p tsconfig.app.json` and `tsconfig.node.json` | pass |
| `eslint .` | 0 errors, 0 warnings |

## Defects discovered and fixed

| ID | Defect | Fix |
|---|---|---|
| D-01 | `src/hooks/useOrg.ts` and the hand-written `types.ts` used a three-role union (`admin`/`supervisor`/`agent`), contradicting `org_members` CHECK and `roles.ts`; an `org_admin` or `qa_analyst` would be typed as unknown and `canEdit` was a second, competing permission rule | `104ae71`: hook narrows with `isRole()`, `canEdit` delegates to `can(role, "agents.edit")`, UI shows `ROLE_LABEL`, types list the five roles |

## Incomplete functionality (by phase)

| Phase | State |
|---|---|
| 1 Database | Migrations written, **not applied** to `eshtcyzraxojwkzqgqld` (REST probe: only `profiles` answers 200; `organisations`, `calls`, `recordings`, `invitations` etc. answer 404; no storage buckets). pgTAP never executed. Generated types are hand-written for 3 tables only |
| 2 Auth | Public signup still **enabled** (`disable_signup=false` on the live project). No invitation function. No acceptance flow. No deactivation |
| 3 Settings | Schema only; no UI or service |
| 4 Agents | Schema (`agents`, `agent_versions`) only; Studio screen writes localStorage; function still reads `prompt.ts` constants |
| 5 Azure | Realtime (speech-to-speech over WebRTC) plus Azure Speech TTS work for the fixed demo agent; no adapter boundary, no health check, no usage tracking, prompt/voice not per-agent |
| 6 Sessions | `advance_call()` and sweeper in SQL; the browser never creates a `calls` row |
| 7 Recording/consent/transcripts | Schema and domain rules only; no upload, no transcript persistence, no retention job |
| 8 Evaluation | Schema only |
| 9 Analytics | Screen renders constants |
| 10 CRM | Schema only |
| 11 Security/ops | CSP and headers done; no server-side audit wiring, no monitoring, no backups verified |
| 12 Integration | Every console screen is demo data |
| 13 Deployment | SWA workflow exists; nothing from this work is deployed |

## Tests

- Passing: 40 vitest unit tests; Playwright public-surface suite (20 checks, last run in previous session).
- Blocked: pgTAP (needs a local Supabase stack, Docker daemon was not running at audit start; being started now), RLS against real JWTs (needs applied schema), authenticated Playwright (needs test accounts).

## Supabase deployment state

- Project `eshtcyzraxojwkzqgqld`. No migrations from this repo applied beyond `profiles`.
- `realtime-token` deployed in an older form (answers 401 unauthenticated); the rate-limited version at HEAD is not deployed.
- Supabase MCP connector: "You do not have permission to perform this action" on every call.
- Supabase CLI: no access token (`supabase login` not done, `SUPABASE_ACCESS_TOKEN` unset).

## Azure integration state

- Azure OpenAI Realtime + Azure Speech credentials exist as local environment values (names only verified; values never printed). Not deployable without Supabase secrets access.
- Live voice works today only through the older deployed function.

## Session 2 additions (2026-11-17, commits `9d1fe0c` → `ed50113`)

| Commit | Change |
|---|---|
| `9d1fe0c` | `src/domain/consent.ts`/`retention.ts` committed (were untracked, complete, tested) |
| `104ae71` | Fixed `useOrg`/`types.ts` three-role drift against the five-role matrix |
| `4305291` | `supabase/functions/_shared/{auth,permissions,http}.ts` — caller authentication, role tiers, response helpers |
| `78628fd` | Migration: membership `status`, invitation `expires_at`/role guard/acceptance trigger, `set_member_status()`. 14 pgTAP assertions |
| `d51add3` | `invite-user` Edge Function (invite / revoke) |
| `1f52990` | `/accept` page to finish invitation setup |
| `091f6aa` | Migration: `legal_hold` on recordings/transcripts, `set_legal_hold()`, `retention_runs`. 9 pgTAP assertions |
| `f450800` | `retention-sweep` Edge Function; made `src/domain/retention.ts` transcript-aware (single source, mirrored) |
| `ffa9c73` | Moved `canAssignRole` to the domain module (was only in its Edge Function mirror) |
| `ed50113` | Real `/console/team` screen: invite, revoke, deactivate/reactivate, backed by the tables above |

Baseline after this session: **19 test files, 58 unit tests, tsc clean, eslint 0/0, production build passes.** Docker's daemon has been unresponsive since before this session started (`com.docker.backend` processes alive since 28 Oct, never answering `docker info`) — pgTAP has still never been executed, only written and hand-verified by reading. This is now the standing local-verification blocker; re-check with `docker info` once Docker Desktop is restarted or reinstalled.

## Session 3 additions (2026-11-17/18, commits `2a37ebd` → `a040173`)

Docker Desktop investigation: its own CLI (`docker desktop restart`) was run and explicitly failed — `stopping Docker Desktop: processes still running: ...: context deadline exceeded`. Two backend processes (PIDs alive since 28 Oct) do not respond to graceful stop. Every sanctioned remediation (`open -a Docker`, `osascript quit`, `docker desktop restart`, `docker desktop start`) was tried; none recovers it, and force-killing the hung processes is outside what this session may do. **Local pgTAP execution remains BLOCKED on a manual Docker Desktop force-quit or machine restart.**

| Commit | Change |
|---|---|
| `2a37ebd` (3 commits) | `start_call()` RPC resolves org/agent/permission server-side; `callSession.ts` client wrapper; `useVoiceAgent.ts` persists the full lifecycle (created→initializing→active→interrupted/completed/failed/cancelled) via three refs in `teardown()` |
| `b1f57f4` | `call-sweep` Edge Function invokes `abandon_stale_calls()` on a schedule — the server-side safety net for a browser that never finalises (tab closed, network lost) |
| `a040173` (2 commits) | `agentConfig.ts` merges a call's `agent_versions` row over the `prompt.ts` seed; `realtime-token` now requires `callId`, verifies the call belongs to the caller and is still open, and builds the session from the resolved config instead of hardcoded constants |

Baseline after this session: **21 test files, 73 unit tests, tsc clean (app+node), eslint 0/0, production build passes, every Edge Function Deno-checks clean.**

Known residual item: the Agent Studio console screen still writes to `localStorage`, not `agent_versions` — the API-level plumbing (`agent_versions` → `realtime-token`) is real and tested, but nothing in the UI lets an admin publish a new prompt/voice yet. That is Phase 10/12 frontend-integration scope, not done this session.

### Session 3 continued: consent resolution and transcript persistence (commits `c8335f2`, `409a2ab`)

- `start_call()` now also resolves whether the new call may record, mirroring `src/domain/consent.ts`'s `decideRecording()` exactly: no approved policy → `recording_allowed=false`; an approved disclosure-only policy → allowed immediately; a policy requiring explicit consent → not yet allowed (nothing has captured the member's answer). 3 new pgTAP assertions.
- `append_transcript_segment()` lets the call's owner (or an org editor) write ordered transcript segments; `advance_call()` now finalises a transcript when its call reaches a terminal state. 10 pgTAP assertions.
- Client: the agent's spoken turns (text + Azure-Speech voice path only) are now persisted as transcript segments in real time, using message types the hook already handled — no new Azure protocol behaviour was introduced.

**Deliberately not attempted this session**, and why:
- **Audio recording upload.** Needs a `MediaRecorder` → private-bucket pipeline I cannot exercise end-to-end without a real browser and live Azure session.
- **The caller's (member's) transcript turns.** Needs Azure Realtime's `input_audio_transcription` requested in the session config — a live-Azure-only protocol change I cannot verify works as expected without testing against a real Azure resource.
- **How explicit verbal consent is captured.** The domain model (`decideRecording`) already distinguishes "not required" from "required and not given," but nothing in a voice-only interface currently converts a spoken "yes" into a `given`/`declined` outcome. This is a product-design question, not an engineering one, and invented behaviour here would risk a compliance-sensitive feature being wrong by construction.

Baseline after this addition: **21 test files, 76 unit tests, tsc clean, eslint 0/0, build passes.**

### Session 3, continued per explicit instruction to defer Docker and keep going (commits `bbeb511` → `11ae57b`)

- **Evaluation workflow** (`submit_evaluation()`, `add_evaluation_review()`): a qa_analyst scores an eligible call against an active template; the weighted overall score is computed server-side, never trusted from the client; a human review/override is a separate row that never touches the original result. 15 pgTAP assertions.
- **A real bug was caught, not just tests written for.** While writing `submit_evaluation()`, recognised the same class of bug already shipped unexecuted in the prior commit's `append_transcript_segment()`: PL/pgSQL's `variable_conflict = error` default makes a bare identifier matching both a function parameter and a scanned table's column raise `column reference "x" is ambiguous` **at execution time** — invisible to SQL parsing, the only check available without Docker. Fixed three instances, then re-audited every function in every migration line by line; none remain. Full detail in `docs/production-audit/SECURITY_AUDIT.md` §7.
- **CRM connector framework** (`enqueue_crm_sync()`, `crm-test-connection`, `crm-sync-worker`): job creation with idempotency, a user-triggered connection test, and a scheduled worker with capped exponential backoff. Only `provider_key='mock'` is a real implementation; everything else gets an honest "not implemented" rather than a fabricated result, since no vendor has been selected. 9 pgTAP assertions.
- **Security review**: confirmed all 39 tables have RLS enabled and every `SECURITY DEFINER` function checks the caller's role against the row's own `org_id` before acting. Found and fixed a real issue: `realtime-token` and `crm-test-connection` interpolated caller-supplied IDs into PostgREST URLs (themselves filter expressions) without validating UUID shape first — a query-string injection risk, contained by RLS but not defended at the input boundary. Added a shared `isUuid()` validator.

Baseline after this session: **22 test files, 78 unit tests, tsc clean, eslint 0/0, build passes.** Nine pgTAP files now exist (`rls`, `voice_platform`, `invitations`, `retention`, `calls`, `transcripts`, `evaluations`, `crm_sync`), none executed — Docker remains the standing blocker, deferred per explicit instruction.

## Exact next implementation task

1. Once Docker (or Supabase CLI access) is available: `supabase db reset` + `supabase test db` to execute all pgTAP files for real; fix anything they reveal.
2. Design (with the product owner) how explicit verbal consent is captured in a voice-only interface, then wire it.
3. Recording upload: `MediaRecorder` on the browser's local/remote audio, private bucket upload, `recordings` metadata row, gated by `calls.recording_allowed`.
4. Wire the Agent Studio screen to read/write `agents`/`agent_versions` for real, closing the loop Phase 3 opened. (QAScorecards.tsx and Analytics.tsx were deliberately not attempted this session: both are built around concepts — per-prompt-version rubric heatmaps, pre-assignment of a reviewer before any review exists, cost-per-model breakdowns — that don't map cleanly onto the existing schema, and wiring them would mean inventing product design rather than plumbing existing data.)

## External blockers (need the product owner)

| Blocker | Why | How to unblock |
|---|---|---|
| Docker daemon unresponsive | Local pgTAP execution, `supabase start` | Restart or reinstall Docker Desktop; `docker info` should return a server version |
| Supabase access token | `db push`, `functions deploy`, `secrets set`, `gen types --linked` all need it | Run `npx supabase login` in this repo's shell, or export `SUPABASE_ACCESS_TOKEN` in the environment (never paste it in chat) |
| Public signup switch | Invitation-only is mandatory; the dashboard switch is the only control | Supabase dashboard → Authentication → Sign In / Providers → turn off "Allow new users to sign up" |
| SMTP / custom sender | Invitation and reset emails need a deliverable sender | Configure SMTP in Supabase Auth settings |
| Consent wording | The system never invents policy text | Client supplies approved disclosure text |
