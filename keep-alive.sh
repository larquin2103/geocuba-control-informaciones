#!/bin/bash
export NODE_OPTIONS="--max-old-space-size=2048"
cd /home/z/my-project
while true; do
  node node_modules/.bin/next dev -p 3000 --webpack
  echo "Server crashed, restarting in 5 seconds..."
  sleep 5
done
