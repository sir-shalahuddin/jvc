# API contract: Retro v2 backend (as implemented)

Errors from the new/changed endpoints are JSON: `{"error": "message"}` (409 also carries `phase` and `allowed`). Older endpoints that were not touched still use plain-text `http.Error` bodies.

## Identity: one value, everywhere
The server derives the voter identity as `sha256("hw_voter:" + fp)` (or the signed guest cookie if no fp). It is used for votes, for `author_id` on cards, and for the write-phase hiding rule. **The client must send the SAME fingerprint on every call**, in any one of:
- header `X-Device-Fingerprint: <fp>` (already sent today on submit/vote/voter-status)
- body field `device_fingerprint` (submit, vote) or `voter_id` (alias)
- query `device_fingerprint=<fp>` or `voter_id=<fp>` (GET endpoints)

Use the existing `getDeviceFingerprint()` value as `voter_id` in the state call. Do NOT use the presence `clientId` here, or own cards will look hidden.

## Phases
`write | group | vote | discuss | act | done`. Missing in old data = `discuss` (the API always returns the effective phase, never an empty string, in session get / state / history / admin list). New sessions are created in `write`.

| Phase | Allowed (else 409) |
|---|---|
| write | add card (`/api/answer/submit`) |
| group | cluster (`/api/answer/cluster`) |
| vote | vote (`/api/answer/vote`) |
| discuss | everything: submit, vote, cluster, spotlight focus |
| act / done | none of the above |

Not phase-guarded: timer (any phase), spotlight `clear`, action items (owner-only as before), question add/update/delete. `GET /api/session/report` returns 409 while phase is `write` (it would leak hidden cards).

409 body: `{"error":"Not allowed in the current phase","phase":"write","allowed":["vote","discuss"]}` (cluster/spotlight/report 409s carry only `error`). Unknown session on a guarded call: 404.

### POST /api/session/phase
Owner only (cookie auth). Request `{"session_id": "...", "phase": "vote"}`.
- 200 `{"status":"success","session_id":"...","phase":"vote"}`
- 400 invalid/missing phase or session_id; 401 not logged in; 403 not owner; 405 wrong method.
Owner may go forward or back.

