const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

const port = parseInt(process.env.PORT || '3000', 10);
const dev = false;
const dir = path.join(__dirname, '..');

const app = next({ dev, dir });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, () => {
    console.log(`> Next.js läuft auf http://localhost:${port}`);
  });
}).catch(err => {
  console.error('Fehler beim Start von Next.js:', err);
  process.exit(1);
});
