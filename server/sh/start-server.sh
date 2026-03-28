#!/usr/bin/env sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p bin logs
go build -o bin/api ./cmd/api

# Фоновый процесс: логи в файл (смотреть в реальном времени: tail -f logs/server.log)
rm -f bin/server.pid
./bin/api >> logs/server.log 2>&1 &
echo $! > bin/server.pid

echo "web-fps api PID $(cat bin/server.pid), лог: $ROOT/logs/server.log"
echo "Смотреть лог: tail -f logs/server.log"
