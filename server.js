/* قعدة لعّيبة — سيرفر بيمرّر الرسائل بين الريس واللاعبين (Express + ws) */
'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const STATS_KEY = process.env.STATS_KEY || 'la3iba';
const ADMIN_KEY = process.env.ADMIN_KEY || STATS_KEY;
const HOST_GRACE_MS = 45000;
const ROOM_TTL_MS = 8 * 60 * 60 * 1000;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, p) {
    if (/\.(html|js|css|webmanifest)$/.test(p)) res.setHeader('Cache-Control', 'no-cache');
  }
}));
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size }));

/* ---------- الإحصائيات (أرقام بس) ---------- */
const STATS_FILE = path.join(__dirname, 'stats.json');
let stats = { rooms: 0, sessions: 0, finished: 0, rounds: 0, players: 0, games: {}, passes: {}, modes: {}, days: {} };
let pg = null;
const CFG_FILE = path.join(__dirname, 'games-config.json');
let gameCfg = { off: [] };
async function saveCfg() {
  try {
    if (pg) await pg.query('INSERT INTO la3iba_stats (id, data) VALUES (2, $1) ON CONFLICT (id) DO UPDATE SET data = $1', [gameCfg]);
    else fs.writeFileSync(CFG_FILE, JSON.stringify(gameCfg));
  } catch (e) { console.error('cfg save', e.message); }
}
async function loadStats() {
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      pg = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false } });
      await pg.query('CREATE TABLE IF NOT EXISTS la3iba_stats (id INT PRIMARY KEY, data JSONB NOT NULL)');
      const r = await pg.query('SELECT data FROM la3iba_stats WHERE id = 1');
      if (r.rows[0]) stats = Object.assign(stats, r.rows[0].data);
      const c = await pg.query('SELECT data FROM la3iba_stats WHERE id = 2');
      if (c.rows[0]) gameCfg = Object.assign(gameCfg, c.rows[0].data);
      console.log('stats: postgres');
      return;
    } catch (e) { console.error('pg failed, using file', e.message); pg = null; }
  }
  try { stats = Object.assign(stats, JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'))); } catch (e) { }
  try { gameCfg = Object.assign(gameCfg, JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'))); } catch (e) { }
}
let saveT = null;
function saveStats() {
  clearTimeout(saveT);
  saveT = setTimeout(async () => {
    try {
      if (pg) await pg.query('INSERT INTO la3iba_stats (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1', [stats]);
      else fs.writeFileSync(STATS_FILE, JSON.stringify(stats));
    } catch (e) { console.error('stats save', e.message); }
  }, 1500);
}
function bump(obj, k, n) { obj[k] = (obj[k] || 0) + (n || 1); }
function today() { return new Date().toISOString().slice(0, 10); }

const GAME_NAMES = { balloon: 'نفّخ البالونة', candles: 'طفّي الشمع', maze: 'المتاهة', ten: '10 ثواني بالضبط', green: 'الضو الأخضر', fly: 'اصطاد الدبّانة', tap: 'الطابع الأسرع', circle: 'الدائرة الكاملة', stroop: 'الألوان الكذابة', simon: 'احفظ الترتيب', dots: 'عدّ النقاط', odd: 'مين الغريب' };
app.get('/stats', (req, res) => {
  if (req.query.key !== STATS_KEY) return res.status(403).send('مفتاح الإحصائيات غير صحيح. أضف ?key= إلى الرابط.');
  if (req.query.format === 'json') return res.json(stats);
  const rows = (o, names) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${names ? (names[k] || k) : k}</td><td>${v}</td></tr>`).join('') || '<tr><td colspan="2">لا توجد بيانات بعد</td></tr>';
  const days = Object.entries(stats.days).sort().slice(-14).map(([d, v]) => `<tr><td>${d}</td><td>${v}</td></tr>`).join('');
  res.send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>إحصائيات قعدة لعّيبة</title>
<style>body{font-family:system-ui,sans-serif;background:#FFF4D6;color:#16211B;max-width:720px;margin:0 auto;padding:20px}h1{margin:0 0 6px}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}.c{background:#fff;border:3px solid #16211B;border-radius:14px;padding:12px;box-shadow:4px 4px 0 #16211B}.c b{display:block;font-size:30px}table{width:100%;border-collapse:collapse;background:#fff;border:3px solid #16211B;margin:10px 0 22px}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:right}th{background:#FFC21A}</style></head><body>
<h1>إحصائيات قعدة لعّيبة</h1><p>أرقام إجمالية فقط، دون أي أسماء أو صور.</p>
<div class="g"><div class="c">القعدات المفتوحة<b>${stats.rooms}</b></div><div class="c">الجلسات التي بدأت<b>${stats.sessions}</b></div><div class="c">الجلسات المكتملة<b>${stats.finished}</b></div><div class="c">الجولات الملعوبة<b>${stats.rounds}</b></div><div class="c">مجموع اللاعبين<b>${stats.players}</b></div></div>
<h2>أكثر الألعاب لعباً</h2><table><tr><th>اللعبة</th><th>عدد الجولات</th></tr>${rows(stats.games, GAME_NAMES)}</table>
<h2>الألعاب التي تم تمريرها</h2><table><tr><th>اللعبة</th><th>عدد مرات التمرير</th></tr>${rows(stats.passes, GAME_NAMES)}</table>
<h2>طريقة اللعب</h2><table><tr><th>الطريقة</th><th>العدد</th></tr>${rows(stats.modes, { solo: 'فردي', teams: 'فرق' })}</table>
<h2>القعدات حسب اليوم</h2><table><tr><th>اليوم</th><th>عدد القعدات</th></tr>${days || '<tr><td colspan="2">لا توجد بيانات بعد</td></tr>'}</table>
</body></html>`);
});

/* ---------- إدارة الألعاب ---------- */
app.get('/config', (req, res) => { res.set('Cache-Control', 'no-store'); res.json({ off: gameCfg.off }); });
app.post('/admin/games', (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).json({ ok: false });
  const off = Array.isArray(req.body && req.body.off) ? req.body.off.filter(g => GAME_NAMES[g]) : [];
  if (off.length >= Object.keys(GAME_NAMES).length) return res.status(400).json({ ok: false, msg: 'لازم تبقى لعبة وحدة مفعّلة على الأقل' });
  gameCfg.off = off; saveCfg();
  res.json({ ok: true, off });
});
app.get('/admin', (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send('مفتاح الإدارة غير صحيح. أضف ?key= إلى الرابط.');
  const key = encodeURIComponent(req.query.key);
  const rows = Object.entries(GAME_NAMES).map(([id, n]) => `<label class="r"><span>${n}<small>${(stats.games[id] || 0)} جولة</small></span><input type="checkbox" data-id="${id}" ${gameCfg.off.includes(id) ? '' : 'checked'}><i></i></label>`).join('');
  res.send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>إدارة قعدة لعّيبة</title>
<style>body{font-family:system-ui,sans-serif;background:#FFF4D6;color:#16211B;max-width:560px;margin:0 auto;padding:20px}h1{margin:0 0 4px}p{margin:0 0 16px;color:#5C6B60}
.r{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:3px solid #16211B;border-radius:14px;padding:12px 14px;margin-bottom:10px;box-shadow:3px 3px 0 #16211B;cursor:pointer}
.r span{font-weight:700;display:flex;flex-direction:column}.r small{font-weight:400;color:#5C6B60}
.r input{display:none}.r i{width:52px;height:30px;border-radius:99px;background:#ddd;border:2px solid #16211B;position:relative;flex:none;transition:.2s}
.r i::after{content:"";position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:#fff;border:2px solid #16211B;transition:.2s}
.r input:checked+i{background:#22C17A}.r input:checked+i::after{right:25px}
#msg{min-height:24px;font-weight:700}a{color:#2F6BFF}</style></head><body>
<h1>إدارة قعدة لعّيبة</h1><p>فعّل أو أوقف أي لعبة. الألعاب الموقوفة تظهر للناس مقفلة بعبارة «قريباً» ولا تدخل العجلة. يُحفظ التغيير فوراً.</p>
${rows}<div id="msg"></div><p><a href="/stats?key=${key}">الإحصائيات ←</a></p>
<script>
const msg=document.getElementById('msg');
document.querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{
  const off=[...document.querySelectorAll('input')].filter(x=>!x.checked).map(x=>x.dataset.id);
  fetch('/admin/games?key=${key}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({off})}).then(r=>r.json()).then(j=>{
    if(j.ok){msg.textContent='تم الحفظ ✔';msg.style.color='#1E9C77'}else{msg.textContent=j.msg||'لم يتم الحفظ';msg.style.color='#E0336F';i.checked=!i.checked}
  }).catch(()=>{msg.textContent='تعذّر الاتصال';i.checked=!i.checked});
}));
</script></body></html>`);
});

/* ---------- الغرف ---------- */
const rooms = new Map();
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
function newCode() {
  for (let i = 0; i < 1000; i++) {
    let c = ''; for (let j = 0; j < 5; j++) c += LETTERS[crypto.randomInt(LETTERS.length)];
    if (!rooms.has(c)) return c;
  }
  throw new Error('no codes');
}
function newKey() { return crypto.randomBytes(18).toString('hex'); }
function makeRoom(code, key, pid) {
  const room = { code, hostKey: key, hostPid: pid, host: null, clients: new Map(), state: null, photos: {}, banned: new Set(), hostLeftAt: null, goneTimer: null, touched: Date.now() };
  rooms.set(code, room);
  return room;
}
function send(ws, o) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); } catch (e) { } } }
function broadcast(room, o, except) {
  const s = JSON.stringify(o);
  room.clients.forEach(ws => { if (ws !== except && ws.readyState === 1) { try { ws.send(s); } catch (e) { } } });
}
function online(room) {
  const l = [...room.clients.keys()];
  if (room.host) l.push(room.hostPid);
  return l;
}
function setHost(room, ws, key) {
  if (room.goneTimer) { clearTimeout(room.goneTimer); room.goneTimer = null; }
  room.clients.delete(ws.pid);
  room.host = ws; room.hostPid = ws.pid; room.hostKey = key; room.hostLeftAt = null;
  ws.isHost = true;
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 6 * 1024 * 1024 });

wss.on('connection', (ws) => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = ws.code ? rooms.get(ws.code) : null;
    if (room) room.touched = Date.now();

    switch (m.t) {
      case 'ping': { send(ws, { t: 'pong', c: m.c, s: Date.now() }); return; }
      case 'create': {
        if (typeof m.pid !== 'string') return;
        const code = newCode(), key = newKey();
        const r = makeRoom(code, key, m.pid);
        ws.pid = m.pid; ws.code = code;
        setHost(r, ws, key);
        bump(stats, 'rooms'); bump(stats.days, today()); saveStats();
        send(ws, { t: 'created', code, key });
        return;
      }
      case 'hello': {
        if (typeof m.code !== 'string' || typeof m.pid !== 'string') return;
        const code = m.code.toUpperCase();
        let r = rooms.get(code);
        if (!r && m.key && /^[A-Z]{5}$/.test(code)) r = makeRoom(code, m.key, m.pid); // رجوع الريس بعد إعادة تشغيل السيرفر
        if (!r) return send(ws, { t: 'nope' });
        if (r.banned.has(m.pid)) { send(ws, { t: 'kicked' }); return; }
        ws.pid = m.pid; ws.code = code;
        if (m.key && m.key === r.hostKey) {
          if (r.host && r.host !== ws) { try { r.host.close(); } catch (e) { } }
          setHost(r, ws, m.key);
          send(ws, { t: 'welcome', role: 'host', state: r.state, photos: r.photos, online: online(r) });
          broadcast(r, { t: 'hostBack' });
        } else {
          const old = r.clients.get(m.pid);
          if (old && old !== ws) { old.replaced = true; try { old.close(); } catch (e) { } }
          if (r.host && r.hostPid === m.pid && r.host !== ws) { /* الريس القديم رجع بلا مفتاح */ }
          ws.isHost = false;
          r.clients.set(m.pid, ws);
          send(ws, { t: 'welcome', role: 'player', state: r.state, photos: r.photos, hostOn: !!r.host });
          if (r.host) send(r.host, { t: 'presence', pid: m.pid, on: true });
          else if (r.hostLeftAt && Date.now() - r.hostLeftAt > HOST_GRACE_MS) send(ws, { t: 'hostGone' });
        }
        return;
      }
      case 'act': {
        if (!room || ws.isHost) return;
        if (room.host) send(room.host, { t: 'act', pid: ws.pid, a: m.a });
        else send(ws, { t: 'noHost' });
        return;
      }
      case 'state': {
        if (!room || !ws.isHost || room.host !== ws) return;
        room.state = m.s;
        broadcast(room, { t: 'state', s: m.s });
        return;
      }
      case 'photos': {
        if (!room || !ws.isHost || room.host !== ws) return;
        room.photos = m.p || {};
        broadcast(room, { t: 'photos', p: room.photos });
        return;
      }
      case 'kick': {
        if (!room || !ws.isHost) return;
        room.banned.add(m.pid);
        const c = room.clients.get(m.pid);
        if (c) { send(c, { t: 'kicked' }); room.clients.delete(m.pid); setTimeout(() => { try { c.close(); } catch (e) { } }, 300); }
        return;
      }
      case 'transfer': {
        if (!room || !ws.isHost || room.host !== ws) return;
        const target = room.clients.get(m.pid);
        if (!target) return;
        const key = newKey();
        ws.isHost = false;
        room.clients.set(ws.pid, ws);
        setHost(room, target, key);
        send(target, { t: 'becomeHost', key, state: room.state, photos: room.photos, online: online(room) });
        send(ws, { t: 'demoted' });
        return;
      }
      case 'claimHost': {
        if (!room || ws.isHost || room.host) return;
        if (!room.hostLeftAt || Date.now() - room.hostLeftAt < HOST_GRACE_MS) return;
        const key = newKey();
        setHost(room, ws, key);
        send(ws, { t: 'becomeHost', key, state: room.state, photos: room.photos, online: online(room) });
        broadcast(room, { t: 'hostBack' });
        return;
      }
      case 'stat': {
        if (!room || !ws.isHost) return;
        const d = m.d || {};
        if (m.ev === 'start') { bump(stats, 'sessions'); bump(stats, 'players', Math.min(30, d.players | 0)); if (d.mode) bump(stats.modes, String(d.mode).slice(0, 10)); }
        if (m.ev === 'round' && GAME_NAMES[d.game]) { bump(stats, 'rounds'); bump(stats.games, d.game); }
        if (m.ev === 'pass' && GAME_NAMES[d.game]) bump(stats.passes, d.game);
        if (m.ev === 'finish') bump(stats, 'finished');
        if (m.ev === 'replay' && GAME_NAMES[d.game]) { stats.replays = stats.replays || {}; bump(stats.replays, d.game); }
        saveStats();
        return;
      }
    }
  });
  ws.on('close', () => {
    const room = ws.code ? rooms.get(ws.code) : null;
    if (!room) return;
    if (room.host === ws) {
      room.host = null; room.hostLeftAt = Date.now();
      broadcast(room, { t: 'hostAway' });
      room.goneTimer = setTimeout(() => { if (!room.host) broadcast(room, { t: 'hostGone' }); }, HOST_GRACE_MS + 200);
    } else if (room.clients.get(ws.pid) === ws) {
      room.clients.delete(ws.pid);
      if (room.host && !ws.replaced) send(room.host, { t: 'presence', pid: ws.pid, on: false });
    }
  });
});

setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; try { ws.ping(); } catch (e) { } });
  const now = Date.now();
  rooms.forEach((r, code) => { if (!r.host && r.clients.size === 0 && now - r.touched > ROOM_TTL_MS) rooms.delete(code); });
}, 25000);

loadStats().then(() => server.listen(PORT, () => console.log('قعدة لعّيبة على البورت ' + PORT)));
