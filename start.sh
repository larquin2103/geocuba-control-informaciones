#!/bin/bash
export NODE_OPTIONS="--max-old-space-size=2048"
exec npx next dev -p 3000 --webpack
