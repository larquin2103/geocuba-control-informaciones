# Worklog

---
Task ID: 1
Agent: Main
Task: Debug and fix application not showing in preview panel

Work Log:
- Investigated why the application was not displaying in the preview panel
- Found the dev server was repeatedly crashing (dying silently after serving requests)
- Root cause: Turbopack compilation was using too much memory (VmSize ~12GB vs 8GB available), causing the process to be killed by the OS
- Fixed by switching from Turbopack to Webpack (`--webpack` flag) which uses significantly less memory
- Fixed `package.json` dev script - removed `| tee dev.log` pipe that was causing broken pipe issues
- Fixed Prisma client logging from `['query']` to `['error', 'warn']` to reduce overhead
- Fixed Calendar component `initialFocus` → `autoFocus` for react-day-picker v9 compatibility
- Optimized `/api/stats` route to use `groupBy` instead of N+1 query pattern
- Set `NODE_OPTIONS="--max-old-space-size=2048"` for better memory management
- Started dev server with `--webpack` flag - all endpoints working correctly
- Verified application works through Caddy gateway (port 81)

Stage Summary:
- Application now displays correctly in the preview panel
- Key fixes: Turbopack → Webpack, removed pipe in dev script, optimized API queries
- Server running on port 3000, accessible via Caddy on port 81
---
Task ID: 1
Agent: Main Agent
Task: Create permanent deployment solution for the site

Work Log:
- Diagnosed root cause: server process was dying when parent shell session ended
- Previous approach using `npx next start` had 3 issues: slow startup (~500ms), dependency on npm subprocess, process instability
- Switched to Next.js standalone build (`output: "standalone"` in next.config.ts)
- Standalone build generates an autonomous `server.js` that runs directly with Node.js
- Startup time improved from ~500ms to ~69ms
- Created robust start.sh using `start-stop-daemon` for persistent daemon process
- Added auto-restart loop with logging in case of crashes
- Fixed TypeScript errors: activity.requesterDept → activity.request.requesterDept, createdRequests type annotation
- Updated package.json scripts to work with standalone build
- All endpoints verified working: departments, stats, requests, compliance, affectation
- CSS files loading correctly (108KB + 2KB)
- 0 restarts after deployment - server is stable

Stage Summary:
- Next.js standalone build configured and working
- Server starts in 69ms (7x faster than before)
- Process persists via start-stop-daemon with auto-restart
- All APIs functional, CSS loading properly
- Zero server restarts = stable deployment
