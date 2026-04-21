#!/bin/bash
cd /home/z/my-project

# Check if production build exists
if [ ! -f ".next/BUILD_ID" ]; then
  echo "Building production bundle..."
  NODE_OPTIONS="--max-old-space-size=7168" npx next build
fi

# Start production server with auto-restart
while true; do
  echo "Starting Next.js production server..."
  npx next start -p 3000 -H 0.0.0.0
  EXIT_CODE=$?
  echo "Server exited with code $EXIT_CODE, restarting in 3 seconds..."
  sleep 3
done
