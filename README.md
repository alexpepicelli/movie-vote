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

## Deploy (Ubuntu + Docker + Cloudflare Tunnel)

1. Copy the repo (or just `docker-compose.yml` once images are published) to the server.
2. Create `.env` from `.env.example`. Set `ORIGIN` to the public hostname and fill in the API keys.
3. Make sure the `networks:` name in `docker-compose.yml` matches the network Radarr, Seerr and cloudflared share.
4. Run `docker compose up -d --build`.
5. In Cloudflare Zero Trust → Tunnels → your tunnel → Public hostnames, add `movies.<yourdomain>` → `http://movie-vote:3000`.
6. Check `https://movies.<yourdomain>/healthz?deep` shows Seerr and Radarr as `ok`.

Data lives in `./data` on the host. Back up that folder.
