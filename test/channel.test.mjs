import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

test(
  'dashboard keeps guest reads public and forwards owner commands only to its configured channel',
  { timeout: 10000 },
  async (t) => {
    const key = randomBytes(24).toString('hex');
    const calls = [];
    const upstream = createServer(async (req, res) => {
      const granted = req.headers['x-terraria-console-key'] === key;
      let body = '';
      for await (const chunk of req) body += chunk;
      calls.push({ path: req.url, method: req.method, granted, body });
      const status = req.method === 'POST' && !granted ? 403 : 200;
      res
        .writeHead(status, { 'content-type': 'application/json' })
        .end(
          JSON.stringify({
            logs: granted ? ['test fixture'] : [],
            ok: status === 200,
          }),
        );
    });
    upstream.listen(0, '127.0.0.1');
    await once(upstream, 'listening');
    t.after(() => new Promise((resolve) => upstream.close(resolve)));
    const connections = [
      {
        port: 'server-channel',
        remoteUrl: 'http://127.0.0.1:' + upstream.address().port,
        transport: { path: '/v1/channel' },
      },
    ];
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('../runtime/server.mjs', import.meta.url))],
      {
        env: {
          ...process.env,
          HOST: '127.0.0.1',
          PORT: '0',
          HOMEPUTE_CONNECTIONS: JSON.stringify(connections),
        },
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    );
    t.after(async () => {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    });
    const [line] = await once(createInterface({ input: child.stdout }), 'line');
    const base = 'http://127.0.0.1:' + line.match(/\d+$/)[0];
    assert.deepEqual(
      (await (await fetch(base + '/api/state')).json()).logs,
      [],
    );
    const command = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command: 'playing' }),
    };
    assert.equal((await fetch(base + '/api/command', command)).status, 403);
    assert.equal(calls.length, 1);
    assert.equal(
      (
        await fetch(base + '/api/command', {
          ...command,
          headers: { ...command.headers, 'x-terraria-console-key': 'wrong' },
        })
      ).status,
      403,
    );
    const authorized = {
      ...command,
      headers: { ...command.headers, 'x-terraria-console-key': key },
    };
    assert.equal((await fetch(base + '/api/link', authorized)).status, 200);
    assert.deepEqual(calls.at(-1), {
      path: '/v1/channel',
      method: 'POST',
      granted: true,
      body: JSON.stringify({ type: 'command', command: 'playing' }),
    });
    assert.deepEqual(
      (
        await (
          await fetch(base + '/api/state', {
            headers: { 'x-terraria-console-key': key },
          })
        ).json()
      ).logs,
      ['test fixture'],
    );
  },
);
