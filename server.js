/* Grand Circuit room relay.
   Serves the game files and passes messages between the people in a room.
   No dependencies: plain Node, server-sent events out, POST in.

     node server.js [port]

   The console prints the address to hand to other players on the network. */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.argv[2]) || 8123;
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8'
};

/* code -> { clients: Map(id -> res), lastSeen } */
const rooms = new Map();
const ROOM_TTL = 1000 * 60 * 60 * 6;

function room(code) {
  let r = rooms.get(code);
  if (!r) { r = { clients: new Map(), lastSeen: Date.now() }; rooms.set(code, r); }
  r.lastSeen = Date.now();
  return r;
}

function post(code, payload, exceptId) {
  const r = rooms.get(code);
  if (!r) return 0;
  const line = 'data: ' + JSON.stringify(payload) + '\n\n';
  let sent = 0;
  r.clients.forEach((res, id) => {
    if (id === exceptId) return;
    try { res.write(line); sent++; } catch (e) { r.clients.delete(id); }
  });
  r.lastSeen = Date.now();
  return sent;
}

setInterval(() => {
  const now = Date.now();
  rooms.forEach((r, code) => {
    if (r.clients.size === 0 && now - r.lastSeen > ROOM_TTL) rooms.delete(code);
    else r.clients.forEach(res => { try { res.write(': ping\n\n'); } catch (e) {} });
  });
}, 25000).unref();

function serveFile(req, res) {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      /* Always hand back the current file: a stale game.js looks like a
         missing feature. */
      'Cache-Control': 'no-store, must-revalidate'
    });
    res.end(body);
  });
}

const server = http.createServer((req, res) => {
  const [pathname, query] = req.url.split('?');
  const params = new URLSearchParams(query || '');

  /* Everyone in a room listens here. */
  if (pathname === '/room/events') {
    const code = (params.get('code') || '').toUpperCase();
    const id = params.get('id') || String(Math.random());
    if (!code) { res.writeHead(400).end('code required'); return; }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      /* Always hand back the current file: a stale game.js looks like a
         missing feature. */
      'Cache-Control': 'no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write('retry: 2000\n\n');
    const r = room(code);
    r.clients.set(id, res);
    res.write('data: ' + JSON.stringify({ type: 'hello', id, size: r.clients.size }) + '\n\n');
    post(code, { type: 'peer-joined', id }, id);
    req.on('close', () => {
      const cur = rooms.get(code);
      if (!cur) return;
      cur.clients.delete(id);
      post(code, { type: 'peer-left', id }, id);
    });
    return;
  }

  /* And speaks here. */
  if (pathname === '/room/send' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2e6) req.destroy();
    });
    req.on('end', () => {
      let msg;
      try { msg = JSON.parse(body); } catch (e) { res.writeHead(400).end('bad json'); return; }
      const code = String(msg.code || '').toUpperCase();
      if (!code) { res.writeHead(400).end('code required'); return; }
      const sent = post(code, msg.payload, msg.from);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, sent }));
    });
    return;
  }

  /* A host tells the lobby what its table looks like. */
  if (pathname === '/room/meta' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      let msg;
      try { msg = JSON.parse(body); } catch (e) { res.writeHead(400).end('bad json'); return; }
      const code = String(msg.code || '').toUpperCase();
      if (!code) { res.writeHead(400).end('code required'); return; }
      room(code).meta = msg.meta || {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  /* Public tables still waiting for players. */
  if (pathname === '/room/list') {
    const out = [];
    rooms.forEach((r, code) => {
      const m = r.meta;
      if (!m || !m.public || m.started || r.clients.size === 0) return;
      out.push({ code, host: m.host || 'Someone', players: m.players || 1,
                 seats: m.seats || 0, map: m.map || 'classic' });
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ rooms: out.slice(0, 40) }));
    return;
  }

  if (pathname === '/room/host-info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ addresses: addresses(), port: PORT }));
    return;
  }

  if (pathname === '/room/exists') {
    const code = (params.get('code') || '').toUpperCase();
    const r = rooms.get(code);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ exists: !!r, players: r ? r.clients.size : 0 }));
    return;
  }

  serveFile(req, res);
});

function addresses() {
  const out = [];
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach(name => {
    (nets[name] || []).forEach(net => {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    });
  });
  return out;
}

server.listen(PORT, () => {
  console.log('Grand Circuit is up.');
  console.log('  On this machine:  http://localhost:' + PORT);
  addresses().forEach(ip => console.log('  On the network:   http://' + ip + ':' + PORT));
  console.log('Hand a network address plus the room link to the people you want to play with.');
});
