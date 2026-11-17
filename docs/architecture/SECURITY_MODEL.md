# Vakyam Voice V2 — Security Model

## Identities and roles

- Identity: Supabase Auth user. Registration is **invite-only**; `disable_signup` must be `true` (checked by `scripts/check-auth-settings.sh`, enforced by the CI `auth-settings` job).
- Membership: `org_members(org_id, user_id, role)`. Roles: `super_admin`, `org_admin`, `supervisor`, `agent`, `qa_analyst`. Super Admin is organisation-level in the initial implementation (a member row with that role); there is no platform-wide account concept yet.
- Permission matrix: see `src/domain/roles.ts` (single source, unit-tested) and the SQL helpers `org_role()`, `can_edit_org()`, `can_review_org()`.

| Capability | super_admin | org_admin | supervisor | agent | qa_analyst |
|---|---|---|---|---|---|
| Read organisation data | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage members / roles | ✓ | ✓ | – | – | – |
| Organisation settings, consent & retention policy | ✓ | ✓ | – | – | – |
| Agents and versions | ✓ | ✓ | ✓ | – | – |
| Live call controls, transfers, decisions | ✓ | ✓ | ✓ | ✓ (own calls) | – |
| Evaluations: run, review, override | ✓ | ✓ | ✓ | – | ✓ |
| Play / download recordings | ✓ | ✓ | ✓ | own calls | ✓ |
| Export audit log | ✓ | ✓ | – | – | ✓ |

## Enforcement layers

1. **Row level security** on every org-scoped table (deny by default). Policies call `SECURITY DEFINER` helpers so `org_members` is not read recursively.
2. **Append-only audit log**: no client insert/update/delete policy; `log_audit()` is the only writer and stamps `auth.uid()`.
3. **Edge functions** re-validate the JWT with `/auth/v1/user` and act with the caller's JWT, never the service role, except for operations that by design need it (invites, retention deletion) which run only server-side.
4. **Frontend gating** hides controls by role; it is not a security boundary.

## Secrets

- Browser bundle contains only the Supabase URL and publishable key.
- Azure keys, service-role key and connector credentials exist only as Supabase function secrets. Connector credentials are stored by reference (`credential_ref`), never in ordinary columns or logs.
- `.env` is untracked; gitleaks runs in CI.

## Transport and headers

- CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy: microphone=(self)` on both nginx and Static Web Apps configs.
- Function CORS origin from `ALLOWED_ORIGIN` (default `*` for local dev only).
- Function error bodies are generic; details go to function logs.

## Abuse controls

- `realtime-token`: per-user hourly cap (`VOICE_SESSIONS_PER_HOUR`, default 10), recorded in `voice_sessions`.
- Calls hard-stop at 10 minutes in the browser.

## Data handling

- Recordings: private bucket, path `org/<org_id>/call/<call_id>/…`, signed URLs only, every playback written to the audit log.
- Consent: a session may record only when an approved `consent_policies` version exists for the organisation and the session's consent outcome satisfies it; otherwise recording is skipped and the reason stored on the session. No wording is invented by the system.
- Retention: `retention_policies` (default 365 days for recordings; transcripts separately configurable). Deletion runs as a scheduled job with dry-run, eligibility checks and a deletion audit trail; irreversible deletion stays disabled until explicitly approved.
