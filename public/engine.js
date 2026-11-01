/* قعدة لعّيبة — منطق اللعبة (بيشتغل عند الريس، وبالسيرفر بس كنسخة محفوظة) */
(function (root) {
  'use strict';

  var GAME_IDS = ['balloon', 'candles', 'maze', 'ten', 'green', 'fly', 'tap', 'circle', 'stroop', 'simon', 'dots', 'odd'];
  var PLAYER_COLORS = ['#FF4B3E', '#2F6BFF', '#FFC21A', '#FF7EC0', '#22C17A', '#FF8A1F', '#8A5CFF', '#00B5C7',
    '#C2562B', '#7FA100', '#E0336F', '#4657C9', '#D49A00', '#1E9C77', '#A447BD', '#5E7C8C'];
  var TEAM_DEF = [
    { name: 'فريق الفرقيعة', color: '#FF4B3E', emoji: '🎈' },
    { name: 'فريق الدبّانة', color: '#2F6BFF', emoji: '🪰' },
    { name: 'فريق الشمعة', color: '#FFC21A', emoji: '🕯️' },
    { name: 'فريق البطّيخة', color: '#22C17A', emoji: '🍉' }
  ];
  var PTS = [5, 3, 1];
  var BET_LOSS = -5;
  var HOST_GRACE_MS = 45000;

  var nowFn = Date.now;
  function now() { return nowFn(); }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function fresh(code, hostId) {
    return {
      v: 1, code: code || '', hostId: hostId || '', phase: 'setup',
      meta: { name: '', type: 'شلة', typeCustom: '' },
      cfg: { mode: 'solo', teamCount: 2, teamStyle: 'all', order: 'wheel', games: GAME_IDS.slice(), rounds: 12, titles: 'three' },
      players: {}, joinOrder: [], kicked: [],
      teams: [], used: [], passed: [], roundNo: 0,
      cur: null, history: [], reveal: null,
      story: { group: true, podium: true },
      groupPhoto: false, seq: 0, updatedAt: now()
    };
  }

  function Engine(opts) {
    this.hooks = opts.hooks || {};
    this.s = opts.state ? clone(opts.state) : fresh(opts.code, opts.hostId);
    this.photos = opts.photos ? clone(opts.photos) : {};
    this.games = opts.games || {}; // {id:{dur}}
    if (opts.now) nowFn = opts.now;
  }

  Engine.GAME_IDS = GAME_IDS;
  Engine.TEAM_DEF = TEAM_DEF;
  Engine.PTS = PTS;
  Engine.BET_LOSS = BET_LOSS;
  Engine.HOST_GRACE_MS = HOST_GRACE_MS;
  Engine.fresh = fresh;

  var P = Engine.prototype;

  P.emit = function (photosChanged) {
    this.s.seq++;
    this.s.updatedAt = now();
    if (this.hooks.state) this.hooks.state(this.s);
    if (photosChanged && this.hooks.photos) this.hooks.photos(this.photos);
  };
  P.stat = function (ev, data) { if (this.hooks.stat) this.hooks.stat(ev, data || {}); };

  /* ---------- مساعدات ---------- */
  P.active = function () {
    var s = this.s;
    return s.joinOrder.filter(function (id) { return s.players[id] && !s.players[id].gone; });
  };
  P.online = function () {
    var s = this.s;
    return this.active().filter(function (id) { return s.players[id].on; });
  };
  P.teamMembers = function (tid) {
    var s = this.s;
    return this.active().filter(function (id) { return s.players[id].team === tid; });
  };
  P.teamOf = function (pid) { var p = this.s.players[pid]; return p ? p.team : null; };
  P.isCaptain = function (pid) {
    var t = this.findTeam(this.teamOf(pid));
    return !!(t && t.captain === pid);
  };
  P.findTeam = function (tid) {
    for (var i = 0; i < this.s.teams.length; i++) if (this.s.teams[i].id === tid) return this.s.teams[i];
    return null;
  };
  P.fixCaptains = function () {
    var self = this;
    this.s.teams.forEach(function (t) {
      var mem = self.teamMembers(t.id);
      if (!t.captain || mem.indexOf(t.captain) < 0) t.captain = mem[0] || null;
    });
  };
  P.buildTeams = function () {
    var s = this.s, n = Math.max(2, Math.min(4, s.cfg.teamCount | 0));
    var old = s.teams;
    s.teams = [];
    for (var i = 0; i < n; i++) {
      var d = TEAM_DEF[i];
      var prev = old[i];
      s.teams.push({ id: 't' + (i + 1), name: prev ? prev.name : d.name, color: d.color, emoji: d.emoji, captain: prev ? prev.captain : null, ptr: 0 });
    }
    var ids = s.teams.map(function (t) { return t.id; });
    this.active().forEach(function (id) { if (ids.indexOf(s.players[id].team) < 0) s.players[id].team = null; });
    this.fixCaptains();
  };
  P.smallestTeam = function () {
    var self = this, best = null, bc = 1e9;
    this.s.teams.forEach(function (t) { var c = self.teamMembers(t.id).length; if (c < bc) { bc = c; best = t.id; } });
    return best;
  };
  P.nextColor = function () {
    var used = {}, s = this.s;
    this.active().forEach(function (id) { used[s.players[id].color] = 1; });
    for (var i = 0; i < PLAYER_COLORS.length; i++) if (!used[PLAYER_COLORS[i]]) return PLAYER_COLORS[i];
    return PLAYER_COLORS[rnd(PLAYER_COLORS.length)];
  };
  P.isHost = function (pid) { return pid === this.s.hostId; };

  /* ---------- الحضور ---------- */
  P.presence = function (pid, on) {
    var p = this.s.players[pid];
    if (!p) return;
    p.on = !!on;
    if (this.s.phase === 'play' && this.s.cur && !this.s.cur.startAt) { if (this.checkReady()) return; }
    this.emit();
  };

  /* ---------- اختيار اللعبة ---------- */
  P.remainingGames = function () {
    var s = this.s;
    var pool = s.cfg.games.filter(function (g) { return s.passed.indexOf(g) < 0; });
    if (!pool.length) pool = s.cfg.games.slice();
    var left = pool.filter(function (g) { return s.used.indexOf(g) < 0; });
    if (!left.length) { s.used = []; left = pool.slice(); }
    return left;
  };
  P.pick = function () {
    var s = this.s;
    var left = this.remainingGames();
    var target;
    if (s.cfg.order === 'ordered') {
      target = left[0];
      this.toIntro(target);
      return;
    }
    target = left[rnd(left.length)];
    s.phase = 'pick';
    s.cur = { n: s.roundNo + 1, game: target, spin: { list: left, target: left.indexOf(target), at: now(), dur: s.cfg.order === 'wheel' ? 4200 : 2600, id: rnd(1e9) } };
    this.emit();
  };
  P.toIntro = function (game) {
    var s = this.s;
    s.phase = 'intro';
    s.cur = { n: s.roundNo + 1, game: game, playersIn: this.choosePlayers(false), bet: null, scores: {}, started: 0, deadline: 0, hidden: false };
    this.emit();
  };
  P.choosePlayers = function (advance) {
    var s = this.s, self = this;
    if (s.cfg.mode === 'solo') return this.online().length ? this.online() : this.active();
    if (s.cfg.teamStyle === 'all') {
      return this.active().filter(function (id) { return s.players[id].team && s.players[id].on; });
    }
    var res = [];
    s.teams.forEach(function (t) {
      var mem = self.teamMembers(t.id);
      var on = mem.filter(function (id) { return s.players[id].on; });
      var list = on.length ? on : mem;
      if (!list.length) return;
      var idx = t.ptr % list.length;
      res.push(list[idx]);
      if (advance) t.ptr = (t.ptr + 1) % Math.max(1, list.length);
    });
    return res;
  };

  /* ---------- الجاهزية والبداية الموحّدة ---------- */
  P.checkReady = function () {
    var s = this.s, c = s.cur;
    if (!c || c.startAt) return false;
    var need = c.playersIn.filter(function (id) { return s.players[id] && s.players[id].on; });
    if (!need.length) need = c.playersIn;
    for (var i = 0; i < need.length; i++) if (!c.ready[need[i]]) return false;
    this.startNow();
    return true;
  };
  P.startNow = function () {
    var s = this.s, c = s.cur;
    if (!c || c.startAt) return;
    var dur = (this.games[c.game] && this.games[c.game].dur) || 20;
    c.startAt = now() + 3600;
    c.deadline = c.startAt + (dur + 15) * 1000;
    this.emit();
  };

  /* ---------- إنهاء الجولة وحساب النقاط ---------- */
  P.allIn = function () {
    var c = this.s.cur;
    if (!c || !c.playersIn) return false;
    for (var i = 0; i < c.playersIn.length; i++) if (!c.scores[c.playersIn[i]]) return false;
    return true;
  };
  function rankRows(rows) {
    rows.sort(function (a, b) {
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });
    var rank = 0, last;
    rows.forEach(function (r, i) {
      if (r.score === null) { r.rank = null; return; }
      if (i === 0 || r.score !== last) rank = i + 1;
      last = r.score;
      r.rank = rank;
    });
    return rows;
  }
  P.computeRound = function () {
    var s = this.s, c = s.cur, self = this;
    var playerRows = c.playersIn.map(function (id) {
      var sc = c.scores[id];
      return { id: id, score: sc ? sc.score : null, label: sc ? sc.label : 'ما لعب' };
    });
    rankRows(playerRows);
    var rows;
    if (s.cfg.mode === 'solo') {
      rows = playerRows.map(function (r) { return { id: r.id, score: r.score, label: r.label, rank: r.rank, pts: r.rank ? (PTS[r.rank - 1] || 0) : 0 }; });
    } else {
      rows = [];
      s.teams.forEach(function (t) {
        var mine = playerRows.filter(function (r) { return s.players[r.id] && s.players[r.id].team === t.id; });
        if (!mine.length) return;
        var vals = mine.filter(function (r) { return r.score !== null; });
        var score = null, label = 'ما لعبوا';
        if (vals.length) {
          if (s.cfg.teamStyle === 'all') {
            score = vals.reduce(function (a, r) { return a + r.score; }, 0) / mine.length;
            label = 'معدّل ' + vals.length + ' من ' + mine.length;
          } else {
            score = vals[0].score;
            label = vals[0].label;
          }
        }
        rows.push({ id: t.id, score: score, label: label, players: mine.map(function (r) { return r.id; }) });
      });
      rankRows(rows);
      rows.forEach(function (r) { r.pts = r.rank ? (PTS[r.rank - 1] || 0) : 0; });
      if (c.bet && c.bet.status === 'on') {
        rows.forEach(function (r) {
          r.pts = r.pts * 2;
          if (r.id === c.bet.team && r.rank !== 1) { r.pts = BET_LOSS; r.betLost = true; }
          if (r.id === c.bet.team && r.rank === 1) r.betWon = true;
        });
      }
    }
    return { n: c.n, game: c.game, rows: rows, playerRows: playerRows, bet: c.bet && c.bet.status === 'on' ? c.bet.team : null, hidden: false, at: now() };
  };
  P.finishPlay = function () {
    var s = this.s;
    if (s.phase !== 'play') return;
    s.phase = 'done';
    this.emit();
  };
  P.commitRound = function (hidden) {
    var s = this.s;
    if (s.phase !== 'done') return;
    var rec = this.computeRound();
    rec.hidden = !!hidden;
    rec.ptrs = s.teams.map(function (t) { return t.ptr; });
    rec.wasUsed = s.used.indexOf(s.cur.game) >= 0;
    s.history.push(rec);
    s.roundNo++;
    if (s.used.indexOf(s.cur.game) < 0) s.used.push(s.cur.game);
    if (s.cfg.mode === 'teams' && s.cfg.teamStyle === 'rotate') this.choosePlayers(true);
    this.stat('round', { game: s.cur.game });
    if (hidden) {
      if (s.roundNo >= s.cfg.rounds) { s.phase = 'revealChoice'; s.cur = null; }
      else { s.cur = null; this.pick(); return; }
    } else {
      s.phase = 'result';
    }
    this.emit();
  };

  /* ---------- المجاميع والترتيب ---------- */
  Engine.totals = function (s, includeHidden) {
    var t = {}, wins = {};
    s.history.forEach(function (h) {
      if (h.hidden && !includeHidden) return;
      h.rows.forEach(function (r) { t[r.id] = (t[r.id] || 0) + r.pts; });
      h.playerRows.forEach(function (r) { if (r.rank === 1) wins[r.id] = (wins[r.id] || 0) + 1; });
    });
    return { pts: t, wins: wins };
  };
  Engine.standings = function (s, includeHidden) {
    var tt = Engine.totals(s, includeHidden);
    var ids;
    if (s.cfg.mode === 'solo') {
      ids = s.joinOrder.filter(function (id) { return s.players[id] && !s.players[id].gone; });
    } else {
      ids = s.teams.map(function (t) { return t.id; });
    }
    var rows = ids.map(function (id) {
      var w = 0;
      if (s.cfg.mode === 'solo') w = tt.wins[id] || 0;
      else s.joinOrder.forEach(function (pid) { var p = s.players[pid]; if (p && p.team === id) w += tt.wins[pid] || 0; });
      return { id: id, pts: tt.pts[id] || 0, wins: w };
    });
    rows.sort(function (a, b) { return (b.pts - a.pts) || (b.wins - a.wins); });
    var rank = 0;
    rows.forEach(function (r, i) {
      if (i === 0 || r.pts !== rows[i - 1].pts || r.wins !== rows[i - 1].wins) rank = i + 1;
      r.rank = rank;
    });
    return { rows: rows, wins: tt.wins };
  };

  /* ---------- الأفعال ---------- */
  P.act = function (pid, a) {
    if (!a || !a.a) return;
    var s = this.s, p = s.players[pid], host = this.isHost(pid), self = this;
    if (s.kicked.indexOf(pid) >= 0) return;
    switch (a.a) {
      case 'join': {
        var prof = a.profile || {};
        var g = prof.g === 'f' ? 'f' : 'm';
        var name = String(prof.name || '').trim().slice(0, 20) || (g === 'f' ? 'لعّيبة' : 'لعّيب') + ' ' + (this.active().length + 1);
        var photoChanged = false;
        if (!p) {
          p = s.players[pid] = { id: pid, name: name, g: g, color: this.nextColor(), team: null, on: true, bot: !!prof.bot, joinedAt: now() };
          s.joinOrder.push(pid);
          if (s.cfg.mode === 'teams' && s.teams.length && s.phase !== 'setup' && s.phase !== 'lobby') {
            p.team = this.smallestTeam();
            this.fixCaptains();
          }
        } else {
          p.name = name; p.g = g; p.on = true; p.gone = false;
        }
        if (prof.photo) { this.photos[pid] = prof.photo; photoChanged = true; }
        else if (prof.photo === null && this.photos[pid]) { delete this.photos[pid]; photoChanged = true; }
        this.emit(photoChanged);
        return;
      }
      case 'rename': {
        var target = host && a.pid ? a.pid : pid;
        var tp = s.players[target];
        if (!tp) return;
        var nm = String(a.name || '').trim().slice(0, 20);
        if (nm) tp.name = nm;
        this.emit();
        return;
      }
      case 'photo': {
        if (!p) return;
        if (a.photo) this.photos[pid] = a.photo; else delete this.photos[pid];
        this.emit(true);
        return;
      }
      case 'joinTeam': {
        if (!p || s.cfg.mode !== 'teams') return;
        if (s.phase !== 'lobby' && s.phase !== 'setup') return;
        if (!this.findTeam(a.team)) return;
        p.team = a.team;
        this.fixCaptains();
        this.emit();
        return;
      }
      case 'score': {
        var c = s.cur;
        if (s.phase !== 'play' || !c || !c.startAt || c.playersIn.indexOf(pid) < 0 || c.scores[pid]) return;
        var sc = Number(a.score);
        if (!isFinite(sc)) return;
        c.scores[pid] = { score: Math.round(sc * 100) / 100, label: String(a.label || '').slice(0, 40), at: now() };
        if (this.allIn()) { this.finishPlay(); return; }
        this.emit();
        return;
      }
      case 'ready': {
        var cr = s.cur;
        if (s.phase !== 'play' || !cr || cr.startAt || cr.playersIn.indexOf(pid) < 0) return;
        cr.ready[pid] = 1;
        if (!this.checkReady()) this.emit();
        return;
      }
      case 'bet': {
        var cb = s.cur;
        if (s.phase !== 'intro' || s.cfg.mode !== 'teams' || !cb || cb.bet) return;
        if (!this.isCaptain(pid)) return;
        var myTeam = this.teamOf(pid);
        var need = s.teams.filter(function (t) { return t.id !== myTeam && t.captain && self.teamMembers(t.id).length; }).map(function (t) { return t.id; });
        cb.bet = { team: myTeam, status: need.length ? 'pending' : 'on', need: need, yes: [], no: null };
        this.emit();
        return;
      }
      case 'betAns': {
        var cc = s.cur;
        if (s.phase !== 'intro' || !cc || !cc.bet || cc.bet.status !== 'pending') return;
        if (!this.isCaptain(pid)) return;
        var tm = this.teamOf(pid);
        if (cc.bet.need.indexOf(tm) < 0 || cc.bet.yes.indexOf(tm) >= 0) return;
        if (a.yes) {
          cc.bet.yes.push(tm);
          if (cc.bet.yes.length >= cc.bet.need.length) cc.bet.status = 'on';
        } else {
          cc.bet.status = 'off';
          cc.bet.no = tm;
        }
        this.emit();
        return;
      }
    }

    if (!host) return; // الباقي للريس بس

    switch (a.a) {
      case 'meta': {
        if (typeof a.name === 'string') s.meta.name = a.name.trim().slice(0, 30);
        if (typeof a.type === 'string') s.meta.type = a.type.slice(0, 20);
        if (typeof a.typeCustom === 'string') s.meta.typeCustom = a.typeCustom.trim().slice(0, 20);
        this.emit();
        return;
      }
      case 'cfg': {
        if (s.phase !== 'setup' && s.phase !== 'lobby') return;
        var cfg = a.cfg || {};
        ['mode', 'teamStyle', 'titles'].forEach(function (k) { if (typeof cfg[k] === 'string') s.cfg[k] = cfg[k]; });
        if (cfg.teamCount) s.cfg.teamCount = Math.max(2, Math.min(4, cfg.teamCount | 0));
        if (Array.isArray(cfg.games)) {
          var gs = cfg.games.filter(function (g) { return GAME_IDS.indexOf(g) >= 0; });
          if (gs.length) s.cfg.games = GAME_IDS.filter(function (g) { return gs.indexOf(g) >= 0; });
        }
        if (cfg.rounds) s.cfg.rounds = Math.max(1, Math.min(36, cfg.rounds | 0));
        if (s.cfg.mode === 'teams') this.buildTeams();
        this.emit();
        return;
      }
      case 'openLobby': {
        if (s.phase !== 'setup') return;
        if (!s.meta.name) return;
        if (s.cfg.mode === 'teams') this.buildTeams();
        s.phase = 'lobby';
        this.emit();
        return;
      }
      case 'backToSetup': {
        if (s.phase !== 'lobby') return;
        s.phase = 'setup';
        this.emit();
        return;
      }
      case 'shuffleTeams': {
        if (s.cfg.mode !== 'teams') return;
        var ids = this.active().slice();
        for (var i = ids.length - 1; i > 0; i--) { var j = rnd(i + 1); var tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp; }
        ids.forEach(function (id, k) { s.players[id].team = s.teams[k % s.teams.length].id; });
        s.teams.forEach(function (t) { t.captain = null; });
        this.fixCaptains();
        this.emit();
        return;
      }
      case 'renameTeam': {
        var tt = this.findTeam(a.team);
        if (!tt) return;
        var tn = String(a.name || '').trim().slice(0, 24);
        if (tn) tt.name = tn;
        this.emit();
        return;
      }
      case 'captain': {
        var tp2 = s.players[a.pid];
        if (!tp2 || !tp2.team) return;
        var t2 = this.findTeam(tp2.team);
        if (t2) t2.captain = a.pid;
        this.emit();
        return;
      }
      case 'kick': {
        var kp = s.players[a.pid];
        if (!kp || a.pid === s.hostId) return;
        kp.gone = true; kp.on = false;
        s.kicked.push(a.pid);
        delete this.photos[a.pid];
        this.fixCaptains();
        if (s.cur && s.cur.playersIn) {
          s.cur.playersIn = s.cur.playersIn.filter(function (id) { return id !== a.pid; });
          if (s.phase === 'play' && !s.cur.startAt && s.cur.playersIn.length && this.checkReady()) { if (this.hooks.kick) this.hooks.kick(a.pid); return; }
          if (s.phase === 'play' && this.allIn()) { if (this.hooks.kick) this.hooks.kick(a.pid); this.finishPlay(); return; }
        }
        if (this.hooks.kick) this.hooks.kick(a.pid);
        this.emit(true);
        return;
      }
      case 'transfer': {
        var np = s.players[a.pid];
        if (!np || np.gone || a.pid === s.hostId) return;
        s.hostId = a.pid;
        this.emit();
        if (this.hooks.transfer) this.hooks.transfer(a.pid);
        return;
      }
      case 'start': {
        if (s.phase !== 'lobby') return;
        var act = this.active();
        if (act.length < 2) return;
        if (s.cfg.mode === 'teams') {
          if (!s.teams.length) this.buildTeams();
          act.forEach(function (id) { if (!s.players[id].team) { s.players[id].team = self.smallestTeam(); } });
          this.fixCaptains();
          var withMembers = s.teams.filter(function (t) { return self.teamMembers(t.id).length; });
          if (withMembers.length < 2) return;
        }
        s.history = []; s.used = []; s.passed = []; s.roundNo = 0; s.reveal = null;
        this.stat('start', { mode: s.cfg.mode, players: act.length });
        this.pick();
        return;
      }
      case 'spinDone': {
        if (s.phase !== 'pick' || !s.cur) return;
        this.toIntro(s.cur.game);
        return;
      }
      case 'pass': {
        if (s.phase !== 'intro' && s.phase !== 'pick') return;
        if (s.cur && s.passed.indexOf(s.cur.game) < 0) s.passed.push(s.cur.game);
        this.stat('pass', { game: s.cur && s.cur.game });
        this.pick();
        return;
      }
      case 'play': {
        if (s.phase !== 'intro' || !s.cur) return;
        if (s.cur.bet && s.cur.bet.status === 'pending') return;
        s.cur.playersIn = this.choosePlayers(false);
        if (!s.cur.playersIn.length) return;
        s.cur.started = now();
        s.cur.seed = 1 + rnd(2147483000);
        s.cur.ready = {}; s.cur.startAt = 0; s.cur.deadline = 0;
        s.cur.readyBy = now() + 45000;
        s.cur.scores = {};
        s.phase = 'play';
        this.emit();
        return;
      }
      case 'closeRound': {
        if (s.phase !== 'play') return;
        this.finishPlay();
        return;
      }
      case 'goNow': {
        if (s.phase !== 'play' || !s.cur || s.cur.startAt) return;
        this.startNow();
        return;
      }
      case 'replay': {
        if (!s.cur && s.phase !== 'result') return;
        var game;
        if (s.phase === 'result') {
          var last = s.history.pop();
          if (!last) return;
          s.roundNo = Math.max(0, s.roundNo - 1);
          if (!last.wasUsed) { var ui = s.used.indexOf(last.game); if (ui >= 0) s.used.splice(ui, 1); }
          if (last.ptrs) s.teams.forEach(function (t, i) { if (last.ptrs[i] != null) t.ptr = last.ptrs[i]; });
          game = last.game;
        } else if (s.phase === 'play' || s.phase === 'done' || s.phase === 'intro') {
          game = s.cur.game;
        } else return;
        this.stat('replay', { game: game });
        this.toIntro(game);
        return;
      }
      case 'reveal': { this.commitRound(false); return; }
      case 'hide': { this.commitRound(true); return; }
      case 'next': {
        if (s.phase !== 'result') return;
        if (s.roundNo >= s.cfg.rounds) { s.phase = 'revealChoice'; s.cur = null; this.emit(); return; }
        this.pick();
        return;
      }
      case 'more': { // زيد جولات
        s.cfg.rounds = Math.min(36, s.cfg.rounds + (a.n | 0 || 3));
        this.emit();
        return;
      }
      case 'end': {
        if (['pick', 'intro', 'result', 'done'].indexOf(s.phase) < 0) return;
        if (!s.history.length) return;
        s.cur = null;
        s.phase = 'revealChoice';
        this.emit();
        return;
      }
      case 'revealMode': {
        if (s.phase !== 'revealChoice') return;
        var st = Engine.standings(s, true).rows;
        if (a.mode === 'party') {
          var steps = Math.min(3, st.length);
          s.reveal = { mode: 'party', steps: steps, step: 0, at: now() };
          s.phase = 'reveal';
        } else {
          s.reveal = { mode: 'all', steps: 0, step: 0, at: now() };
          s.phase = 'final';
          this.stat('finish', {});
        }
        this.emit();
        return;
      }
      case 'revealNext': {
        if (s.phase !== 'reveal' || !s.reveal) return;
        if (s.reveal.step < s.reveal.steps) { s.reveal.step++; s.reveal.at = now(); }
        else { s.phase = 'final'; this.stat('finish', {}); }
        this.emit();
        return;
      }
      case 'story': {
        if (typeof a.group === 'boolean') s.story.group = a.group;
        if (typeof a.podium === 'boolean') s.story.podium = a.podium;
        this.emit();
        return;
      }
      case 'groupPhoto': {
        if (a.photo) { this.photos.__group = a.photo; s.groupPhoto = true; }
        else { delete this.photos.__group; s.groupPhoto = false; }
        this.emit(true);
        return;
      }
      case 'closeRoom': {
        s.phase = 'closed'; s.cur = null;
        this.emit();
        return;
      }
      case 'rematch': {
        s.history = []; s.used = []; s.passed = []; s.roundNo = 0; s.cur = null; s.reveal = null;
        s.teams.forEach(function (t) { t.ptr = 0; });
        s.phase = 'lobby';
        this.emit();
        return;
      }
    }
  };

  /* ---------- دقّات الوقت ---------- */
  P.tick = function () {
    var s = this.s;
    if (s.phase !== 'play' || !s.cur) return;
    if (!s.cur.startAt && s.cur.readyBy && now() > s.cur.readyBy) { this.startNow(); return; }
    if (s.cur.deadline && now() > s.cur.deadline) this.finishPlay();
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(this);
