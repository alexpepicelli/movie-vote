#!/bin/sh
# Make /data writable for PUID:PGID (like the LinuxServer images YAMS uses), then drop root
# and start the app as that user. Docker creates a missing bind-mount folder as root, so this
# saves creating it by hand.
set -eu

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

case "$PUID$PGID" in
  *[!0-9]*) echo "PUID and PGID must be numeric (got PUID=$PUID PGID=$PGID)" >&2; exit 1 ;;
esac

if [ "$(id -u)" = "0" ]; then
  mkdir -p /data
  # Only fix ownership when it's wrong, so restarts stay fast.
  if [ "$(stat -c %u:%g /data)" != "$PUID:$PGID" ]; then
    echo "Giving /data to $PUID:$PGID"
    chown -R "$PUID:$PGID" /data
  fi
  exec su-exec "$PUID:$PGID" "$@"
fi

# Already started as a non-root user (e.g. `user:` in compose): run as-is.
exec "$@"
