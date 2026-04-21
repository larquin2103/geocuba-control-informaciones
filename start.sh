#!/bin/bash
cd /home/z/my-project

# ============================================================
# GEOCUBA - Permanent Deployment Script
# Uses Next.js standalone build for maximum stability
# ============================================================

# Kill any existing server
fuser -k 3000/tcp 2>/dev/null || true
start-stop-daemon --stop --pidfile /home/z/my-project/server.pid 2>/dev/null || true
sleep 1

# Check if standalone build exists, if not create it
if [ ! -f ".next/standalone/server.js" ]; then
  echo "Standalone build not found. Building..."
  NODE_OPTIONS="--max-old-space-size=7168" npx next build

  # Copy required files to standalone directory
  cp -r .next/static .next/standalone/.next/
  cp -r public .next/standalone/ 2>/dev/null || mkdir -p .next/standalone/public
  cp -r prisma .next/standalone/ 2>/dev/null || true
  cp -r db .next/standalone/ 2>/dev/null || true
fi

# Ensure static files are in sync (in case of rebuild)
if [ -d ".next/static" ]; then
  cp -rn .next/static .next/standalone/.next/ 2>/dev/null || true
fi

# Start the standalone server as a persistent daemon
start-stop-daemon --start \
  --background \
  --make-pidfile \
  --pidfile /home/z/my-project/server.pid \
  --startas /bin/bash \
  -- -c "cd /home/z/my-project/.next/standalone && while true; do NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 node server.js >> /home/z/my-project/dev.log 2>&1; echo 'Server exited at '\$(date)', restarting in 3s...' >> /home/z/my-project/server-restarts.log; sleep 3; done"

echo "✓ Server started (standalone mode). PID file: /home/z/my-project/server.pid"
