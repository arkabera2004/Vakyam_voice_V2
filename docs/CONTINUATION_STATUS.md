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

## Exact next implementation task

1. Bring up the local Supabase stack (Docker) and run `supabase db reset` + `supabase test db` to execute both pgTAP files for real.
2. Fix anything the migrations or tests reveal, commit.
3. Phase 2: `invite-user` Edge Function with shared auth helper and tests.

## External blockers (need the product owner)

| Blocker | Why | How to unblock |
|---|---|---|
| Supabase access token | `db push`, `functions deploy`, `secrets set`, `gen types --linked` all need it | Run `npx supabase login` in this repo's shell, or export `SUPABASE_ACCESS_TOKEN` in the environment (never paste it in chat) |
| Public signup switch | Invitation-only is mandatory; the dashboard switch is the only control | Supabase dashboard → Authentication → Sign In / Providers → turn off "Allow new users to sign up" |
| SMTP / custom sender | Invitation and reset emails need a deliverable sender | Configure SMTP in Supabase Auth settings |
| Consent wording | The system never invents policy text | Client supplies approved disclosure text |
