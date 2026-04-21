#!/bin/bash
cd /home/z/my-project

# Check if production build exists
if [ ! -f ".next/BUILD_ID" ]; then
  echo "Building production bundle..."
  NODE_OPTIONS="--max-old-space-size=7168" npx next build
fi

# Kill any existing server on port 3000
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# Start production server persistently using start-stop-daemon
start-stop-daemon --stop --pidfile /home/z/my-project/server.pid 2>/dev/null || true
sleep 1

start-stop-daemon --start --background --make-pidfile --pidfile /home/z/my-project/server.pid \
  --startas /bin/bash -- -c "cd /home/z/my-project && while true; do npx next start -p 3000 -H 0.0.0.0; echo 'Server crashed at \$(date), restarting in 3s...' >> /home/z/my-project/server-restarts.log; sleep 3; done"

echo "Server started. Check /home/z/my-project/dev.log for output."
