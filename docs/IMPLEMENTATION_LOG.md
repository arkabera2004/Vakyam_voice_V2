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
