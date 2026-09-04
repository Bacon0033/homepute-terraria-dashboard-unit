import http from 'node:http';

const port = Number(process.env.PORT || 3000);
const parseConnections = () => {
  try { return JSON.parse(process.env.HOMEPUTE_CONNECTIONS || '[]'); } catch { return []; }
};
const terraria = () => parseConnections().find((connection) => connection.port === 'server-channel' && connection.remoteUrl);
const remoteUrl = (connection) => new URL(connection?.transport?.path || '/v1/channel', connection.remoteUrl);

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 65_536) throw new Error('body_too_large');
  }
  return body ? JSON.parse(body) : {};
}

async function proxy(method, body) {
  const connection = terraria();
  if (!connection) return { status: 503, value: { error: 'Connect this add-on to a compatible unit output, then restart the add-on.' } };
  const response = await fetch(remoteUrl(connection), {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5_000),
  });
  return { status: response.status, value: await response.json() };
}

const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Terraria Console</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0d0c12;color:#f5f1ff;font:14px Inter,system-ui}.shell{max-width:1100px;margin:auto;padding:32px}.top{display:flex;justify-content:space-between;align-items:center}.pill{border:1px solid #3b3550;border-radius:99px;padding:8px 12px;color:#b9f6ce;background:#13251b}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.card,.console{border:1px solid #302c3b;background:#17151d;border-radius:18px;padding:18px}.label{color:#8f879f;text-transform:uppercase;letter-spacing:.12em;font-size:11px}.value{font-size:24px;margin-top:8px}.console{height:430px;overflow:auto;font:13px ui-monospace,monospace}.line{padding:7px;border-bottom:1px solid #24212c;color:#cfc8dd}form{display:flex;gap:10px;margin-top:12px}input{flex:1;background:#17151d;border:1px solid #3a3546;border-radius:12px;padding:12px;color:white}button{background:#8c6df0;color:white;border:0;border-radius:12px;padding:0 18px;font-weight:650}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style></head><body><main class="shell"><div class="top"><div><div class="label">Homepute add-on</div><h1>Terraria Dashboard</h1></div><span class="pill" id="status">Connecting</span></div><section class="grid"><div class="card"><div class="label">World</div><div class="value" id="world">—</div></div><div class="card"><div class="label">Uptime</div><div class="value" id="uptime">—</div></div><div class="card"><div class="label">Port</div><div class="value" id="port">—</div></div></section><section class="console" id="console"></section><form id="form"><input id="command" autocomplete="off" placeholder="Enter a Terraria console command"><button>Send</button></form></main><script>const q=s=>document.querySelector(s);async function refresh(){try{const r=await fetch('/api/state');const s=await r.json();q('#status').textContent=s.ready?'Ready':s.running?'Starting':'Offline';q('#world').textContent=s.world||'—';q('#uptime').textContent=s.uptimeSeconds==null?'—':Math.floor(s.uptimeSeconds/60)+' min';q('#port').textContent=s.gamePort||'—';q('#console').innerHTML=(s.logs||[]).map(l=>'<div class="line">'+String(l.message).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</div>').join('');q('#console').scrollTop=q('#console').scrollHeight}catch{q('#status').textContent='Disconnected'}}q('#form').onsubmit=async e=>{e.preventDefault();const command=q('#command').value.trim();if(!command)return;await fetch('/api/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command})});q('#command').value='';refresh()};refresh();setInterval(refresh,2000)</script></body></html>`;

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      return response.end('{"ok":true}');
    }
    if (request.url === '/api/state' || request.url === '/api/link') {
      const result = await proxy('GET');
      response.writeHead(result.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return response.end(JSON.stringify(result.value));
    }
    if (request.method === 'POST' && (request.url === '/api/command' || request.url === '/api/link')) {
      const input = await readBody(request);
      const result = await proxy('POST', { type: 'command', command: String(input.command || '') });
      response.writeHead(result.status, { 'content-type': 'application/json' });
      return response.end(JSON.stringify(result.value));
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(page);
  } catch (error) {
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'connection_failed' }));
  }
});
server.listen(port, '0.0.0.0');
