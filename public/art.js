/* قعدة لعّيبة — رسومات العيد (3 نسخ) */
(function (root) {
  'use strict';
  var INK = '#16211B';
  var PAL = ['#FF4B3E', '#FFC21A', '#2F6BFF', '#22C17A', '#FF7EC0', '#FF8A1F'];

  function q(p0, p1, p2, t) { var u = 1 - t; return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]; }
  function catenary(a, c, b) { return 'M' + a + ' Q' + c + ' ' + b; }
  function along(a, c, b, n, from, to) {
    var pts = []; from = from || 0; to = to == null ? 1 : to;
    for (var i = 0; i < n; i++) pts.push(q(a, c, b, from + (to - from) * (i + .5) / n));
    return pts;
  }

  /* عجلة دولاب الهوا */
  function wheel(cx, cy, r, cabins, spin) {
    var s = '<g class="' + (spin ? 'spin' : '') + '" style="transform-origin:' + cx + 'px ' + cy + 'px">';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + INK + '" stroke-width="' + Math.max(2.5, r * .05) + '"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * .72) + '" fill="none" stroke="' + INK + '" stroke-width="' + Math.max(1.5, r * .025) + '" stroke-dasharray="' + (r * .08) + ' ' + (r * .06) + '"/>';
    for (var i = 0; i < cabins; i++) {
      var a = i / cabins * Math.PI * 2, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + INK + '" stroke-width="' + Math.max(1.5, r * .025) + '"/>';
    }
    for (i = 0; i < cabins; i++) {
      var b = i / cabins * Math.PI * 2, x2 = cx + r * Math.cos(b), y2 = cy + r * Math.sin(b), cr = Math.max(4, r * .13);
      s += '<circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="' + cr.toFixed(1) + '" fill="' + PAL[i % PAL.length] + '" stroke="' + INK + '" stroke-width="' + Math.max(1.5, r * .03) + '"/>';
    }
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + Math.max(4, r * .1) + '" fill="#FFC21A" stroke="' + INK + '" stroke-width="2"/></g>';
    return s;
  }
  function legs(cx, cy, r, ground) {
    var w = r * .55;
    return '<path d="M' + (cx - w) + ' ' + ground + ' L' + cx + ' ' + cy + ' L' + (cx + w) + ' ' + ground + '" fill="none" stroke="' + INK + '" stroke-width="' + Math.max(3, r * .06) + '" stroke-linejoin="round"/>';
  }
  function tent(x, ground, w, h, c) {
    var s = '<g>';
    s += '<rect x="' + (x - w / 2) + '" y="' + (ground - h * .45) + '" width="' + w + '" height="' + (h * .45) + '" fill="#FFF4D6" stroke="' + INK + '" stroke-width="2.5"/>';
    var n = 4, sw = w / n;
    for (var i = 0; i < n; i++) s += '<path d="M' + x + ' ' + (ground - h) + ' L' + (x - w / 2 + i * sw) + ' ' + (ground - h * .45) + ' L' + (x - w / 2 + (i + 1) * sw) + ' ' + (ground - h * .45) + ' Z" fill="' + (i % 2 ? '#FFF4D6' : c) + '" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>';
    s += '<line x1="' + x + '" y1="' + (ground - h) + '" x2="' + x + '" y2="' + (ground - h - 9) + '" stroke="' + INK + '" stroke-width="2"/><path d="M' + x + ' ' + (ground - h - 9) + ' l9 3 l-9 3z" fill="' + c + '"/></g>';
    return s;
  }
  function flagsLine(a, c, b, n, h, cls) {
    var s = '<path d="' + catenary(a.join(' '), c.join(' '), b.join(' ')) + '" fill="none" stroke="' + INK + '" stroke-width="2"/>';
    along(a, c, b, n).forEach(function (p, i) {
      var w = h * .9;
      s += '<path class="' + (cls || '') + '" style="transform-origin:' + p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px;animation-delay:' + (-i * .27).toFixed(2) + 's" d="M' + (p[0] - w / 2).toFixed(1) + ' ' + p[1].toFixed(1) + ' L' + (p[0] + w / 2).toFixed(1) + ' ' + p[1].toFixed(1) + ' L' + p[0].toFixed(1) + ' ' + (p[1] + h).toFixed(1) + ' Z" fill="' + PAL[i % PAL.length] + '" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/>';
    });
    return s;
  }
  function lightsLine(a, c, b, n, r) {
    var s = '<path d="' + catenary(a.join(' '), c.join(' '), b.join(' ')) + '" fill="none" stroke="#0A1222" stroke-width="2"/>';
    along(a, c, b, n).forEach(function (p, i) {
      var col = ['#FFD84D', '#FF7E6B', '#7FE3C2', '#FFB0DA'][i % 4];
      s += '<circle class="glow g' + (i % 2) + '" cx="' + p[0].toFixed(1) + '" cy="' + (p[1] + r).toFixed(1) + '" r="' + r + '" fill="' + col + '"/>';
    });
    return s;
  }
  function lantern(x, top, len, size, c, d) {
    var y = top + len;
    return '<g class="sway" style="transform-origin:' + x + 'px ' + top + 'px;animation-delay:' + d + 's">' +
      '<line x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + y + '" stroke="#FFF3D6" stroke-width="1.5" opacity=".7"/>' +
      '<rect x="' + (x - size * .35) + '" y="' + y + '" width="' + (size * .7) + '" height="' + (size * .18) + '" rx="2" fill="#E9B23C" stroke="#0A1222" stroke-width="1.5"/>' +
      '<path d="M' + (x - size * .5) + ' ' + (y + size * .18) + ' Q' + x + ' ' + (y + size * .05) + ' ' + (x + size * .5) + ' ' + (y + size * .18) + ' L' + (x + size * .42) + ' ' + (y + size * 1.1) + ' Q' + x + ' ' + (y + size * 1.22) + ' ' + (x - size * .42) + ' ' + (y + size * 1.1) + ' Z" fill="' + c + '" stroke="#0A1222" stroke-width="1.8"/>' +
      '<path d="M' + x + ' ' + (y + size * .2) + ' L' + x + ' ' + (y + size * 1.15) + ' M' + (x - size * .22) + ' ' + (y + size * .22) + ' Q' + (x - size * .3) + ' ' + (y + size * .66) + ' ' + (x - size * .2) + ' ' + (y + size * 1.12) + ' M' + (x + size * .22) + ' ' + (y + size * .22) + ' Q' + (x + size * .3) + ' ' + (y + size * .66) + ' ' + (x + size * .2) + ' ' + (y + size * 1.12) + '" stroke="#0A1222" stroke-width="1" fill="none" opacity=".5"/>' +
      '<ellipse cx="' + x + '" cy="' + (y + size * .66) + '" rx="' + (size * .2) + '" ry="' + (size * .3) + '" fill="#FFF3B0" opacity=".75" class="flick"/>' +
      '<rect x="' + (x - size * .3) + '" y="' + (y + size * 1.1) + '" width="' + (size * .6) + '" height="' + (size * .14) + '" rx="2" fill="#E9B23C" stroke="#0A1222" stroke-width="1.5"/></g>';
  }
  function stars(w, h, n, seed) {
    var s = '', k = seed || 3;
    function r() { k = (k * 9301 + 49297) % 233280; return k / 233280; }
    for (var i = 0; i < n; i++) s += '<circle class="tw" style="animation-delay:' + (-r() * 3).toFixed(2) + 's" cx="' + (r() * w).toFixed(1) + '" cy="' + (r() * h).toFixed(1) + '" r="' + (0.8 + r() * 1.6).toFixed(1) + '" fill="#FFF3D6"/>';
    return s;
  }
  function balloon(x, y, r, c, d, str) {
    return '<g class="bob" style="animation-delay:' + d + 's">' +
      '<path d="M' + x + ' ' + (y + r * 1.15) + ' q-6 ' + (str * .3) + ' 2 ' + (str * .55) + ' t-3 ' + (str * .45) + '" stroke="' + INK + '" stroke-width="1.5" fill="none"/>' +
      '<ellipse cx="' + x + '" cy="' + y + '" rx="' + r + '" ry="' + (r * 1.18) + '" fill="' + c + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M' + (x - 4) + ' ' + (y + r * 1.15) + ' l4 6 l4 -6z" fill="' + c + '" stroke="' + INK + '" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<ellipse cx="' + (x - r * .35) + '" cy="' + (y - r * .45) + '" rx="' + (r * .18) + '" ry="' + (r * .3) + '" fill="#fff" opacity=".7" transform="rotate(-25 ' + (x - r * .35) + ' ' + (y - r * .45) + ')"/></g>';
  }

  /* ---------- الشريط فوق كل شاشة ---------- */
  function band(skin) {
    var W = 400, H = 70, s = '<svg class="band-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMax slice" aria-hidden="true">';
    if (skin === 'night') {
      s += stars(W, H, 26, 5);
      s += lightsLine([-10, 4], [100, 40], [200, 8], 9, 3.4) + lightsLine([200, 8], [300, 40], [410, 4], 9, 3.4);
      s += lantern(60, 0, 8, 22, '#FF4B3E', 0) + lantern(340, 0, 4, 20, '#2F6BFF', -1.2);
    } else if (skin === 'flags') {
      s += flagsLine([-10, 2], [100, 30], [200, 6], 9, 16, 'flap') + flagsLine([200, 6], [300, 30], [410, 2], 9, 16, 'flap');
      s += flagsLine([-10, 30], [120, 56], [250, 34], 8, 12, 'flap');
    } else {
      s += '<rect x="0" y="' + (H - 5) + '" width="' + W + '" height="5" fill="' + INK + '"/>';
      s += legs(335, 34, 28, H - 5) + wheel(335, 34, 28, 8, true);
      s += tent(60, H - 5, 46, 42, '#FF4B3E') + tent(112, H - 5, 34, 30, '#2F6BFF') + tent(262, H - 5, 38, 34, '#22C17A');
      s += flagsLine([150, 12], [195, 30], [240, 14], 5, 9, '');
    }
    return s + '</svg>';
  }

  /* ---------- رسمة الغلاف (عنصر واحد هادي) ---------- */
  function hero() {
    var W = 360, H = 150;
    return '<svg class="hero-svg" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><g opacity=".95">' + legs(180, 70, 58, H - 4) + wheel(180, 70, 58, 8, true) + '</g></svg>';
  }

  root.Art = { band: band, hero: hero };
})(this);
