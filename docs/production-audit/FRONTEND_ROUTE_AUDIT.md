# Vakyam Voice V2 — Frontend Route Audit

Source of truth: `src/App.tsx` (React Router 6, `BrowserRouter`). Browser checks were run with Claude in Chrome against the already-running Vite dev server at `http://localhost:5181` (signed-in demo session) and `http://localhost:8081` (signed out, same code). Viewport 1470×801 for desktop; 390×844 emulated with a same-origin iframe for mobile because the window could not be resized in this Chrome profile.

## 1. Registered routes (17)

| # | Path | Kind | Element | Guard |
|---|---|---|---|---|
| R01 | `/login` | public | `Login` | none |
| R02 | `/` | redirect | `Navigate → /console` | inherits console guard |
| R03 | `/voice` | protected | `Index` (header, hero, VoiceChatCard, footer) | `ProtectedRoute` |
| R04 | `/console` | protected layout + index | `ConsoleShell` → `Home` | `ProtectedRoute` + `ConsoleProvider` |
| R05 | `/console/live` | nested | `LiveCalls` | inherited |
| R06 | `/console/live/:id` | dynamic | `LiveCallDetail` | inherited |
| R07 | `/console/transfers` | nested | `WarmTransfer` | inherited |
| R08 | `/console/review` | nested | `CallReview` | inherited |
| R09 | `/console/qa` | nested | `QAScorecards` | inherited |
| R10 | `/console/studio` | nested | `AgentStudio` | inherited |
| R11 | `/console/tools` | nested | `Tools` | inherited |
| R12 | `/console/routing` | nested | `Routing` | inherited |
| R13 | `/console/knowledge` | nested | `Knowledge` | inherited |
| R14 | `/console/compliance` | nested | `Compliance` | inherited |
| R15 | `/console/analytics` | nested | `Analytics` | inherited |
| R16 | `/console/alerts` | nested (mobile-first) | `MobileSupervisor` | inherited |
| R17 | `*` | fallback | `NotFound` | none |

All console pages are `React.lazy` with a "Loading…" fallback (`App.tsx:12-26`). No breadcrumbs component; the header shows a crumb string from `CRUMBS` in `ConsoleShell.tsx:13-26`. No back-navigation controls beyond the browser.

## 2. Browser results, signed in (localhost:5181)

| # | Path | Loads | Expected UI | Active nav | Console errors | Notes |
|---|---|---|---|---|---|---|
| R02 | `/` | PASS → `/console` | — | — | 0 | |
| R03 | `/voice` | PASS | "VAKYAM" header, "Talk to Meera" card, mic button present (`aria-label="Start voice chat"`) | n/a | 0 | Live call not started (needs mic) |
| R04 | `/console` | PASS | h1 "Good afternoon. Meera is handling 71% of calls.", 5 buttons | "Home 6" (badge) | 0 | Date string hard-coded |
| R05 | `/console/live` | PASS | 12 call cards, 2 dropdowns | "Live calls 14" | 0 | Screenshot taken |
| R06 | `/console/live/4812` | PASS | "Rohan Mehta, Platinum member", 3 control buttons, crumb "Live calls / Call 4812, Rohan Mehta" | "Live calls" | 0 | |
| R06 | `/console/live/9999` (unknown id) | PASS (graceful) | "Call 9999 is not live any more. Back to the live wall" | "Live calls" | 0 | Good empty state |
| R07 | `/console/transfers` | PASS | "Incoming warm transfer", Accept/Decline/Add note | "Warm transfers 3" | 0 | Screenshot taken |
| R08 | `/console/review?call=4801` | PASS (loads) / **FAIL (content)** | Shows "Call 4790, Anita Iyer" regardless of `?call=` | "Call review" | 0 | GAP-F-03 |
| R09 | `/console/qa` | PASS | Rubric heatmap, flagged table, 11 buttons | "QA scorecards" | 0 | Screenshot taken |
| R10 | `/console/studio` | PASS | "Shape how Meera sounds and speaks", 21 buttons, 2 range inputs | "Agent studio v7" | 0 | |
| R11 | `/console/tools` | PASS | "What Meera can reach, and how fast", 12 buttons | "Tools and integrations" | 0 | |
| R12 | `/console/routing` | PASS | "Who Meera answers, and who she calls", 5 buttons | "Routing and campaigns" | 0 | Screenshot taken |
| R13 | `/console/knowledge` | PASS | "Knowledge and policies", 11 buttons | "Knowledge and policies" | 0 | |
| R14 | `/console/compliance` | PASS | "Compliance and consent", 9 buttons | "Compliance and consent" | 0 | Screenshot taken |
| R15 | `/console/analytics` | PASS | "Analytics", 5 buttons | "Analytics" | 0 | |
| R16 | `/console/alerts` | PASS | "Pune desk" feed, 5 alert buttons | **none in sidebar** (route is only in the mobile tab bar; mobile tab "Alerts" is active) | 0 | GAP-F-15 (P3) |
| R01 | `/login` while signed in | PASS (loads) | Login form still shown; no redirect | — | 0 | GAP-F-06 |
| R17 | `/nonexistent` | PASS | "404 / Oops! Page not found / Return to Home" | — | 1 `console.error` by design (`NotFound.tsx:8`) | |

