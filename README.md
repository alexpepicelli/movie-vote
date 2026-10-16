# Votarr

Self-hosted movie night voting for friends. It sits next to Radarr and Seerr: friends keep watchlists, nominate films, vote, and the winner is checked against Radarr (or requested through Seerr by the owner). See [PLAN.md](PLAN.md) for the full design.

## Develop

```bash
npm install
cp .env.example .env   # fill in Seerr/Radarr URLs + keys to test integrations
npm run dev
```

The SQLite database is created at `./data/votarr.db`, and migrations run automatically on startup.

| Command                                  | What it does                                                   |
| ---------------------------------------- | -------------------------------------------------------------- |
| `npm test`                               | Unit tests (Vitest)                                            |
| `npm run check`                          | Type-check Svelte + TS                                         |
| `npm run lint` / `npm run format`        | Prettier + ESLint                                              |
| `npm run db:generate -- --name <change>` | Create a migration after editing `src/lib/server/db/schema.ts` |
| `npm run db:studio`                      | Browse the database                                            |

## Deploy with YAMS

[YAMS](https://yams.media) runs extra containers from `docker-compose.custom.yaml` in its install folder (`/opt/yams` below). Those containers join YAMS's network, so Votarr reaches Radarr and Seerr by name. GitHub Actions builds the image and publishes it to `ghcr.io/alexpepicelli/votarr` on every push, so there's nothing to clone or build on the server.

1. **Add the service:** copy the `votarr:` block from [`deploy/yams/docker-compose.custom.yaml`](deploy/yams/docker-compose.custom.yaml) under `services:` in `/opt/yams/docker-compose.custom.yaml`. If your Seerr user isn't ID 1, change `OWNER_SEERR_USER_ID` (Seerr → Users).
2. **Start it:**
   ```bash
   cd /opt/yams && yams start votarr
   ```
   It creates `/opt/yams/config/votarr` itself and runs as your YAMS user (`PUID`/`PGID`).
3. **Expose it through your Cloudflare Tunnel** (Zero Trust → Networks → Tunnels → your tunnel → Public hostnames), e.g. `votarr.<yourdomain>`:
   - cloudflared as a container on the YAMS network → service `http://votarr:3069`
   - cloudflared on the host (your other routes say `http://localhost:…`) → use `http://localhost:3069` (the block publishes `3069:3069`)
   - locally managed tunnel (`config.yml`, dashboard is read-only) → add `- hostname: votarr.<yourdomain>` / `service: http://localhost:3069` above the `http_status:404` catch-all, run `cloudflared tunnel route dns <tunnel> votarr.<yourdomain>`, then `sudo systemctl restart cloudflared`
4. **Sign in** at your hostname with your Jellyfin login (you'll be owner).
5. **Connect your stack** in **Admin → Settings**. The Seerr and Radarr URLs are pre-filled for YAMS (`http://seerr:5055`, `http://radarr:7878`), so just paste each API key (Settings → General in each app), test and save.

**Updating:** if Watchtower is running, it pulls new images automatically. Otherwise:

```bash
cd /opt/yams && docker compose -f docker-compose.yaml -f docker-compose.custom.yaml pull votarr && yams start votarr
```

**If the image is private:** GitHub publishes new packages as private. Either make it public (GitHub → your profile → Packages → votarr → Package settings → Change visibility), or log the server in once with a token that has `read:packages`: `docker login ghcr.io -u alexpepicelli`.

Use the public hostname rather than the LAN port: sign-in cookies are HTTPS-only. Data (including your saved API keys) lives in `/opt/yams/config/votarr`. Keep that folder private. Votarr copies its database into `backups/` there once a day and keeps 14 days of copies; **Admin → Health** lists them and has a **Back up now** button.

## Deploy (plain Docker Compose)

1. Copy `docker-compose.yml` to the server.
2. Optionally create `.env` from `.env.example`. Everything in it is optional, and Seerr/Radarr can be connected in Admin → Settings instead.
3. Make sure the `networks:` name in `docker-compose.yml` matches the network Radarr, Seerr and cloudflared share.
4. Run `docker compose up -d`.
5. In Cloudflare Zero Trust → Tunnels → your tunnel → Public hostnames, add `votarr.<yourdomain>` → `http://votarr:3069`.
6. Sign in, then connect Seerr and Radarr in **Admin → Settings**.

Data lives in `./config` on the host, with daily database copies in `./config/backups` (see **Admin → Health**).

## Using it on a phone

Votarr can be added to the home screen and then opens full-screen like an app:

- **Android (Chrome):** menu ⋮ → **Install app** (or **Add to Home screen**).
- **iPhone (Safari):** Share → **Add to Home Screen**. iOS never shows an install prompt, so friends need to do this themselves.

Live updates: open pages refresh themselves when someone nominates, votes, or a night changes phase.
