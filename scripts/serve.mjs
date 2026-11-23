import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRecordsApi } from './records-api.mjs';
import { isPublicAsset } from './public-assets.mjs';
import { serveSiteRequest } from './site-response.mjs';

const root = fileURLToPath(new URL(process.argv.includes('--dist') ? '../dist/' : '../', import.meta.url));
const portIndex = process.argv.indexOf('--port');
const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 5173;
const dataIndex = process.argv.indexOf('--data-dir');
const dataDir = dataIndex >= 0 ? path.resolve(process.argv[dataIndex + 1]) : fileURLToPath(new URL('../.data/records/', import.meta.url));
const template = await readFile(path.join(root, 'index.html'), 'utf8');
const records = await createRecordsApi({ dataDir });
const mime = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8' };
const server = createServer(async (request, response) => {
  try { if (await records(request, response)) return; }
  catch {
    if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ error: '纪录服务暂时不可用，请稍后重试' }));
    else response.destroy();
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  try {
    const url = new URL(request.url, `http://127.0.0.1:${request.socket.localPort}`);
    const result = await serveSiteRequest(new Request(url, { method: request.method }), { template, records });
    if (result) {
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(request.method === 'HEAD' ? undefined : Buffer.from(await result.arrayBuffer()));
      return;
    }
    if (!isPublicAsset(url.pathname)) {
      response.writeHead(404).end('Not found'); return;
    }
    const file = url.pathname.slice(1);
    const contents = await readFile(path.join(root, file));
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch (error) {
    if (error.code === 'ENOENT') response.writeHead(404).end('Not found');
    else response.writeHead(500, { 'Cache-Control': 'no-store' }).end('Site temporarily unavailable');
  }
});
server.on('error', async error => { console.error(error.message); process.exitCode = 1; await records.close(); });
server.on('close', () => records.close());
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
