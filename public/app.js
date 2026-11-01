/* قعدة لعّيبة — الواجهة والاتصال */
(function () {
  'use strict';

  var IG = 'https://instagram.com/eyad.hloubi';
  var GM = MiniGames.G;
  var ENG = Engine;
  var $app = document.getElementById('app'), $stage = document.getElementById('stage'), $modal = document.getElementById('modal'), $toast = document.getElementById('toast');

  /* ---------- تخزين محلي آمن ---------- */
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { } }
  };
  function uid() { return 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function qs(name) { try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; } }

  var ME = LS.get('lb_pid', null);
  if (!ME) { ME = uid(); LS.set('lb_pid', ME); }

  /* ---------- الحالة العامة ---------- */
  var S = null, PH = {};
  var engine = null, net = null, demo = false;
  var room = LS.get('lb_room', null); // {code, key}
  var role = 'none';
  var V = {
    screen: 'cover', form: { name: '', g: '', photo: null, code: '' }, formKind: 'join', formErr: '',
    server: null, connected: false, tab: 'rank', story: { layout: 'cover', dark: false },
    playingKey: null, myScores: {}, spinSeen: {}, revealSeen: null, revealAt: 0,
    hostAway: false, hostGone: false, kicked: false, confettiFor: null, setupErr: '', withdrawn: {}, ctrl: null
  };
  var installEvt = null;
  var OFFG = [];
  function liveGames() { return MiniGames.ids.filter(function (id) { return OFFG.indexOf(id) < 0; }); }
  function fixGames() { if (!engine || !S || (S.phase !== 'setup' && S.phase !== 'lobby')) return; var g = S.cfg.games.filter(function (id) { return OFFG.indexOf(id) < 0; }); if (!g.length) g = liveGames(); if (g.length !== S.cfg.games.length) act({ a: 'cfg', cfg: { games: g } }); }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
  window.addEventListener('appinstalled', function () { installEvt = null; toast('انزلت عالشاشة الرئيسية ✔'); });

  /* ---------- الثيم ---------- */
  var theme = LS.get('lb_theme', null);
  function applyTheme() { if (theme) document.documentElement.setAttribute('data-theme', theme); else document.documentElement.removeAttribute('data-theme'); }
  applyTheme();
  /* ---------- التصاميم التلاتة (للاختيار) ---------- */
  var skin = 'wheel';
  function applySkin() { document.documentElement.setAttribute('data-skin', skin); }
  function isDark() { var t = document.documentElement.getAttribute('data-theme'); if (t) return t === 'dark'; return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches; }

  function toast(msg, ms) {
    $toast.textContent = msg; $toast.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { $toast.hidden = true; }, ms || 2400);
  }

  /* ---------- الاتصال بالسيرفر ---------- */
  function WSNet(onMsg, onOpen, onClose) {
    var ws = null, q = [], open = false, tries = 0, closed = false;
    function connect() {
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); }
      catch (e) { onClose(true); return; }
      ws.onopen = function () { open = true; tries = 0; onOpen(); var m = q.splice(0); m.forEach(function (x) { ws.send(x); }); };
      ws.onmessage = function (e) { var m; try { m = JSON.parse(e.data); } catch (x) { return; } onMsg(m); };
      ws.onclose = function () { open = false; onClose(false); if (!closed) setTimeout(connect, Math.min(5000, 400 * Math.pow(1.7, tries++))); };
      ws.onerror = function () { };
    }
    connect();
    return {
      send: function (o) { var s = JSON.stringify(o); if (open) { try { ws.send(s); } catch (e) { q.push(s); } } else if (o.t !== 'state' && o.t !== 'photos') q.push(s); },
      close: function () { closed = true; try { ws.close(); } catch (e) { } }
    };
  }

  function startNet() {
    if (net || demo) return;
    net = WSNet(onMsg, function () {
      V.connected = true; syncClock();
      if (room && room.code) net.send({ t: 'hello', code: room.code, pid: ME, key: room.key || null });
      render();
    }, function () { V.connected = false; render(); });
  }

  function send(o) { if (net) net.send(o); }
  var OFF = { off: 0, rtt: 1e9 };
  function T() { return Date.now() + OFF.off; }
  function syncClock() { for (var i = 0; i < 5; i++) setTimeout(function () { send({ t: 'ping', c: Date.now() }); }, i * 250); }
  setInterval(function () { if (net && V.connected) send({ t: 'ping', c: Date.now() }); }, 20000);

  function act(a) {
    if (role === 'host' && engine) engine.act(ME, a);
    else if (demo && engine) engine.act(ME, a);
    else send({ t: 'act', a: a });
  }

  function hooksFor() {
    return {
      state: function (s) {
        S = s;
        send({ t: 'state', s: s }); LS.set('lb_hs_' + s.code, s);
        render();
      },
      photos: function (p) { PH = p; if (!demo) send({ t: 'photos', p: p }); render(); },
      stat: function (ev, d) { if (!demo) send({ t: 'stat', ev: ev, d: d }); },
      kick: function (pid) { if (!demo) send({ t: 'kick', pid: pid }); },
      transfer: function (pid) { if (!demo) send({ t: 'transfer', pid: pid }); }
    };
  }
  var GDUR = {}; Object.keys(GM).forEach(function (k) { GDUR[k] = { dur: GM[k].dur }; });

  function becomeHost(state, photos, online) {
    role = 'host';
    if (!state && room) state = LS.get('lb_hs_' + room.code, null);
    if (!V.pendingProfile) V.pendingProfile = LS.get('lb_prof', null);
    engine = state ? new ENG({ state: state, photos: photos || {}, hooks: hooksFor(), games: GDUR, now: T })
      : new ENG({ code: room.code, hostId: ME, hooks: hooksFor(), games: GDUR, now: T });
    engine.s.hostId = ME;
    if (online) Object.keys(engine.s.players).forEach(function (id) { engine.s.players[id].on = online.indexOf(id) >= 0 || id === ME; });
    PH = engine.photos;
    if (!engine.s.players[ME] && V.pendingProfile) engine.act(ME, { a: 'join', profile: V.pendingProfile });
    engine.emit(true);
  }

  function onMsg(m) {
    switch (m.t) {
      case 'pong': {
        var now = Date.now(), rtt = now - m.c;
        if (rtt >= 0 && (rtt <= OFF.rtt * 1.5 || OFF.rtt > 5000)) { if (rtt < OFF.rtt) OFF.rtt = rtt; OFF.off = m.s + rtt / 2 - now; }
        break;
      }
      case 'created':
        room = { code: m.code, key: m.key }; LS.set('lb_room', room);
        role = 'host';
        engine = new ENG({ code: m.code, hostId: ME, hooks: hooksFor(), games: GDUR, now: T });
        engine.act(ME, { a: 'join', profile: V.pendingProfile });
        V.screen = 'room';
        try { history.replaceState(null, '', location.pathname + '?r=' + m.code); } catch (e) { }
        render();
        break;
      case 'welcome':
        V.hostAway = !m.hostOn && m.role !== 'host'; V.hostGone = false;
        if (m.role === 'host') {
          if (!engine) becomeHost(m.state, m.photos, m.online);
          else { engine.s.hostId = ME; engine.emit(true); }
          V.screen = 'room';
        } else {
          role = 'player'; engine = null;
          if (room && room.key) { room.key = null; LS.set('lb_room', room); }
          S = m.state; PH = m.photos || {};
          if (S && S.players[ME] && !S.players[ME].gone) { V.screen = 'room'; }
          else if (V.pendingProfile) { act({ a: 'join', profile: V.pendingProfile }); V.screen = 'room'; }
          else { V.formKind = 'join'; V.form.code = room.code; V.screen = 'form'; }
        }
        render();
        break;
      case 'state': if (role !== 'host') { S = m.s; render(); } break;
      case 'photos': if (role !== 'host') { PH = m.p || {}; render(); } break;
      case 'act': if (role === 'host' && engine) engine.act(m.pid, m.a); break;
      case 'presence': if (role === 'host' && engine) engine.presence(m.pid, m.on); break;
      case 'kicked':
        V.kicked = true; LS.del('lb_room'); room = null; closeGame(); render(); break;
      case 'becomeHost':
        room.key = m.key; LS.set('lb_room', room);
        V.hostAway = false; V.hostGone = false;
        becomeHost(m.state, m.photos, m.online);
        toast('صرت الريس 🎩');
        break;
      case 'demoted':
        role = 'player'; engine = null; room.key = null; LS.set('lb_room', room);
        toast('سلّمت الريسة 👋'); render(); break;
      case 'hostAway': V.hostAway = true; render(); break;
      case 'hostGone': V.hostGone = true; render(); break;
      case 'hostBack': V.hostAway = false; V.hostGone = false; render(); break;
      case 'nope':
        V.nopeTries = (V.nopeTries || 0) + 1;
        if (V.nopeTries <= 5 && S) { setTimeout(function () { if (room) send({ t: 'hello', code: room.code, pid: ME, key: room.key || null }); }, 3000); break; }
        V.nopeTries = 0;
        toast('ما في قعدة بهالكود 🤔'); LS.del('lb_room'); room = null; role = 'none';
        V.formKind = 'join'; V.screen = 'form'; render(); break;
      case 'noHost': toast('الريس مو موصول هلّق، استنى شوي'); break;
    }
  }

  /* ---------- دقات الريس ---------- */
  setInterval(function () {
    if (!engine || (role !== 'host' && !demo)) return;
    engine.tick();
    var s = engine.s;
    if (s.phase === 'pick' && s.cur && s.cur.spin && Date.now() > s.cur.spin.at + s.cur.spin.dur + 900) engine.act(ME, { a: 'spinDone' });
    if (s.phase === 'play') renderDeadline();
  }, 400);
  setInterval(function () { if (S && S.phase === 'play') renderDeadline(); }, 1000);

  /* ---------- مساعدات العرض ---------- */
  function P(id) { return S && S.players[id]; }
  function isHost() { return S && S.hostId === ME && (role === 'host' || demo); }
  function fem(id) { var p = P(id); return p && p.g === 'f'; }
  function t2(id, m, f) { return fem(id) ? f : m; }
  function avatar(id, cls) {
    var p = P(id) || {}, ph = PH[id];
    var st = '--c:' + (p.color || '#FFC21A') + ';' + (ph ? 'background-image:url(' + ph + ')' : '');
    var crown = '';
    if (S && S.cfg.mode === 'teams' && p.team) { var t = teamById(p.team); if (t && t.captain === id) crown = '<span class="crown">👑</span>'; }
    if (S && S.hostId === id && !crown) crown = '<span class="crown">🎩</span>';
    return '<span class="avatar ' + (cls || '') + '" style="' + st + '">' + (ph ? '' : esc((p.name || '؟').charAt(0))) + crown + '</span>';
  }
  function teamById(tid) { if (!S) return null; for (var i = 0; i < S.teams.length; i++) if (S.teams[i].id === tid) return S.teams[i]; return null; }
  function teamMembers(tid) { return activeIds().filter(function (id) { return S.players[id].team === tid; }); }
  function activeIds() { return S.joinOrder.filter(function (id) { return S.players[id] && !S.players[id].gone; }); }
  function entName(id) { if (S.cfg.mode === 'solo') return P(id) ? P(id).name : '؟'; var t = teamById(id); return t ? t.emoji + ' ' + t.name : '؟'; }
  function entColor(id) { if (S.cfg.mode === 'solo') return P(id) ? P(id).color : '#ccc'; var t = teamById(id); return t ? t.color : '#ccc'; }
  function entAvatar(id) {
    if (S.cfg.mode === 'solo') return avatar(id);
    var t = teamById(id); return '<span class="avatar" style="--c:' + (t ? t.color : '#ccc') + '">' + (t ? t.emoji : '') + '</span>';
  }
  function qType() { return S.meta.type === 'غير شي' ? (S.meta.typeCustom || 'قعدة') : S.meta.type; }
  function nb(n, plus) { return '<bdi dir="ltr">' + (plus && n > 0 ? '+' : '') + n + '</bdi>'; }
  function hashN(s, n) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % n; }

  var TITLES = {
    m: ['المعلّم', 'نائب المعلّم', 'صاحب البرونزية 🥉'],
    f: ['المعلّمة', 'نائبة المعلّمة', 'صاحبة البرونزية 🥉'],
    t: ['الفريق المعلّم', 'نائب المعلّم', 'فريق البرونزية 🥉']
  };
  var NOTITLE = {
    m: ['حظ أوفر المرة الجاية 🍀', 'شدّ حيلك، السهرة الجاية إلك 💪', 'حمّي إيدك للقعدة الجاية 🔥', 'اليوم إحماء، الجاي بطولة 😎', 'الميدالية ناطرتك المرة الجاية 🏅'],
    f: ['حظ أوفر المرة الجاية 🍀', 'شدّي حيلك، السهرة الجاية إلك 💪', 'حمّي إيدك للقعدة الجاية 🔥', 'اليوم إحماء، الجاي بطولة 😎', 'الميدالية ناطرتك المرة الجاية 🏅'],
    t: ['حظ أوفر يا شباب 🍀', 'شدّوا حيلكن، الجاية إلكن 💪', 'اليوم إحماء، الجاي بطولة 😎', 'الميدالية ناطرتكن المرة الجاية 🏅']
  };
  function titleOf(rank, key) {
    if (!rank || rank > 3) return null;
    if (S.cfg.titles === 'one' && rank !== 1) return null;
    return TITLES[key][rank - 1];
  }
  function phraseOf(id, key) { var l = NOTITLE[key]; return l[hashN(id + (S.code || ''), l.length)]; }
  function entTitle(row) {
    var key = S.cfg.mode === 'solo' ? (fem(row.id) ? 'f' : 'm') : 't';
    return titleOf(row.rank, key) || phraseOf(row.id, key);
  }
  function ordinal(n) { return ['', 'الأول', 'التاني', 'التالت', 'الرابع'][n] || ('رقم ' + n); }

  /* ---------- العرض الرئيسي ---------- */
  function header() {
    var code = (room && room.code && V.screen === 'room' && !demo) ? '<span class="code-chip num">' + esc(room.code) + '</span>' : (demo && V.screen === 'room' ? '<span class="code-chip">تجربة</span>' : '');
    return '<div class="topline" aria-hidden="true"></div><div class="topbar">' +
      '<div class="brand"><b>لعّيبة</b>' + code + '</div>' +
      '<div class="btn-row" style="flex:0 0 auto;gap:8px">' + (V.screen === 'room' && S && isHost() && S.phase !== 'setup' ? '<button class="icon-btn" data-a="players" aria-label="اللاعبين">👥</button>' : '') + '<button class="icon-btn" data-a="theme" aria-label="الوضع الفاتح والداكن">◐</button><button class="icon-btn" data-a="help" aria-label="كيف منلعب؟">؟</button></div></div>';
  }

  function keepFocus(fn) {
    var a = document.activeElement, id = a && a.id, val, s1, s2;
    if (id && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) { val = a.value; try { s1 = a.selectionStart; s2 = a.selectionEnd; } catch (e) { } }
    fn();
    if (id) {
      var n = document.getElementById(id);
      if (n && val != null) { n.value = val; n.focus(); try { n.setSelectionRange(s1, s2); } catch (e) { } }
    }
  }

  function render() {
    keepFocus(function () {
      var html = header() + '<main class="wrap">';
      if (V.kicked) html += kickedView();
      else if (V.screen === 'cover') html += coverView();
      else if (V.screen === 'form') html += formView();
      else if (!S) html += '<div class="card center"><h2 class="dots-anim">عم نوصل</h2><p class="muted">لحظة وبتفتح القعدة</p></div>';
      else html += banners() + roomView();
      html += '</main>';
      if (V.screen !== 'cover') html += '<div class="sig">إعداد م. إياد حلوبي</div>';
      $app.innerHTML = html;
    });
    after();
  }

  function banners() {
    var h = '';
    if (!demo && role !== 'host' && !V.connected) h += '<div class="banner">النت مقطوع، عم نرجع نوصل<span class="dots-anim"></span></div>';
    if (role !== 'host' && !demo && V.hostGone) h += '<div class="banner"><span>الريس طلع من القعدة 🚪</span><button class="btn sm ghost" data-a="claimHost">خليني أنا الريس 🎩</button></div>';
    else if (role !== 'host' && !demo && V.hostAway) h += '<div class="banner">الريس انقطع، رح نستناه شوي<span class="dots-anim"></span></div>';
    return h;
  }

  function kickedView() {
    return '<div class="card center"><div style="font-size:64px">🚪</div><h2>الريس طلّعك من القعدة</h2><p class="muted">بتقدر تفتح قعدة جديدة أو تجرّب لحالك.</p><button class="btn" data-a="home">عالبداية</button></div>';
  }

  function coverView() {
    var noServer = V.server === false;
    return '<section class="cover-hero">' +
      '<div class="hero">' + Art.hero(skin) + '</div>' +
      '<div class="logo"><span class="l1">صار بدها</span><span class="l2">قعدة لعّيبة</span></div>' +
      '</section>' +
      '<div class="card">' +
      '<button class="btn red wide" data-a="toForm" data-k="host">🎪 افتح قعدة وصير الريس</button>' +
      '<button class="btn blue wide" data-a="toForm" data-k="join">🎟️ فوت بكود</button>' +
      (noServer ? '<p class="muted center" style="margin:0;font-size:14px">السيرفر مو واصل هلّق. تأكد من النت وجرّب كمان شوي.</p>' : '') +
      '</div>' + (standalone() ? '' : '<button class="btn sm ghost" data-a="install" style="align-self:center">📲 نزّلها كتطبيق عموبايلك</button>') + '<p class="sig">إعداد م. إياد حلوبي</p>';
  }

  function formView() {
    var f = V.form, k = V.formKind;
    var title = k === 'join' ? 'فوت عالقعدة 🎟️' : 'قبل ما تفتح القعدة 🎪';
    var ph = f.photo ? 'background-image:url(' + f.photo + ')' : '';
    return '<div class="card">' +
      '<div class="sheet-h"><h2 class="h-sec">' + title + '</h2><button class="icon-btn" data-a="home" aria-label="رجوع">→</button></div>' +
      (k === 'join' ? '<div class="field"><label class="label" for="f-code">كود القعدة</label><input class="input code" id="f-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE" value="' + esc(f.code || '') + '"></div>' : '') +
      '<div class="field"><span class="label">صورتك (اختياري)</span><div class="photo-pick"><span class="avatar lg" style="--c:#FFC21A;' + ph + '">' + (f.photo ? '' : '🙂') + '</span>' +
      '<div class="btn-col"><button class="btn sm ghost" data-a="pickPhoto" data-for="form">🖼️ من الصور</button><button class="btn sm ghost" data-a="selfie" data-for="form">🤳 التقط سيلفي</button>' +
      (f.photo ? '<button class="btn sm ghost" data-a="rmPhoto">🗑️ شيل الصورة</button>' : '') + '</div></div></div>' +
      '<div class="field"><label class="label" for="f-name">اسمك (اختياري)</label><input class="input" id="f-name" maxlength="20" autocomplete="off" placeholder="شو بينادوك بالقعدة؟" value="' + esc(f.name) + '"></div>' +
      '<div class="field"><span class="label">شب ولا صبية؟ (لازم)</span><div class="chips"><button class="chip big ' + (f.g === 'm' ? 'on' : '') + '" data-a="g" data-v="m">🧔 شب</button><button class="chip big ' + (f.g === 'f' ? 'on' : '') + '" data-a="g" data-v="f">👩 صبية</button></div></div>' +
      (V.formErr ? '<div class="err">' + esc(V.formErr) + '</div>' : '') +
      '<button class="btn red wide" data-a="submitForm">' + (k === 'join' ? 'فوت 🚪' : 'افتح القعدة 🎪') + '</button></div>';
  }

  function roomView() {
    var me = P(ME);
    if (!me && S.phase !== 'setup') return '<div class="card center"><h2 class="dots-anim">عم نفوّتك</h2></div>';
    switch (S.phase) {
      case 'setup': return isHost() ? setupView() : waitView('الريس عم يجهّز القعدة', '🎪');
      case 'lobby': return lobbyView();
      case 'pick': return pickView();
      case 'intro': return introView();
      case 'play': return playView();
      case 'done': return doneView();
      case 'result': return resultView();
      case 'revealChoice': return revealChoiceView();
      case 'reveal': return revealView();
      case 'final': return finalView();
    }
    return '';
  }
  function waitView(msg, em) {
    return '<div class="card center"><div style="font-size:60px">' + (em || '⏳') + '</div><h2 class="dots-anim">' + esc(msg) + '</h2>' +
      '<button class="btn sm ghost" data-a="editMe">✏️ عدّل اسمي وصورتي</button></div>';
  }

  /* ---------- الإعدادات ---------- */
  function chip(a, v, on, label, extra) { return '<button class="chip ' + (on ? 'on' : '') + '" data-a="' + a + '" data-v="' + v + '"' + (extra || '') + '>' + label + '</button>'; }
  function setupView() {
    var c = S.cfg, m = S.meta;
    var types = ['شلة', 'رفقة', 'عيلة', 'شغل', 'غير شي'];
    var gl = MiniGames.ids.map(function (id) {
      if (OFFG.indexOf(id) >= 0) return '<span class="chip locked" title="قريباً">🔒 ' + GM[id].name + ' <small>قريباً</small></span>';
      var on = c.games.indexOf(id) >= 0; return '<button class="chip ' + (on ? 'on' : '') + '" data-a="cfgGame" data-v="' + id + '">' + GM[id].emoji + ' ' + GM[id].name + '</button>';
    }).join('');
    return '<div class="card"><h2 class="h-sec">جهّز القعدة 🎪</h2>' +
      '<div class="field"><label class="label" for="q-name">اسم القعدة (لازم)</label><input class="input" id="q-name" maxlength="30" placeholder="مثلاً: سهرة الخميس" value="' + esc(m.name) + '"></div>' +
      '<div class="field"><span class="label">نوع القعدة</span><div class="chips">' + types.map(function (t) { return chip('metaType', t, m.type === t, t); }).join('') + '</div>' +
      (m.type === 'غير شي' ? '<input class="input" id="q-type" maxlength="20" placeholder="اكتبوها انتو" value="' + esc(m.typeCustom) + '">' : '') + '</div>' +
      (V.setupErr ? '<div class="err">' + esc(V.setupErr) + '</div>' : '') + '</div>' +
      '<div class="card"><span class="label">طريقة اللعب</span><div class="chips">' + chip('cfg', 'mode:solo', c.mode === 'solo', '🙋 كل واحد لحالو') + chip('cfg', 'mode:teams', c.mode === 'teams', '👥 فرق') + '</div>' +
      (c.mode === 'teams' ? '<span class="label">كم فريق؟</span><div class="chips">' + [2, 3, 4].map(function (n) { return chip('cfg', 'teamCount:' + n, c.teamCount === n, n + ' فرق'); }).join('') + '</div>' +
        '<span class="label">مين بيلعب من الفريق؟</span><div class="chips">' + chip('cfg', 'teamStyle:all', c.teamStyle === 'all', '🫂 الفريق كله بكل جولة') + chip('cfg', 'teamStyle:rotate', c.teamStyle === 'rotate', '🔄 واحد من كل فريق بالدور') + '</div>' +
        '<p class="muted" style="margin:0;font-size:14px">' + (c.teamStyle === 'all' ? 'كل الأعضاء بيلعبوا وبينحسب معدّل الفريق.' : 'كل جولة بيلعب عضو من كل فريق، وبيتبدّلوا بالدور.') + ' قائد كل فريق 👑 هو اللي بيراهن.</p>' : '') +
      '</div>' +
      '<div class="card"><span class="label">الألعاب (' + c.games.length + ' من ' + liveGames().length + ')</span><div class="chips">' + gl + '</div>' +
      '<span class="label">كم جولة؟</span><div class="stepper"><button class="btn sm ghost" data-a="rounds" data-v="-1" aria-label="أقل">−</button><span class="val num">' + c.rounds + '</span><button class="btn sm ghost" data-a="rounds" data-v="1" aria-label="أكتر">+</button></div>' +
      '<p class="muted" style="margin:0;font-size:14px">' + roundsNote(c) + '</p>' +
      '<span class="label">الألقاب بالآخر</span><div class="chips">' + chip('cfg', 'titles:one', c.titles === 'one', '🏆 لقب واحد للفايز') + chip('cfg', 'titles:three', c.titles === 'three', '🥇🥈🥉 تلات مراتب') + '</div></div>' +
      '<button class="btn red wide" data-a="openLobby">افتح الباب 🚪</button>';
  }

  function roundsNote(c) {
    var n = c.games.length, r = c.rounds;
    if (r < n) return 'كل جولة لعبة مختلفة، ورح تنلعب ' + r + ' من الـ' + n + ' لعبة اللي نقّيتها.';
    if (r === n) return 'كل جولة لعبة، وكل لعبة رح تنلعب مرة وحدة.';
    var extra = r - n;
    return 'كل جولة لعبة. بعد ما يخلصوا الـ' + n + ' ألعاب بتبلّش دورة جديدة، فرح ' + (extra === 1 ? 'تنعاد لعبة وحدة' : (extra <= 10 ? 'ينعادوا ' + extra + ' ألعاب' : 'ينعادوا ' + extra + ' لعبة')) + '.';
  }

  /* ---------- اللوبي ---------- */
  function shareLink() { return location.origin + location.pathname + '?r=' + (room ? room.code : ''); }
  function lobbyView() {
    var host = isHost(), ids = activeIds(), h = '';
    if (!demo) {
      h += '<div class="ticket"><div class="qr" id="qr"></div><div class="tk-side"><span class="label" style="color:var(--onc)">كود القعدة</span><div class="big-code num">' + esc(S.code) + '</div>' +
        '<button class="btn sm ghost" data-a="copyLink">🔗 انسخ الرابط</button></div></div>';
    }
    h += '<div class="card"><div class="sheet-h"><h2 class="h-sec">' + esc(S.meta.name) + ' <span class="muted" style="font-size:15px">· ' + esc(qType()) + '</span></h2><span class="code-chip num">' + ids.length + ' 👤</span></div>';
    if (S.cfg.mode === 'teams') {
      h += '<div class="teams">' + S.teams.map(function (t) {
        var mem = teamMembers(t.id), mine = P(ME) && P(ME).team === t.id;
        return '<div class="team" style="--tc:' + t.color + '"><div class="team-h">' + (host ? '<button data-a="renameTeam" data-v="' + t.id + '">' + t.emoji + ' ' + esc(t.name) + ' ✏️</button>' : '<span>' + t.emoji + ' ' + esc(t.name) + '</span>') + '<span class="num">' + mem.length + '</span></div>' +
          '<div class="team-b">' + mem.map(plTile).join('') + '</div>' + (mine ? '' : '<button class="btn sm ghost" data-a="joinTeam" data-v="' + t.id + '">انضم هون</button>') + '</div>';
      }).join('') + '</div>';
      var un = ids.filter(function (id) { return !S.players[id].team; });
      if (un.length) h += '<span class="label">لسّا ما اختاروا فريق</span><div class="plist">' + un.map(plTile).join('') + '</div>';
    } else {
      h += '<div class="plist">' + ids.map(plTile).join('') + '</div>';
    }
    h += '<p class="muted" style="margin:0;font-size:13px">' + (host ? 'اكبس على أي حدا لتعدّل اسمو أو تطلّعو' + (S.cfg.mode === 'teams' ? ' أو تخليه قائد 👑' : '') + '.' : 'اكبس على صورتك لتعدّل اسمك.') + '</p></div>';
    var summary = (S.cfg.mode === 'solo' ? '🙋 فردي' : '👥 ' + S.teams.length + ' فرق · ' + (S.cfg.teamStyle === 'all' ? 'الفريق كله' : 'بالدور')) +  ' · 🎡 عجلة الحظ' + ' · ' + S.cfg.rounds + ' جولة';
    h += '<p class="center muted" style="margin:0;font-weight:800">' + summary + '</p>';
    if (host) {
      h += '<div class="btn-row"><button class="btn ghost" data-a="backSetup">⚙️ الإعدادات</button>' + (S.cfg.mode === 'teams' ? '<button class="btn pink" data-a="shuffle">🎲 فرز عشوائي</button>' : '') + '</div>' +
        '<button class="btn red wide" data-a="start" ' + (ids.length < 2 ? 'disabled' : '') + '>يلا نبلّش ▶</button>' +
        (ids.length < 2 ? '<p class="center muted" style="margin:0">لازم لاعبين اتنين عالأقل</p>' : '');
    } else h += '<div class="card center"><b class="dots-anim">بانتظار الريس يبلّش</b></div>';
    return h;
  }
  function plTile(id) {
    var p = P(id);
    return '<button class="pl ' + (p.on ? '' : 'off') + '" data-a="player" data-v="' + id + '">' + avatar(id) + '<span class="nm">' + esc(p.name) + (id === ME ? ' (أنا)' : '') + '</span>' + (p.bot ? '<span class="tag">وهمي</span>' : '') + '</button>';
  }

  /* ---------- اختيار اللعبة ---------- */
  function roundTag() { return '<span class="round-tag num">الجولة ' + (S.cur ? S.cur.n : S.roundNo + 1) + ' من ' + S.cfg.rounds + '</span>'; }
  function pickView() {
    var sp = S.cur.spin;
    var h = '<div class="center">' + roundTag() + '</div>';
    if (S.cfg.order === 'wheel') {
      h += '<h2 class="center">عجلة الحظ عم تدور 🎡</h2><div class="wheel-box"><div class="wheel-pin"></div>' + wheelSVG(sp.list) + '</div>';
    } else {
      h += '<h2 class="center">شو اللعبة الجاية؟ 🎲</h2><div class="slot" id="slot">' + GM[sp.list[0]].emoji + ' ' + GM[sp.list[0]].name + '</div>';
    }
    if (isHost()) h += '<button class="btn ghost wide" data-a="pass">🔁 مرّر هاللعبة</button>';
    return h;
  }
  function wheelSVG(list) {
    var n = list.length, R = 150, cx = 160, cy = 160, h = '<svg viewBox="0 0 320 320" role="img" aria-label="عجلة الألعاب"><g class="wheel-rot" id="wrot">';
    var pal = ['#FF4B3E', '#FFF4D6', '#2F6BFF', '#FFC21A', '#22C17A', '#FF7EC0'];
    for (var i = 0; i < n; i++) {
      var a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      var x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      var col = n === 1 ? pal[3] : pal[i % pal.length];
      if (n % pal.length === 1 && i === n - 1) col = pal[2];
      h += n === 1 ? '<circle cx="160" cy="160" r="150" fill="' + col + '" stroke="#16211B" stroke-width="4"/>' :
        '<path d="M' + cx + ',' + cy + ' L' + x0.toFixed(1) + ',' + y0.toFixed(1) + ' A' + R + ',' + R + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' Z" fill="' + col + '" stroke="#16211B" stroke-width="3"/>';
      var am = (a0 + a1) / 2, tx = cx + R * 0.68 * Math.cos(am), ty = cy + R * 0.68 * Math.sin(am);
      h += '<text x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" font-size="' + (n > 9 ? 24 : 30) + '" text-anchor="middle" dominant-baseline="central">' + GM[list[i]].emoji + '</text>';
    }
    for (var b = 0; b < 16; b++) { var ab = b / 16 * Math.PI * 2; h += '<circle cx="' + (cx + 154 * Math.cos(ab)).toFixed(1) + '" cy="' + (cy + 154 * Math.sin(ab)).toFixed(1) + '" r="5" fill="' + (b % 2 ? '#FFC21A' : '#FFF4D6') + '" stroke="#16211B" stroke-width="2"/>'; }
    h += '</g><circle cx="160" cy="160" r="24" fill="#16211B"/><circle cx="160" cy="160" r="12" fill="#FFC21A"/></svg>';
    return h;
  }
  function animatePick() {
    if (!S || S.phase !== 'pick' || !S.cur || !S.cur.spin) return;
    var sp = S.cur.spin, n = sp.list.length;
    if (!V.spinSeen[sp.id]) V.spinSeen[sp.id] = performance.now();
    var t0 = V.spinSeen[sp.id], dur = sp.dur;
    if (S.cfg.order === 'wheel') {
      var g = document.getElementById('wrot'); if (!g) return;
      var seg = 360 / n, final = 360 * 5 + (360 - (sp.target * seg + seg / 2));
      var done = performance.now() - t0;
      var ease = function (x) { return 1 - Math.pow(1 - x, 4); };
      (function frame() {
        var gg = document.getElementById('wrot'); if (!gg) return;
        var x = Math.min(1, (performance.now() - t0) / dur);
        gg.setAttribute('transform', 'rotate(' + (final * ease(x)).toFixed(2) + ' 160 160)');
        if (x < 1) requestAnimationFrame(frame);
        else if (!V.spinBuzz || V.spinBuzz !== sp.id) { V.spinBuzz = sp.id; try { navigator.vibrate && navigator.vibrate(60); } catch (e) { } }
      })();
      void done;
    } else {
      (function tick() {
        var el = document.getElementById('slot'); if (!el) return;
        var x = (performance.now() - t0) / dur;
        if (x >= 1) { var gg = GM[sp.list[sp.target]]; el.textContent = gg.emoji + ' ' + gg.name; el.style.background = gg.color; el.style.color = 'var(--onc)'; return; }
        var i = Math.floor((performance.now() - t0) / (60 + x * 200)) % n;
        el.textContent = GM[sp.list[i]].emoji + ' ' + GM[sp.list[i]].name;
        setTimeout(tick, 50);
      })();
    }
  }

  /* ---------- قبل الجولة ---------- */
  function introView() {
    var c = S.cur, g = GM[c.game], host = isHost(), h = '';
    h += '<div class="center">' + roundTag() + '</div>';
    h += '<div class="game-card" style="--gc:' + g.color + '"><div class="ge">' + g.emoji + '</div><h2>' + g.name + '</h2><p>' + g.hint + '</p><span class="round-tag">⏱️ ' + (g.id === 'simon' ? 'لحد أول غلطة' : g.dur + ' ثانية') + '</span></div>';
    h += '<div class="card"><span class="label">مين بيلعب؟</span>' + whoPlays(c.playersIn) + '</div>';
    if (S.cfg.mode === 'teams') h += betBox();
    if (host) {
      var pending = c.bet && c.bet.status === 'pending';
      h += '<div class="btn-row"><button class="btn ghost" data-a="pass">🔁 مرّر</button><button class="btn red" data-a="play" ' + (pending ? 'disabled' : '') + '>يلا ابدؤوا ▶</button></div>';
      if (pending) h += '<p class="center muted" style="margin:0">عم نستنى الفرق توافق عالرهان...</p>';
      if (S.history.length) h += '<button class="btn sm ghost" data-a="endAsk">🏁 خلّصنا، عالنتيجة</button>';
    } else h += '<div class="card center"><b class="dots-anim">الريس رح يبلّش هلّق</b></div>';
    return h;
  }
  function whoPlays(ids) {
    if (S.cfg.mode === 'solo') return '<div class="who-plays">' + ids.map(function (id) { return '<span class="who">' + avatar(id, 'sm') + esc(P(id).name) + '</span>'; }).join('') + '</div>';
    return S.teams.map(function (t) {
      var mine = ids.filter(function (id) { return P(id) && P(id).team === t.id; });
      if (!mine.length) return '';
      return '<div class="wrow" style="border-color:' + t.color + ';flex-wrap:wrap"><span class="avatar sm" style="--c:' + t.color + '">' + t.emoji + '</span><span class="nm">' + esc(t.name) + '</span><span class="who-plays" style="justify-content:flex-start;flex-basis:100%">' +
        mine.map(function (id) { return '<span class="who">' + avatar(id, 'sm') + esc(P(id).name) + '</span>'; }).join('') + '</span></div>';
    }).join('');
  }
  function betBox() {
    var c = S.cur, b = c.bet, myT = P(ME) && P(ME).team, team = teamById(myT), isCap = team && team.captain === ME;
    var h = '<div class="bet-box ' + (b && b.status === 'on' ? 'bet-on' : '') + '">';
    if (!b) {
      h += '<b>🎲 رهان ×2</b><span style="font-size:14px">قائد أي فريق بيقدر يراهن عالجولة: إذا ربح بياخد 10 نقاط، وإذا خسر بينقصلو ' + Math.abs(ENG.BET_LOSS) + '. والفرق التانية لازم توافق.</span>';
      if (isCap) h += '<button class="btn pink" data-a="bet">نراهن عالجولة ×2 🎲</button>';
    } else if (b.status === 'pending') {
      var bt = teamById(b.team);
      h += '<b>' + bt.emoji + ' ' + esc(bt.name) + ' بدو يراهن عالجولة!</b>';
      h += '<span style="font-size:14px">وافق: ' + (b.yes.length ? b.yes.map(function (id) { return teamById(id).emoji; }).join(' ') : 'لسّا ما حدا') + '</span>';
      if (isCap && b.need.indexOf(myT) >= 0 && b.yes.indexOf(myT) < 0) h += '<div class="btn-row"><button class="btn mint" data-a="betAns" data-v="1">موافقين 🤝</button><button class="btn ghost" data-a="betAns" data-v="0">لا 🙅</button></div>';
      else if (b.team === myT) h += '<span class="dots-anim" style="font-weight:800">عم نستنى موافقة الفرق</span>';
    } else if (b.status === 'on') {
      var bt2 = teamById(b.team);
      h += '<b>🔥 الجولة مضاعفة! ' + bt2.emoji + ' ' + esc(bt2.name) + ' راهن</b><span style="font-size:14px">النقاط ×2، وإذا ما طلع أول بينقصلو ' + Math.abs(ENG.BET_LOSS) + '.</span>';
    } else {
      var nt = teamById(b.no);
      h += '<b>🙅 ' + (nt ? nt.emoji + ' ' + esc(nt.name) : 'فريق') + ' رفض الرهان</b><span style="font-size:14px">الجولة عادية.</span>';
    }
    return h + '</div>';
  }

  /* ---------- أثناء اللعب ---------- */
  function playView() {
    var c = S.cur, g = GM[c.game], amIn = c.playersIn.indexOf(ME) >= 0, mine = c.scores[ME], h = '';
    var key = c.started + ':' + ME;
    h += '<div class="center">' + roundTag() + '</div>';
    if (amIn && !mine && !V.withdrawn[key]) {
      h += '<div class="game-card" style="--gc:' + g.color + '"><div class="ge">' + g.emoji + '</div><h2>دورك! ' + g.name + '</h2><p>' + g.hint + '</p>' +
        '<button class="btn wide" style="background:var(--surface);color:var(--ink)" data-a="openGame">ارجع عاللعبة 🎮</button></div>';
    } else if (amIn && (mine || V.myScores[key])) {
      var lb = mine ? mine.label : V.myScores[key].label;
      h += '<div class="card center"><div style="font-size:48px">' + g.emoji + '</div><h2>نتيجتك: ' + esc(lb) + '</h2><p class="muted dots-anim" style="margin:0">عم نستنى الباقيين</p></div>';
    } else {
      h += '<div class="card center"><div style="font-size:48px">👀</div><h2>هالجولة مو دورك</h2><p class="muted" style="margin:0">' + g.emoji + ' ' + g.name + ' · شجّع فريقك!</p></div>';
    }
    if (c.bet && c.bet.status === 'on') h += '<div class="banner">🔥 الجولة مضاعفة!</div>';
    var started = !!c.startAt;
    var cnt = c.playersIn.filter(function (id) { return started ? c.scores[id] : c.ready[id]; }).length;
    h += '<div class="card"><div class="sheet-h"><span class="label">' + (started ? 'مين خلّص' : 'مين جاهز') + ' (' + cnt + ' من ' + c.playersIn.length + ')</span><span class="deadline num" id="dl"></span></div><div class="waitlist">' +
      c.playersIn.map(function (id) {
        var p = P(id); if (!p) return '';
        var st = started ? (c.scores[id] ? '✔️' : (p.on ? '<span class="dots-anim">🎮</span>' : '📵')) : (c.ready[id] ? '✋' : (p.on ? '<span class="dots-anim">⏳</span>' : '📵'));
        return '<div class="wrow' + (isHost() && id !== ME ? ' wbtn" data-a="player" data-v="' + id : '') + '">' + avatar(id, 'sm') + '<span class="nm">' + esc(p.name) + (p.on ? '' : ' <span class="muted" style="font-size:12px">مو موصول</span>') + '</span><span class="st">' + st + '</span></div>';
      }).join('') + '</div></div>';
    if (isHost()) {
      if (!started) h += '<button class="btn red wide" data-a="goNow">بلّشوا هلّق بلا ما نستنى ⚡</button>';
      h += '<div class="btn-row"><button class="btn ghost" data-a="replayAsk">🔁 عيد اللعبة</button><button class="btn ghost" data-a="closeAsk">⏹️ سكّر الجولة</button></div>';
    }
    return h;
  }
  function renderDeadline() {
    var el = document.getElementById('dl'); if (!el || !S || !S.cur) return;
    if (!S.cur.startAt) { el.textContent = ''; return; }
    var left = Math.round((S.cur.startAt - T()) / 1000);
    if (left > 0) { el.textContent = 'بتبلّش بعد ' + left + 'ث'; return; }
    if (!S.cur.deadline) return;
    el.textContent = 'بتتسكّر بعد ' + Math.max(0, Math.round((S.cur.deadline - T()) / 1000)) + 'ث';
  }
  function readyInfo() {
    var c = S.cur, n = c.playersIn.filter(function (id) { return c.ready[id]; }).length;
    var names = c.playersIn.filter(function (id) { return !c.ready[id] && P(id); }).map(function (id) { return esc(P(id).name); });
    return '<b>جاهزين ' + n + ' من ' + c.playersIn.length + '</b>' + (names.length && n ? '<span>عم نستنى: ' + names.join('، ') + '</span>' : '');
  }
  function syncGame() {
    if (!V.ctrl || !S || S.phase !== 'play' || !S.cur) return;
    if (S.cur.startAt) { V.ctrl.begin(S.cur.startAt, T); return; }
    V.ctrl.info(readyInfo(), isHost() ? '<button class="btn sm red" data-gt="goNow">بلّشوا هلّق ⚡</button>' : '');
  }
  function openGame() {
    if (!S || S.phase !== 'play') return;
    var key = S.cur.started + ':' + ME;
    if (S.cur.scores[ME] || V.myScores[key] || V.playingKey === key) return;
    V.withdrawn[key] = false;
    V.playingKey = key;
    $stage.hidden = false;
    document.body.style.overflow = 'hidden';
    V.ctrl = MiniGames.run(S.cur.game, $stage, function (score, label) {
      V.myScores[key] = { score: score, label: label };
      act({ a: 'score', score: score, label: label });
      setTimeout(closeGame, 1600);
    }, {
      seed: S.cur.seed,
      onReady: function () { act({ a: 'ready' }); },
      onHostTool: function (a) { if (a === 'goNow') act({ a: 'goNow' }); }
    });
    var x = document.createElement('button');
    x.className = 'icon-btn'; x.textContent = '✕'; x.setAttribute('aria-label', 'سكّر');
    x.style.cssText = 'position:fixed;bottom:calc(14px + env(safe-area-inset-bottom,0px));left:calc(14px + env(safe-area-inset-left,0px));z-index:45';
    x.onclick = function () {
      confirmSheet('بدك تطلع من اللعبة؟ بتقدر ترجع قبل ما تبلّش، وإذا بلّشت بتنحسبلك صفر.', 'اطلع', function () {
        var k = V.playingKey;
        if (S && S.cur && S.cur.startAt && T() >= S.cur.startAt) { V.myScores[k] = { score: -1e9, label: 'انسحب 🏳️' }; act({ a: 'score', score: -1e9, label: 'انسحب 🏳️' }); }
        else V.withdrawn[k] = true;
        closeGame();
      });
    };
    $stage.appendChild(x);
    syncGame();
  }
  function closeGame() {
    if (V.ctrl) { try { V.ctrl.stop(); } catch (e) { } V.ctrl = null; }
    $stage.hidden = true; $stage.innerHTML = ''; document.body.style.overflow = ''; V.playingKey = null;
    render();
  }

  /* ---------- بعد ما الكل خلّص ---------- */
  function doneView() {
    if (isHost()) {
      return '<div class="center">' + roundTag() + '</div><div class="card center"><div style="font-size:60px">🎉</div><h2>الكل خلّص!</h2><p class="muted" style="margin:0">بدك تكشف النتيجة هلّق، ولا تخبّيها لآخر القعدة؟</p>' +
        '<div class="btn-row" style="width:100%"><button class="btn red" data-a="reveal">اكشف النتيجة 👀</button><button class="btn ghost" data-a="hide">الجاي بلا كشف 🤫</button></div><button class="btn sm ghost" data-a="replayAsk">🔁 عيد اللعبة (النتيجة بتنلغى)</button></div>';
    }
    return '<div class="card center"><div style="font-size:60px">🤔</div><h2 class="dots-anim">الريس عم يقرر يكشف ولا يخبّي</h2></div>';
  }

  /* ---------- نتيجة الجولة ---------- */
  function resultView() {
    var rec = S.history[S.history.length - 1], g = GM[rec.game], h = '';
    h += '<div class="center"><span class="round-tag num">الجولة ' + rec.n + ' من ' + S.cfg.rounds + '</span></div>';
    h += '<div class="card" style="background:' + g.color + ';color:var(--onc)"><h2 class="center">' + g.emoji + ' نتيجة ' + g.name + '</h2></div>';
    if (rec.bet) { var bt = teamById(rec.bet), row = rec.rows.filter(function (r) { return r.id === rec.bet; })[0]; h += '<div class="banner">' + (row && row.betWon ? '🔥 ' + esc(bt.name) + ' ربح الرهان!' : '💸 ' + esc(bt.name) + ' خسر الرهان') + '</div>'; }
    h += resRows(rec);
    if (S.cfg.mode === 'teams') {
      h += '<details class="card"><summary class="label" style="cursor:pointer">نتائج اللاعبين</summary><div class="waitlist">' + rec.playerRows.map(function (r) { var p = P(r.id); if (!p) return ''; return '<div class="wrow">' + avatar(r.id, 'sm') + '<span class="nm">' + esc(p.name) + '</span><span class="muted" style="font-weight:800">' + esc(r.label) + '</span></div>'; }).join('') + '</div></details>';
    }
    h += boardView(false);
    if (isHost()) {
      if (S.roundNo >= S.cfg.rounds) h += '<button class="btn red wide" data-a="endNow">عالنتيجة النهائية 🏆</button><button class="btn ghost wide" data-a="more">+3 جولات كمان</button>';
      else h += '<button class="btn red wide" data-a="next">الجولة الجاية ▶</button>';
      h += '<div class="btn-row"><button class="btn sm ghost" data-a="replayAsk">🔁 عيد هاللعبة</button>' + (S.roundNo >= S.cfg.rounds ? '' : '<button class="btn sm ghost" data-a="endAsk">🏁 خلّصنا هون</button>') + '</div>';
    } else h += '<div class="card center"><b class="dots-anim">الريس رح يكمّل</b></div>';
    return h;
  }
  function resRows(rec) {
    return '<div class="res-list">' + rec.rows.map(function (r) {
      var cls = r.pts > 0 ? '' : r.pts < 0 ? 'neg' : 'zero';
      var sub = S.cfg.mode === 'teams' && r.players && S.cfg.teamStyle === 'rotate' ? (P(r.players[0]) ? P(r.players[0]).name + ' · ' : '') + r.label : r.label;
      return '<div class="res ' + (r.rank === 1 ? 'first' : '') + '"><span class="stamp num">' + (r.rank || '–') + '</span>' + entAvatar(r.id) +
        '<div style="min-width:0"><div class="nm">' + esc(entName(r.id)) + '</div><div class="sub">' + esc(sub) + '</div></div><span class="tix num ' + cls + '">' + nb(r.pts, true) + ' 🎟️</span></div>';
    }).join('') + '</div>';
  }
  function boardView(all) {
    var st = ENG.standings(S, all).rows, max = Math.max(1, st.reduce(function (a, r) { return Math.max(a, r.pts); }, 0));
    var hidden = S.history.filter(function (h) { return h.hidden; }).length;
    return '<div class="card"><span class="label">المجموع' + (hidden && !all ? ' (في ' + hidden + ' جولة مخبّاية 🤫)' : '') + '</span><div class="board">' + st.map(function (r) {
      return '<div class="brow"><span class="num">' + r.rank + '</span><div style="min-width:0"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(entName(r.id)) + '</div><div class="bar"><i style="--bc:' + entColor(r.id) + ';width:' + Math.max(0, r.pts / max * 100) + '%"></i></div></div><span class="num tix ' + (r.pts < 0 ? 'neg' : r.pts === 0 ? 'zero' : '') + '">' + nb(r.pts) + '</span></div>';
    }).join('') + '</div></div>';
  }

  /* ---------- الكشف النهائي ---------- */
  function revealChoiceView() {
    if (isHost()) {
      return '<div class="card center"><div style="font-size:60px">🏆</div><h2>خلصت الجولات!</h2><p class="muted" style="margin:0">كيف بدك تكشف النتيجة النهائية؟</p>' +
        '<button class="btn red wide" data-a="revealMode" data-v="party">🎉 حفلة كشف خطوة خطوة</button><button class="btn ghost wide" data-a="revealMode" data-v="all">⚡ دفعة وحدة</button></div>';
    }
    return '<div class="card center"><div style="font-size:60px">🥁</div><h2 class="dots-anim">الريس عم يحضّر الكشف</h2></div>';
  }
  function revealView() {
    var st = ENG.standings(S, true).rows, r = S.reveal, h = '<div class="reveal-stage">';
    if (V.revealSeen !== r.at) { V.revealSeen = r.at; V.revealAt = performance.now(); if (r.step > 0) setTimeout(render, 2150); }
    var counting = r.step > 0 && performance.now() - V.revealAt < 2100;
    if (r.step === 0) {
      h += '<div style="font-size:80px">🥁</div><h2>جاهزين للكشف؟</h2><p class="muted">' + (S.cfg.mode === 'solo' ? 'مين معلّم اللعب بالقعدة؟' : 'أي فريق هو الفريق اللعّيب؟') + '</p>';
    } else {
      var place = r.steps - r.step + 1, row = st[place - 1];
      if (counting) {
        var n = 3 - Math.floor((performance.now() - V.revealAt) / 700);
        h += '<span class="place">المركز ' + ordinal(place) + '</span><div class="reveal-count num">' + Math.max(1, n) + '</div>';
        setTimeout(render, 700 - ((performance.now() - V.revealAt) % 700));
      } else if (row) {
        h += '<span class="place">المركز ' + ordinal(place) + '</span>' + podiumCard(row, place === 1);
        if (place === 1 && V.confettiFor !== 'rev' + r.at) { V.confettiFor = 'rev' + r.at; confetti(); }
      }
    }
    h += '</div>';
    if (isHost() && !counting) {
      var lbl = r.step < r.steps ? 'اكشف المركز ' + ordinal(r.steps - r.step) + ' 🥁' : 'عالنتيجة الكاملة 🏆';
      h += '<button class="btn red wide" data-a="revealNext">' + lbl + '</button>';
    }
    return h;
  }
  function podiumCard(row, gold) {
    var name = entName(row.id), av = S.cfg.mode === 'solo' ? avatar(row.id, 'lg') : '<span class="avatar lg" style="--c:' + entColor(row.id) + '">' + teamById(row.id).emoji + '</span>';
    var t = entTitle(row);
    return '<div class="podium-card ' + (gold ? 'gold' : '') + '">' + av + '<div class="p-name">' + esc(name) + '</div><span class="p-title">' + esc(t) + '</span><span class="tix num">' + nb(row.pts) + ' 🎟️ · ' + row.wins + ' جولة ربحها</span></div>';
  }

  /* ---------- النتيجة النهائية ---------- */
  function finalView() {
    var st = ENG.standings(S, true).rows, top = st[0], h = '';
    if (V.confettiFor !== 'final' + S.code + S.history.length) { V.confettiFor = 'final' + S.code + S.history.length; setTimeout(confetti, 200); }
    h += '<div class="center"><span class="round-tag">' + esc(S.meta.name) + ' · ' + esc(qType()) + '</span></div>';
    if (top) h += '<div class="center"><span class="place">⭐ نجم السهرة</span></div>' + podiumCard(top, true);
    h += '<div class="tabs"><button class="chip ' + (V.tab === 'rank' ? 'on' : '') + '" data-a="tab" data-v="rank">🏆 الترتيب</button><button class="chip ' + (V.tab === 'rounds' ? 'on' : '') + '" data-a="tab" data-v="rounds">🎮 كل الجولات</button></div>';
    if (V.tab === 'rank') {
      h += '<div class="res-list">' + st.map(function (r) {
        var t = entTitle(r);
        return '<div class="res ' + (r.rank === 1 ? 'first' : '') + '"><span class="stamp num">' + r.rank + '</span>' + entAvatar(r.id) + '<div style="min-width:0"><div class="nm">' + esc(entName(r.id)) + '</div><div class="sub">' + esc(t) + ' · ' + r.wins + ' جولة</div></div><span class="tix num ' + (r.pts < 0 ? 'neg' : r.pts === 0 ? 'zero' : '') + '">' + nb(r.pts) + ' 🎟️</span></div>';
      }).join('') + '</div>';
      if (S.cfg.mode === 'teams') {
        h += '<div class="card"><span class="label">الفرق وأعضاؤها</span>' + S.teams.map(function (t) {
          var mem = teamMembers(t.id); if (!mem.length) return '';
          return '<div class="wrow" style="flex-wrap:wrap"><span class="avatar sm" style="--c:' + t.color + '">' + t.emoji + '</span><span class="nm">' + esc(t.name) + '</span><span class="who-plays" style="flex-basis:100%">' + mem.map(function (id) { return '<span class="who">' + avatar(id, 'sm') + esc(P(id).name) + '</span>'; }).join('') + '</span></div>';
        }).join('') + '</div>';
      }
    } else {
      h += S.history.map(function (rec) {
        var g = GM[rec.game], w = rec.rows.filter(function (r) { return r.rank === 1; }).map(function (r) { return entName(r.id); }).join(' و');
        return '<details class="card"><summary style="cursor:pointer;font-weight:800;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="round-tag num">' + rec.n + '</span>' + g.emoji + ' ' + g.name + (rec.hidden ? ' 🤫' : '') + (rec.bet ? ' 🎲' : '') + '<span class="muted" style="font-size:14px">🏆 ' + esc(w || '—') + '</span></summary>' + resRows(rec) + '</details>';
      }).join('');
    }
    h += storyCard();
    if (isHost()) h += hostFinalTools();
    h += installCard();
    if (isHost()) h += '<button class="btn mint wide" data-a="rematch">🔁 قعدة جديدة بنفس الناس</button>';
    return h;
  }
  function storyCard() {
    var s = V.story, host = isHost();
    return '<div class="card"><h2 class="h-sec">صورة الستوري 📸</h2><div class="story-prev"><img id="story-img" alt="صورة نتيجتك للستوري"></div>' +
      '<span class="label">الشكل</span><div class="chips">' + chip('storyLayout', 'cover', s.layout === 'cover', '📰 غلاف') + chip('storyLayout', 'polaroid', s.layout === 'polaroid', '🖼️ بولاريد') + chip('storyLayout', 'card', s.layout === 'card', '🎟️ كرت') + '</div>' +
      '<div class="chips">' + chip('storyDark', '0', !s.dark, '☀️ فاتح') + chip('storyDark', '1', s.dark, '🌙 داكن') + '</div>' +
      (host ? '<span class="label">شو بيطلع بالصورة (للكل)</span><div class="chips">' + chip('storyOpt', 'podium', S.story.podium, (S.story.podium ? '✔ ' : '') + 'المراكز التلاتة') + chip('storyOpt', 'group', S.story.group, (S.story.group ? '✔ ' : '') + 'صورة الشلة') + '</div>' : '') +
      '<div class="btn-row"><button class="btn red" data-a="dlStory">📥 نزّل الصورة</button><a class="btn blue" href="' + IG + '" target="_blank" rel="noopener">💌 شارك مع صحابك</a></div>' +
      '<p class="muted center" style="margin:0;font-size:13px">إذا ما نزلت، اضغط مطوّل عالصورة واحفظها.</p></div>';
  }
  function hostFinalTools() {
    var m = S.meta, types = ['شلة', 'رفقة', 'عيلة', 'شغل', 'غير شي'];
    return '<div class="card"><h2 class="h-sec">أدوات الريس 🎩</h2>' +
      '<div class="field"><label class="label" for="q-name2">اسم القعدة</label><input class="input" id="q-name2" maxlength="30" value="' + esc(m.name) + '"></div>' +
      '<div class="chips">' + types.map(function (t) { return chip('metaType', t, m.type === t, t); }).join('') + '</div>' +
      (m.type === 'غير شي' ? '<input class="input" id="q-type" maxlength="20" placeholder="اكتبوها انتو" value="' + esc(m.typeCustom) + '">' : '') +
      '<span class="label">صورة الشلة</span><div class="btn-row"><button class="btn sm ghost" data-a="pickPhoto" data-for="group">🖼️ من الصور</button><button class="btn sm ghost" data-a="selfie" data-for="group">🤳 سيلفي مع مؤقت</button>' + (S.groupPhoto ? '<button class="btn sm ghost" data-a="rmGroup">🗑️ شيلها</button>' : '') + '</div>' +
      (S.groupPhoto && PH.__group ? '<img src="' + PH.__group + '" alt="صورة الشلة" style="border:3px solid var(--line);border-radius:14px;width:100%;max-height:220px;object-fit:cover">' : '') + '</div>';
  }
  function standalone() { try { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; } catch (e) { return false; } }
  function installCard() {
    if (standalone()) return '';
    return '<div class="card install"><h2 class="h-sec">خلّي اللعبة عموبايلك 📲</h2><p style="margin:0;font-weight:700">بتصير أيقونة عالشاشة الرئيسية، وبتفتحها متل أي تطبيق بالقعدة الجاية.</p>' +
      '<button class="btn" data-a="install">📲 نزّلها كتطبيق</button></div>';
  }
  function installSheet() {
    var ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
    var inApp = /Instagram|FBAN|FBAV|Line\//i.test(ua);
    var steps = inApp ? [['🌐', 'افتحها بالمتصفح أول', 'انت فاتحها من جوّا إنستغرام. اكبس (⋯) فوق واختار «فتح في المتصفح»، وبعدين رجاع اكبس «نزّلها كتطبيق».']]
      : ios ? [['🧭', 'لازم تكون بـ Safari', 'إذا فاتحها بمتصفح تاني، انسخ الرابط وافتحه بـ Safari.'], ['⬆️', 'اكبس زر المشاركة', 'المربع اللي طالع منه سهم، تحت بنص الشاشة.'], ['➕', '«إضافة إلى الشاشة الرئيسية»', 'نزّل بالقائمة لتلاقيها، وبعدين اكبس «إضافة».']]
      : [['⋮', 'افتح قائمة المتصفح', 'التلات نقاط فوق بالزاوية بـ Chrome.'], ['📲', '«تثبيت التطبيق» أو «إضافة للشاشة الرئيسية»', 'وبعدين اكبس «تثبيت».']];
    openSheet(sheetHead('نزّلها كتطبيق 📲') + steps.map(function (x) { return '<div class="how-step"><span class="ic">' + x[0] + '</span><div><b>' + x[1] + '</b><span class="muted">' + x[2] + '</span></div></div>'; }).join('') + '<button class="btn" data-close>تمام 👍</button>', function (sh) {
      sh.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = closeSheet; });
    });
  }

  /* ---------- الستوري ---------- */
  var storyCache = { key: null, url: null, canvas: null };
  function storyData() {
    var st = ENG.standings(S, true), rows = st.rows, me = P(ME) || { name: '؟', color: '#FFC21A' };
    var mineId = S.cfg.mode === 'solo' ? ME : me.team;
    var mine = rows.filter(function (r) { return r.id === mineId; })[0] || { rank: null, pts: 0 };
    var team = null;
    if (S.cfg.mode === 'teams' && me.team) {
      var t = teamById(me.team);
      team = { name: t.name, color: t.color, emoji: t.emoji, members: teamMembers(t.id).map(function (id) { return { name: P(id).name, color: P(id).color, photo: PH[id] }; }) };
    }
    return {
      layout: V.story.layout, dark: V.story.dark,
      me: { name: me.name, color: me.color, photo: PH[ME] || null },
      qName: S.meta.name || 'قعدتنا', qType: qType(),
      rank: mine.rank, title: entTitle(mine.rank ? mine : { id: mineId, rank: null }), pts: mine.pts, wins: st.wins[ME] || 0,
      team: team, mineId: mineId,
      podium: rows.slice(0, 3).map(function (r) { return { id: r.id, name: entName(r.id), pts: r.pts, color: entColor(r.id) }; }),
      showPodium: S.story.podium, showGroup: S.story.group, groupPhoto: PH.__group || null,
      gamesCount: S.history.length
    };
  }
  function refreshStory() {
    var img = document.getElementById('story-img'); if (!img || !S || S.phase !== 'final') return;
    var d = storyData();
    var key = JSON.stringify([d.layout, d.dark, d.me.name, !!d.me.photo, d.rank, d.pts, d.showPodium, d.showGroup, !!d.groupPhoto, d.qName, d.qType, d.title, S.seq > 0 ? S.history.length : 0, d.team && d.team.members.length, Object.keys(PH).length]);
    if (storyCache.key === key && storyCache.url) { img.src = storyCache.url; return; }
    storyCache.key = key;
    Story.render(d).then(function (cv) {
      if (storyCache.key !== key) return;
      storyCache.canvas = cv;
      storyCache.url = cv.toDataURL('image/jpeg', 0.9);
      var im = document.getElementById('story-img'); if (im) im.src = storyCache.url;
    });
  }
  function downloadStory() {
    if (!storyCache.canvas) { toast('لحظة، عم نجهّز الصورة'); return; }
    try {
      storyCache.canvas.toBlob(function (b) {
        if (!b) return;
        var f = 'la3iba-' + (P(ME) ? P(ME).name : 'story') + '.png';
        try {
          var file = new File([b], f, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'قعدة لعّيبة' }).catch(function () { }); return; }
        } catch (e) { }
        var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      }, 'image/png');
    } catch (e) { toast('اضغط مطوّل عالصورة واحفظها'); }
  }

  /* ---------- بعد الرسم ---------- */
  function after() {
    if (S && isHost() && S.phase === 'setup' && S.cfg.games.some(function (id) { return OFFG.indexOf(id) >= 0; })) setTimeout(fixGames, 0);
    if (V.playingKey && (!S || S.phase !== 'play' || !S.cur || (S.cur.started + ':' + ME) !== V.playingKey)) {
      setTimeout(function () { if (V.playingKey) { var k = V.playingKey; closeGame(); if (!V.myScores[k]) toast('الريس وقّف الجولة ⏹️'); } }, 0);
    }
    var q = document.getElementById('qr');
    if (q && window.qrcode && !q.dataset.done) {
      q.dataset.done = '1';
      try { var qr = qrcode(0, 'M'); qr.addData(shareLink()); qr.make(); q.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) { }
    }
    if (S && S.phase === 'play' && S.cur && !V.kicked && V.screen === 'room') {
      var k2 = S.cur.started + ':' + ME;
      if (S.cur.playersIn.indexOf(ME) >= 0 && !S.cur.scores[ME] && !V.myScores[k2] && !V.withdrawn[k2] && !V.playingKey) setTimeout(openGame, 0);
      else syncGame();
    }
    animatePick();
    renderDeadline();
    refreshStory();
  }

  /* ---------- الأحداث ---------- */
  $app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    var a = b.dataset.a, v = b.dataset.v;
    if (H[a]) { e.preventDefault(); H[a](v, b); }
  });
  var metaT = null;
  function metaLater(o) { clearTimeout(metaT); metaT = setTimeout(function () { act(o); }, 450); }
  $app.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'f-name') V.form.name = t.value;
    if (t.id === 'f-code') { t.value = t.value.toUpperCase().replace(/[^A-Z]/g, ''); V.form.code = t.value; }
    if (t.id === 'q-name' || t.id === 'q-name2') { V.setupErr = ''; metaLater({ a: 'meta', name: t.value }); }
    if (t.id === 'q-type') metaLater({ a: 'meta', typeCustom: t.value });
  });

  var H = {
    theme: function () { theme = isDark() ? 'light' : 'dark'; LS.set('lb_theme', theme); applyTheme(); render(); },
    help: function () { helpSheet(); },
    home: function () { if (demo || V.kicked) { location.href = location.pathname; return; } V.screen = 'cover'; V.formErr = ''; render(); },
    toForm: function (v, b) {
      var k = b.dataset.k;
      if ((k === 'host' || k === 'join') && V.server === false) { toast('السيرفر مو واصل هلّق، جرّب كمان شوي'); return; }
      V.formKind = k; V.form = { name: '', g: '', photo: null, code: V.form.code || '' }; V.formErr = ''; V.screen = 'form'; render();
    },
    g: function (v) { V.form.g = v; V.formErr = ''; render(); },
    rmPhoto: function () { V.form.photo = null; render(); },
    pickPhoto: function (v, b) { pickPhoto(b.dataset.for); },
    selfie: function (v, b) { selfieSheet(b.dataset.for); },
    submitForm: function () {
      var f = V.form;
      var nm = document.getElementById('f-name'); if (nm) f.name = nm.value;
      if (!f.g) { V.formErr = 'اختار شب ولا صبية لنكمّل 🙏'; render(); return; }
      var prof = { name: f.name.trim(), g: f.g, photo: f.photo || null };
      V.pendingProfile = prof; LS.set('lb_prof', prof);
      if (V.formKind === 'host') { startNet(); send({ t: 'create', pid: ME }); V.screen = 'room'; S = null; render(); return; }
      var code = (f.code || '').toUpperCase();
      if (!/^[A-Z]{5}$/.test(code)) { V.formErr = 'الكود 5 أحرف إنكليزية'; render(); return; }
      room = { code: code, key: null }; LS.set('lb_room', room);
      startNet(); send({ t: 'hello', code: code, pid: ME, key: null });
      V.screen = 'room'; S = null; render();
    },
    claimHost: function () { send({ t: 'claimHost' }); },
    editMe: function () { playerSheet(ME); },
    metaType: function (v) { act({ a: 'meta', type: v }); },
    cfg: function (v) { var p = v.split(':'), o = {}; o[p[0]] = p[0] === 'teamCount' ? +p[1] : p[1]; act({ a: 'cfg', cfg: o }); },
    cfgGame: function (v) {
      if (OFFG.indexOf(v) >= 0) return;
      var gs = S.cfg.games.slice(), i = gs.indexOf(v);
      if (i >= 0) { if (gs.length <= 1) { toast('خلّي لعبة وحدة عالأقل'); return; } gs.splice(i, 1); } else gs.push(v);
      act({ a: 'cfg', cfg: { games: gs } });
    },
    rounds: function (v) { act({ a: 'cfg', cfg: { rounds: S.cfg.rounds + (+v) } }); },
    openLobby: function () {
      var n = document.getElementById('q-name'); if (n && n.value.trim() !== S.meta.name) act({ a: 'meta', name: n.value });
      var name = n ? n.value.trim() : S.meta.name;
      if (!name) { V.setupErr = 'اكتب اسم للقعدة قبل ما تفتح الباب'; render(); var nn = document.getElementById('q-name'); if (nn) nn.focus(); return; }
      fixGames();
      act({ a: 'openLobby' });
    },
    backSetup: function () { act({ a: 'backToSetup' }); },
    shuffle: function () { act({ a: 'shuffleTeams' }); },
    joinTeam: function (v) { act({ a: 'joinTeam', team: v }); },
    renameTeam: function (v) { var t = teamById(v); inputSheet('اسم الفريق', t.name, function (val) { act({ a: 'renameTeam', team: v, name: val }); }); },
    player: function (v) { playerSheet(v); },
    players: function () { playersSheet(); },
    copyLink: function () { copy(shareLink()); },
    start: function () { act({ a: 'start' }); },
    pass: function () { act({ a: 'pass' }); },
    play: function () { act({ a: 'play' }); },
    bet: function () { act({ a: 'bet' }); },
    betAns: function (v) { act({ a: 'betAns', yes: v === '1' }); },
    openGame: function () { openGame(); },
    goNow: function () { act({ a: 'goNow' }); },
    replayAsk: function () { confirmSheet('نعيد ' + GM[(S.cur || S.history[S.history.length - 1]).game].name + ' من أول؟ نتيجة هالجولة رح تنلغى.', 'عيدها 🔁', function () { act({ a: 'replay' }); }); },
    closeAsk: function () { confirmSheet('بدك تسكّر الجولة هلّق؟ اللي ما خلّص ما رح تنحسبلو نقاط.', 'سكّر الجولة', function () { act({ a: 'closeRound' }); }); },
    reveal: function () { act({ a: 'reveal' }); },
    hide: function () { act({ a: 'hide' }); },
    next: function () { act({ a: 'next' }); },
    more: function () { act({ a: 'more', n: 3 }); act({ a: 'next' }); },
    endNow: function () { act({ a: 'next' }); },
    endAsk: function () { confirmSheet('بدك تخلّصوا هون وتروحوا عالنتيجة النهائية؟', 'إيه، عالنتيجة', function () { act({ a: 'end' }); }); },
    revealMode: function (v) { act({ a: 'revealMode', mode: v }); },
    revealNext: function () { act({ a: 'revealNext' }); },
    tab: function (v) { V.tab = v; render(); },
    storyLayout: function (v) { V.story.layout = v; render(); },
    storyDark: function (v) { V.story.dark = v === '1'; render(); },
    storyOpt: function (v) { var o = { a: 'story' }; o[v] = !S.story[v]; act(o); },
    dlStory: function () { downloadStory(); },
    rmGroup: function () { act({ a: 'groupPhoto', photo: null }); },
    install: function () {
      if (installEvt) { var ev = installEvt; installEvt = null; try { ev.prompt(); ev.userChoice.then(function (r) { if (r && r.outcome === 'accepted') toast('انزلت عالشاشة الرئيسية ✔'); render(); }); } catch (e) { installSheet(); } return; }
      installSheet();
    },
    rematch: function () { confirmSheet('نبلّش قعدة جديدة بنفس الناس؟ النتيجة الحالية رح تنمسح.', 'يلا', function () { act({ a: 'rematch' }); }); }
  };

  function copy(text) {
    try { navigator.clipboard.writeText(text).then(function () { toast('انتسخ الرابط ✔'); }, function () { inputSheet('انسخ الرابط', text, null); }); }
    catch (e) { inputSheet('انسخ الرابط', text, null); }
  }

  /* ---------- النوافذ ---------- */
  function openSheet(html, onBind) {
    $modal.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    $modal.hidden = false;
    $modal.onclick = function (e) { if (e.target === $modal) closeSheet(); };
    var x = $modal.querySelector('[data-close]'); if (x) x.onclick = closeSheet;
    if (onBind) onBind($modal.querySelector('.sheet'));
  }
  function closeSheet() { if ($modal._cleanup) { $modal._cleanup(); $modal._cleanup = null; } $modal.hidden = true; $modal.innerHTML = ''; }
  function sheetHead(t) { return '<div class="sheet-h"><h3>' + t + '</h3><button class="icon-btn" data-close aria-label="سكّر">✕</button></div>'; }
  function confirmSheet(msg, ok, fn) {
    openSheet(sheetHead('متأكد؟') + '<p style="margin:0;font-weight:700">' + esc(msg) + '</p><div class="btn-row"><button class="btn red" id="cf-ok">' + esc(ok) + '</button><button class="btn ghost" id="cf-no">لا، رجعني</button></div>', function (s) {
      s.querySelector('#cf-ok').onclick = function () { closeSheet(); fn(); };
      s.querySelector('#cf-no').onclick = closeSheet;
    });
  }
  function inputSheet(title, val, fn) {
    openSheet(sheetHead(esc(title)) + '<input class="input" id="sh-in" maxlength="' + (fn ? 24 : 200) + '" value="' + esc(val) + '" ' + (fn ? '' : 'readonly') + '>' +
      (fn ? '<button class="btn red" id="sh-ok">حفظ ✔</button>' : '<p class="muted" style="margin:0">حدّد النص وانسخه.</p>'), function (s) {
        var i = s.querySelector('#sh-in'); setTimeout(function () { i.focus(); i.select(); }, 50);
        if (fn) { var ok = function () { var v = i.value.trim(); if (v) fn(v); closeSheet(); }; s.querySelector('#sh-ok').onclick = ok; i.onkeydown = function (e) { if (e.key === 'Enter') ok(); }; }
      });
  }
  function playerSheet(pid) {
    var p = P(pid); if (!p) return;
    var host = isHost(), self = pid === ME;
    var h = sheetHead(avatar(pid) + ' ' + esc(p.name));
    if (self || host) h += '<div class="field"><label class="label" for="ps-name">الاسم</label><input class="input" id="ps-name" maxlength="20" value="' + esc(p.name) + '"></div><button class="btn" id="ps-save">احفظ الاسم ✔</button>';
    if (self) h += '<div class="btn-row"><button class="btn sm ghost" id="ps-photo">🖼️ غيّر صورتي</button><button class="btn sm ghost" id="ps-selfie">🤳 سيلفي</button>' + (PH[ME] ? '<button class="btn sm ghost" id="ps-rm">🗑️ شيل الصورة</button>' : '') + '</div>';
    if (host && !self) {
      if (S.cfg.mode === 'teams' && p.team) h += '<button class="btn pink" id="ps-cap">👑 خليه قائد الفريق</button>';
      if (!p.bot) h += '<button class="btn blue" id="ps-host">🎩 سلّمه الريسة</button>';
      h += '<button class="btn red" id="ps-kick">🚪 طلّعه من القعدة</button>';
    }
    if (!self && !host) h += '<p class="muted" style="margin:0">' + (p.on ? 'موصول ✔' : 'مو موصول هلّق 📵') + '</p>';
    openSheet(h, function (s) {
      var sv = s.querySelector('#ps-save'); if (sv) sv.onclick = function () { var v = s.querySelector('#ps-name').value.trim(); if (v) act({ a: 'rename', pid: pid, name: v }); closeSheet(); };
      var ph = s.querySelector('#ps-photo'); if (ph) ph.onclick = function () { closeSheet(); pickPhoto('me'); };
      var sf = s.querySelector('#ps-selfie'); if (sf) sf.onclick = function () { closeSheet(); selfieSheet('me'); };
      var rm = s.querySelector('#ps-rm'); if (rm) rm.onclick = function () { act({ a: 'photo', photo: null }); closeSheet(); };
      var cp = s.querySelector('#ps-cap'); if (cp) cp.onclick = function () { act({ a: 'captain', pid: pid }); closeSheet(); };
      var hs = s.querySelector('#ps-host'); if (hs) hs.onclick = function () { closeSheet(); confirmSheet('بدك تسلّم الريسة لـ' + p.name + '؟ رح تصير لاعب عادي.', 'سلّمه', function () { act({ a: 'transfer', pid: pid }); }); };
      var kk = s.querySelector('#ps-kick'); if (kk) kk.onclick = function () { closeSheet(); confirmSheet('بدك تطلّع ' + p.name + '؟ ما رح يقدر يرجع.', 'طلّعه', function () { act({ a: 'kick', pid: pid }); }); };
    });
  }
  function playersSheet() {
    var ids = activeIds();
    var on = ids.filter(function (id) { return S.players[id].on; }).length;
    var h = sheetHead('اللاعبين 👥 (' + on + ' من ' + ids.length + ' موصولين)');
    h += '<div class="waitlist">' + ids.map(function (id) {
      var p = P(id), t = S.cfg.mode === 'teams' && p.team ? teamById(p.team) : null;
      return '<button class="wrow wbtn" data-pid="' + id + '">' + avatar(id, 'sm') + '<span class="nm">' + esc(p.name) + (id === ME ? ' (أنا)' : '') + (t ? ' <span class="muted" style="font-size:13px">' + t.emoji + '</span>' : '') + '</span>' +
        '<span class="st-tag ' + (p.on ? 'on' : 'off') + '">' + (p.on ? 'موصول' : '📵 مو موصول') + '</span></button>';
    }).join('') + '</div><p class="muted" style="margin:0;font-size:14px">اكبس على أي حدا لتعدّل اسمو أو تطلّعو من القعدة، حتى لو طلع لحالو.</p>';
    openSheet(h, function (sh) {
      sh.querySelectorAll('[data-pid]').forEach(function (b) { b.onclick = function () { var id = b.dataset.pid; closeSheet(); playerSheet(id); }; });
    });
  }
  function helpSheet() {
    var h = sheetHead('كيف منلعب؟ 🎪');
    var steps = [
      ['🎩', 'الريس بيفتح القعدة', 'بتطلعلو QR وكود من 5 أحرف، والباقي بيفوتوا من موبايلاتهن.'],
      ['👥', 'فردي أو فرق', 'بالفرق: يا الفريق كله بيلعب وبينحسب المعدّل، يا واحد من كل فريق بالدور.'],
      ['🎡', 'عجلة الحظ بتختار اللعبة', 'كل جولة بتدور العجلة، واللعبة اللي ما عجبتكن مرّروها.'],
      ['🎮', 'كلكن بتبلّشوا سوا', 'اللعبة بتنفتح عند الكل، كل واحد بيكبس «جاهز ✋»، وبعدين عدّ تنازلي واحد للكل. وكلكن بتاخدوا نفس التحدي بالجولة.'],
      ['🎟️', 'النقاط حسب الترتيب', 'الأول 5، التاني 3، التالت 1.'],
      ['🎲', 'الرهان', 'قائد الفريق بيراهن والفرق التانية لازم توافق: الجولة بتصير ×2، وإذا ما طلع أول بينقصلو ' + Math.abs(ENG.BET_LOSS) + '.'],
      ['🏆', 'بالآخر', 'حفلة كشف، لقب للفايز أو تلات مراتب، وصورة ستوري لكل واحد.']
    ];
    h += steps.map(function (s) { return '<div class="how-step"><span class="ic">' + s[0] + '</span><div><b>' + s[1] + '</b><span class="muted">' + s[2] + '</span></div></div>'; }).join('');
    h += '<div class="card"><b>أدوات الريس 🎩</b><span class="muted">يعدّل الإعدادات، يفرز الفرق، يمرّر لعبة، يبلّش بلا ما يستنى الكل، يعيد اللعبة إذا ما فهموها، يكشف النتيجة أو يخبّيها للآخر، يسكّر الجولة، يعدّل الأسماء، يطلّع حدا، ويسلّم الريسة. وإذا طلع، بعد 45 ثانية حدا تاني بيقدر يصير الريس.</span></div>';
    h += '<div class="card"><b>الألعاب</b><div class="chips">' + MiniGames.ids.map(function (id) { return OFFG.indexOf(id) >= 0 ? '<span class="chip locked">🔒 ' + GM[id].name + ' <small>قريباً</small></span>' : '<span class="chip">' + GM[id].emoji + ' ' + GM[id].name + '</span>'; }).join('') + '</div><span class="muted" style="font-size:14px">ألعاب المايك والحركة بتطلب إذن، وإذا ما انعطى في بديل باللمس.</span></div>';
    h += '<p class="muted" style="margin:0;font-size:14px">مرجع اللعبة: فكرة ألعاب الحفلات القصيرة (Party mini-games) بنسخة قعدة. إعداد م. إياد حلوبي.</p>';
    if (V.screen === 'room' && !demo) h += '<button class="btn ghost" id="hp-leave">🚪 اطلع من القعدة</button>';
    openSheet(h, function (s) {
      var l = s.querySelector('#hp-leave');
      if (l) l.onclick = function () { closeSheet(); confirmSheet('بدك تطلع من القعدة على هالجهاز؟', 'اطلع', function () { LS.del('lb_room'); location.href = location.pathname; }); };
    });
  }

  /* ---------- الصور: اختيار، سيلفي، قص ---------- */
  function photoDone(target, url) {
    if (target === 'form') { V.form.photo = url; render(); }
    else if (target === 'me') act({ a: 'photo', photo: url });
    else if (target === 'group') act({ a: 'groupPhoto', photo: url });
  }
  function pickPhoto(target) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var r = new FileReader(); r.onload = function () { cropSheet(r.result, target); }; r.readAsDataURL(f);
    };
    inp.click();
  }
  function selfieSheet(target) {
    var group = target === 'group';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { pickPhotoCapture(target); return; }
    openSheet(sheetHead(group ? 'صورة الشلة 🤳' : 'سيلفي 🤳') + '<div class="selfie" style="position:relative"><video id="sv" playsinline autoplay muted></video><div class="cnt" id="scnt"></div></div>' +
      '<div class="btn-row"><button class="btn red" id="snap">📸 صوّر</button>' + (group ? '<button class="btn ghost" id="snap5">⏱️ بعد 5 ثواني</button>' : '') + '</div>', function (s) {
        var v = s.querySelector('#sv'), stream = null;
        $modal._cleanup = function () { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); };
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false }).then(function (st) { stream = st; v.srcObject = st; })
          .catch(function () { closeSheet(); toast('ما قدرنا نفتح الكاميرا، اختار من الصور'); pickPhotoCapture(target); });
        function snap() {
          if (!v.videoWidth) return;
          var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
          var x = c.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(v, 0, 0);
          var url = c.toDataURL('image/jpeg', 0.9); closeSheet(); cropSheet(url, target);
        }
        s.querySelector('#snap').onclick = snap;
        var s5 = s.querySelector('#snap5');
        if (s5) s5.onclick = function () {
          var n = 5, el = s.querySelector('#scnt'); el.textContent = n;
          var iv = setInterval(function () { n--; if (n <= 0) { clearInterval(iv); el.textContent = ''; snap(); } else el.textContent = n; }, 1000);
        };
      });
  }
  function pickPhotoCapture(target) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'user');
    inp.onchange = function () { var f = inp.files && inp.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { cropSheet(r.result, target); }; r.readAsDataURL(f); };
    inp.click();
  }
  function cropSheet(src, target) {
    var rect = target === 'group';
    openSheet(sheetHead(rect ? 'ظبّط صورة الشلة' : 'ظبّط صورتك') + '<div class="crop-box ' + (rect ? 'rect' : '') + '" id="cb"><img id="ci" alt=""></div>' +
      '<label class="label" for="cz">كبّر وصغّر، واسحب الصورة بإصبعك</label><input type="range" class="range" id="cz" min="1" max="4" step="0.01" value="1">' +
      '<button class="btn red" id="cok">تمام ✔</button>', function (s) {
        var box = s.querySelector('#cb'), img = s.querySelector('#ci'), z = s.querySelector('#cz');
        var bw, bh, base = 1, zoom = 1, x = 0, y = 0, drag = null, pinch = null, pts = {};
        img.onload = function () {
          bw = box.clientWidth; bh = box.clientHeight;
          base = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
          x = (bw - img.naturalWidth * base) / 2; y = (bh - img.naturalHeight * base) / 2; apply();
        };
        img.src = src;
        function sc() { return base * zoom; }
        function clampXY() {
          var w = img.naturalWidth * sc(), h = img.naturalHeight * sc();
          x = Math.min(0, Math.max(bw - w, x)); y = Math.min(0, Math.max(bh - h, y));
        }
        function apply() { clampXY(); img.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sc() + ')'; }
        function setZoom(nz, cx, cy) {
          nz = Math.max(1, Math.min(4, nz)); cx = cx == null ? bw / 2 : cx; cy = cy == null ? bh / 2 : cy;
          var k = nz / zoom; x = cx - (cx - x) * k; y = cy - (cy - y) * k; zoom = nz; z.value = nz; apply();
        }
        z.oninput = function () { setZoom(+z.value); };
        box.addEventListener('pointerdown', function (e) { box.setPointerCapture(e.pointerId); pts[e.pointerId] = [e.clientX, e.clientY]; drag = [e.clientX, e.clientY]; });
        box.addEventListener('pointermove', function (e) {
          if (!pts[e.pointerId]) return;
          pts[e.pointerId] = [e.clientX, e.clientY];
          var ids = Object.keys(pts);
          if (ids.length >= 2) {
            var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
            if (pinch) { var r = box.getBoundingClientRect(); setZoom(zoom * d / pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); }
            pinch = d; return;
          }
          if (drag) { x += e.clientX - drag[0]; y += e.clientY - drag[1]; drag = [e.clientX, e.clientY]; apply(); }
        });
        function up(e) { delete pts[e.pointerId]; pinch = null; var ids = Object.keys(pts); drag = ids.length ? pts[ids[0]] : null; }
        box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
        s.querySelector('#cok').onclick = function () {
          var ow = rect ? 720 : 280, oh = rect ? 540 : 280, c = document.createElement('canvas'); c.width = ow; c.height = oh;
          var k = ow / bw, cx = c.getContext('2d');
          cx.drawImage(img, x * k, y * k, img.naturalWidth * sc() * k, img.naturalHeight * sc() * k);
          var url = c.toDataURL('image/jpeg', rect ? 0.78 : 0.8);
          closeSheet(); photoDone(target, url);
        };
      });
  }

  /* ---------- كونفيتي ---------- */
  function confetti() {
    var cv = document.getElementById('confetti'), cx = cv.getContext('2d');
    var W = cv.width = innerWidth, Hh = cv.height = innerHeight, cols = ['#FF4B3E', '#2F6BFF', '#FFC21A', '#FF7EC0', '#22C17A'];
    var ps = []; for (var i = 0; i < 140; i++) ps.push({ x: Math.random() * W, y: -20 - Math.random() * Hh * 0.5, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[i % 5], w: 8 + Math.random() * 6 });
    var t0 = performance.now();
    try { navigator.vibrate && navigator.vibrate([40, 40, 80]); } catch (e) { }
    (function f() {
      var t = performance.now() - t0; cx.clearRect(0, 0, W, Hh);
      ps.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.r += p.vr; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -3, p.w, 6); cx.restore(); });
      if (t < 3200) requestAnimationFrame(f); else cx.clearRect(0, 0, W, Hh);
    })();
  }

  /* ---------- البداية ---------- */
  function checkServer() {
    return new Promise(function (res) {
      var done = false, t = setTimeout(function () { if (!done) { done = true; res(false); } }, 2500);
      try {
        fetch('health', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (!done) { done = true; clearTimeout(t); res(!!(j && j.ok)); } })
          .catch(function () { if (!done) { done = true; clearTimeout(t); res(false); } });
      } catch (e) { done = true; clearTimeout(t); res(false); }
    });
  }

  (function boot() {
    applySkin();
    var urlCode = (qs('r') || '').toUpperCase().replace(/[^A-Z]/g, '');
    render();
    checkServer().then(function (ok) {
      V.server = ok;
      if (!ok) { render(); return; }
      try { fetch('config', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { OFFG = (j && j.off) || []; render(); }).catch(function () { }); } catch (e) { }
      if (urlCode && (!room || room.code !== urlCode)) {
        room = null; LS.del('lb_room');
        V.formKind = 'join'; V.form.code = urlCode; V.screen = 'form'; render(); return;
      }
      if (room && room.code) { V.screen = 'room'; startNet(); render(); return; }
      render();
    });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      try { navigator.serviceWorker.register('sw.js').catch(function () { }); } catch (e) { }
    }
  })();
})();
