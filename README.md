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

1. **Add keys to YAMS's `.env`** (`/opt/yams/.env`):
   ```bash
   SEERR_API_KEY=...        # Seerr → Settings → General
   RADARR_API_KEY=...       # Radarr → Settings → General
   VOTARR_URL=https://votarr.example.com
   ```
2. **Add the service:** copy the `votarr:` block from [`deploy/yams/docker-compose.custom.yaml`](deploy/yams/docker-compose.custom.yaml) under `services:` in `/opt/yams/docker-compose.custom.yaml`. Check:
   - the Seerr container name (`seerr` or `jellyseerr`: `docker ps`)
   - `OWNER_SEERR_USER_ID` (Seerr → Users → your user)
3. **Create the data folder as your YAMS user, then start:**
   ```bash
   mkdir -p /opt/yams/config/votarr
   cd /opt/yams && yams start votarr
   ```
4. **Expose it through your Cloudflare Tunnel** (Zero Trust → Networks → Tunnels → your tunnel → Public hostnames), adding a hostname matching `VOTARR_URL`:
   - cloudflared as a container on the YAMS network → service `http://votarr:3000`
   - cloudflared on the host → uncomment the `ports:` line and use `http://localhost:3069`
5. **Sign in** at your hostname with your Jellyfin login (you'll be owner), then open **Home → Check Seerr and Radarr**. Both should say `"status":"ok"`.

**Updating:** if Watchtower is running, it pulls new images automatically. Otherwise:

```bash
cd /opt/yams && docker compose -f docker-compose.yaml -f docker-compose.custom.yaml pull votarr && yams start votarr
```

**If the image is private:** GitHub publishes new packages as private. Either make it public (GitHub → your profile → Packages → votarr → Package settings → Change visibility), or log the server in once with a token that has `read:packages`: `docker login ghcr.io -u alexpepicelli`.

Use the public hostname rather than the LAN port. Sign-in and voting forms only accept requests from `ORIGIN`. Data lives in `/opt/yams/config/votarr`: back up that folder.

## Deploy (plain Docker Compose)

1. Copy `docker-compose.yml` to the server.
2. Create `.env` from `.env.example`. Set `ORIGIN` to the public hostname and fill in the API keys.
3. Make sure the `networks:` name in `docker-compose.yml` matches the network Radarr, Seerr and cloudflared share.
4. Run `docker compose up -d`.
5. In Cloudflare Zero Trust → Tunnels → your tunnel → Public hostnames, add `votarr.<yourdomain>` → `http://votarr:3000`.
6. Check `https://votarr.<yourdomain>/healthz?deep` shows Seerr and Radarr as `ok`.

Data lives in `./data` on the host. Back up that folder.
