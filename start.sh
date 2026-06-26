#!/bin/bash
set -e

# Free ports before starting
fuser -k 8081/tcp 2>/dev/null || true
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 24365/tcp 2>/dev/null || true
sleep 1

# Build the API server first
echo "Building API server..."
cd /home/runner/workspace/artifacts/api-server && pnpm run build
cd /home/runner/workspace

# Start API server in background (port 8081)
echo "Starting API server..."
PORT=8081 node --enable-source-maps /home/runner/workspace/artifacts/api-server/dist/index.mjs &
API_PID=$!

# Wait for API server to be ready (up to 30s)
echo "Waiting for API server on port 8081..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8081/api > /dev/null 2>&1; then
    echo "API server ready."
    break
  fi
  sleep 1
done

# Start Vite dev server (port 5000)
echo "Starting frontend..."
NODE_OPTIONS="--max-http-header-size=65536" PORT=5000 BASE_PATH=/ pnpm --filter @workspace/gol-da-sorte run dev &
VITE_PID=$!

# Trap exit signals to clean up both processes
cleanup() {
  echo "Shutting down..."
  kill $API_PID $VITE_PID 2>/dev/null
  exit 0
}
trap cleanup SIGTERM SIGINT EXIT

# Watch loop: restart API server if it dies
while true; do
  if ! kill -0 $API_PID 2>/dev/null; then
    echo "API server stopped unexpectedly. Restarting..."
    PORT=8081 node --enable-source-maps /home/runner/workspace/artifacts/api-server/dist/index.mjs &
    API_PID=$!
  fi
  if ! kill -0 $VITE_PID 2>/dev/null; then
    echo "Frontend stopped. Exiting."
    exit 1
  fi
  sleep 5
done
