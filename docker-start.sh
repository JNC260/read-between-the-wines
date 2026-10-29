#!/bin/sh
# Starts the server (or whatever command it's given) as the unprivileged
# node user. Railway mounts volumes owned by root, which node can't write
# to, so when this starts as root it first hands the uploads folder to
# node, then drops to node for everything else. Started as anyone else, it
# just runs the command.
set -eu

if [ "$(id -u)" = "0" ]; then
  dir="${UPLOAD_DIR:-uploads}"
  mkdir -p "$dir"
  # Only the folder itself: everything inside is written by node anyway.
  chown node:node "$dir"
  exec setpriv --reuid=node --regid=node --init-groups -- "$@"
fi

exec "$@"
