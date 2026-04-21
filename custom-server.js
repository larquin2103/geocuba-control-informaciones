const { createServer } = require('http') // eslint-disable-line @typescript-eslint/no-require-imports
const { parse } = require('url') // eslint-disable-line @typescript-eslint/no-require-imports
const next = require('next') // eslint-disable-line @typescript-eslint/no-require-imports

const dev = process.argv.includes('--dev');
const hostname = '0.0.0.0';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
