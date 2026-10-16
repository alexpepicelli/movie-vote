# Votarr — Design Plan

Name: **Votarr**. A self-hosted web app that sits next to Radarr and Seerr. Friends keep watchlists, nominate films for a movie night, vote, and the winner is checked against (or requested through) your stack.

Each section ends with a **Decision** line. Approve, change or reject it per section.

---

## 1. Core concept and flows

**Roles**

- **Admin** (you): creates movie nights, manages users, can override results.
- **Member** (friends): search, watchlist, nominate, vote.

**Always-on: the watchlist is the heart of the app**

- Members can add any film to their **personal watchlist** at any time, whether or not a night is planned.
- **Group "Most Wanted"** ranks films by how many watchlists they're on.
- Watched films get flagged so they don't come up again (they can still be re-added on purpose).

**Main loop: a Movie Night**

1. **Create.** The admin creates a night (title, date, nomination and vote limits, deadlines). A Discord message goes out.
2. **Nominate.** Each member nominates up to _N_ films. The picker is **ordered by priority**:
   1. **Your watchlist**, oldest-added first ("you've wanted this the longest")
   2. **Group Most Wanted**, films on several people's watchlists, each with a "3 friends want this" badge
   3. Search for anything else
      Films on several watchlists also get a "🔥 popular" badge in the nominee grid.
3. **Vote.** Nominations lock and members cast votes (method in §2).
4. **Close.** Voting closes at the deadline or by hand. The app picks the winner and settles ties.
5. **Prepare.** The winner's status shows from Radarr (on disk / downloading / missing). If it's missing, **only the owner** sees a one-click **Request via Seerr**.
6. **Watched.** The night is marked done and the film goes into history. Optionally, members rate it afterwards.

**History.** Past nights, winners, vote breakdowns and ratings.

**Decision:** ✅ Approved, with nominations prioritised from the watchlist.

---

## 2. Voting mechanics

**✅ Decided: approval voting, no veto.** Each member gets _K_ upvotes per night (default 3, set per night) and spends each one on a different film. The film with the most upvotes wins.

Rules:

- You can't vote on your own nomination (configurable per night).
- Tie-break order: more watchlist saves → random (seeded, shown publicly).
- Live tallies are **hidden until close** (default), so nobody bandwagons. This can be toggled per night.
- Votes can be changed until the deadline.

**Decision:** ✅ Approved.

---

## 3. Integration with Radarr and Seerr

**Seerr = metadata and requests** (it is already TMDB-backed and handles posters):

- Search: `GET /api/v1/search?query=…` (filter to `mediaType=movie`)
- Detail: `GET /api/v1/movie/{tmdbId}` (overview, runtime, genres, trailer, rating, `mediaInfo.status`)
- Discover rows: `GET /api/v1/discover/movies`, `/discover/trending`
- Request: `POST /api/v1/request` `{ mediaType: "movie", mediaId: tmdbId }`. **Owner only**, sent with the server's Seerr API key.

**Radarr = availability**:

- `GET /api/v3/movie?tmdbId=…` → `hasFile`, `monitored`, `isAvailable`
- `GET /api/v3/queue` → download progress for nominees and the winner

**Rules**

- All API keys stay **server-side only**. The browser only talks to Votarr.
- Metadata is cached in a local DB (`movies` table, refreshed after 7 days). Radarr status is polled every 5 minutes for films that are active in a night or on a watchlist.
- Posters load from `image.tmdb.org` through a small proxy/cache route, so friends' browsers don't need direct TMDB access and the app keeps working if TMDB is slow.
- Status badges: 🟢 On server · 🟡 Downloading (x%) · 🟠 Requested · ⚪ Not requested.
- **Fallback:** if Seerr is down, search fails gracefully and cached films still work.

**Decision:** ✅ Approved. Only the owner can request.

---

## 4. Authentication and users

**✅ Decided: both login methods.**

