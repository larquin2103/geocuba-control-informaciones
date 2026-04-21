#!/bin/bash
cd /home/z/my-project
while true; do
  npx next start -p 3000 -H 0.0.0.0 2>&1
  echo "Server crashed, restarting in 3s..." >> /home/z/my-project/server-restarts.log
  sleep 3
done
