/* MooBoard live LED board.
   Every scene draws into a 128 x 32 canvas. Text is drawn into a scratch canvas and
   thresholded to hard pixels, like a real panel. The frame is then shown two ways:
   as round LEDs (big canvas, dot mask) and as a blurred copy for the glow. */
(function () {
  'use strict';

  var W = 128, H = 32, N = W * H;
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PIX = '8px Silkscreen';
  var DEV = '"Noto Sans Devanagari", "Kohinoor Devanagari", sans-serif';

  var C = {
    marigold: [255, 184, 28], pink: [255, 46, 136], cream: [245, 233, 214],
    sky: [119, 237, 215], warm: [255, 238, 214], white: [255, 255, 255]
  };

  /* ---------- helpers ---------- */
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function rgb(a, al) { return 'rgba(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ',' + (al == null ? 1 : al) + ')'; }
  function hexc(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { t = clamp(t, 0, 1); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    function f(n) { var k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }
    return [f(0), f(8), f(4)];
  }
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  var sweep = function (x, x0, x1) { return mix(C.marigold, C.pink, clamp((x - x0) / Math.max(1, x1 - x0), 0, 1)); };

  /* ---------- thresholded text ---------- */
  var sc = mk(W, H), sx = sc.getContext('2d', { willReadFrequently: true });

  function measure(str, font) {
    sx.font = font;
    var m = sx.measureText(str);
    return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent, w: m.width };
  }
  // x position that centres the ink of str on cx (left aligned drawing)
  function cx(str, font, c) { var m = measure(str, font); return Math.round(c - (m.r - m.l) / 2); }

  // draw str with its baseline at y. color: [r,g,b] or fn(x,y) -> [r,g,b,alpha?]
  function text(ctx, str, x, y, color, font, thr) {
    font = font || PIX; thr = thr == null ? 0.5 : thr;
    sx.clearRect(0, 0, W, H);
    sx.font = font; sx.textBaseline = 'alphabetic'; sx.textAlign = 'left';
    sx.fillStyle = '#fff'; sx.fillText(str, Math.round(x), Math.round(y));
    var img = sx.getImageData(0, 0, W, H), d = img.data, fn = typeof color === 'function' ? color : null;
    var c = fn ? null : (color || C.white), lim = thr * 255, x0 = W, x1 = -1;
    for (var p = 0, i = 0; p < N; p++, i += 4) {
      if (d[i + 3] > lim) {
        var px = p % W, py = (p / W) | 0, k = fn ? fn(px, py) : c;
        d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = 255 * (k[3] == null ? 1 : k[3]);
        if (px < x0) x0 = px; if (px > x1) x1 = px;
      } else d[i + 3] = 0;
    }
    sx.putImageData(img, 0, 0);
    ctx.drawImage(sc, 0, 0);
    return { x0: x0, x1: x1 };
  }
  function ctext(ctx, str, c, y, color, font, thr) { return text(ctx, str, cx(str, font || PIX, c), y, color, font, thr); }

  function px(ctx, x, y, c, a) { ctx.fillStyle = rgb(c, a); ctx.fillRect(x | 0, y | 0, 1, 1); }
  function rect(ctx, x, y, w, h, c, a) { ctx.fillStyle = rgb(c, a); ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function disc(ctx, x, y, r, c, a) { ctx.fillStyle = rgb(c, a); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  function use12h() {
    try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 !== false; } catch (e) { return true; }
  }
  var H12 = use12h();
  var DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var MONS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function clockParts(d) {
    var h = d.getHours(), m = d.getMinutes();
    var hh = H12 ? ((h + 11) % 12 + 1) : h;
    return { h: H12 ? String(hh) : (hh < 10 ? '0' : '') + hh, m: (m < 10 ? '0' : '') + m, ap: h < 12 ? 'AM' : 'PM' };
  }

  /* ---------- sky ---------- */
  var SKY = [
    [0, '#03050f', '#0b1233'], [5, '#0b1233', '#3a2750'], [6.5, '#2b4a8f', '#ff8a5c'], [8, '#3b8fd2', '#a4dcf2'],
    [12, '#2a80d8', '#92d2f6'], [16.5, '#3a7cc4', '#f2b574'], [18.8, '#3a2b6c', '#ff6a4a'], [20.2, '#0d1539', '#2b1f4c'], [24, '#03050f', '#0b1233']
  ];
  function skyAt(h) {
    for (var i = 0; i < SKY.length - 1; i++) {
      var a = SKY[i], b = SKY[i + 1];
      if (h >= a[0] && h <= b[0]) {
        var t = (h - a[0]) / (b[0] - a[0]);
        return [mix(hexc(a[1]), hexc(b[1]), t), mix(hexc(a[2]), hexc(b[2]), t)];
      }
    }
    return [hexc('#03050f'), hexc('#0b1233')];
  }
  function drawSky(ctx, t, h, dim, region) {
    var s = skyAt(h), rw = region || W;
    for (var y = 0; y < H; y++) rect(ctx, 0, y, rw, 1, mul(mix(s[0], s[1], y / (H - 1)), dim));
    var night = h < 5.6 || h > 19.8 ? 1 : h < 6.6 ? (6.6 - h) : h > 18.8 ? (h - 18.8) : 0;
    night = clamp(night, 0, 1);
    if (night > 0) {
      var r = rnd(7);
      for (var i = 0; i < 46; i++) {
        var sx0 = r() * rw, sy0 = r() * 22, ph = r() * 6.28, sp = .6 + r() * 2;
        var tw = .35 + .65 * Math.abs(Math.sin(t * sp + ph));
        px(ctx, sx0, sy0, C.warm, night * tw * (r() > .8 ? 1 : .55));
      }
    }
    // sun by day, moon by night, on an arc across the region
    var up = h >= 6 && h < 19, p = up ? (h - 6) / 13 : ((h + 24 - 19) % 24) / 11;
    var bx = 4 + p * (rw - 8), by = 24 - Math.sin(p * Math.PI) * 17;
    if (up) {
      disc(ctx, bx, by, 6.5, [255, 170, 40], .22);
      disc(ctx, bx, by, 4.2, [255, 205, 70]);
      disc(ctx, bx - 1, by - 1, 2, [255, 245, 200]);
    } else {
      disc(ctx, bx, by, 5.5, [180, 200, 255], .12);
      disc(ctx, bx, by, 3.6, [236, 232, 214]);
      disc(ctx, bx + 1.8, by - 1.2, 3.1, mul(mix(s[0], s[1], by / H), dim));
    }
    // drifting clouds by day
    if (h > 7 && h < 18.5) {
      for (var k = 0; k < 3; k++) {
        var cxp = ((t * (2 + k) + k * 53) % (rw + 30)) - 15, cy = 5 + k * 5;
        ctx.fillStyle = rgb([235, 240, 248], .32 * dim + .06);
        ctx.beginPath(); ctx.ellipse(cxp, cy, 7, 2.2, 0, 0, 6.3); ctx.ellipse(cxp + 4, cy - 1.4, 4, 2, 0, 0, 6.3); ctx.fill();
      }
    }
    // hills
    for (var x = 0; x < rw; x++) {
      var hy = 28 + Math.round(Math.sin(x * .09 + 1) * 1.6 + Math.sin(x * .23) * .8);
      rect(ctx, x, hy, 1, H - hy, mul([22, 70, 60], .5 + .5 * (1 - night)));
    }
  }

  /* ---------- scenes ---------- */
  var S = {};

  S.time = function () {
    return {
      label: 'Time', dur: 7,
      draw: function (ctx, t) {
        var d = new Date(), h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
        drawSky(ctx, t, h, .78, 42);
        rect(ctx, 42, 0, W - 42, H, [0, 0, 0]);
        var c = clockParts(d), font = '800 27px Nunito';
        var str = c.h + ':' + c.m, x = cx(str, font, 85);
        var hw = measure(c.h, font).w, cw = measure(':', font).w, blink = d.getMilliseconds() < 500 || REDUCED;
        text(ctx, str, x, 22, function (X) { return X >= x + hw && X < x + hw + cw && !blink ? [0, 0, 0, 0] : C.warm; }, font);
        var date = DAYS[d.getDay()] + ' ' + MONS[d.getMonth()] + ' ' + d.getDate();
        ctext(ctx, date, 85, 31, mul(C.cream, .55));
        if (H12) text(ctx, c.ap, 126 - measure(c.ap, PIX).w, 8, mul(C.sky, .9));
      }
    };
  };

  var STANZAS = [
    ['we danced in', 'the kitchen light'],
    ['and the radio', 'sang all night']
  ];
  S.lyrics = function () {
    return {
      label: 'Lyrics', dur: 8,
      draw: function (ctx, t, st) {
        var per = 4, si = Math.floor(st / per) % STANZAS.length, lt = st % per;
        var lines = STANZAS[si], font = '900 13px Nunito';
        var wt = 0.42, cur = lt / wt, wi = 0;
        lines.forEach(function (line, li) {
          var y = li ? 28 : 13, x0 = cx(line, font, 64), parts = line.split(' '), spans = [], acc = '';
          parts.forEach(function (w, k) {
            acc += (k ? ' ' : '') + w;
            spans.push([x0 + (k ? measure(acc.slice(0, acc.length - w.length), font).w : 0), x0 + measure(acc, font).w, wi++]);
          });
          var xe = x0 + measure(line, font).w;
          text(ctx, line, x0, y, function (X) {
            for (var q = 0; q < spans.length; q++) {
              var sp = spans[q];
              if (X >= sp[0] - 1 && X <= sp[1] + 1) {
                var idx = sp[2], f = cur - idx;
                if (f >= 1) return sweep(X, x0, xe);
                if (f > 0 && X <= sp[0] + (sp[1] - sp[0]) * f) return sweep(X, x0, xe);
                return mul(C.cream, .22);
              }
            }
            return mul(C.cream, .22);
          }, font);
        });
      }
    };
  };

  // the playlist (js/music.js): the current line lights word by word in the track's colour
  function bright(c) { var m = Math.max(c[0], c[1], c[2], 1); return mul(c, 255 / m); }
  function songLine(ctx, words, y, p, tint) {
    var font = '900 13px Nunito', line = words.map(function (w) { return w.text; }).join(' ');
    var w0 = measure(line, font).w, sz = w0 > 124 ? '900 11px Nunito' : font;
    if (sz !== font) { font = sz; w0 = measure(line, font).w; }
    var x0 = cx(line, font, 64), xe = x0 + w0, spans = [], acc = '';
    var hi = bright(tint || C.marigold), lo = mix(hi, C.white, .55);
    words.forEach(function (w, k) {
      var st = x0 + (k ? measure(acc + ' ', font).w : 0); acc += (k ? ' ' : '') + w.text;
      spans.push([st, x0 + measure(acc, font).w, w.t0, Math.min(w.t1, w.t0 + .7)]);
    });
    text(ctx, line, x0, y, function (X) {
      for (var q = 0; q < spans.length; q++) {
        var sp = spans[q];
        if (X >= sp[0] - 1 && X <= sp[1] + 1) {
          var f = (p - sp[2]) / Math.max(.05, sp[3] - sp[2]);
          if (f >= 1 || (f > 0 && X <= sp[0] + (sp[1] - sp[0]) * f)) return mix(lo, hi, clamp((X - x0) / Math.max(1, xe - x0), 0, 1));
          return mul(C.cream, .22);
        }
      }
      return mul(C.cream, .22);
    }, font);
  }
  S.song = function () {
    return {
      label: 'Lyrics', dur: 12,
      draw: function (ctx) {
        var M = window.MooMusic, tm = M && M.timing(), tr = M && M.track();
        if (!tm || !tm.lines || !tm.lines.length) { ctext(ctx, 'MOO', 64, 20, mul(C.cream, .3)); return; }
        var p = M.pos(), L = tm.lines, li = 0;
        while (li < L.length - 1 && p >= L[li].t1) li++;
        var tint = tr && tr.tint ? hexc(tr.tint) : null;
        songLine(ctx, L[li].words, 13, p, tint);
        songLine(ctx, (L[li + 1] || L[0]).words, 28, -1, tint);
      }
    };
  };

  S.art = function () {
    return {
      label: 'Album art', dur: 7,
      draw: function (ctx, t, st) {
        // procedural cover: sunset over water
        for (var y = 0; y < 32; y++) {
          var k = y / 31, c = y < 19 ? mix([255, 94, 120], [255, 176, 60], k * 1.6) : mix([40, 60, 140], [20, 30, 80], (y - 19) / 12);
          rect(ctx, 0, y, 32, 1, c);
        }
        disc(ctx, 16, 17, 7, [255, 236, 170]);
        rect(ctx, 0, 19, 32, 13, [30, 44, 110]);
        for (var r = 0; r < 6; r++) {
          var ww = 10 - r * 1.3, off = Math.sin(t * 2 + r) * 1.5;
          rect(ctx, 16 - ww / 2 + off, 20 + r * 2, ww, 1, [255, 214, 140], .8 - r * .1);
        }
        var p = (st / 7 * 0.25 + .32);
        text(ctx, 'SUNDAY LIGHT', 38, 10, C.cream);
        text(ctx, 'THE MEADOWS', 38, 19, mul(C.cream, .45));
        rect(ctx, 38, 25, 86, 1, [60, 50, 60]);
        rect(ctx, 38, 25, 86 * p, 1, [255, 150, 90]);
        disc(ctx, 38 + 86 * p, 25.5, 1.5, [255, 214, 170]);
        // tiny equaliser
        for (var b = 0; b < 5; b++) {
          var hb = 2 + Math.abs(Math.sin(t * (3 + b) + b)) * 4;
          rect(ctx, 106 + b * 4, 19 - hb, 2, hb, mix([255, 184, 28], [255, 46, 136], b / 4));
        }
      }
    };
  };

  S.calendar = function () {
    return {
      label: 'Calendar', dur: 7,
      draw: function (ctx, t, st) {
        // calendar icon
        rect(ctx, 5, 8, 19, 18, [236, 232, 224]);
        rect(ctx, 5, 8, 19, 5, [235, 64, 64]);
        rect(ctx, 9, 6, 2, 4, [180, 180, 180]); rect(ctx, 18, 6, 2, 4, [180, 180, 180]);
        ctext(ctx, String(new Date().getDate()), 14.5, 24, [30, 30, 40]);
        text(ctx, 'LEAVE IN', 31, 10, mul(C.cream, .6));
        var n = st < 3.6 ? 12 : 11, roll = st >= 3.6 && st < 3.9 ? (st - 3.6) / .3 : 1;
        var pulse = .75 + .25 * Math.sin(t * 5);
        var font = '900 19px Nunito', yo = Math.round((1 - ease(roll)) * -10);
        var b = text(ctx, String(n), 31, 29 + yo, function (X) { return mul(sweep(X, 31, 60), pulse); }, font);
        text(ctx, 'MIN', b.x1 + 4, 29, C.warm, '900 13px Nunito');
        text(ctx, '3:30', 126 - measure('3:30', PIX).w, 10, mul(C.sky, .9));
        text(ctx, 'YOGA', 126 - measure('YOGA', PIX).w, 19, mul(C.cream, .5));
        // car on the road
        rect(ctx, 94, 27, 31, 1, [70, 70, 80]);
        var carx = 94 + ((st * 5) % 26);
        rect(ctx, carx, 24, 5, 2, C.sky); rect(ctx, carx + 1, 23, 3, 1, C.sky);
      }
    };
  };

  S.score = function () {
    return {
      label: 'Scores', dur: 7,
      draw: function (ctx, t, st) {
        var goal = st > 2.8, flash = Math.max(0, 1 - st / .35, goal ? 1 - (st - 2.8) / .45 : 0);
        rect(ctx, 0, 0, 36, H, [20, 50, 170], .9);
        rect(ctx, 92, 0, 36, H, [190, 30, 40], .9);
        ctext(ctx, 'NYC', 18, 13, C.white);
        ctext(ctx, 'LDN', 110, 13, C.white);
        ctext(ctx, goal ? "79'" : "78'", 18, 25, mul(C.white, .6));
        ctext(ctx, 'LIVE', 110, 25, mul(C.white, .6));
        var a = goal ? 3 : 2, bump = goal ? Math.max(0, 1 - (st - 2.8) / .6) : 0;
        ctext(ctx, a + '', 52, 25 - Math.round(bump * 3), goal && bump > 0 ? C.marigold : C.white, '900 22px Nunito');
        ctext(ctx, '1', 76, 25, C.white, '900 22px Nunito');
        rect(ctx, 62, 15, 3, 2, mul(C.white, .6));
        if (goal && st < 4.6 && Math.floor(st * 6) % 2) ctext(ctx, 'GOAL', 64, 31, C.marigold);
        if (flash > 0) rect(ctx, 0, 0, W, H, C.white, flash * .85);
      }
    };
  };

  function diya(ctx, x, t, seed) {
    var f = .6 + .4 * Math.sin(t * 13 + seed) * Math.sin(t * 7.3 + seed * 2) + Math.random() * .15;
    var fh = 5 + f * 3, sway = Math.sin(t * 5 + seed) * .7;
    disc(ctx, x, 21 - fh / 2, 6 + f * 1.5, [255, 140, 30], .13);
    ctx.fillStyle = rgb([255, 120, 20]);
    ctx.beginPath(); ctx.moveTo(x - 2.4, 22); ctx.quadraticCurveTo(x + sway, 22 - fh * 1.6, x + 2.4, 22); ctx.fill();
    ctx.fillStyle = rgb([255, 214, 90]);
    ctx.beginPath(); ctx.moveTo(x - 1.3, 22); ctx.quadraticCurveTo(x + sway * .7, 22 - fh * 1.05, x + 1.3, 22); ctx.fill();
    px(ctx, x, 21, [255, 250, 220]);
    ctx.fillStyle = rgb([200, 90, 40]);
    ctx.beginPath(); ctx.moveTo(x - 7, 23); ctx.quadraticCurveTo(x, 31, x + 7, 23); ctx.closePath(); ctx.fill();
    rect(ctx, x - 7, 23, 14, 1, [240, 150, 60]);
  }
  S.prayer = function () {
    var sparks = [];
    return {
      label: 'Prayer', dur: 8,
      draw: function (ctx, t, st) {
        rect(ctx, 0, 0, W, H, [40, 10, 4]);
        diya(ctx, 15, t, 1); diya(ctx, 113, t, 4);
        if (Math.random() < .25) sparks.push([Math.random() < .5 ? 15 : 113, 14, Math.random() - .5, 0]);
        sparks = sparks.filter(function (s) { s[1] -= .35; s[0] += s[2] * .3; s[3] += .03; px(ctx, s[0], s[1], [255, 190, 80], 1 - s[3]); return s[3] < 1; });
        var pulse = .82 + .18 * Math.sin(t * 2.2);
        if (st < 4) {
          var fo = DEV.replace(/^/, '600 30px ');
          var r = ctext(ctx, 'ॐ', 64, 27, function (X, Y) { return mul(mix(C.marigold, C.pink, clamp((Y - 4) / 24, 0, 1)), pulse); }, fo, .45);
          void r;
        } else {
          var line = 'जय जगदीश हरे', font = '600 15px ' + DEV, x0 = cx(line, font, 64), xe = x0 + measure(line, font).w;
          var prog = (st - 4) / 2.6;
          text(ctx, line, x0, 22, function (X) { return X < x0 + (xe - x0) * prog ? sweep(X, x0, xe) : mul(C.cream, .25); }, font, .42);
        }
      }
    };
  };

  S.weather = function (board) {
    var n = 0, drops = [], flakes = [], r = rnd(11);
    for (var i = 0; i < 44; i++) drops.push([r() * W, r() * H, 18 + r() * 12]);
    for (i = 0; i < 60; i++) flakes.push([r() * W, r() * H, 3 + r() * 4, r() * 6]);
    var sc = {
      label: 'Weather', dur: 7, variant: board && board.opts.weather,
      enter: function () { n++; },
      draw: function (ctx, t, st, dt) {
        var kind = sc.variant || (n % 2 === 0 ? 'snow' : 'rain'), snow = kind === 'snow';
        if (kind === 'clear') {
          var d = new Date(); drawSky(ctx, t, d.getHours() + d.getMinutes() / 60, .8, W);
          rect(ctx, 76, 9, 52, 23, [0, 0, 0], .6);
          ctext(ctx, sc.temp || '72°', 101, 25, C.warm, '900 19px Nunito');
          ctext(ctx, sc.label || 'CLEAR', 101, 31, mul(C.sky, 1));
          return;
        }
        for (var y = 0; y < H; y++) rect(ctx, 0, y, W, 1, snow ? mix([30, 40, 62], [14, 18, 30], y / H) : mix([22, 32, 48], [8, 12, 22], y / H));
        var bolt = (kind === 'storm' || (kind === 'rain' && !sc.label)) && (st % 4.3) > 3.9 && (st % 4.3) < 4.02;
        if (bolt) rect(ctx, 0, 0, W, H, [200, 210, 255], .5);
        // clouds
        for (var k = 0; k < 4; k++) {
          var x = ((t * (1.6 + k * .5) + k * 40) % 150) - 20, yy = 4 + (k % 2) * 3;
          ctx.fillStyle = rgb(snow ? [190, 200, 215] : [130, 140, 158], .75);
          ctx.beginPath(); ctx.ellipse(x, yy, 12, 3.4, 0, 0, 6.3); ctx.ellipse(x + 6, yy - 2, 6, 3.2, 0, 0, 6.3); ctx.ellipse(x - 6, yy - 1, 5, 2.6, 0, 0, 6.3); ctx.fill();
        }
        var step = Math.min(dt, .05);
        if (snow) {
          flakes.forEach(function (f) {
            f[1] += f[2] * step; f[0] += Math.sin(t * 1.5 + f[3]) * .12;
            if (f[1] > H) { f[1] = 4; f[0] = Math.random() * W; }
            px(ctx, f[0], f[1], [240, 246, 255], .9);
          });
        } else if (kind !== 'cloud') {
          drops.forEach(function (d) {
            d[1] += d[2] * step * 2; d[0] -= d[2] * step * .6;
            if (d[1] > H) { d[1] = 5; d[0] = Math.random() * (W + 20); }
            px(ctx, d[0], d[1], [120, 190, 255]); px(ctx, d[0] + 1, d[1] - 1, [120, 190, 255], .55); px(ctx, d[0] + 2, d[1] - 2, [120, 190, 255], .25);
          });
        }
        rect(ctx, 76, 9, 52, 23, [0, 0, 0], .72);
        ctext(ctx, sc.temp || (snow ? '28°' : '54°'), 101, 25, C.warm, '900 19px Nunito');
        ctext(ctx, sc.label || (snow ? 'SNOW' : 'RAIN'), 101, 32 - 1, snow ? mul(C.sky, 1) : [120, 190, 255]);
      }
    };
    return sc;
  };

  /* ---------- live weather: Open-Meteo, no key, location guessed from the time zone (no prompt) ---------- */
  var TZ_CITY = {
    'America/New_York': [40.71, -74.01, 'NYC'], 'America/Detroit': [42.33, -83.05, 'DETROIT'], 'America/Toronto': [43.65, -79.38, 'TORONTO'],
    'America/Chicago': [41.88, -87.63, 'CHICAGO'], 'America/Denver': [39.74, -104.99, 'DENVER'], 'America/Phoenix': [33.45, -112.07, 'PHOENIX'],
    'America/Los_Angeles': [34.05, -118.24, 'L.A.'], 'America/Vancouver': [49.28, -123.12, 'VANCOUVR'], 'America/Anchorage': [61.22, -149.9, 'ANCHORGE'],
    'Pacific/Honolulu': [21.31, -157.86, 'HONOLULU'], 'America/Mexico_City': [19.43, -99.13, 'MEXICO'], 'America/Sao_Paulo': [-23.55, -46.63, 'SAO PAULO'],
    'America/Bogota': [4.71, -74.07, 'BOGOTA'], 'America/Argentina/Buenos_Aires': [-34.6, -58.38, 'B. AIRES'], 'Europe/London': [51.51, -0.13, 'LONDON'],
    'Europe/Dublin': [53.35, -6.26, 'DUBLIN'], 'Europe/Paris': [48.86, 2.35, 'PARIS'], 'Europe/Berlin': [52.52, 13.4, 'BERLIN'], 'Europe/Madrid': [40.42, -3.7, 'MADRID'],
    'Europe/Rome': [41.9, 12.5, 'ROME'], 'Europe/Amsterdam': [52.37, 4.9, 'AMSTRDAM'], 'Europe/Stockholm': [59.33, 18.07, 'STOCKHLM'], 'Europe/Zurich': [47.38, 8.54, 'ZURICH'],
    'Europe/Istanbul': [41.01, 28.98, 'ISTANBUL'], 'Europe/Moscow': [55.76, 37.62, 'MOSCOW'], 'Africa/Cairo': [30.04, 31.24, 'CAIRO'], 'Africa/Lagos': [6.52, 3.38, 'LAGOS'],
    'Africa/Nairobi': [-1.29, 36.82, 'NAIROBI'], 'Africa/Johannesburg': [-26.2, 28.05, 'JOBURG'], 'Asia/Dubai': [25.2, 55.27, 'DUBAI'],
    'Asia/Kolkata': [28.61, 77.21, 'DELHI'], 'Asia/Calcutta': [28.61, 77.21, 'DELHI'], 'Asia/Karachi': [24.86, 67.0, 'KARACHI'], 'Asia/Dhaka': [23.81, 90.41, 'DHAKA'],
    'Asia/Bangkok': [13.76, 100.5, 'BANGKOK'], 'Asia/Jakarta': [-6.2, 106.85, 'JAKARTA'], 'Asia/Singapore': [1.35, 103.82, 'SINGAPRE'], 'Asia/Manila': [14.6, 120.98, 'MANILA'],
    'Asia/Hong_Kong': [22.32, 114.17, 'HONGKONG'], 'Asia/Shanghai': [31.23, 121.47, 'SHANGHAI'], 'Asia/Seoul': [37.57, 126.98, 'SEOUL'], 'Asia/Tokyo': [35.68, 139.69, 'TOKYO'],
    'Australia/Sydney': [-33.87, 151.21, 'SYDNEY'], 'Australia/Melbourne': [-37.81, 144.96, 'MELBRNE'], 'Australia/Perth': [-31.95, 115.86, 'PERTH'],
    'Pacific/Auckland': [-36.85, 174.76, 'AUCKLAND'], 'America/Indianapolis': [39.77, -86.16, 'INDY'], 'America/Indiana/Indianapolis': [39.77, -86.16, 'INDY'],
    'America/Kentucky/Louisville': [38.25, -85.76, 'LOUISVLE'], 'America/Halifax': [44.65, -63.58, 'HALIFAX'], 'America/Edmonton': [53.55, -113.49, 'EDMONTON'],
    'America/Winnipeg': [49.9, -97.14, 'WINNIPEG'], 'America/Boise': [43.62, -116.2, 'BOISE'], 'America/Santiago': [-33.45, -70.67, 'SANTIAGO'],
    'America/Lima': [-12.05, -77.04, 'LIMA'], 'Europe/Lisbon': [38.72, -9.14, 'LISBON'], 'Europe/Warsaw': [52.23, 21.01, 'WARSAW'], 'Europe/Athens': [37.98, 23.73, 'ATHENS'],
    'Europe/Helsinki': [60.17, 24.94, 'HELSINKI'], 'Europe/Oslo': [59.91, 10.75, 'OSLO'], 'Europe/Copenhagen': [55.68, 12.57, 'CPH'], 'Europe/Brussels': [50.85, 4.35, 'BRUSSELS'],
    'Europe/Vienna': [48.21, 16.37, 'VIENNA'], 'Europe/Prague': [50.08, 14.44, 'PRAGUE'], 'Asia/Taipei': [25.03, 121.57, 'TAIPEI'], 'Asia/Kathmandu': [27.72, 85.32, 'KATHMNDU'],
    'Asia/Riyadh': [24.71, 46.68, 'RIYADH'], 'Asia/Tehran': [35.69, 51.39, 'TEHRAN'], 'Australia/Brisbane': [-27.47, 153.03, 'BRISBANE']
  };
  var TZ = ''; try { TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* none */ }
  var SOUTH = /^(Australia|Pacific\/Auckland|America\/(Sao_Paulo|Argentina|Santiago)|Africa\/Johannesburg)/.test(TZ);
  var FAHR = /^(en-US|en-LR|my)/.test(navigator.language || '') || /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit)|^Pacific\/Honolulu/.test(TZ);
  var WX = null, wxAsked = false;
  function wxKind(code) {
    if (code >= 95) return 'storm'; if (code >= 71 && code <= 77 || code === 85 || code === 86) return 'snow';
    if (code >= 51) return 'rain'; if (code >= 2) return 'cloud'; return 'clear';
  }
  function askWeather() {
    if (wxAsked) return; wxAsked = true;
    var c = TZ_CITY[TZ]; if (!c || !window.fetch) return;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + c[0] + '&longitude=' + c[1] + '&current=temperature_2m,weather_code,is_day' + (FAHR ? '&temperature_unit=fahrenheit' : ''))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.current) WX = { temp: Math.round(j.current.temperature_2m), kind: wxKind(j.current.weather_code), city: c[2] }; })
      .catch(function () { /* stand-in sky stays */ });
  }
  S.wx = function (board) {
    var inner = S.weather(board);
    return {
      label: 'Weather', dur: 8,
      draw: function (ctx, t, st, dt) {
        askWeather();
        if (!WX) { inner.variant = 'rain'; inner.label = null; return inner.draw(ctx, t, st, dt); }
        inner.variant = WX.kind; inner.label = WX.city; inner.temp = WX.temp + '°';
        inner.draw(ctx, t, st, dt);
      }
    };
  };

  /* ---------- seasons: today's date picks the art ---------- */
  function seasonNow(d) {
    var m = d.getMonth(), day = d.getDate(), md = m * 100 + day;
    if (m === 9 && day >= 24) return 'halloween';
    if ((m === 11 && day >= 18) || (m === 0 && day <= 1)) return 'holiday';
    if (m === 1 && day >= 12 && day <= 14) return 'hearts';
    var s = md >= 220 && md < 521 ? 'spring' : md >= 521 && md < 822 ? 'summer' : md >= 822 && md < 1121 ? 'autumn' : 'winter';
    if (SOUTH) s = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' }[s];
    return s;
  }
  S.seasons = function () {
    var parts = [], r = rnd(21);
    return {
      label: 'Seasons', dur: 8,
      draw: function (ctx, t, st, dt) {
        var d = new Date(), k = seasonNow(d), step = Math.min(dt || .016, .05), i;
        var P = {
          spring: { sky: [[40, 90, 150], [120, 190, 230]], ground: [60, 150, 70], cols: [[255, 170, 200], [255, 255, 255], [255, 210, 90]], fall: .25, word: 'SPRING' },
          summer: { sky: [[30, 110, 210], [140, 210, 250]], ground: [230, 200, 120], cols: [[255, 255, 255]], fall: 0, word: 'SUMMER' },
          autumn: { sky: [[60, 40, 70], [240, 150, 90]], ground: [110, 60, 30], cols: [[255, 120, 30], [230, 60, 40], [255, 190, 60]], fall: .5, word: 'AUTUMN' },
          winter: { sky: [[14, 24, 60], [60, 90, 150]], ground: [230, 240, 255], cols: [[255, 255, 255]], fall: .6, word: 'WINTER' },
          halloween: { sky: [[20, 10, 40], [70, 30, 80]], ground: [40, 30, 50], cols: [[255, 140, 0]], fall: 0, word: 'BOO' },
          holiday: { sky: [[10, 20, 50], [40, 60, 110]], ground: [235, 245, 255], cols: [[255, 255, 255]], fall: .6, word: 'HOLIDAYS' },
          hearts: { sky: [[80, 10, 40], [200, 60, 110]], ground: [120, 20, 60], cols: [[255, 90, 140], [255, 180, 200]], fall: .4, word: 'LOVE' }
        }[k];
        for (var y = 0; y < H; y++) rect(ctx, 0, y, W, 1, mul(mix(P.sky[0], P.sky[1], y / H), .75));
        if (k === 'summer') { disc(ctx, 20, 10, 7, [255, 200, 60], .25); disc(ctx, 20, 10, 4.5, [255, 220, 90]); for (i = 0; i < 128; i++) rect(ctx, i, 27 + Math.round(Math.sin(i * .25 + t * 3)), 1, 6, [40, 140, 210]); }
        else if (k === 'halloween') { disc(ctx, 22, 20, 7, [255, 130, 0]); rect(ctx, 21, 11, 2, 3, [60, 140, 40]); px(ctx, 19, 18, [0, 0, 0]); px(ctx, 25, 18, [0, 0, 0]); rect(ctx, 19, 22, 7, 1, [0, 0, 0]); disc(ctx, 108, 8, 4, [240, 240, 220]); }
        else if (k === 'holiday') { for (i = 0; i < 9; i++) rect(ctx, 20 - i, 6 + i * 2, 1 + i * 2, 2, [40, 150, 70]); rect(ctx, 19, 24, 3, 4, [120, 70, 30]); px(ctx, 20, 5, [255, 220, 60]); for (i = 0; i < 6; i++) px(ctx, 14 + (i * 7) % 13, 10 + i * 2, [[255, 60, 60], [255, 220, 60], [80, 180, 255]][i % 3], .6 + .4 * Math.sin(t * 5 + i)); }
        else { var tr = k === 'autumn' ? [230, 110, 30] : k === 'spring' ? [255, 170, 210] : k === 'winter' ? [220, 235, 255] : [255, 90, 140]; rect(ctx, 19, 16, 3, 12, [90, 55, 30]); disc(ctx, 20, 12, 8, tr, .9); disc(ctx, 15, 15, 5, tr, .9); disc(ctx, 25, 15, 5, tr, .9); }
        rect(ctx, 0, 28, W, 4, P.ground);
        if (P.fall && Math.random() < P.fall) parts.push([r() * W, -1, .5 + r(), r() * 6, P.cols[Math.floor(r() * P.cols.length)]]);
        parts = parts.filter(function (q) { q[1] += q[2] * step * 12; q[0] += Math.sin(t * 2 + q[3]) * .15; px(ctx, q[0], q[1], q[4]); return q[1] < 28; });
        rect(ctx, 44, 5, 80, 20, [0, 0, 0], .55);
        ctext(ctx, P.word, 84, 15, C.warm, '900 13px Nunito');
        ctext(ctx, MONS[d.getMonth()] + ' ' + d.getDate(), 84, 23, mul(C.cream, .6));
      }
    };
  };

  S.soon = function () {
    return {
      label: 'More', dur: 8,
      draw: function (ctx, t) {
        for (var i = 0; i < 3; i++) { var on = Math.floor(t * 3) % 3 === i; disc(ctx, 52 + i * 12, 12, 3, on ? C.sky : mul(C.sky, .25)); }
        ctext(ctx, 'MORE SOON', 64, 28, C.warm);
      }
    };
  };

  S.tv = function () {
    return {
      label: 'TV', dur: 7,
      draw: function (ctx, t, st) {
        rect(ctx, 3, 7, 26, 17, [90, 90, 100]);
        for (var y = 0; y < 13; y++) for (var x = 0; x < 22; x++) {
          var v = .5 + .5 * Math.sin(x * .4 + t * 3) * Math.cos(y * .5 - t * 2);
          px(ctx, 5 + x, 9 + y, mix([20, 60, 140], [255, 120, 60], v), .9);
        }
        rect(ctx, 12, 25, 8, 1, [90, 90, 100]); rect(ctx, 9, 26, 14, 1, [90, 90, 100]);
        text(ctx, 'NOW WATCHING', 34, 8, mul(C.sky, .85));
        text(ctx, 'Night Train', 34, 20, C.cream, '900 13px Nunito');
        text(ctx, 'S2 E5', 34, 30, mul(C.cream, .45));
        var p = .41 + st / 7 * .05;
        rect(ctx, 64, 27, 60, 1, [60, 56, 66]); rect(ctx, 64, 27, 60 * p, 1, [255, 120, 60]);
      }
    };
  };

  S.lights = function () {
    return {
      label: 'Lights', dur: 7,
      draw: function (ctx, t) {
        for (var x = 0; x < W; x++) {
          var c = hsl(x * 2.2 - t * 70, .95, .55);
          var v = .55 + .45 * Math.sin(x * .12 - t * 3);
          for (var y = 0; y < H; y++) { var fall = .45 + .55 * Math.sin((y / H) * Math.PI); px(ctx, x, y, mul(c, v * fall)); }
        }
        rect(ctx, 34, 9, 60, 15, [0, 0, 0], .88);
        ctext(ctx, 'IN SYNC', 64, 20, C.white);
      }
    };
  };

  S.faces = function () {
    return {
      label: 'Clock faces', dur: 9,
      draw: function (ctx, t, st) {
        var d = new Date(), c = clockParts(d), f = Math.floor(st / 3) % 3, str = c.h + ':' + c.m;
        if (f === 0) {
          ctext(ctx, str, 64, 27, function (X, Y) { return mix(C.sky, [210, 255, 244], Y / 32); }, '600 30px Fredoka');
        } else if (f === 1) {
          ctext(ctx, str, 64, 25, [255, 30, 20, .7], '800 26px Nunito');
        } else {
          var ox = 20, oy = 16;
          for (var a = 0; a < 12; a++) { var an = a / 12 * 6.283; px(ctx, ox + Math.sin(an) * 13, oy - Math.cos(an) * 13, a % 3 ? mul(C.cream, .5) : C.marigold); }
          var hr = (d.getHours() % 12 + d.getMinutes() / 60) / 12 * 6.283, mn = (d.getMinutes() + d.getSeconds() / 60) / 60 * 6.283, sc2 = (d.getSeconds() + d.getMilliseconds() / 1000) / 60 * 6.283;
          ctx.lineWidth = 1.4; ctx.lineCap = 'round';
          ctx.strokeStyle = rgb(C.warm); ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.sin(hr) * 7, oy - Math.cos(hr) * 7); ctx.stroke();
          ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.sin(mn) * 11, oy - Math.cos(mn) * 11); ctx.stroke();
          ctx.strokeStyle = rgb(C.pink); ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.sin(sc2) * 11, oy - Math.cos(sc2) * 11); ctx.stroke();
          text(ctx, str, 44, 20, C.warm, '800 18px Nunito');
          text(ctx, DAYS[d.getDay()], 46, 30, mul(C.sky, .9));
        }
      }
    };
  };

  // the MooBoard mark is itself a 20 x 16 grid of LED dots, so it maps straight onto the panel
  var MARK = [
    '.......c....c.......',
    '.......c....c.......',
    '.....ssssssssss.....',
    'sss.ssssssssssss.sss',
    'sppss.kkkkkkkk.sspps',
    'ssssskkkkkkkkkksssss',
    '...sskkwkkkkwkkss...',
    '...sskwowkkwowkss...',
    '...sskkwkkkkwkkss...',
    '...sskkkkkkkkkkss...',
    '...sskkppppppkkss...',
    '...sskkpkppkpkkss...',
    '...sskkppppppkkss...',
    '...ss.kkkkkkkk.ss...',
    '....ssssssssssss....',
    '.....ssssssssss.....'
  ];
  var MARKC = { c: C.cream, p: [255, 150, 185], w: C.white, o: C.white };
  function drawMark(ctx, x0, y0, k, t, frame) {
    var look = 0, blink = (t % 3.7) < .14, flap = Math.sin(t * 1.3) > .4 && Math.sin(t * 14) > 0 ? 1 : 0;
    for (var r = 0; r < 16; r++) for (var c = 0; c < 20; c++) {
      var ch = MARK[r][c];
      if (ch === '.' || ch === 'k') continue;
      if (blink && (ch === 'w' || ch === 'o') && r !== 7) continue;
      if (ch === 'o') { rect(ctx, x0 + c * k, y0 + r * k, k, k, C.white); continue; }
      var col = ch === 's' ? frame : MARKC[ch], yo = (r >= 3 && r <= 5 && (c < 3 || c > 16)) ? -flap : 0;
      rect(ctx, x0 + c * k, y0 + (r + yo) * k, k, k, col);
    }
    if (!blink) [7, 12].forEach(function (c) { rect(ctx, x0 + (c + look) * k, y0 + 7 * k, k, k, [0, 0, 0]); });
  }
  S.moo = function () {
    return {
      label: 'Moo', dur: 4.5,
      draw: function (ctx, t, st) {
        drawMark(ctx, 0, 0, 2, t, C.sky);
        var letters = ['M', 'O', 'O'], font = '700 28px Fredoka', x = 45;
        letters.forEach(function (L, i) {
          var tt = clamp((st - .15 - i * .22) / .35, 0, 1), jump = Math.round(Math.sin(tt * Math.PI) * -6 + Math.sin(t * 5 + i) * (tt >= 1 ? 1 : 0));
          if (tt > 0) {
            var bb = text(ctx, L, x, 27 + jump, function (X, Y) { return mix([255, 255, 255], C.sky, Y / 34); }, font);
            x = bb.x1 + 4;
          } else x += measure(L, font).w + 2;
        });
      }
    };
  };

  /* ---------- the board ---------- */
  var boards = [], maskCache = {};

  function masks(s) {
    if (maskCache[s]) return maskCache[s];
    var bw = W * s, bh = H * s, m = mk(bw, bh), u = mk(bw, bh), cell = mk(s, s), cc = cell.getContext('2d');
    var r = s * .46, g = cc.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, r);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.62, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    cc.fillStyle = g; cc.fillRect(0, 0, s, s);
    var mx = m.getContext('2d'); mx.fillStyle = mx.createPattern(cell, 'repeat'); mx.fillRect(0, 0, bw, bh);
    var cu = mk(s, s), cux = cu.getContext('2d');
    cux.fillStyle = '#1B1920'; cux.beginPath(); cux.arc(s / 2, s / 2, s * .36, 0, 6.3); cux.fill();
    var ux = u.getContext('2d'); ux.fillStyle = ux.createPattern(cu, 'repeat'); ux.fillRect(0, 0, bw, bh);
    return (maskCache[s] = { m: m, u: u });
  }

  var noise = new Float32Array(N);
  (function () { var r = rnd(3); for (var i = 0; i < N; i++) noise[i] = r() * .75 + ((i % W) / W) * .25; })();

  function Board(el, opts) {
    this.el = el; this.opts = opts = opts || {};
    el.classList.add('led');
    this.glowCv = mk(W, H); this.glowCv.className = 'led-glow';
    this.dots = mk(W * 4, H * 4); this.dots.className = 'led-dots';
    this.fx = this.glowCv.getContext('2d', { willReadFrequently: true });
    this.bx = this.dots.getContext('2d');
    this.A = mk(W, H); this.B = mk(W, H);
    this.ax = this.A.getContext('2d', { willReadFrequently: true }); this.bbx = this.B.getContext('2d', { willReadFrequently: true });
    el.appendChild(this.dots); el.appendChild(this.glowCv);
    var self = this;
    this.names = opts.scenes || ['time'];
    this.scenes = {};
    this.names.concat(['moo']).forEach(function (n) { self.scenes[n] = S[n](self); });
    this.idx = 0; this.cur = this.names[0]; this.start = 0; this.next = null; this.tStart = 0;
    this.auto = opts.auto !== false; this.visible = true; this.frame = 0; this.glow = [119, 237, 215];
    this.last = 0; this.s = 0;
    this.resize();
    if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(el);
    if (window.IntersectionObserver) new IntersectionObserver(function (e) { self.visible = e[0].isIntersecting; }, { rootMargin: '100px' }).observe(el);
    if (this.scenes[this.cur].enter) this.scenes[this.cur].enter();
    boards.push(this);
  }
  Board.prototype.resize = function () {
    var w = this.el.clientWidth || 512, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var s = clamp(Math.max(Math.round(w * dpr / W), this.opts.minScale || 0), 3, 14);
    this.el.style.setProperty('--cell', (w / W).toFixed(2) + 'px');
    if (s === this.s) return;
    this.s = s; this.dots.width = W * s; this.dots.height = H * s; this.mk = masks(s);
  };
  Board.prototype.go = function (name, now) {
    if (!this.scenes[name] || name === this.cur || this.next) return;
    this.next = name; this.tStart = now == null ? (performance.now() - t0) / 1000 : now;
    if (this.scenes[name].enter) this.scenes[name].enter();
    this.el.dispatchEvent(new CustomEvent('scene', { detail: name }));
  };
  // keep one scene on the board (the song) until released
  Board.prototype.hold = function (name) {
    if (!this.scenes[name]) this.scenes[name] = S[name](this);
    this.held = name;
    if (this.next) { this.cur = this.next; this.start = this.tStart; this.next = null; }
    this.go(name);
  };
  Board.prototype.release = function () {
    var h = this.held; this.held = null;
    if (h && (this.cur === h || this.next === h)) this.go(this.names[0]);
  };
  Board.prototype.step = function () {
    var i = this.names.indexOf(this.cur);
    this.go(this.names[(i + 1) % this.names.length]);
  };
  Board.prototype.moo = function () {
    if (this.cur === 'moo' && !this.next) { this.start = (performance.now() - t0) / 1000; return; }
    if (this.next === 'moo') return;
    this.back = this.next || this.cur;
    if (this.next) { this.cur = this.next; this.start = this.tStart; this.next = null; }
    this.go('moo');
  };
  Board.prototype.render = function (t, dt) {
    var sc = this.scenes[this.cur], st = this.opts.at != null ? this.opts.at : Math.max(0, t - this.start);
    if (!this.start) { this.start = t; st = 0; }
    var TR = REDUCED ? 0.01 : 0.7;
    var mooBack = this.cur === 'moo' && this.back;
    if (!this.next && ((this.auto && !this.held && this.names.length > 1) || mooBack) && st > sc.dur * (REDUCED ? 1.6 : 1)) {
      var nm = mooBack ? this.back : this.names[(this.names.indexOf(this.cur) + 1) % this.names.length];
      this.back = null;
      if (nm !== this.cur) this.go(nm, t);
    }
    var a = this.ax;
    a.globalAlpha = 1; a.fillStyle = '#000'; a.fillRect(0, 0, W, H);
    sc.draw(a, t, st, dt);
    var out;
    if (this.next) {
      var p = Math.max(0, (t - this.tStart) / TR), b = this.bbx;
      b.fillStyle = '#000'; b.fillRect(0, 0, W, H);
      this.scenes[this.next].draw(b, t, Math.max(0, t - this.tStart), dt);
      if (p >= 1) {
        this.cur = this.next; this.next = null; this.start = this.tStart;
        this.fx.drawImage(this.B, 0, 0);
      } else {
        var da = a.getImageData(0, 0, W, H), db = b.getImageData(0, 0, W, H), d = da.data, e = db.data;
        for (var q = 0, i = 0; q < N; q++, i += 4) {
          var n = noise[q];
          if (n < p - .08) { d[i] = e[i]; d[i + 1] = e[i + 1]; d[i + 2] = e[i + 2]; }
          else if (n < p) { d[i] = 255; d[i + 1] = 240; d[i + 2] = 220; }
        }
        this.fx.putImageData(da, 0, 0);
      }
    } else this.fx.drawImage(this.A, 0, 0);
    out = this.bx;
    var bw = this.dots.width, bh = this.dots.height;
    out.globalCompositeOperation = 'copy'; out.imageSmoothingEnabled = false;
    out.drawImage(this.glowCv, 0, 0, bw, bh);
    out.globalCompositeOperation = 'destination-in'; out.drawImage(this.mk.m, 0, 0);
    out.globalCompositeOperation = 'destination-over'; out.drawImage(this.mk.u, 0, 0);
    out.globalCompositeOperation = 'source-over';
    if (this.opts.onGlow && (this.frame++ % 10 === 0)) {
      var g = this.fx.getImageData(0, 0, W, H).data, r = 0, gg = 0, bl = 0, c = 0;
      for (var j = 0; j < g.length; j += 16) { var s2 = g[j] + g[j + 1] + g[j + 2]; if (s2 > 60) { r += g[j]; gg += g[j + 1]; bl += g[j + 2]; c++; } }
      if (c) { var target = [r / c, gg / c, bl / c]; this.glow = mix(this.glow, target, .35); this.opts.onGlow(this.glow); }
    }
  };

  var t0 = performance.now(), lastT = 0, acc = 0;
  function loop(now) {
    var t = (now - t0) / 1000, dt = t - lastT; lastT = t;
    acc += dt;
    var minStep = REDUCED ? .5 : 0;
    if (acc >= minStep && !document.hidden) {
      for (var i = 0; i < boards.length; i++) {
        if (!boards[i].visible || (boards[i].opts.when && !boards[i].opts.when())) continue;
        try { boards[i].render(t, acc); } catch (e) { if (!boards[i].failed) { boards[i].failed = 1; setTimeout(function () { throw e; }); } }
      }
      acc = 0;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.MooBoard = {
    Board: Board, scenes: S, boards: boards,
    now: function () { return (performance.now() - t0) / 1000; },
    labels: function (names) { return names.map(function (n) { return S[n] ? S[n]().label : n; }); }
  };
})();