- **Seerr account (Jellyfin-backed).** The login form is sent to Seerr's `/api/v1/auth/jellyfin` (and `/auth/local` for Seerr-local users), then confirmed with `/auth/me`. A local user record is created or linked by Seerr user ID. No Plex flow is needed.
- **Invite link.** The owner generates single-use, expiring invite links. The friend picks a username and password (argon2id). These accounts don't depend on Seerr.
- The login page has one form with a tab for each method. Invite sign-up lives at `/invite/[code]`.
- Sessions use httpOnly, Secure, SameSite=Lax cookies and a server-side session table, valid for 30 days.
- **Owner** is set by the `OWNER_SEERR_USER_ID` env var (or the first user created). The owner is the only one who can request, manage nights and manage users.
- An optional allowlist controls which Seerr users may log in.

**Decision:** ✅ Approved.

---

## 5. Tech stack

**Recommended: one container, TypeScript end to end**

- **SvelteKit** (adapter-node) for the UI and API routes in one app
- **SQLite** with **Drizzle ORM** and migrations. No extra DB container; backups are a single file.
- **Tailwind CSS**, mobile-first (friends will vote from their phones), installable as a PWA (manifest and icons only: no service worker, since Votarr needs the server anyway)
- **Server-Sent Events** for live updates (new nominations, phase changes, countdown). Events only say which night changed; browsers reload their own data, so hidden tallies never leak
- **node-cron** in-process for deadlines and Radarr polling
- **Vitest** for unit tests (vote tallying, tie-breaks) and **Playwright** for a smoke E2E test

Alternatives if you'd rather: Next.js + Prisma (heavier), or Python FastAPI + HTMX (fine, but a less interactive voting UI).

**Decision:** ✅ Approved: SvelteKit 3 + Svelte 5, Drizzle, better-sqlite3, Tailwind 4.

---

## 6. Data model (SQLite)

```
users        id, auth_kind(seerr|local), seerr_user_id?, username, password_hash?,
             display_name, avatar_url, role(owner|member), created_at
invites      code PK, created_by, expires_at, used_by?, used_at?
sessions     id, user_id, expires_at
movies       tmdb_id PK, title, year, overview, poster_path, backdrop_path, runtime,
             genres(json), tmdb_rating, trailer_key, radarr_status, radarr_progress,
             seerr_status, metadata_refreshed_at, status_refreshed_at
watchlist    user_id, tmdb_id, note?, added_at            PK(user_id, tmdb_id)
nights       id, title, scheduled_for, status(draft|nominating|voting|closed|watched),
             nominate_until, vote_until, max_nominations, max_votes,
             self_vote_allowed, results_hidden, winner_tmdb_id?, tiebreak_seed, created_by
nominations  id, night_id, tmdb_id, user_id, created_at
             UNIQUE(night_id, tmdb_id)
votes        night_id, user_id, nomination_id                   PK(night_id,user_id,nomination_id)
ratings      night_id, user_id, score(1–10), comment?           PK(night_id,user_id)
audit_log    id, user_id, action, payload(json), at        (admin overrides, requests)
```

**Decision:** ✅ Approved, with no nomination pitch.

---

## 7. Pages and UX

