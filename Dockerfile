# syntax=docker/dockerfile:1

# ---- build: install deps (incl. native better-sqlite3) and compile the app ----
FROM node:24-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime: only what the server needs ----
FROM node:24-alpine
WORKDIR /app
# No ORIGIN needed: the public URL comes from the Host header (Cloudflare Tunnel passes the
# hostname through) and X-Forwarded-Proto. Set ORIGIN only to pin it to one address.
ENV NODE_ENV=production \
    PORT=3069 \
    DATABASE_URL=/config/votarr.db \
    PROTOCOL_HEADER=x-forwarded-proto

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle

# Starts as root only to give /config to PUID:PGID, then runs the app as that user (su-exec).
RUN apk add --no-cache su-exec && mkdir -p /config
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
VOLUME /config
EXPOSE 3069

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" > /dev/null || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "build"]
