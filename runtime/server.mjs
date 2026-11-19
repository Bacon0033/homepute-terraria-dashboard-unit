import http from 'node:http';
import { readFileSync } from 'node:fs';

const port = Number(process.env.PORT || 3000);
const parseConnections = () => {
  try { return JSON.parse(process.env.HOMEPUTE_CONNECTIONS || '[]'); } catch { return []; }
};
function terraria() {
  const candidates = parseConnections().filter(connection => connection.direction === 'input' && connection.status === 'active' && connection.port === 'server-channel' && connection.remotePort === 'server-channel' && connection.remoteUrl);
  return candidates.length === 1 ? candidates[0] : undefined;
}
const remoteUrl = (connection) => new URL(connection?.transport?.path || '/v1/channel', connection.remoteUrl);

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 65_536) throw new Error('body_too_large');
  }
  return body ? JSON.parse(body) : {};
}

async function proxy(method, body, credential) {
  const connection = terraria();
  if (!connection) return { status: 503, value: { error: 'Connect one Terraria server output to this panel’s input.' } };
  const response = await fetch(remoteUrl(connection), {
    method, redirect:'error',
    headers: { ...(credential ? {'X-Terraria-Console-Key':credential} : {}), Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5_000),
  });
  return { status: response.status, value: await response.json() };
}

const page = readFileSync(new URL('./panel.html', import.meta.url));

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      return response.end('{"ok":true}');
    }
    if (request.method === 'GET' && (request.url === '/api/state' || request.url === '/api/link')) {
      const result = await proxy('GET',undefined,request.headers['x-terraria-console-key']);
      response.writeHead(result.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return response.end(JSON.stringify(result.value));
    }
    if (request.method === 'POST' && (request.url === '/api/command' || request.url === '/api/link')) {
      if (!request.headers['x-terraria-console-key'] || !String(request.headers['content-type']).startsWith('application/json')) {
        response.writeHead(403); return response.end();
      }
      const input = await readBody(request);
      const result = await proxy('POST', { type: 'command', command: String(input.command || '') }, request.headers['x-terraria-console-key']);
      response.writeHead(result.status, { 'content-type': 'application/json' });
      return response.end(JSON.stringify(result.value));
    }
    if (request.method !== 'GET' || request.url !== '/') { response.writeHead(404); return response.end(); }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control':'no-store' });
    response.end(page);
  } catch (error) {
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'connection_failed' }));
  }
});
server.listen(port, process.env.HOST || '0.0.0.0', () => console.log('Listening on port '+server.address().port));