| Route                       | Purpose                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/`                         | **Tonight / Next Night**: phase banner and countdown, nominee poster grid, your remaining votes, vote/veto buttons |
| `/discover`                 | Search plus trending and popular rows (from Seerr); add to watchlist or nominate                                   |
| `/movie/[tmdbId]`           | Detail: backdrop, trailer, runtime, status badge, who has it on their watchlist                                    |
| `/watchlist`                | My list, plus a "Group Most Wanted" tab                                                                            |
| `/nights` · `/nights/[id]`  | History, results breakdown (bar chart), ratings                                                                    |
| `/admin`                    | Create and edit nights, advance phases, manage users, integration health check                                     |
| `/login` · `/invite/[code]` | Seerr or local login; invite sign-up                                                                               |

UX notes: dark "cinema" theme, poster-first cards, works one-handed on a phone, optimistic voting with an undo toast, and a confetti/reveal animation for the winner.

**Decision:** Approve the page set? Anything missing, for example notifications?

---

## 8. Notifications: Discord (⏸ benched)

> **Status: on hold (2026-10-16).** Wanted, but not a priority. Pick up after M7. The env var `DISCORD_WEBHOOK_URL` already exists but nothing uses it yet.

The app posts to a Discord channel webhook (`DISCORD_WEBHOOK_URL`) using rich embeds with a poster thumbnail and a link back to the app:

- 🎬 **Nominations open** for _Night title_ (date, nomination deadline)
- 🗳️ **Voting open**, listing the nominees
- ⏰ **Voting closes in 2h** reminder
- 🏆 **Winner: _Film_** with the vote count and status (🟢 on server / 🟠 requested)
- ✅ **Ready**: the requested winner has finished downloading (from the Radarr poll)

Each message type can be switched on or off by the owner in admin settings.

**Implementation plan (agreed shape, not built):**

- **Driven by database state.** A single `syncNotifications(db)` works out from each night's state which messages are due and sends any that are missing. It runs after any action that changes a night and from the minute scheduler.
- **Sent once.** A `notifications(night_id, kind, sent_at)` table records each message, so it goes out once, survives restarts and is retried on failure. A row is only written after Discord replies with a 2xx. The migration backfills existing nights as already sent, so the first deploy doesn't spam the channel.
- **Out-of-date messages are skipped**, e.g. no "voting open" once a night is closed. "Ready" is only sent if the winner wasn't already on the server when voting closed.
- **Sent in the background**, so a slow Discord never slows a request. 429 responses honour `retry_after`.
- **Embeds** use public TMDB image URLs (Discord can't reach the logged-in `/img` proxy) and links built from `ORIGIN`.
- **`/admin/settings`**: an on/off switch per message, an optional @here per message, a "Send test message" button and the last error.

**Open questions for when it resumes:**

1. Should the winner message name the film? Recommended: no name, just "Results are in. Tap to reveal", to protect the in-app reveal. Alternatives: a Discord ‖spoiler‖ tag, or the full name.
2. Default @here: on for "Voting open" and "Closing soon" only?
3. "Closing soon": fixed at 2 hours, or a setting per night?

**Decision:** ⏸ Approved but benched.

---

## 9. Deployment on your Ubuntu server

```yaml
# docker-compose.yml (excerpt — joins your existing *arr network)
services:
  votarr:
    image: ghcr.io/<you>/votarr:latest # or build: .
    container_name: votarr
    restart: unless-stopped
    environment:
      - ORIGIN=https://votarr.example.com
      - SEERR_URL=http://seerr:5055
      - SEERR_API_KEY=${SEERR_API_KEY}
      - RADARR_URL=http://radarr:7878
      - RADARR_API_KEY=${RADARR_API_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
      - TZ=Australia/Adelaide
    volumes:
      - ./votarr/config:/config # sqlite db + poster cache
    networks: [media]
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost:3069/healthz']
networks:
  media:
    external: true
```

- Multi-stage Dockerfile on node:22-alpine, runs as non-root, roughly 150 MB image
- Migrations run automatically on startup
- `/healthz` checks the DB, Seerr and Radarr
- Backups: once a day, SQLite's online backup into `/config/backups`, keeping 14 days (the newest is never pruned). **Admin → Health** lists them and has a "Back up now" button.
- **Friend access: ✅ your existing Cloudflare Tunnel.** Add a public hostname such as `votarr.<yourdomain>` → `http://votarr:3069`. The `cloudflared` container must be on the same Docker network (or point it at `localhost:3069` if cloudflared runs on the host). Set `ORIGIN` to the public URL so CSRF checks and cookies work. The app's own login protects it, so Cloudflare Access isn't needed (though it can be added).
- SSE live updates work through Cloudflare Tunnel. The app sends a heartbeat every 30s so idle connections aren't cut.

**Decision:** ✅ Approved.

---

## 10. Security

- API keys only live in env and are never sent to the client. Upstream calls go through server routes with an allowlist.
- CSRF protection (SvelteKit origin check), rate limiting on login and search
- All inputs are validated with Zod. Parameterised queries via Drizzle.
- Members can only change their own watchlist, nominations and votes. Phase rules are enforced on the server, not just in the UI.
- Request-in-Seerr is limited by role and logged in `audit_log`

---

## 12. Redesign: "Midnight Movie" (M8–M10)

Picked from the [design canvas](https://claude.ai/artifact/Gwrn9SQae7SQ2a3wfhkJXd) (direction E). The rule: **a clean, ordinary app first; the 80s is the mood, not the mechanics.** Buttons say "Vote", lists are lists. The theme lives in type, colour, a few glows and one big moment (the reveal).

### 12.1 Look and feel

- **Colours** (Tailwind `@theme` tokens in `layout.css`, replacing the current ones): ground `#0d0b1e`, panel `#16132e`, line `#2a2550`, ink `#f1eefe`, muted `#a7a1d0`, hot pink `#ff4f9a` (primary), sunset orange `#ffb347`, cyan `#45e3ff` (live/status only). The sunset gradient (orange → pink) is for the main button, the "Voted" state and the hero title, nowhere else.
- **Type:** Kanit 800 italic for headings and titles, Manrope for body text, Space Mono for numbers, countdowns and small labels. Bebas Neue goes.
- **Motion:** content fades up on load (staggered), posters lift on hover, buttons press in, the hero's perspective grid drifts slowly. Everything respects `prefers-reduced-motion`.
- **Icons:** inline stroke SVGs instead of the emoji currently in the nav and headings.
- **App icon and favicon** get the new palette.

### 12.2 Pages

| Page                                                             | Change                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home `/`                                                         | Hero: phase label, gradient title, date, a Nominate → Vote → Watch stepper, countdown and "4 / 6 voted" tiles, your votes left, one main button. Then "On the ballot" poster grid and "Most wanted".                            |
| Night `/nights/[id]`                                             | Ballot as a list: poster, title, year · runtime · genre, one-line synopsis, status, who picked it, the vote controls (§13) and who voted (§14). Segmented "All / Your votes" filter, sticky footer with votes left, undo toast. |
| Winner reveal                                                    | "Ready for the winner?" → sunset rises over the grid, the title slides in with a chrome shine, then status and the results bars. Replaces `WinnerReveal`'s current animation.                                                   |
| Discover, Watchlist, Movie, Nights history, Admin, Login, Invite | Re-skinned with the same tokens and components. No layout changes beyond what §15 needs.                                                                                                                                        |

### 12.3 Shared components

`Avatar`, `AvatarStack`, `Poster` (with the status dot), `VoteControl`, `StatusPill`, `Stepper`, `StatTile`, `Toast`, `SegmentedControl`, `SectionHeader`. `MovieCard`, `StatusBadge` and `WinnerReveal` are reworked onto these.

**Decision:** ✅ Approved.

---

## 13. Up and down votes

Each member still gets _K_ votes per night (default 3). Each vote goes on a different film and is either **up (+1)** or **down (−1)**. A film's **score** is ups minus downs, and the highest score wins.

- **One budget:** an up and a down both use one of your _K_ votes, so a downvote costs you an upvote somewhere else.
- **Your own nomination:** you can't vote on it at all, up or down (the existing per-night setting can still allow it).
- **Changing your mind:** tap up, tap down or tap again to clear, until voting closes.
- **Tie-breaks:** score → more upvotes (more people actively wanted it) → more watchlist saves → seeded random draw, as today.
- **Data:** `votes` gets a `value` column (`1` or `-1`, default `1`), so existing votes become upvotes. `tally()` sums values; `RankedEntry` gains `ups`, `downs` and `score` (stored results from old nights still read, with `score = votes`).
- **UI:** a compact ▲ / ▼ pair per film. The chosen one fills (pink up, orange down) and shows the film's running score when votes are visible (§14).

**Decision:** ✅ Approved: shared budget, no separate cap on downvotes.

---

## 14. Seeing who voted for what

**Votes are visible by default.** A new night setting, **"Secret ballot"** (off by default), hides them.

| What people see                      | Visible (default) | Secret ballot              |
| ------------------------------------ | ----------------- | -------------------------- |
| Live score per film while voting     | Yes               | No                         |
| Who voted, and up or down            | Yes, live         | Never                      |
| Who has voted at all ("4 / 6 voted") | Yes               | Yes (count only, no names) |
| Final scores after close             | Yes               | Yes                        |

- **On each film:** an avatar stack of who voted, with a small ▲/▼ badge on each face. Tap it to expand the list of names.
- **Live:** votes already go out over SSE (M7), so other people's avatars pop in as they vote.
- **Data:** this reuses the existing `results_hidden` column, renamed `secret_ballot` with its default flipped to off. Existing nights keep the setting they had. `nightView()` only returns voter identities when the night isn't secret, so names never reach the browser otherwise.
- **The reveal still happens** on open ballots. The winner may be obvious by then, but the moment is part of the fun.

**Decision:** ✅ Approved.

---

## 15. People and avatars

- **Avatar:** the user's Seerr/Jellyfin picture when there is one, otherwise their initials on a colour derived from their user ID (stable, and different per person). Seerr avatars are saved at sign-in and served through `/avatar/[userId]`, like posters, because Seerr's address is usually internal.
- **Attendance comes from taking part.** Nominating or voting on a night means you're **going**. Anyone else can tap **I'm in** to say they're coming without voting yet. Everyone who hasn't done any of those counts as **not going or abstaining**. "I'm in" can be taken back while you have no nominations or votes on the night.
- **"Who's in" strip** on Home and the night page: everyone's avatar in two groups, **Going** and **Not in yet**, with a small badge on each going person for what they've done (nominated, voted, or just "I'm in"). It shows at a glance who's coming and who to nudge.
- **Data:** a small `attendance(night_id, user_id, joined_at)` table for explicit "I'm in" taps. Going = has an attendance row, a nomination or a vote on the night, so it's never out of sync with what people actually did. Changes go out over SSE like votes.
- **Avatars appear wherever a person is named:** "picked by" on each film, the voter stacks (§14), ratings and comments, the history page and the header.

**Decision:** ✅ Approved.

---

## 16. Mobile and desktop

Mobile-first, checked at 375 px, 768 px and 1280 px.

- **Phone (< 640 px):** single column, bottom tab bar, sticky ballot footer, 44 px minimum touch targets.
- **Tablet (640–1023 px):** top nav, two-column poster grids become three to four, the ballot stays a list.
- **Desktop (≥ 1024 px):** content up to about 1200 px wide. Home becomes two columns (hero and ballot on the left; Who's in, countdown and Most wanted on the right). The night page puts the ballot list next to a sticky side panel with your votes, the people strip and the deadline. The reveal is centred at about 720 px.
- Hover states only add to what tapping already shows.

**Decision:** ✅ Approved.

---

## 11. Build milestones

| #     | Milestone    | Deliverable                                                                  |
| ----- | ------------ | ---------------------------------------------------------------------------- |
| M0 ✅ | Scaffold     | SvelteKit + Drizzle + SQLite, Dockerfile, compose, CI lint/test              |
| M1 ✅ | Auth         | Seerr (Jellyfin) login and invite links, sessions, owner role                |
| M2 ✅ | Metadata     | Seerr search/detail, movie cache, poster proxy, Radarr status poller         |
| M3 ✅ | Watchlist    | Personal and group "Most Wanted"                                             |
| M4 ✅ | Movie Nights | Night lifecycle, nominations, voting, tally + tie-break (unit-tested)        |
| M5 ✅ | Results      | Winner reveal, owner request via Seerr, history, ratings                     |
| M6 ⏸  | Discord      | Webhook notifications for each phase plus the "ready" alert                  |
| M7 ✅ | Polish       | SSE live updates, PWA, admin health page, backups                            |
| M8    | Redesign     | Midnight Movie theme, shared components, responsive layouts (§12, §16)       |
| M9    | Voting v2    | Up/down votes, scores, new tie-breaks, migration (§13)                       |
| M10   | People       | Avatars, attendance, Who's in strip, visible votes, secret ballot (§14, §15) |

**Decision:** ✅ Approved. M0 is done.
