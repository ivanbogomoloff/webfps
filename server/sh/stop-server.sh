#!/usr/bin/env sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8080}"
PIDFILE="$ROOT/bin/server.pid"

if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "Останавливаю PID $PID (из bin/server.pid)"
    kill "$PID" 2>/dev/null || true
  fi
  rm -f "$PIDFILE"
fi

if ! command -v lsof >/dev/null 2>&1; then
  echo "stop-server.sh: lsof не найден; если сервер не из start-server.sh — остановите вручную." >&2
  exit 0
fi

PIDS=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
if [ -z "$PIDS" ]; then
  echo "На порту $PORT никто не слушает."
  exit 0
fi

echo "Останавливаю по порту $PORT: PID $PIDS"
echo "$PIDS" | xargs kill
