const { spawn } = require('child_process');
const path = require('path');

function startServer() {
  console.log('[Runner] Starting Next.js server...');
  
  const child = spawn('node', [path.join(__dirname, 'node_modules/.bin/next'), 'dev', '-p', '3000'], {
    cwd: __dirname,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
    stdio: 'inherit'
  });

  child.on('exit', (code, signal) => {
    console.log(`[Runner] Server exited with code ${code}, signal ${signal}`);
    console.log('[Runner] Restarting in 3 seconds...');
    setTimeout(startServer, 3000);
  });

  child.on('error', (err) => {
    console.error('[Runner] Error:', err);
  });

  process.on('SIGTERM', () => {
    child.kill();
    process.exit(0);
  });
}

startServer();
