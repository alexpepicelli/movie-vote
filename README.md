# Movie Vote

Self-hosted movie night voting for friends. It sits next to Radarr and Seerr: friends keep watchlists, nominate films, vote, and the winner is checked against Radarr (or requested through Seerr by the owner). See [PLAN.md](PLAN.md) for the full design.

## Develop

```bash
npm install
cp .env.example .env   # fill in Seerr/Radarr URLs + keys to test integrations
npm run dev
```

The SQLite database is created at `./data/movie-vote.db`, and migrations run automatically on startup.

| Command                                  | What it does                                                   |
| ---------------------------------------- | -------------------------------------------------------------- |
| `npm test`                               | Unit tests (Vitest)                                            |
| `npm run check`                          | Type-check Svelte + TS                                         |
| `npm run lint` / `npm run format`        | Prettier + ESLint                                              |
| `npm run db:generate -- --name <change>` | Create a migration after editing `src/lib/server/db/schema.ts` |
| `npm run db:studio`                      | Browse the database                                            |

## Deploy with YAMS

[YAMS](https://yams.media) runs extra containers from `docker-compose.custom.yaml` in its install folder (`/opt/yams` below). Those containers join YAMS's network, so Movie Vote reaches Radarr and Seerr by name.

1. **Get the code onto the server:**
   ```bash
   sudo git clone <your repo url> /opt/movie-vote && sudo chown -R $USER: /opt/movie-vote
   ```
2. **Add keys to YAMS's `.env`** (`/opt/yams/.env`):
   ```bash
   SEERR_API_KEY=...        # Seerr → Settings → General
   RADARR_API_KEY=...       # Radarr → Settings → General
   MOVIE_VOTE_URL=https://movies.example.com
   ```
3. **Add the service:** copy the `movie-vote:` block from [`deploy/yams/docker-compose.custom.yaml`](deploy/yams/docker-compose.custom.yaml) under `services:` in `/opt/yams/docker-compose.custom.yaml`. Check:
   - the Seerr container name (`seerr` or `jellyseerr`: `docker ps`)
   - `OWNER_SEERR_USER_ID` (Seerr → Users → your user)
4. **Create the data folder as your YAMS user, then start:**
   ```bash
   mkdir -p /opt/yams/config/movie-vote
   cd /opt/yams && yams start movie-vote
   ```
5. **Expose it through your Cloudflare Tunnel** (Zero Trust → Networks → Tunnels → your tunnel → Public hostnames), adding a hostname matching `MOVIE_VOTE_URL`:
   - cloudflared as a container on the YAMS network → service `http://movie-vote:3000`
   - cloudflared on the host → uncomment the `ports:` line and use `http://localhost:3069`
6. **Sign in** at your hostname with your Jellyfin login (you'll be owner), then open **Home → Check Seerr and Radarr**. Both should say `"status":"ok"`.

**Updating:**

```bash
cd /opt/movie-vote && git pull
cd /opt/yams && docker compose -f docker-compose.yaml -f docker-compose.custom.yaml up -d --build movie-vote
```

Use the public hostname rather than the LAN port. Sign-in and voting forms only accept requests from `ORIGIN`. Data lives in `/opt/yams/config/movie-vote`: back up that folder.

## Deploy (plain Docker Compose)

1. Copy the repo (or just `docker-compose.yml` once images are published) to the server.
2. Create `.env` from `.env.example`. Set `ORIGIN` to the public hostname and fill in the API keys.
3. Make sure the `networks:` name in `docker-compose.yml` matches the network Radarr, Seerr and cloudflared share.
4. Run `docker compose up -d --build`.
5. In Cloudflare Zero Trust → Tunnels → your tunnel → Public hostnames, add `movies.<yourdomain>` → `http://movie-vote:3000`.
6. Check `https://movies.<yourdomain>/healthz?deep` shows Seerr and Radarr as `ok`.

Data lives in `./data` on the host. Back up that folder.
