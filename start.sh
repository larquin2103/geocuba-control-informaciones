#!/bin/bash
cd /home/z/my-project

# ============================================================
# GEOCUBA - Development Server Startup Script
# ============================================================

# Kill any existing server
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# Start the Next.js dev server
nohup npx next dev -p 3000 -H 0.0.0.0 > /home/z/my-project/dev.log 2>&1 &

echo $! > /home/z/my-project/server.pid
echo "✓ Dev server started on port 3000. PID: $(cat /home/z/my-project/server.pid)"