## Cards hidden in write
While `phase == "write"`, every endpoint returning answers (`GET /api/session/answers`, `GET /api/session/state`) returns a mixed array:
- own card (author_id equals caller's voter id): full `Answer` object (unchanged shape; now also `author_id`).
- every other card, including old cards without author_id and the owner's view of others: exactly `{"id","question_id","hidden":true}`.
Full cards have no `hidden` key. Discriminate with `a.hidden === true`. From `group` on, all cards are full. The owner has no exception. `GET /api/session/clusters` returns `[]` during write. Pagination (`limit`/`offset`) on `/api/session/answers` still works. Empty list is now `[]`, not `null`.

### POST /api/answer/submit (changed)
Body adds optional `device_fingerprint` / `voter_id`. Now requires `session_id` and `question_id` (400 JSON error otherwise). Allowed in `write` and `discuss`, else 409. Response unchanged: 202 `{"id","status":"success","author_name"}`.

### POST /api/answer/vote (changed)
Body adds optional `voter_id` alias. Allowed in `vote` and `discuss`, else 409. Other responses unchanged (409 "already voted" also exists with `{"status":"error","message"}`; tell them apart by `error` key vs `status` key, or check `phase` in the body).

### POST /api/answer/cluster (changed)
Owner only, allowed in `group` and `discuss`, else 409 (`{"error":...}`).

### POST /api/session/spotlight/action (changed)
`action:"focus"` only in `discuss`, else 409. `clear` always allowed.

## GET /api/session/state
Query: `session_id` (required), `question_id` (optional; empty = answers of all questions), `voter_id` (the fingerprint, see above), optional presence heartbeat `client_id` + `name` (if `client_id` is given the caller is registered in presence, role `moderator` when the caller is the owner; so the board does not need to also POST presence heartbeats, but `POST /api/session/presence/leave` still works for leaving).
Cookie auth is optional; with it `session.is_owner` is true for the owner. Header `Cache-Control: no-store`.

200:
```json
{
  "session":  {"id","name","owner_email","created_at","status","phase","is_owner"},
  "questions":[{"id","session_id","text","type","gif_url","time_limit_seconds","created_at","answer_count"}],
  "answers":  [ /* full Answer or {"id","question_id","hidden":true}, sorted by created_at asc */ ],
  "voter_status": {"guest_name","guest_id","total_votes","remaining_votes","max_votes","voted_answers":["answerId"]},
  "vote_budget": 5,
  "timer":    {"session_id","running","remaining_seconds","end_time_unix_ms","preset_minutes"},
  "spotlight":{"session_id","active","question_id","answer_id","updated_at_ms"},
  "presence": {"session_id","count","participants":[{"id","name","role","last_seen"}],"topic_counts":{"questionId":3}},
  "clusters": [{"tag","count"}],
  "server_time_ms": 1760000000000
}
```
`questions[].answer_count` counts all cards (including hidden ones), so "N kartu dari orang lain" can also be computed from `answers` entries with `hidden:true`. `clusters` is `[]` during write. `vote_budget` is the server constant (`MaxVotesPerParticipant`); use it instead of a hard-coded 5. `session.owner_email` is present (same as `/api/session/get`).
Errors: 400 no session_id, 404 unknown session, 405, 500.
Old endpoints (`/api/session/get|questions|answers|voter-status|timer|spotlight|presence|clusters`) still work.

## GET /api/session/previous-actions?session_id=
Anyone with the session id (no auth). Finds the same owner's most recent session created before this one (excluding this one), returns its open (not completed) action items.
```json
{"session": {"id","name","created_at"} , "items": [ActionItem...]}
```
`session` is `null` and `items` is `[]` when there is no previous session. Only the single most recent previous session is considered (even if it has no items). Ticking: existing `POST /api/action-items/toggle` with `{"session_id": <OLD session id>, "id", "completed"}`; owner only (403 otherwise). 404 unknown session_id.

## GET /session/summary?id=
Server-rendered HTML (`text/html`, `<meta name="robots" content="noindex">` plus `X-Robots-Tag: noindex`), Indonesian copy, escaped via html/template. Contents: session name and date ("17 Oktober 2026"), each topic with cards sorted by votes desc (text, "N suara", cluster tag), clusters, action items (assignee, due date, Selesai/Belum selesai). Plus Jakarta Sans (Google Fonts link), white/ink, `#2563EB` only on links, light/dark by system.
- 404 HTML for missing/unknown id.
- 409 HTML (no card text) while the session is in `write`, so the frontend should only show "Ringkasan" from `group` onward (or accept the placeholder page).
Share link: use the existing `GET /api/session/share-link?id=` (it still shortens the board URL `/session/?id=`). It does not yet shorten the summary URL; if the frontend wants "Bagikan ringkasan" to shorten `/session/summary?id=...`, shorten client-side via the same hanya.click `/shorten`, or ask backend to add `kind=summary` (not implemented).

## Session responses
`GET /api/session/get`, `GET /api/history` (`sessions[]`), admin list, state: all include `phase` (effective). `POST /api/session/create` returns the session with `phase:"write"`.

## Admin
### GET /api/admin/sessions?page=1&page_size=20&q=
Admin only (403 otherwise). **Response shape changed from a bare array to an object:**
```json
{"sessions":[Session...], "total": 57, "page": 1, "page_size": 20}
```
`page` default 1, `page_size` default 20, max 50 (larger values are capped). `q` is a case-insensitive substring match over session name and owner email, applied across ALL sessions before paging. `total` is the count after filtering. Sessions are newest first.

### DELETE /api/admin/sessions?id=
Admin only. 200 on success, 400 without `id`, 500 with `{"error"}` if deleting fails. Deletes the session doc and all its subcollections (`questions`, `answers`, `voters`, `action_items`) in batched writes (400 per batch). Clusters are not stored separately (they are `cluster_tag` on answers) so they go with answers. Also drops in-memory timer/spotlight/presence/cache for that session.

### GET /api/admin/stats
Unchanged fields plus a real `health` object replacing any hard-coded status:
```json
"health": {"status":"ok|degraded","firestore_ok":true,"firestore_ms":12,"uptime_seconds":3600,"started_at_unix_ms":1760000000000}
```
`status` is `degraded` when a Firestore read (limit 1, 3 s timeout) fails. `uptime_seconds` is time since process start (Cloud Run instance, so it resets on cold start).

## Login redirect
`GET /auth/google/login?next=/some/path` stores `next` in a short-lived HttpOnly cookie only if it is a same-origin absolute path (starts with a single `/`, no `//`, no backslash, no control chars, max 512 chars). After the Google callback the user is redirected to that path, otherwise `/dashboard`. Logout still redirects to `/`.
