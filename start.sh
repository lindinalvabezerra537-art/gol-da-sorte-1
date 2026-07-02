#!/bin/bash
set -e

# Agressively kill anything holding our ports
echo "Liberando portas..."
pkill -9 -f "dist/index.mjs" 2>/dev/null || true
pkill -9 -f "api-server" 2>/dev/null || true

# Use node to find and kill processes on port 8081
node -e "
const net = require('net');
const { execSync } = require('child_process');
try {
  const out = execSync('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || cat /proc/net/tcp 2>/dev/null', {encoding:'utf-8'});
  console.log('Port scan done');
} catch(e) {}
try { execSync('pkill -9 -f \"dist/index.mjs\"', {stdio:'ignore'}); } catch(e) {}
" 2>/dev/null || true

sleep 3

# Build the API server first
echo "Building API server..."
cd /home/runner/workspace/artifacts/api-server && pnpm run build
cd /home/runner/workspace

# Function to start API server
start_api() {
  # Kill anything on 8081 before starting
  pkill -9 -f "dist/index.mjs" 2>/dev/null || true
  sleep 1
  PORT=8081 node --enable-source-maps /home/runner/workspace/artifacts/api-server/dist/index.mjs &
  echo $!
}

# Start API server in background (port 8081)
echo "Starting API server..."
API_PID=$(start_api)

# Wait for API server to be ready (up to 30s)
echo "Waiting for API server on port 8081..."
READY=0
for i in $(seq 1 30); do
  if curl -sf http://localhost:8081/api > /dev/null 2>&1; then
    echo "API server ready."
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -eq 0 ]; then
  echo "API server failed to start. Killing and retrying..."
  pkill -9 -f "dist/index.mjs" 2>/dev/null || true
  sleep 2
  API_PID=$(start_api)
  sleep 5
fi

# Start Vite dev server (port 5000)
echo "Starting frontend..."
NODE_OPTIONS="--max-http-header-size=65536" PORT=5000 BASE_PATH=/ pnpm --filter @workspace/gol-da-sorte run dev &
VITE_PID=$!

# Trap exit signals to clean up both processes
cleanup() {
  echo "Shutting down..."
  pkill -9 -f "dist/index.mjs" 2>/dev/null || true
  kill $VITE_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT EXIT

# Watch loop: restart API server if it dies
while true; do
  if ! kill -0 $API_PID 2>/dev/null; then
    echo "API server stopped unexpectedly. Restarting..."
    pkill -9 -f "dist/index.mjs" 2>/dev/null || true
    sleep 2
    API_PID=$(start_api)
  fi
  if ! kill -0 $VITE_PID 2>/dev/null; then
    echo "Frontend stopped. Exiting."
    exit 1
  fi
  sleep 5
done
