# SPEC: Retro v2: phases, quieter UI, one family with hanya.click

Owner decisions (2026-10-17). This is the single source of truth for the agents doing the work.

## Product rules
1. **Phases replace "everything always on".** A session has `phase`, one of:
   - `write`
   - `group`
   - `vote`
   - `discuss`
   - `act`
   - `done`

   - Only the owner (facilitator) changes phase, and may move forward or back.
   - New sessions start in `write`.
   - Sessions without a phase field (old data) are treated as `discuss`, so old boards look as before, with everything visible.
2. **Cards stay hidden during writing.** In `write`, the server returns full text only for the requester's own cards. Every other card comes back as `{id, question_id, hidden: true}` with no text, gif, author or sentiment, so the UI can show "3 kartu dari orang lain".
   - Own cards are identified by `author_id`. That is the same client voter id the app already uses for voting (see `VoterRecord.VoterID` and how the frontend sends it). Store it on new answers.
   - Old answers without `author_id` are hidden from everyone in `write`. This only matters if an old session is moved back to `write`.
   - The owner has no exception, because hiding exists to prevent anchoring.
   - From `group` onward, all cards are visible.
3. **Tools by phase:**
   - `write`: add card.
   - `group`: cluster/tag (owner) and drag or merge, if it is cheap.
   - `vote`: vote and votes-left.
   - `discuss`: spotlight (owner) and timer.
   - `act`: action items.
   - `done`: read-only, plus a summary link.

   The timer is available in every phase, but shows only while it is running or to the owner.
4. **Promises from last time.** When a session opens, show the open (not completed) action items from the same owner's most recent previous session as "Janji sesi lalu". Read-only for participants. The owner can tick them, which updates the old session's item.
5. **Summary page.** `GET /session/summary?id=...` is a read-only server-rendered page with:
   - topics with their cards sorted by votes;
   - clusters;
   - action items with assignee and due date;
   - the session date.

   - Anyone with the session link can see it, the same access as the board.
   - `noindex`.
   - In `done`, the owner gets a "Bagikan ringkasan" button that uses the existing hanya.click shortener integration (see `SessionShareLinkHandler`).
6. **Card text is on the front.** No flip-to-read. Sentiment stays as a small label in the corner. No kaomoji animation, no confetti, no sound effects (remove the engines), and no theme switcher (one look; light/dark follows the system).

## Bugs to fix (verified in the audit)
- **Upload:** guests see "Upload Image", but `/api/upload` requires login. Hide upload for guests. Logged-in users keep it.
- **Admin, 10-session cap:** `admin.go` caps the list at 10, and search only covers those 10. Add server-side pagination (`?page`, `?page_size` max 50) and search (`?q` over name/owner) and return a total count. The frontend paginates.
- **Admin delete leaves orphans:** deleting a session must also delete its subcollections or related docs (questions, answers, voters, action items, clusters). Check how they are stored in `db/` and `repositories/`. Use batched deletes. Add a test with mocks.
- **Admin "100% OK / Operational" is hard-coded:** replace it with something real (e.g. Firestore ping OK + uptime since start), or remove the card.
- **Global header search does nothing on /admin:** remove the global search from the header. Pages that need search have their own.
- **Login lands on `/`:** after OAuth, redirect to `/dashboard`, or to a safe same-origin `next` path if one was given.
- **Shortcuts modal lists keys that don't work** (`?`, Space, Esc): make the list match the real handlers, and make `?` open the modal and `Esc` close modals.
- **Vote badge hard-codes "/5":** use the server's vote budget, which should come in the state response.
- **Polling:** 5 sequential requests every 3 s per client. Add `GET /api/session/state?session_id=&voter_id=&question_id=` that returns, in one response:
  - session (incl. phase, is_owner)
  - questions
  - answers (with phase hiding applied)
  - voter status and budget
  - timer
  - spotlight
  - presence
  - clusters

  The frontend polls only this, every 3 s, and backs off to 10 s while the tab is hidden.

## Themes: owner decision, overrides anything below
- **Neo-Brutalist is the DEFAULT look.** Rebuild it on the new components, using the original styling from git HEAD `frontend/src/styles/design-system.css`: `[data-ui-style]` neo-brutalist tokens, thick ink borders, hard offset shadows, orange primary, display/mono fonts. Brutalist offset shadows and thick borders are allowed in this theme, because they are its identity. Emoji-as-icons, confetti, sound, kaomoji animation and gradients stay removed.
- **"Modern" is an option** = the plain hanya.click-family look described below (tokens.css).
  - Switch in the `⋯` menu ("Tampilan: Brutalist / Modern"), stored in localStorage (wrapped in try/catch), applied as `data-ui-style` on `<html>` before first paint.
  - It applies to every page: board, dashboard, admin.
- Light/dark follows the system in both themes. No manual toggle.

## Visual system: same family as hanya.click (this is the "Modern" theme)
Reference: `C:\Users\siraj\hanya-click\shorten-link\static\hc.css` and `index.html`. Read them.
- **Colour:** tokens on `:root`, light by default, dark via `prefers-color-scheme`. Brand blue `#2563EB` is used ONLY on clickable things. Neutrals are white/ink. Semantic colours (ok/warn/danger) only for state.
- **Type:** Plus Jakarta Sans. ui-monospace only for codes/timer digits.
- **Shapes:** 1px rules, radius at most 10px. No gradients, glows, backdrop blur, shadows (except maybe one subtle one for floating menus), emoji used as icons, or pill badges used as decoration.
- **Copy:** Indonesian first, plain and short, written by the maker. Keep an EN toggle only if one already exists cleanly; otherwise Indonesian only. Remove brochure lines ("industrial-grade", "99.9%", "Command Center", "telemetry", "built by Antigravity AI", the false Firestore real-time claim).
- **Logo:** one mark everywhere (app and landing). Reuse the hanya.click "h" logo with the wordmark "retro.hanya.click", or a plain wordmark.
- **Session header,** final: `← | Judul sesi | phase stepper (Tulis · Kelompokkan · Vote · Bahas · Aksi · Selesai) | timer | Undang | ⋯`.
  - The `⋯` menu holds: Export PDF (owner), Ringkasan, Shortcut. There is no theme item.
  - Presence is a small "7 orang" text that opens the list.
  - Participants see the stepper as read-only progress.
  - Mobile (390px): back button, title (truncated), current phase name, timer, `⋯`. Nothing overlaps.
- **Board layout:**
  - Wide screens: topics as side-by-side columns (max 4 visible, horizontal scroll beyond that).
  - Mobile: topic tabs.
  - The add-card button sits at the top of each column, in `write` only.

## Out of scope
- Payments (dead code to delete).
- New auth.
- Firestore real-time listeners (keep polling).
- Changing Cloud Run settings beyond what is already in deploy.yml.