Console output across the whole walk: **0 errors**; only React Router v7 future-flag warnings (2 per navigation) and the Vite/React DevTools info lines.

## 3. Browser results, signed out (localhost:8081, session token removed for that origin only)

| Path | Result |
|---|---|
| `/console/analytics` | Redirected to `/login` (form present) — PASS |
| `/voice` | Redirected to `/login` — PASS |
| `/login` with `nobody@example.com` / wrong password | Toast "Login failed — Invalid login credentials"; stays on `/login` — PASS |
| `/nonexistent` | 404 page — PASS |

Network: the auth call to Supabase was made by the page (toast shows the server's `invalid_credentials` message); the extension's request log had not started tracking before the request, so the raw status was captured by curl instead (400, see API_ENDPOINT_AUDIT E05).

## 4. Workflow checks (client-side)

| Workflow | Steps | Result |
|---|---|---|
| Home decision modal | Click "Review" on the Anita Iyer upgrade → modal → "Approve upgrade to 2BR" | PASS: toast "Done — Upgrade approved…", `decided["upgrade-anita"]="approved"`, audit row prepended ("16 Nov, 13:19 · Kavita Rao · Approved: …"), audit length 14→15, Home badge 6→5 |
| Persistence after reload | Reload `/console` | PASS: pending rows reduced to 2, badge stays 5 (localStorage) |
| Cross-screen update | Alerts page after the decision | PASS: Anita alert no longer listed (5 alerts) |
| Demo reset | Not exercised (uses `window.confirm`, which would block the automation session) | UNVERIFIED in browser; code reviewed `ConsoleShell.tsx:110-113` |
| CSV exports | Not exercised (triggers a file download) | UNVERIFIED in browser; `toCsv` unit-tested |
| Voice preview buttons | Not exercised (audio, and the Azure path mints a session) | UNVERIFIED |

All of these change only `localStorage`; see COMPLETE_FEATURE_AUDIT for why they are MOCKED rather than VERIFIED as business operations.

## 5. Responsive results (390×844 emulated)

| Path | Sidebar hidden | Mobile tab bar | Horizontal page scroll | Verdict |
|---|---|---|---|---|
| `/console/alerts` | yes | visible, "Alerts" active | no (doc 386 = viewport) | PASS |
| `/console/live/4812` | yes | visible | no | PASS |
| `/login` | n/a | n/a | no | PASS |
| `/console` | yes | visible | **yes, 397 vs 386** (11 px) | FAIL (minor) — GAP-F-14 |
| `/console/qa` | yes | visible | **yes, 558 vs 386** | FAIL — the two `<table class="w-full">` panels have no `overflow-x-auto` wrapper (`QAScorecards.tsx:103-161`) — GAP-F-14 |

Tablet (768–1024) was not separately exercised; the layout uses `md:`/`lg:` breakpoints and desktop at 1470 is clean.

## 6. Counts

- Routes registered: 17
- Routes loaded in browser: 17 (16 signed in + 404; 2 of them also signed out)
- Routes rendering expected UI: 16; 1 content defect (R08)
- Routes with console errors: 0 (404 logs by design)
- Responsive failures: 2 of 5 sampled
