/* قعدة لعّيبة — صورة الستوري (3 أشكال × فاتح/داكن) */
(function (root) {
  'use strict';
  var W = 1080, H = 1920;
  var FD = '"Marhey", "Baloo Bhaijaan 2", sans-serif';
  var FB = '"Baloo Bhaijaan 2", "Marhey", sans-serif';
  var ONC = '#16211B';

  function loadImg(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src;
    });
  }
  function pal(dark) {
    return dark
      ? { bg: '#151A17', surf: '#222A25', ink: '#FFF1D0', line: '#FFF1D0', shadow: '#000000', muted: '#B9B19B', paper: '#151A17' }
      : { bg: '#FFF4D6', surf: '#FFFFFF', ink: '#16211B', line: '#16211B', shadow: '#16211B', muted: '#5C6B60', paper: '#FFF4D6' };
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function box(c, p, x, y, w, h, fill, r, sh) {
    sh = sh == null ? 14 : sh; r = r == null ? 28 : r;
    if (sh) { rr(c, x + sh, y + sh, w, h, r); c.fillStyle = p.shadow; c.fill(); }
    rr(c, x, y, w, h, r); c.fillStyle = fill; c.fill(); c.lineWidth = 7; c.strokeStyle = p.line; c.stroke();
  }
  function txt(c, s, x, y, font, color, align, maxW) {
    c.font = font; c.fillStyle = color; c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.direction = 'rtl';
    if (maxW) { var size = parseInt(font.match(/(\d+)px/)[1], 10); while (c.measureText(s).width > maxW && size > 24) { size -= 4; c.font = font.replace(/\d+px/, size + 'px'); } }
    c.fillText(s, x, y);
  }
  function photoCircle(c, p, img, cx, cy, r, color, name, sh) {
    sh = sh == null ? 16 : sh;
    c.beginPath(); c.arc(cx + sh, cy + sh, r, 0, 7); c.fillStyle = p.shadow; c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip();
    if (img) { var s = Math.max(2 * r / img.width, 2 * r / img.height); c.drawImage(img, cx - img.width * s / 2, cy - img.height * s / 2, img.width * s, img.height * s); }
    else { c.fillStyle = color; c.fillRect(cx - r, cy - r, 2 * r, 2 * r); txt(c, (name || '؟').trim().charAt(0), cx, cy + r * 0.05, '400 ' + Math.round(r * 0.95) + 'px ' + FD, ONC); }
    c.restore();
    c.beginPath(); c.arc(cx, cy, r, 0, 7); c.lineWidth = Math.max(5, r * 0.04); c.strokeStyle = p.line; c.stroke();
  }
  function photoRect(c, p, img, x, y, w, h) {
    c.save(); rr(c, x, y, w, h, 10); c.clip();
    if (img) { var s = Math.max(w / img.width, h / img.height); c.drawImage(img, x + w / 2 - img.width * s / 2, y + h / 2 - img.height * s / 2, img.width * s, img.height * s); }
    else { c.fillStyle = '#ddd'; c.fillRect(x, y, w, h); }
    c.restore();
    rr(c, x, y, w, h, 10); c.lineWidth = 6; c.strokeStyle = p.line; c.stroke();
  }
  function awning(c, h, colA, colB) {
    var n = 9, sw = W / n;
    for (var i = 0; i < n; i++) {
      c.fillStyle = i % 2 ? colB : colA; c.fillRect(i * sw, 0, sw, h);
      c.beginPath(); c.arc(i * sw + sw / 2, h, sw / 2, 0, Math.PI); c.fill();
    }
    c.lineWidth = 7; c.strokeStyle = ONC;
    c.beginPath(); for (i = 0; i < n; i++) { c.moveTo(i * sw, h); c.arc(i * sw + sw / 2, h, sw / 2, Math.PI, 0, true); } c.stroke();
  }
  function ferris(c, cx, cy, r, ink) {
    var cols = ['#FF4B3E', '#FFC21A', '#2F6BFF', '#22C17A', '#FF7EC0', '#FF8A1F'];
    c.save(); c.strokeStyle = ink; c.lineWidth = 6; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(cx - r * .55, cy + r * 1.25); c.lineTo(cx, cy); c.lineTo(cx + r * .55, cy + r * 1.25); c.stroke();
    c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
    c.lineWidth = 3;
    for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); c.stroke(); }
    for (i = 0; i < 8; i++) { var b = i / 8 * Math.PI * 2; c.beginPath(); c.arc(cx + r * Math.cos(b), cy + r * Math.sin(b), 11, 0, 7); c.fillStyle = cols[i % 6]; c.fill(); c.lineWidth = 3; c.stroke(); }
    c.beginPath(); c.arc(cx, cy, 9, 0, 7); c.fillStyle = '#FFC21A'; c.fill(); c.stroke();
    c.restore();
  }
  function confetti(c, colors, n, seed) {
    var s = seed || 7;
    function r() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (var i = 0; i < n; i++) {
      c.save(); c.translate(r() * W, r() * H); c.rotate(r() * 6);
      c.fillStyle = colors[i % colors.length]; c.fillRect(-9, -4, 18, 8); c.restore();
    }
  }
  function sticker(c, p, x, y, rot, text, fill, size) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.font = '400 ' + size + 'px ' + FD; var w = c.measureText(text).width + size * 0.9, h = size * 1.55;
    box(c, p, -w / 2, -h / 2, w, h, fill, h / 2, 9);
    txt(c, text, 0, 2, '400 ' + size + 'px ' + FD, ONC);
    c.restore();
  }
  function ticketStats(c, p, cx, y, d) {
    var w = 400, h = 150, gap = 40;
    [[d.pts, 'نقطة', '#FFC21A'], [d.wins, d.wins === 1 ? 'جولة ربحها' : 'جولات ربحها', '#FF7EC0']].forEach(function (it, i) {
      var x = cx + (i === 0 ? gap / 2 : -gap / 2 - w);
      box(c, p, x, y, w, h, it[2], 22, 10);
      c.save(); c.setLineDash([10, 10]); c.lineWidth = 4; c.strokeStyle = ONC; c.beginPath(); c.moveTo(x + 110, y + 14); c.lineTo(x + 110, y + h - 14); c.stroke(); c.restore();
      txt(c, '\u200E' + it[0], x + 55, y + h / 2 + 4, '400 64px ' + FD, ONC);
      txt(c, it[1], x + 110 + (w - 110) / 2, y + h / 2 + 4, '700 42px ' + FB, ONC, 'center', w - 130);
    });
  }
  function podium(c, p, x, y, w, rows, mine, step) {
    var medals = ['🥇', '🥈', '🥉']; var avail = step ? step * 3 : 276; step = 82;
    var cnt = Math.max(1, Math.min(3, Math.floor((avail + 16) / step)));
    rows.slice(0, cnt).forEach(function (r, i) {
      var yy = y + i * step;
      var hl = r.id === mine;
      box(c, p, x, yy, w, step - 16, hl ? (r.color || '#FFC21A') : p.surf, 18, 7);
      txt(c, medals[i] || '', x + w - 44, yy + (step - 16) / 2 + 2, '400 44px sans-serif', p.ink);
      txt(c, r.name, x + w - 90, yy + (step - 16) / 2 + 2, '700 40px ' + FB, hl ? ONC : p.ink, 'right', w - 230);
      txt(c, '\u200E' + r.pts + ' 🎟️', x + 80, yy + (step - 16) / 2 + 2, '400 40px ' + FD, hl ? ONC : p.ink);
    });
  }
  function footer(c, p, y) {
    var a = '@eyad.hloubi', sep = '  ·  ', b = 'صار بدها قعدة.';
    c.font = '700 38px ' + FB; c.textBaseline = 'middle'; c.fillStyle = p.ink;
    var wa = c.measureText(a).width, ws = c.measureText(sep).width, wb = c.measureText(b).width, x = W / 2 + (wa + ws + wb) / 2;
    c.direction = 'ltr'; c.textAlign = 'right'; c.fillText(a, x, y);
    c.fillText(sep, x - wa, y);
    c.direction = 'rtl'; c.textAlign = 'right'; c.fillText(b, x - wa - ws, y);
  }
  function teamChip(c, p, d, cx, y, imgs) {
    if (!d.team) return;
    var label = d.team.emoji + ' ' + d.team.name;
    c.font = '700 42px ' + FB;
    var tw = Math.min(600, c.measureText(label).width + 70), avs = Math.min(5, d.team.members.length), aw = avs * 58 + 20;
    var w = tw + aw, x = cx - w / 2;
    box(c, p, x, y, w, 92, d.team.color, 46, 8);
    txt(c, label, x + w - tw / 2, y + 48, '700 42px ' + FB, ONC, 'center', tw - 40);
    for (var i = 0; i < avs; i++) {
      var m = d.team.members[i];
      photoCircle(c, p, imgs[i], x + 50 + i * 58, y + 46, 30, m.color, m.name, 0);
    }
  }

  function render(d) {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d'), p = pal(d.dark);
    var fontsReady = (document.fonts && document.fonts.load) ? Promise.all([
      document.fonts.load('400 60px "Marhey"'), document.fonts.load('700 40px "Baloo Bhaijaan 2"')
    ]).catch(function () { }) : Promise.resolve();
    var teamImgs = d.team ? Promise.all(d.team.members.slice(0, 5).map(function (m) { return loadImg(m.photo); })) : Promise.resolve([]);
    return Promise.all([fontsReady, loadImg(d.me.photo), loadImg(d.showGroup ? d.groupPhoto : null), teamImgs]).then(function (res) {
      var me = res[1], grp = res[2], timgs = res[3];
      ({ cover: cover, polaroid: polaroid, card: card }[d.layout] || cover)(c, p, d, me, grp, timgs);
      return cv;
    });
  }

  /* ---- 1) غلاف ---- */
  function cover(c, p, d, me, grp, timgs) {
    c.fillStyle = p.bg; c.fillRect(0, 0, W, H);
    c.fillStyle = '#FF4B3E'; c.fillRect(0, 0, W, 18);
    ferris(c, W - 125, 112, 64, d.dark ? '#FFF1D0' : ONC);
    c.save(); c.translate(W / 2, 270); c.rotate(-0.03);
    box(c, p, -330, -70, 660, 140, '#FFC21A', 30, 12);
    txt(c, 'قعدة لعّيبة', 0, 6, '400 92px ' + FD, ONC);
    c.restore();
    txt(c, d.qName + '  ·  ' + d.qType, W / 2, 400, '700 44px ' + FB, p.ink, 'center', 900);
    photoCircle(c, p, me, W / 2, 730, 270, d.me.color, d.me.name);
    if (d.rank) sticker(c, p, W / 2 + 250, 500, 0.18, '#' + d.rank, d.rank === 1 ? '#FFC21A' : '#FF7EC0', 74);
    txt(c, d.me.name, W / 2, 1090, '400 112px ' + FD, p.ink, 'center', 960);
    c.save(); c.translate(W / 2, 1210); c.rotate(0.02);
    c.font = '700 54px ' + FB; var tw = Math.min(940, c.measureText(d.title).width + 90);
    box(c, p, -tw / 2, -54, tw, 108, d.rank === 1 ? '#22C17A' : '#2F6BFF', 54, 10);
    txt(c, d.title, 0, 4, '700 54px ' + FB, d.rank === 1 ? ONC : '#FFFFFF', 'center', tw - 60);
    c.restore();
    ticketStats(c, p, W / 2, 1310, d);
    var y = 1510;
    if (d.team) { teamChip(c, p, d, W / 2, y, timgs); y += 130; }
    bottom(c, p, d, grp, y, 1800);
    footer(c, p, 1862);
  }
  function bottom(c, p, d, grp, y, yMax) {
    var hasPod = d.showPodium && d.podium && d.podium.length, hasG = !!grp;
    var hgt = yMax - y;
    if (hasPod && hasG) {
      var pw = 500, gw = 400;
      photoRect(c, p, grp, 80, y, gw, Math.min(hgt, 270));
      podium(c, p, 80 + gw + 40, y, pw, d.podium, d.mineId, (hgt + 16) / 3);
    } else if (hasG) {
      var gh = Math.min(hgt, 290);
      photoRect(c, p, grp, 140, y, W - 280, gh);
    } else if (hasPod) {
      podium(c, p, 180, y, W - 360, d.podium, d.mineId, (hgt + 16) / 3);
    }
  }

  /* ---- 2) بولاريد ---- */
  function polaroid(c, p, d, me, grp, timgs) {
    c.fillStyle = d.dark ? '#151A17' : (d.me.color || '#2F6BFF'); c.fillRect(0, 0, W, H);
    if (!d.dark) { c.fillStyle = 'rgba(255,255,255,0.18)'; for (var i = 0; i < 14; i++) { c.fillRect(0, i * 140, W, 60); } }
    else confetti(c, ['#FF4B3E', '#2F6BFF', '#FFC21A', '#22C17A'], 50, 3);
    var tp = d.dark ? p : pal(false);
    c.save(); c.translate(W / 2, 130); c.rotate(0.025);
    box(c, tp, -300, -62, 600, 124, '#FFF4D6', 24, 12);
    txt(c, 'قعدة لعّيبة', 0, 6, '400 80px ' + FD, ONC);
    c.restore();
    c.save(); c.translate(W / 2, 720); c.rotate(-0.045);
    box(c, tp, -370, -470, 740, 850, '#FFFFFF', 12, 16);
    photoRect(c, tp, me, -320, -420, 640, 640);
    if (!me) { c.save(); rr(c, -320, -420, 640, 640, 10); c.clip(); c.fillStyle = d.me.color; c.fillRect(-320, -420, 640, 640); txt(c, d.me.name.charAt(0), 0, -100, '400 340px ' + FD, ONC); c.restore(); rr(c, -320, -420, 640, 640, 10); c.lineWidth = 6; c.strokeStyle = ONC; c.stroke(); }
    txt(c, d.me.name, 0, 285, '400 90px ' + FD, ONC, 'center', 640);
    txt(c, d.qName + ' · ' + d.qType, 0, 350, '700 36px ' + FB, '#5C6B60', 'center', 640);
    c.restore();
    if (d.rank) sticker(c, tp, W / 2 - 310, 290, -0.2, '#' + d.rank, '#FFC21A', 80);
    c.save(); c.translate(W / 2, 1185); c.rotate(0.03);
    c.font = '700 52px ' + FB; var tw = Math.min(940, c.measureText(d.title).width + 90);
    box(c, tp, -tw / 2, -52, tw, 104, '#FFC21A', 52, 10);
    txt(c, d.title, 0, 4, '700 52px ' + FB, ONC, 'center', tw - 60);
    c.restore();
    ticketStats(c, tp, W / 2, 1275, d);
    var y = 1470;
    if (d.team) { teamChip(c, tp, d, W / 2, y, timgs); y += 125; }
    var bp = d.dark ? p : { bg: '#FFF4D6', surf: '#FFF4D6', ink: ONC, line: ONC, shadow: ONC };
    bottom(c, bp, d, grp, y, 1810);
    footer(c, d.dark ? p : { ink: d.me.color ? ONC : ONC }, 1866);
  }

  /* ---- 3) كرت (تذكرة) ---- */
  function card(c, p, d, me, grp, timgs) {
    c.fillStyle = d.dark ? '#0F1311' : '#16211B'; c.fillRect(0, 0, W, H);
    for (var y0 = 0; y0 < H; y0 += 60) for (var x0 = (y0 / 60) % 2 ? 30 : 0; x0 < W; x0 += 60) { c.fillStyle = 'rgba(255,241,208,0.06)'; c.beginPath(); c.arc(x0, y0, 5, 0, 7); c.fill(); }
    var tp = pal(d.dark), x = 70, y = 90, w = W - 140, h = H - 200;
    box(c, { shadow: '#FF4B3E', line: tp.line }, x, y, w, h, tp.surf, 40, 18);
    // ثقوب التذكرة
    c.fillStyle = d.dark ? '#0F1311' : '#16211B';
    [430, 1180].forEach(function (yy) {
      c.beginPath(); c.arc(x, y + yy, 36, 0, 7); c.fill(); c.beginPath(); c.arc(x + w, y + yy, 36, 0, 7); c.fill();
      c.save(); c.setLineDash([18, 16]); c.lineWidth = 5; c.strokeStyle = tp.muted; c.beginPath(); c.moveTo(x + 50, y + yy); c.lineTo(x + w - 50, y + yy); c.stroke(); c.restore();
    });
    txt(c, 'تذكرة لعّيب', W / 2, y + 85, '400 64px ' + FD, '#FF4B3E');
    txt(c, d.qName + '  ·  ' + d.qType, W / 2, y + 160, '700 42px ' + FB, tp.ink, 'center', w - 100);
    photoCircle(c, tp, me, x + w - 210, y + 300, 120, d.me.color, d.me.name, 10);
    txt(c, d.me.name, x + w - 370, y + 270, '400 84px ' + FD, tp.ink, 'right', w - 440);
    txt(c, d.title, x + w - 370, y + 360, '700 46px ' + FB, tp.muted, 'right', w - 440);
    if (d.rank) sticker(c, tp, x + 120, y + 290, -0.15, '#' + d.rank, '#FFC21A', 76);
    ticketStats(c, tp, W / 2, y + 500, d);
    var yy2 = y + 700;
    if (d.team) { teamChip(c, tp, d, W / 2, yy2, timgs); yy2 += 130; }
    bottom(c, tp, d, grp, yy2, y + 1150);
    txt(c, 'العب. اربح. صوّر.', W / 2, y + 1270, '400 70px ' + FD, tp.ink);
    txt(c, d.gamesCount + ' لعبة انلعبت بالقعدة', W / 2, y + 1360, '700 44px ' + FB, tp.muted);
    for (var b = 0; b < 26; b++) { c.fillStyle = tp.ink; c.fillRect(x + 150 + b * 30, y + 1450, b % 3 ? 10 : 18, 120); }
    footer(c, { ink: '#FFF1D0' }, H - 55);
  }

  root.Story = { render: render };
})(this);
