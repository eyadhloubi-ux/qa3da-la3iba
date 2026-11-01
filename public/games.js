/* قعدة لعّيبة — الـ12 لعبة الصغيرة */
(function (root) {
  'use strict';

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var R = Math.random;
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function rand(a, b) { return a + R() * (b - a); }
  function ri(a, b) { return Math.floor(rand(a, b + 1)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function sec(ms) { return (ms / 1000).toFixed(1); }

  /* ---------- أصوات خفيفة ---------- */
  var AC = null;
  function audio() { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; } return AC; }
  function beep(f, d, type, vol) {
    var ac = AC; if (!ac) return;
    try {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square'; o.frequency.value = f;
      g.gain.value = vol || 0.05;
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (d || 0.12));
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + (d || 0.12));
    } catch (e) { }
  }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 30); } catch (e) { } }

  /* ---------- المايك ---------- */
  function getMic() {
    return new Promise(function (resolve) {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return resolve(null);
        var done = false;
        var to = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 6000);
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (stream) {
          if (done) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
          done = true; clearTimeout(to);
          var ac = audio();
          if (!ac) { stream.getTracks().forEach(function (t) { t.stop(); }); return resolve(null); }
          var src = ac.createMediaStreamSource(stream);
          var an = ac.createAnalyser(); an.fftSize = 1024;
          src.connect(an);
          var buf = new Uint8Array(an.fftSize);
          resolve({
            level: function () {
              an.getByteTimeDomainData(buf);
              var s = 0; for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; s += v * v; }
              return Math.sqrt(s / buf.length);
            },
            stop: function () { try { stream.getTracks().forEach(function (t) { t.stop(); }); src.disconnect(); } catch (e) { } }
          });
        }).catch(function () { if (!done) { done = true; clearTimeout(to); resolve(null); } });
      } catch (e) { resolve(null); }
    });
  }

  /* ---------- حساس الميلان ---------- */
  function getTilt() {
    return new Promise(function (resolve) {
      if (typeof DeviceOrientationEvent === 'undefined') return resolve(null);
      var go = function () {
        var st = { b: null, g: null, b0: null, g0: null, ok: false };
        var h = function (e) {
          if (e.beta == null) return;
          if (st.b0 == null) { st.b0 = e.beta; st.g0 = e.gamma; }
          st.b = e.beta; st.g = e.gamma; st.ok = true;
        };
        window.addEventListener('deviceorientation', h);
        resolve({ st: st, stop: function () { window.removeEventListener('deviceorientation', h); } });
      };
      try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
          DeviceOrientationEvent.requestPermission().then(function (r) { if (r === 'granted') go(); else resolve(null); }).catch(function () { resolve(null); });
        } else go();
      } catch (e) { resolve(null); }
    });
  }

  function plural(n, one, two, few, many) {
    if (n === 1) return one;
    if (n === 2) return two;
    if (n >= 3 && n <= 10) return n + ' ' + few;
    return n + ' ' + many;
  }

  /* ---------- تعريف الألعاب ---------- */
  var G = {};

  G.balloon = {
    name: 'نفّخ البالونة', emoji: '🎈', dur: 15, needs: 'mic', color: '#FF4B3E',
    hint: 'انفخ عالمايك (تحت الموبايل) لحتى تفقع البالونة. الأسرع بيربح.',
    label: function (r) { return r.popped ? 'فقعها بـ ' + sec(r.ms) + 'ث' : 'وصّلها لـ ' + Math.round(r.size) + '%'; },
    score: function (r) { return r.popped ? 100000 - r.ms : r.size * 100; },
    bot: function () { return R() < 0.7 ? { popped: true, ms: rand(2400, 9000) } : { popped: false, size: rand(40, 96) }; },
    start: function (api) {
      var b = api.body;
      b.innerHTML = '<div class="g-center"><div class="bl-stage"><div class="bl" id="bl"><i></i></div><div class="bl-knot"></div><div class="bl-str"></div></div>' +
        '<div class="g-big" id="blp">0%</div><div class="g-sub" id="blh">' + (api.mic ? 'انفخ عالمايك! 💨' : 'اكبس بسرعة لتنفخ') + '</div>' +
        (api.mic ? '' : '<button class="g-pad g-pump" id="pump">💨 اكبس</button>') + '</div>';
      var bl = b.querySelector('#bl'), pct = b.querySelector('#blp');
      var size = 0, t0 = api.now(), last = t0, base = 0.02, calib = [], over = false;
      var thr = 0.12;
      if (!api.mic) {
        b.querySelector('#pump').addEventListener('pointerdown', function (e) { e.preventDefault(); size += 3.2; beep(300 + size * 5, 0.05, 'triangle', 0.03); buzz(10); });
      }
      function draw() {
        var s = 0.32 + size / 100 * 0.95;
        bl.style.transform = 'scale(' + s.toFixed(3) + ')';
        bl.classList.toggle('bl-tense', size > 80);
        pct.textContent = Math.round(size) + '%';
      }
      function pop() {
        over = true;
        bl.classList.add('bl-pop'); beep(120, 0.3, 'sawtooth', 0.12); buzz([60, 30, 60]);
        pct.textContent = '💥 فقعت!';
        var r = { popped: true, ms: api.now() - t0 };
        setTimeout(function () { api.finish(G.balloon.score(r), G.balloon.label(r)); }, 700);
      }
      api.timer(15, function () { if (over) return; over = true; var r = { popped: false, size: size }; api.finish(G.balloon.score(r), G.balloon.label(r)); });
      api.loop(function () {
        if (over) return false;
        var t = api.now(), dt = Math.min(0.05, (t - last) / 1000); last = t;
        if (api.mic) {
          var lv = api.mic.level();
          if (t - t0 < 350) { calib.push(lv); base = calib.reduce(function (a, v) { return a + v; }, 0) / calib.length; thr = Math.max(0.1, base * 4); }
          else if (lv > thr) size += Math.min(38, (lv - thr) * 130) * dt;
        }
        size = Math.max(0, size - 2.2 * dt);
        if (size >= 100) { size = 100; draw(); pop(); return false; }
        draw();
      });
    }
  };

  G.candles = {
    name: 'طفّي الشمع', emoji: '🕯️', dur: 15, needs: 'mic', color: '#FFC21A',
    hint: 'انفخ عالمايك وطفّي الـ8 شمعات... وانتبه، في شمعات بترجع تولع!',
    label: function (r) { return r.all ? 'طفّاهم بـ ' + sec(r.ms) + 'ث' : 'طفّى ' + r.out + ' من 8'; },
    score: function (r) { return r.all ? 100000 - r.ms : r.out * 1000; },
    bot: function () { return R() < 0.6 ? { all: true, ms: rand(3500, 12000) } : { all: false, out: ri(3, 7) }; },
    start: function (api) {
      var b = api.body, N = 8;
      var html = '<div class="g-center"><div class="cd-row" id="cd">';
      for (var i = 0; i < N; i++) html += '<div class="cd" data-i="' + i + '"><span class="cd-fl">🔥</span><span class="cd-body"></span></div>';
      html += '</div><div class="g-big" id="cdn">0 / 8</div><div class="g-sub">' + (api.mic ? 'انفخ عالمايك! 💨' : 'اضغط ضل ماسك عالزر لتنفخ') + '</div>' +
        (api.mic ? '' : '<button class="g-pad g-pump" id="hold">💨 انفخ (ضل ماسك)</button>') + '</div>';
      b.innerHTML = html;
      var nodes = b.querySelectorAll('.cd'), cnt = b.querySelector('#cdn');
      var lit = [], hp = 1, holding = false, over = false, t0 = api.now(), last = t0, nextRelight = t0 + rand(1600, 2600);
      var base = 0.02, calib = [], thr = 0.12;
      for (i = 0; i < N; i++) lit.push(true);
      if (!api.mic) {
        var hb = b.querySelector('#hold');
        hb.addEventListener('pointerdown', function (e) { e.preventDefault(); holding = true; });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { hb.addEventListener(ev, function () { holding = false; }); });
      }
      function outCount() { return lit.filter(function (x) { return !x; }).length; }
      function render() {
        var act = lit.indexOf(true);
        nodes.forEach(function (n, k) {
          n.classList.toggle('off', !lit[k]);
          n.classList.toggle('act', k === act);
          var fl = n.querySelector('.cd-fl');
          fl.style.transform = k === act ? 'scale(' + (0.35 + hp * 0.65).toFixed(2) + ')' : '';
        });
        cnt.textContent = outCount() + ' / 8';
      }
      function done(all) {
        if (over) return; over = true;
        var r = all ? { all: true, ms: api.now() - t0 } : { all: false, out: outCount() };
        if (all) { cnt.textContent = '🎉 كلهن انطفوا'; beep(660, 0.2, 'triangle', 0.08); }
        setTimeout(function () { api.finish(G.candles.score(r), G.candles.label(r)); }, all ? 600 : 0);
      }
      api.timer(15, function () { done(false); });
      render();
      api.loop(function () {
        if (over) return false;
        var t = api.now(), dt = Math.min(0.05, (t - last) / 1000); last = t;
        var blowing = false;
        if (api.mic) {
          var lv = api.mic.level();
          if (t - t0 < 350) { calib.push(lv); base = calib.reduce(function (a, v) { return a + v; }, 0) / calib.length; thr = Math.max(0.1, base * 4); }
          else blowing = lv > thr;
        } else blowing = holding;
        var act = lit.indexOf(true);
        if (act < 0) { done(true); return false; }
        if (blowing) hp -= (api.mic ? 4 : 3) * dt; else hp = Math.min(1, hp + 1.5 * dt);
        if (hp <= 0) { lit[act] = false; hp = 1; beep(200, 0.08, 'triangle', 0.04); buzz(15); if (lit.indexOf(true) < 0) { render(); done(true); return false; } }
        if (t > nextRelight) {
          nextRelight = t + rand(1600, 2600);
          var outs = []; lit.forEach(function (x, k) { if (!x) outs.push(k); });
          if (outs.length && outs.length < N && R() < 0.55) { lit[outs[ri(0, outs.length - 1)]] = true; beep(880, 0.06, 'square', 0.03); }
        }
        render();
      });
    }
  };

  function genMaze() {
    var C = 5, Rw = 7, W = 320, H = 440, cw = W / C, ch = H / Rw, T = 10, i, j;
    var east = [], south = [], seen = [];
    for (i = 0; i < Rw; i++) { east.push([]); south.push([]); seen.push([]); for (j = 0; j < C; j++) { east[i].push(true); south[i].push(true); seen[i].push(false); } }
    var stack = [[0, C - 1]]; seen[0][C - 1] = true;
    while (stack.length) {
      var cur = stack[stack.length - 1], r = cur[0], c = cur[1], nb = [];
      if (r > 0 && !seen[r - 1][c]) nb.push([r - 1, c]);
      if (r < Rw - 1 && !seen[r + 1][c]) nb.push([r + 1, c]);
      if (c > 0 && !seen[r][c - 1]) nb.push([r, c - 1]);
      if (c < C - 1 && !seen[r][c + 1]) nb.push([r, c + 1]);
      if (!nb.length) { stack.pop(); continue; }
      var n = nb[Math.floor(R() * nb.length)];
      if (n[0] === r) east[r][Math.min(c, n[1])] = false; else south[Math.min(r, n[0])][c] = false;
      seen[n[0]][n[1]] = true; stack.push(n);
    }
    // فتحات إضافية لتسهيلها شوي
    for (i = 0; i < Rw; i++) for (j = 0; j < C; j++) { if (R() < 0.18) east[i][j] = false; if (R() < 0.12) south[i][j] = false; }
    var walls = [];
    for (i = 0; i < Rw; i++) for (j = 0; j < C; j++) {
      if (east[i][j] && j < C - 1) walls.push([(j + 1) * cw - T / 2, i * ch - (i ? T / 2 : 0), T, ch + (i ? T / 2 : 0) + (i < Rw - 1 ? T / 2 : 0)]);
      if (south[i][j] && i < Rw - 1) walls.push([j * cw - (j ? T / 2 : 0), (i + 1) * ch - T / 2, cw + (j ? T / 2 : 0) + (j < C - 1 ? T / 2 : 0), T]);
    }
    return { start: [W - cw / 2, ch / 2], hole: [cw / 2, H - ch / 2], walls: walls };
  }

  G.maze = {
    name: 'المتاهة', emoji: '🔮', dur: 30, needs: 'tilt', color: '#8A5CFF',
    hint: 'ميّل الموبايل ودحرج الكرة للحفرة. ما في حركة؟ اضغط بإصبعك بالمكان اللي بدك الكرة تروحلو.',
    label: function (r) { return r.reached ? 'وصل بـ ' + sec(r.ms) + 'ث' : 'قرّب ' + Math.round(r.prog) + '%'; },
    score: function (r) { return r.reached ? 100000 - r.ms : r.prog * 5; },
    bot: function () { return R() < 0.55 ? { reached: true, ms: rand(7000, 26000) } : { reached: false, prog: rand(30, 90) }; },
    start: function (api) {
      var W = 320, H = 440, R = 11;
      var m = genMaze();
      api.body.innerHTML = '<div class="g-center"><canvas class="mz" id="mz" width="' + W * 2 + '" height="' + H * 2 + '"></canvas><div class="g-sub" id="mzh">' + (api.tilt ? 'ميّل الموبايل 📱' : 'اضغط بإصبعك وين بدك الكرة تروح 👆') + '</div></div>';
      var cv = api.body.querySelector('#mz'), cx = cv.getContext('2d');
      var css = getComputedStyle(document.documentElement);
      var ink = '#16211B', wallC = '#2F6BFF', ballC = '#FF4B3E', holeC = '#16211B', bg = '#FFF4D6';
      var x = m.start[0], y = m.start[1], vx = 0, vy = 0, over = false, t0 = api.now(), last = t0;
      var startDist = Math.hypot(m.hole[0] - x, m.hole[1] - y);
      var touch = null;
      function pos(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
      cv.addEventListener('pointerdown', function (e) { e.preventDefault(); touch = pos(e); try { cv.setPointerCapture(e.pointerId); } catch (er) { } });
      cv.addEventListener('pointermove', function (e) { if (touch) touch = pos(e); });
      ['pointerup', 'pointercancel'].forEach(function (ev) { cv.addEventListener(ev, function () { touch = null; }); });
      function hit(px, py) {
        if (px < R || px > W - R || py < R || py > H - R) return true;
        for (var i = 0; i < m.walls.length; i++) {
          var w = m.walls[i];
          if (px + R > w[0] && px - R < w[0] + w[2] && py + R > w[1] && py - R < w[1] + w[3]) return true;
        }
        return false;
      }
      function draw() {
        cx.setTransform(2, 0, 0, 2, 0, 0);
        cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
        cx.strokeStyle = ink; cx.lineWidth = 4; cx.strokeRect(2, 2, W - 4, H - 4);
        m.walls.forEach(function (w) { cx.fillStyle = ink; cx.fillRect(w[0] + 3, w[1] + 3, w[2], w[3]); cx.fillStyle = wallC; cx.fillRect(w[0], w[1], w[2], w[3]); cx.strokeStyle = ink; cx.lineWidth = 2.5; cx.strokeRect(w[0], w[1], w[2], w[3]); });
        cx.beginPath(); cx.arc(m.hole[0], m.hole[1], 17, 0, Math.PI * 2); cx.fillStyle = holeC; cx.fill();
        cx.font = '16px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; 
        cx.beginPath(); cx.arc(x + 2, y + 3, R, 0, Math.PI * 2); cx.fillStyle = ink; cx.fill();
        cx.beginPath(); cx.arc(x, y, R, 0, Math.PI * 2); cx.fillStyle = ballC; cx.fill(); cx.lineWidth = 2.5; cx.strokeStyle = ink; cx.stroke();
        cx.beginPath(); cx.arc(x - 3, y - 4, 3, 0, Math.PI * 2); cx.fillStyle = '#fff'; cx.fill();
      }
      function end(reached) {
        if (over) return; over = true;
        var r = reached ? { reached: true, ms: api.now() - t0 } : { reached: false, prog: clamp((1 - Math.hypot(m.hole[0] - x, m.hole[1] - y) / startDist) * 100, 0, 99) };
        if (reached) { beep(700, 0.25, 'triangle', 0.08); buzz(80); }
        setTimeout(function () { api.finish(G.maze.score(r), G.maze.label(r)); }, reached ? 500 : 0);
      }
      api.timer(30, function () { end(false); });
      api.loop(function () {
        if (over) return false;
        var t = api.now(), dt = Math.min(0.033, (t - last) / 1000); last = t;
        var ax = 0, ay = 0;
        if (api.tilt && api.tilt.st.ok) {
          ax += clamp((api.tilt.st.g - api.tilt.st.g0) / 22, -1, 1) * 950;
          ay += clamp((api.tilt.st.b - api.tilt.st.b0) / 22, -1, 1) * 950;
        }
        if (touch) {
          var dx = touch[0] - x, dy = touch[1] - y, d = Math.hypot(dx, dy) || 1, k = Math.min(d, 90) / 90;
          ax += dx / d * 950 * k; ay += dy / d * 950 * k;
        }
        vx = (vx + ax * dt) * 0.985; vy = (vy + ay * dt) * 0.985;
        var sp = Math.hypot(vx, vy), mx = 420; if (sp > mx) { vx = vx / sp * mx; vy = vy / sp * mx; }
        var nx = x + vx * dt; if (hit(nx, y)) { vx = -vx * 0.35; } else x = nx;
        var ny = y + vy * dt; if (hit(x, ny)) { vy = -vy * 0.35; } else y = ny;
        draw();
        if (Math.hypot(m.hole[0] - x, m.hole[1] - y) < 13) { end(true); return false; }
      });
    }
  };

  G.ten = {
    name: '10 ثواني بالضبط', emoji: '⏱️', dur: 14, needs: '', color: '#2F6BFF',
    hint: 'العداد بيختفي بعد 3 ثواني. اكبس لما تحس إنو وصلنا 10 بالضبط.',
    label: function (r) { if (r.none) return 'ما كبس'; var a = Math.abs(r.err); if (a < 0.01) return 'بالضبط! 🎯'; return (r.err < 0 ? 'بكّر ' : 'تأخّر ') + a.toFixed(2) + 'ث'; },
    score: function (r) { return r.none ? -20000 : -Math.round(Math.abs(r.err) * 1000); },
    bot: function () { var e = rand(-1.3, 1.3) * R(); return { err: e }; },
    start: function (api) {
      api.body.innerHTML = '<div class="g-center"><div class="tn-clock" id="tn">0.00</div><div class="g-sub" id="tnh">العداد شغّال...</div><button class="g-pad g-tap tn-btn" id="tb">اكبس عـ10 ⏱️</button></div>';
      var tn = api.body.querySelector('#tn'), hh = api.body.querySelector('#tnh'), t0 = api.now(), over = false;
      function end(r) {
        if (over) return; over = true;
        if (!r.none) { tn.textContent = (10 + r.err).toFixed(2); tn.classList.add('tn-show'); hh.textContent = G.ten.label(r); }
        beep(520, 0.15, 'triangle', 0.08); buzz(40);
        setTimeout(function () { api.finish(G.ten.score(r), G.ten.label(r)); }, 1100);
      }
      api.body.querySelector('#tb').addEventListener('pointerdown', function (e) { e.preventDefault(); if (!over) end({ err: (api.now() - t0) / 1000 - 10 }); });
      api.timer(20, function () { end({ none: true }); }, true);
      api.loop(function () {
        if (over) return false;
        var t = (api.now() - t0) / 1000;
        if (t < 3) tn.textContent = t.toFixed(2);
        else { tn.textContent = '?.??'; tn.classList.add('tn-hide'); hh.textContent = 'عدّ براسك... 🤫'; }
      });
    }
  };

  G.green = {
    name: 'الضو الأخضر', emoji: '🚦', dur: 15, needs: '', color: '#22C17A',
    hint: 'الشاشة بتتلوّن. اكبس بس لما تصير خضرا 🟩. أي لون تاني بينقّصلك.',
    label: function (r) { return r.hits + ' صح · ' + r.wrong + ' غلط'; },
    score: function (r) { return r.hits * 1000 - r.wrong * 1200 - Math.round((r.rt || 600) / 10); },
    bot: function () { return { hits: ri(3, 9), wrong: ri(0, 3), rt: rand(280, 600) }; },
    start: function (api) {
      var cols = [{ c: '#22C17A', g: 1 }, { c: '#FF4B3E' }, { c: '#2F6BFF' }, { c: '#FFC21A' }, { c: '#FF7EC0' }];
      api.body.innerHTML = '<div class="gr-field" id="gf"><div class="gr-msg" id="gm"></div></div><div class="g-row"><span id="gh">✔ 0</span><span id="gw">✖ 0</span></div>';
      var gf = api.body.querySelector('#gf'), gm = api.body.querySelector('#gm');
      var hits = 0, wrong = 0, rts = [], cur = null, shownAt = 0, tapped = false, over = false, nextAt = api.now() + 500, lastWasGreen = false;
      function show() {
        var isG = !lastWasGreen && R() < 0.36;
        cur = isG ? cols[0] : cols[ri(1, cols.length - 1)];
        lastWasGreen = isG;
        gf.style.background = cur.c; gm.textContent = '';
        shownAt = api.now(); tapped = false;
        nextAt = shownAt + rand(550, 900);
      }
      function blank() { cur = null; gf.style.background = ''; gm.textContent = ''; nextAt = api.now() + 130; }
      gf.addEventListener('pointerdown', function (e) {
        e.preventDefault(); if (over) return;
        if (cur && cur.g && !tapped) { tapped = true; hits++; rts.push(api.now() - shownAt); beep(880, 0.06, 'square', 0.04); gm.textContent = '✔'; buzz(10); }
        else { wrong++; beep(140, 0.12, 'sawtooth', 0.06); buzz(60); gf.classList.remove('shake'); void gf.offsetWidth; gf.classList.add('shake'); }
        api.body.querySelector('#gh').textContent = '✔ ' + hits; api.body.querySelector('#gw').textContent = '✖ ' + wrong;
      });
      api.timer(15, function () {
        over = true;
        var r = { hits: hits, wrong: wrong, rt: rts.length ? rts.reduce(function (a, v) { return a + v; }, 0) / rts.length : 900 };
        api.finish(G.green.score(r), G.green.label(r));
      });
      api.loop(function () {
        if (over) return false;
        if (api.now() >= nextAt) { if (cur) blank(); else show(); }
      });
    }
  };

  G.fly = {
    name: 'اصطاد الدبّانة', emoji: '🪰', dur: 10, needs: '', color: '#7FA100',
    hint: 'دبّانة عم تطير بالشاشة. اكبس عليها. كم وحدة بتصطاد بـ10 ثواني؟',
    label: function (r) { return 'صاد ' + plural(r.n, 'دبّانة وحدة', 'دبّانتين', 'دبّانات', 'دبّانة'); },
    score: function (r) { return r.n * 1000; },
    bot: function () { return { n: ri(3, 12) }; },
    start: function (api) {
      api.body.innerHTML = '<div class="fl-field" id="ff"><div class="fl" id="fly">🪰</div></div><div class="g-row"><span id="fn">🪰 0</span></div>';
      var ff = api.body.querySelector('#ff'), fly = api.body.querySelector('#fly');
      var W = ff.clientWidth, H = ff.clientHeight, x = W / 2, y = H / 2, tx = x, ty = y, sp = 160, n = 0, over = false, last = api.now();
      function target() { tx = rand(30, W - 30); ty = rand(30, H - 30); }
      target();
      ff.addEventListener('pointerdown', function (e) {
        e.preventDefault(); if (over) return;
        var r = ff.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        if (Math.hypot(px - x, py - y) < 42) {
          n++; sp += 28; beep(500 + n * 40, 0.07, 'square', 0.05); buzz(20);
          var sp2 = el('div', 'fl-splat', '💥'); sp2.style.left = x + 'px'; sp2.style.top = y + 'px'; ff.appendChild(sp2); setTimeout(function () { sp2.remove(); }, 450);
          var side = ri(0, 3); x = side === 0 ? 10 : side === 1 ? W - 10 : rand(20, W - 20); y = side === 2 ? 10 : side === 3 ? H - 10 : rand(20, H - 20);
          target();
          api.body.querySelector('#fn').textContent = '🪰 ' + n;
        }
      });
      api.timer(10, function () { over = true; api.finish(G.fly.score({ n: n }), G.fly.label({ n: n })); });
      api.loop(function () {
        if (over) return false;
        W = ff.clientWidth; H = ff.clientHeight;
        var t = api.now(), dt = Math.min(0.05, (t - last) / 1000); last = t;
        var dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy);
        if (d < 8) target(); else { x += dx / d * sp * dt; y += dy / d * sp * dt; }
        fly.style.transform = 'translate(' + (x - 22) + 'px,' + (y - 22) + 'px) rotate(' + (Math.atan2(dy, dx) * 57 + 90).toFixed(0) + 'deg)';
      });
    }
  };

  G.tap = {
    name: 'الطابع الأسرع', emoji: '👆', dur: 10, needs: '', color: '#FF7EC0',
    hint: 'اكبس اكبس اكبس... كم كبسة بتعمل بـ10 ثواني؟',
    label: function (r) { return r.n + ' كبسة'; },
    score: function (r) { return r.n; },
    bot: function () { return { n: ri(45, 95) }; },
    start: function (api) {
      api.body.innerHTML = '<div class="g-center"><div class="g-big tp-n" id="tn">0</div><button class="g-pad tp-btn" id="tb">اكبس!</button></div>';
      var n = 0, over = false, tn = api.body.querySelector('#tn'), btn = api.body.querySelector('#tb');
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault(); if (over) return; n++; tn.textContent = n; if (n % 10 === 0) beep(400 + n * 4, 0.04, 'square', 0.03);
        btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
      });
      api.timer(10, function () { over = true; api.finish(G.tap.score({ n: n }), G.tap.label({ n: n })); });
    }
  };

  G.circle = {
    name: 'الدائرة الكاملة', emoji: '⭕', dur: 15, needs: '', color: '#FF8A1F',
    hint: 'ارسم دائرة بإصبعك قد ما فيك كاملة. معك 15 ثانية وبتنحسب أحسن محاولة.',
    label: function (r) { return r.best.toFixed(1) + '%'; },
    score: function (r) { return Math.round(r.best * 10); },
    bot: function () { return { best: rand(68, 97) }; },
    start: function (api) {
      var S = 320;
      api.body.innerHTML = '<div class="g-center"><canvas class="cc" id="cc" width="' + S * 2 + '" height="' + S * 2 + '"></canvas><div class="g-row"><span id="cl">ارسم ⭕</span><span id="cb">أحسن: —</span></div></div>';
      var cv = api.body.querySelector('#cc'), cx = cv.getContext('2d');
      var pts = [], drawing = false, best = 0, over = false;
      function P(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * S, (e.clientY - r.top) / r.height * S]; }
      function clear() {
        cx.setTransform(2, 0, 0, 2, 0, 0); cx.fillStyle = '#FFF4D6'; cx.fillRect(0, 0, S, S);
        cx.fillStyle = '#16211B'; cx.beginPath(); cx.arc(S / 2, S / 2, 4, 0, 7); cx.fill();
      }
      function evalc() {
        if (pts.length < 15) return 0;
        var mx = 0, my = 0; pts.forEach(function (p) { mx += p[0]; my += p[1]; }); mx /= pts.length; my /= pts.length;
        var rs = pts.map(function (p) { return Math.hypot(p[0] - mx, p[1] - my); });
        var R = rs.reduce(function (a, v) { return a + v; }, 0) / rs.length;
        if (R < 35) return 0;
        var dev = rs.reduce(function (a, v) { return a + Math.abs(v - R); }, 0) / rs.length / R;
        var tot = 0, pa = Math.atan2(pts[0][1] - my, pts[0][0] - mx);
        for (var i = 1; i < pts.length; i++) { var a = Math.atan2(pts[i][1] - my, pts[i][0] - mx), d = a - pa; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; tot += d; pa = a; }
        var cov = Math.abs(tot) / (2 * Math.PI);
        var q = 100 * (1 - dev * 4);
        if (cov < 0.92) q *= Math.max(0, cov / 0.92);
        var gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) / R;
        if (gap > 0.45) q -= 12;
        return clamp(q, 0, 100);
      }
      clear();
      cv.addEventListener('pointerdown', function (e) { e.preventDefault(); if (over) return; drawing = true; pts = [P(e)]; clear(); try { cv.setPointerCapture(e.pointerId); } catch (er) { } });
      cv.addEventListener('pointermove', function (e) {
        if (!drawing) return; var p = P(e), l = pts[pts.length - 1]; pts.push(p);
        cx.strokeStyle = '#FF4B3E'; cx.lineWidth = 7; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(l[0], l[1]); cx.lineTo(p[0], p[1]); cx.stroke();
      });
      function up() {
        if (!drawing) return; drawing = false;
        var q = evalc();
        if (q > best) best = q;
        api.body.querySelector('#cl').textContent = q ? q.toFixed(1) + '%' : 'كمّلها دائرة 😅';
        api.body.querySelector('#cb').textContent = 'أحسن: ' + (best ? best.toFixed(1) + '%' : '—');
        if (q > 0) beep(300 + q * 6, 0.1, 'triangle', 0.06);
      }
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      api.timer(15, function () { over = true; if (drawing) up(); api.finish(G.circle.score({ best: best }), G.circle.label({ best: best })); });
    }
  };

  G.stroop = {
    name: 'الألوان الكذابة', emoji: '🎨', dur: 15, needs: '', color: '#E0336F',
    hint: 'بتطلع كلمة لون مكتوبة بلون تاني. اختار لون الخط، مو الكلمة!',
    label: function (r) { return r.c + ' صح · ' + r.w + ' غلط'; },
    score: function (r) { return (r.c - r.w) * 1000 + r.c; },
    bot: function () { return { c: ri(8, 18), w: ri(0, 4) }; },
    start: function (api) {
      var C = [{ n: 'أحمر', c: '#FF3B30' }, { n: 'أزرق', c: '#2F6BFF' }, { n: 'أخضر', c: '#1FB86B' }, { n: 'أصفر', c: '#F5B800' }];
      var h = '<div class="g-center"><div class="st-word" id="sw"></div><div class="st-btns">';
      C.forEach(function (o, i) { h += '<button class="g-pad st-b" data-i="' + i + '" style="background:' + o.c + '" aria-label="' + o.n + '"></button>'; });
      h += '</div><div class="g-row"><span id="sc">✔ 0</span><span id="sx">✖ 0</span></div></div>';
      api.body.innerHTML = h;
      var sw = api.body.querySelector('#sw'), ink = 0, c = 0, w = 0, over = false;
      function next() {
        var word = ri(0, 3); ink = word;
        if (R() < 0.78) { while (ink === word) ink = ri(0, 3); }
        sw.textContent = C[word].n; sw.style.color = C[ink].c;
        sw.classList.remove('pop'); void sw.offsetWidth; sw.classList.add('pop');
      }
      api.body.querySelectorAll('.st-b').forEach(function (b) {
        b.addEventListener('pointerdown', function (e) {
          e.preventDefault(); if (over) return;
          if (+b.dataset.i === ink) { c++; beep(760, 0.05, 'square', 0.04); } else { w++; beep(150, 0.12, 'sawtooth', 0.06); buzz(50); }
          api.body.querySelector('#sc').textContent = '✔ ' + c; api.body.querySelector('#sx').textContent = '✖ ' + w;
          next();
        });
      });
      next();
      api.timer(15, function () { over = true; api.finish(G.stroop.score({ c: c, w: w }), G.stroop.label({ c: c, w: w })); });
    }
  };

  G.simon = {
    name: 'احفظ الترتيب', emoji: '🧠', dur: 600, needs: '', color: '#00B5C7',
    hint: 'الأزرار بتضوي بترتيب، عيدو متلو. كل مرة بيزيد واحد، وبتضل تلعب لحد أول غلطة.',
    label: function (r) { return r.len ? 'حفظ ' + r.len + ' بالترتيب' : 'ما حفظ شي'; },
    score: function (r) { return r.len * 1000; },
    bot: function () { return { len: ri(3, 10) }; },
    start: function (api) {
      var cols = ['#FF4B3E', '#2F6BFF', '#FFC21A', '#22C17A'], tones = [330, 392, 494, 587];
      var h = '<div class="g-center"><div class="g-sub" id="sh">ركّز... 👀</div><div class="sm-grid">';
      cols.forEach(function (c, i) { h += '<button class="sm-p" data-i="' + i + '" style="background:' + c + '"></button>'; });
      h += '</div><div class="g-big" id="sl">0</div></div>';
      api.body.innerHTML = h;
      var pads = api.body.querySelectorAll('.sm-p'), sh = api.body.querySelector('#sh'), sl = api.body.querySelector('#sl');
      var seq = [], inp = 0, listening = false, best = 0, over = false;
      function flash(i, ms) { pads[i].classList.add('lit'); beep(tones[i], ms / 1000, 'triangle', 0.07); setTimeout(function () { pads[i].classList.remove('lit'); }, ms); }
      function play() {
        listening = false; sh.textContent = 'ركّز... 👀';
        if (!seq.length) { seq = [ri(0, 3), ri(0, 3)]; }
        seq.push(ri(0, 3));
        var sp = Math.max(260, 470 - seq.length * 18), k = 0;
        (function step() {
          if (over) return;
          if (k >= seq.length) { listening = true; inp = 0; sh.textContent = 'دورك! 👆'; return; }
          flash(seq[k], sp); k++; setTimeout(step, sp + 160);
        })();
      }
      function end() { if (over) return; over = true; api.finish(G.simon.score({ len: best }), G.simon.label({ len: best })); }
      pads.forEach(function (p) {
        p.addEventListener('pointerdown', function (e) {
          e.preventDefault(); if (!listening || over) return;
          var i = +p.dataset.i; flash(i, 160);
          if (i !== seq[inp]) { listening = false; sh.textContent = '❌ غلط!'; buzz(120); beep(120, 0.3, 'sawtooth', 0.08); setTimeout(end, 700); return; }
          inp++;
          if (inp >= seq.length) { best = seq.length; sl.textContent = best; listening = false; sh.textContent = '✔ برافو'; setTimeout(play, 600); }
        });
      });
      api.timer(600, end, true);
      setTimeout(play, 400);
    }
  };

  G.dots = {
    name: 'عدّ النقاط', emoji: '🔢', dur: 60, needs: '', color: '#C2562B',
    hint: 'النقاط بتطلع لحظة وبتختفي. قدّر كم وحدة كانت. 4 مرات، والأقل غلط بيربح.',
    label: function (r) { return r.err === 0 ? 'كلهن صح 🎯' : 'غلط بـ ' + r.err + ' بالمجموع'; },
    score: function (r) { return -r.err; },
    bot: function () { return { err: ri(2, 30) }; },
    start: function (api) {
      var S = 300, ROUNDS = 4;
      api.body.innerHTML = '<div class="g-center"><div class="g-sub" id="dh">جولة 1 من 4</div><div class="dt-rb" id="rb" hidden></div><canvas class="dt" id="dc" width="' + S * 2 + '" height="' + S * 2 + '"></canvas>' +
        '<div class="dt-in" id="di" hidden><div class="dt-val" id="dv">؟</div><div class="dt-keys" id="dk"></div></div></div>';
      var cv = api.body.querySelector('#dc'), cx = cv.getContext('2d'), di = api.body.querySelector('#di'), dv = api.body.querySelector('#dv'), dh = api.body.querySelector('#dh'), rb = api.body.querySelector('#rb');
      var round = 0, N = 0, val = '', err = 0, over = false;
      var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✔'];
      var dk = api.body.querySelector('#dk');
      keys.forEach(function (k) { var b = el('button', 'dt-k' + (k === '✔' ? ' ok' : ''), k); b.addEventListener('pointerdown', function (e) { e.preventDefault(); key(k); }); dk.appendChild(b); });
      function key(k) {
        if (over || di.hidden) return;
        if (k === '⌫') val = val.slice(0, -1);
        else if (k === '✔') { if (!val) return; submit(); return; }
        else if (val.length < 3) val += k;
        dv.textContent = val || '؟';
      }
      function paint(show) {
        cx.setTransform(2, 0, 0, 2, 0, 0); cx.fillStyle = '#FFF4D6'; cx.fillRect(0, 0, S, S);
        if (!show) { cx.fillStyle = '#16211B'; cx.font = '700 54px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('?', S / 2, S / 2); return; }
        var placed = [], tries = 0, cs = ['#FF4B3E', '#2F6BFF', '#16211B', '#22C17A'];
        while (placed.length < N && tries < 4000) {
          tries++; var x = rand(16, S - 16), y = rand(16, S - 16), ok = true;
          for (var i = 0; i < placed.length; i++) if (Math.hypot(placed[i][0] - x, placed[i][1] - y) < 22) { ok = false; break; }
          if (ok) placed.push([x, y]);
        }
        N = placed.length;
        placed.forEach(function (p, i) { cx.beginPath(); cx.arc(p[0], p[1], 8, 0, 7); cx.fillStyle = cs[i % cs.length]; cx.fill(); });
      }
      function next() {
        if (round >= ROUNDS) return finish();
        round++; N = ri(10 + round * 3, 22 + round * 6);
        di.hidden = true; cv.hidden = true; val = ''; dv.textContent = '؟';
        rb.hidden = false; rb.innerHTML = '<div class="dt-rn">' + round + ' / ' + ROUNDS + '</div><div class="g-sub">جولة ' + ['', 'أولى', 'تانية', 'تالتة', 'رابعة'][round] + '... ركّز 👀</div>';
        var n = 3;
        (function cd() {
          if (over) return;
          if (n > 0) { dh.textContent = 'بعد ' + n; n--; beep(440, 0.06, 'square', 0.03); setTimeout(cd, 550); return; }
          rb.hidden = true; cv.hidden = false; dh.textContent = 'جولة ' + round + ' من ' + ROUNDS;
          paint(true); beep(700, 0.06, 'square', 0.04);
          setTimeout(function () { if (over) return; paint(false); cv.hidden = true; di.hidden = false; dh.textContent = 'كم نقطة كانت؟'; }, 900);
        })();
      }
      function submit() {
        var g = parseInt(val, 10) || 0, e = Math.abs(g - N); err += e;
        di.hidden = true; cv.hidden = true; rb.hidden = false;
        rb.innerHTML = '<div class="dt-rn">' + (e === 0 ? '🎯' : N) + '</div><div class="g-sub">' + (e === 0 ? 'بالضبط! كانوا ' + N : 'كانوا ' + N + '، وانت قلت ' + g) + '</div>' +
          (round < ROUNDS ? '<button class="btn" id="dnx">الجولة الجاية ▶</button>' : '<button class="btn" id="dnx">خلّصت ✔</button>');
        dh.textContent = 'جولة ' + round + ' من ' + ROUNDS;
        rb.querySelector('#dnx').addEventListener('click', next);
      }
      function finish() { if (over) return; over = true; api.finish(G.dots.score({ err: err }), G.dots.label({ err: err })); }
      api.timer(60, function () { if (over) return; if (!di.hidden && val) { var g = parseInt(val, 10) || 0; err += Math.abs(g - N); round++; } err += (ROUNDS - round) * 15; finish(); });
      next();
    }
  };

  var PAIRS = [['😀', '😃'], ['🐻', '🐨'], ['🍊', '🍑'], ['🌕', '🌝'], ['⭐', '🌟'], ['🚗', '🚙'], ['🌲', '🌳'], ['🍎', '🍅'], ['🐸', '🐢'], ['🙂', '🙃'], ['🔵', '🟣'], ['🐶', '🐱'], ['🍋', '🍌'], ['☕', '🍵'], ['🎈', '🏮'], ['🥒', '🌶️']];
  G.odd = {
    name: 'مين الغريب', emoji: '🔍', dur: 15, needs: '', color: '#4657C9',
    hint: 'كل الأشكال متشابهة إلا واحد. لاقيه بأسرع ما فيك، وكل مرة بتكبر الشبكة.',
    label: function (r) { return 'لقى ' + r.n; },
    score: function (r) { return r.n * 1000; },
    bot: function () { return { n: ri(4, 12) }; },
    start: function (api) {
      api.body.innerHTML = '<div class="g-center"><div class="od-grid" id="og"></div><div class="g-row"><span id="on">🔍 0</span></div></div>';
      var og = api.body.querySelector('#og'), n = 0, over = false, sizes = [3, 4, 4, 5, 5, 6, 6, 6, 7, 7, 7, 7];
      function level() {
        var s = sizes[Math.min(n, sizes.length - 1)], pr = PAIRS[ri(0, PAIRS.length - 1)].slice();
        if (R() < 0.5) pr.reverse();
        var odd = ri(0, s * s - 1);
        og.style.gridTemplateColumns = 'repeat(' + s + ',1fr)';
        og.innerHTML = '';
        for (var i = 0; i < s * s; i++) {
          var b = el('button', 'od-c', i === odd ? pr[1] : pr[0]);
          b.style.fontSize = (s > 5 ? 22 : s > 4 ? 26 : 32) + 'px';
          (function (isOdd, btn) {
            btn.addEventListener('pointerdown', function (e) {
              e.preventDefault(); if (over) return;
              if (isOdd) { n++; beep(700 + n * 30, 0.06, 'square', 0.04); api.body.querySelector('#on').textContent = '🔍 ' + n; level(); }
              else { btn.classList.add('no'); buzz(40); beep(150, 0.08, 'sawtooth', 0.04); }
            });
          })(i === odd, b);
          og.appendChild(b);
        }
      }
      level();
      api.timer(15, function () { over = true; api.finish(G.odd.score({ n: n }), G.odd.label({ n: n })); });
    }
  };

  /* ---------- المشغّل ---------- */
  // run(id, host, onDone, opts) → controller { begin(startAt, nowFn), info(html), stop() }
  // opts: { seed, onReady(), hostTools: html أو null, onHostTool(action) }
  function run(id, host, onDone, opts) {
    opts = opts || {};
    var g = G[id]; if (!g) return { begin: function () { }, info: function () { }, stop: function () { } };
    var live = true, timers = [], raf = 0, mic = null, tilt = null, finished = false, prepared = null, started = false, beginAt = 0, nowFn = null;
    host.innerHTML = '';
    var wrap = el('div', 'g-wrap');
    wrap.style.setProperty('--gc', g.color);
    var head = el('div', 'g-head', '<div class="g-title"><span>' + g.emoji + '</span>' + g.name + '</div><div class="g-time" id="gt"></div>');
    var bar = el('div', 'g-bar', '<i id="gbar"></i>');
    var body = el('div', 'g-body');
    wrap.appendChild(head); wrap.appendChild(bar); wrap.appendChild(body);
    host.appendChild(wrap);

    function cleanup() {
      live = false; cancelAnimationFrame(raf);
      timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
      if (mic) mic.stop(); if (tilt) tilt.stop();
    }
    var api = {
      body: body,
      now: function () { return performance.now(); },
      mic: null, tilt: null,
      finish: function (score, label) {
        if (finished) return; finished = true;
        cleanup();
        body.innerHTML = '<div class="g-center g-done"><div class="g-done-e">' + g.emoji + '</div><div class="g-big">' + label + '</div><div class="g-sub">انبعتت نتيجتك ✔</div></div>';
        beep(523, 0.1, 'triangle', 0.06); setTimeout(function () { beep(784, 0.15, 'triangle', 0.06); }, 110);
        onDone(score, label);
      },
      timer: function (sx, cb, hidden) {
        var t0 = performance.now(), gt = head.querySelector('#gt'), gb = bar.querySelector('#gbar');
        if (hidden) { gt.textContent = ''; bar.style.visibility = 'hidden'; }
        var iv = setInterval(function () {
          if (!live) return clearInterval(iv);
          var left = Math.max(0, sx - (performance.now() - t0) / 1000);
          if (!hidden) { gt.textContent = Math.ceil(left); gb.style.width = (left / sx * 100) + '%'; }
          if (left <= 0) { clearInterval(iv); cb(); }
        }, 100);
        timers.push(iv);
      },
      loop: function (fn) {
        function f() { if (!live) return; if (fn() === false) return; raf = requestAnimationFrame(f); }
        raf = requestAnimationFrame(f);
      }
    };

    function prep() {
      if (prepared) return prepared;
      audio();
      prepared = g.needs === 'mic' ? getMic().then(function (m) { mic = m; api.mic = m; })
        : g.needs === 'tilt' ? getTilt().then(function (t) { tilt = t; api.tilt = t; }) : Promise.resolve();
      return prepared;
    }

    body.innerHTML = '<div class="g-center g-ready"><div class="g-ready-e">' + g.emoji + '</div><div class="g-hint">' + g.hint + '</div>' +
      (g.needs === 'mic' ? '<div class="g-note">🎤 رح نطلب إذن المايك</div>' : g.needs === 'tilt' ? '<div class="g-note">📱 رح نطلب إذن حساس الحركة</div>' : '') +
      '<button class="btn btn-go" id="go">جاهز ✋</button><div class="g-wait" id="gw"></div><div id="gh"></div></div>';
    var info = '', toolsHtml = '';
    function paintWait() {
      var gw = body.querySelector('#gw'), gh = body.querySelector('#gh');
      if (gw) gw.innerHTML = info;
      if (gh) gh.innerHTML = toolsHtml;
    }
    body.addEventListener('click', function (e) {
      var t = e.target.closest('[data-gt]');
      if (t && opts.onHostTool) opts.onHostTool(t.dataset.gt);
    });
    body.querySelector('#go').addEventListener('click', function () {
      var b = this; b.disabled = true; b.textContent = 'لحظة...';
      prep().then(function () {
        if (!live || started) return;
        b.textContent = 'جاهز ✔';
        b.classList.add('is-ready');
        if (opts.onReady) opts.onReady();
      });
    });

    function countdown() {
      if (started || !live) return;
      started = true;
      body.innerHTML = '<div class="g-center"><div class="g-sub">كلكن مع بعض!</div><div class="g-count" id="gc">3</div></div>';
      var gc = body.querySelector('#gc'), last = null;
      var go = function () { if (!live) return; beep(880, 0.2, 'square', 0.06); body.innerHTML = ''; R = opts.seed ? mulberry(opts.seed) : Math.random; g.start(api); };
      var startIt = function () {
        var ready = prepared || (g.needs === 'tilt' ? Promise.resolve() : prep());
        ready.then(function () {
          (function tick() {
            if (!live) return;
            var left = beginAt - nowFn();
            if (left <= 0) { go(); return; }
            var n = Math.min(3, Math.ceil(left / 1000));
            if (n !== last) { last = n; gc.textContent = n; gc.classList.remove('pulse'); void gc.offsetWidth; gc.classList.add('pulse'); beep(440, 0.12, 'square', 0.05); buzz(25); }
            timers.push(setTimeout(tick, Math.min(50, left)));
          })();
        });
      };
      startIt();
    }

    return {
      begin: function (startAt, fn) { if (!live || started) return; beginAt = startAt; nowFn = fn; countdown(); },
      info: function (html, tools) { info = html || ''; toolsHtml = tools || ''; if (!started) paintWait(); },
      seed: function (sd) { R = sd ? mulberry(sd) : Math.random; },
      stop: function () { if (!finished) cleanup(); }
    };
  }

  function botResult(id) {
    var g = G[id], keep = R; R = Math.random; var r = g.bot(); R = keep;
    return { score: g.score(r), label: g.label(r) };
  }

  root.MiniGames = { G: G, run: run, bot: botResult, ids: Object.keys(G), genMaze: genMaze };
})(this);
