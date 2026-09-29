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
    sky: [61, 196, 224], warm: [255, 238, 214], white: [255, 255, 255]
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
        var snow = sc.variant ? sc.variant === 'snow' : n % 2 === 0;
        for (var y = 0; y < H; y++) rect(ctx, 0, y, W, 1, snow ? mix([30, 40, 62], [14, 18, 30], y / H) : mix([22, 32, 48], [8, 12, 22], y / H));
        var bolt = !snow && (st % 4.3) > 3.9 && (st % 4.3) < 4.02;
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
        } else {
          drops.forEach(function (d) {
            d[1] += d[2] * step * 2; d[0] -= d[2] * step * .6;
            if (d[1] > H) { d[1] = 5; d[0] = Math.random() * (W + 20); }
            px(ctx, d[0], d[1], [120, 190, 255]); px(ctx, d[0] + 1, d[1] - 1, [120, 190, 255], .55); px(ctx, d[0] + 2, d[1] - 2, [120, 190, 255], .25);
          });
        }
        rect(ctx, 76, 9, 52, 23, [0, 0, 0], .72);
        ctext(ctx, snow ? '28°' : '54°', 101, 25, C.warm, '900 19px Nunito');
        ctext(ctx, snow ? 'SNOW' : 'RAIN', 101, 32 - 1, snow ? mul(C.sky, 1) : [120, 190, 255]);
      }
    };
    return sc;
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
          ctext(ctx, str, 64, 27, function (X, Y) { return mix(C.sky, [140, 240, 255], Y / 32); }, '600 30px Fredoka');
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

  var MARK_EARS = [
    ['M20 40 C 8 40, 2 34, 3 30 C 5 25, 16 26, 26 32 Z', 'M19 36 C 11 36, 8 33, 9 31 C 11 29, 17 30, 23 33 Z', 26, 34, 1],
    ['M116 40 C 128 40, 134 34, 133 30 C 131 25, 120 26, 110 32 Z', 'M117 36 C 125 36, 128 33, 127 31 C 125 29, 119 30, 113 33 Z', 110, 34, -1]
  ];
  var MARK_HORNS = ['M44 24 C 42 14, 46 6, 52 5 C 54 10, 54 18, 52 24 Z', 'M92 24 C 94 14, 90 6, 84 5 C 82 10, 82 18, 84 24 Z'];
  var P2D = {};
  function path(d) { return P2D[d] || (P2D[d] = new Path2D(d)); }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  // the MooBoard mark drawn onto the LEDs. k = scale from the 136 x 112 artboard
  function drawMark(ctx, x, y, k, t, frame) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = rgb(C.cream); MARK_HORNS.forEach(function (d) { ctx.fill(path(d)); });
    MARK_EARS.forEach(function (e) {
      ctx.save(); ctx.translate(e[2], e[3]); ctx.rotate(Math.sin(t * 9) * .22 * e[4] * (Math.sin(t * 1.3) > .3 ? 1 : 0)); ctx.translate(-e[2], -e[3]);
      ctx.fillStyle = rgb(frame); ctx.fill(path(e[0])); ctx.fillStyle = rgb(C.pink); ctx.fill(path(e[1]));
      ctx.restore();
    });
    ctx.fillStyle = rgb(frame); rrect(ctx, 18, 20, 100, 80, 24); ctx.fill();
    ctx.fillStyle = '#000'; rrect(ctx, 28, 30, 80, 60, 15); ctx.fill();
    var blink = (t % 3.7) < .12;
    ctx.fillStyle = '#fff';
    if (blink) { ctx.fillRect(43, 50, 16, 4); ctx.fillRect(77, 50, 16, 4); }
    else { ctx.beginPath(); ctx.arc(51, 51, 8.5, 0, 6.3); ctx.arc(85, 51, 8.5, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = rgb([255, 150, 185]); rrect(ctx, 45, 65, 46, 21, 10); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(59, 75.5, 4, 0, 6.3); ctx.arc(77, 75.5, 4, 0, 6.3); ctx.fill();
    ctx.restore();
  }
  S.moo = function () {
    return {
      label: 'Moo', dur: 4.5,
      draw: function (ctx, t, st) {
        var bob = Math.round(Math.sin(t * 6) * .8);
        drawMark(ctx, 1, 3 + bob, .235, t, C.sky);
        var letters = ['M', 'O', 'O'], font = '700 28px Fredoka', x = 40;
        letters.forEach(function (L, i) {
          var tt = clamp((st - .15 - i * .22) / .35, 0, 1), jump = Math.round(Math.sin(tt * Math.PI) * -6 + Math.sin(t * 5 + i) * (tt >= 1 ? 1 : 0));
          if (tt > 0) {
            var bb = text(ctx, L, x, 27 + jump, function (X, Y) { return mix([255, 255, 255], C.sky, Y / 34); }, font);
            x = bb.x1 + 4;
          } else x += measure(L, font).w + 2;
        });
        if (st > 1.2) { var hx = 116, hy = 10 + Math.round(Math.sin(t * 4) * 2); [[1, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [2, 3]].forEach(function (q) { px(ctx, hx + q[0], hy + q[1], C.pink); }); }
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
    this.auto = opts.auto !== false; this.visible = true; this.frame = 0; this.glow = [61, 196, 224];
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
  Board.prototype.step = function () {
    var i = this.names.indexOf(this.cur);
    this.go(this.names[(i + 1) % this.names.length]);
  };
  Board.prototype.moo = function () {
    if (this.cur === 'moo' || this.next === 'moo') return;
    this.back = this.next || this.cur;
    if (this.next) { this.cur = this.next; this.start = this.tStart; this.next = null; }
    this.go('moo');
  };
  Board.prototype.render = function (t, dt) {
    var sc = this.scenes[this.cur], st = this.opts.at != null ? this.opts.at : Math.max(0, t - this.start);
    if (!this.start) { this.start = t; st = 0; }
    var TR = REDUCED ? 0.01 : 0.7;
    var mooBack = this.cur === 'moo' && this.back;
    if (!this.next && ((this.auto && this.names.length > 1) || mooBack) && st > sc.dur * (REDUCED ? 1.6 : 1)) {
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
        if (!boards[i].visible) continue;
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
