/* MooBoard site */
var FORMSPREE_ID = ""; // set to the Formspree form id to open the waitlist

(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);
  var gsap = window.gsap, ST = window.ScrollTrigger;
  var ANIM = !!(gsap && ST) && !params.has('static');
  if (!ANIM) document.documentElement.classList.add('no-anim');
  var root = document.documentElement;
  var MB = window.MooBoard;

  // ask the browser for the board fonts so the canvas can use them
  if (document.fonts && document.fonts.load) {
    ['8px Silkscreen', '800 27px Nunito', '900 13px Nunito', '600 30px Fredoka', '700 28px Fredoka', '600 30px "Noto Sans Devanagari"']
      .forEach(function (f) { document.fonts.load(f, f.indexOf('Devanagari') > -1 ? 'ॐ' : 'A1').catch(function () {}); });
  }

  /* ---------- boards ---------- */
  var HERO_SCENES = ['time', 'lyrics', 'art', 'calendar', 'score', 'prayer', 'weather'];
  var first = HERO_SCENES.indexOf(params.get('scene'));
  if (first > 0) HERO_SCENES = HERO_SCENES.slice(first).concat(HERO_SCENES.slice(0, first));
  var heroEl = $('#hero-board');
  var hero = new MB.Board(heroEl, {
    scenes: HERO_SCENES,
    onGlow: function (c) { root.style.setProperty('--glow', (c[0] | 0) + ', ' + (c[1] | 0) + ', ' + (c[2] | 0)); }
  });

  var chips = $('#chips');
  MB.labels(HERO_SCENES).forEach(function (label, i) {
    var b = document.createElement('button');
    b.className = 'chip' + (i ? '' : ' on'); b.textContent = label; b.setAttribute('aria-pressed', i ? 'false' : 'true');
    b.dataset.scene = HERO_SCENES[i];
    b.addEventListener('click', function () { hero.go(HERO_SCENES[i]); });
    chips.appendChild(b);
  });
  heroEl.addEventListener('scene', function (e) {
    $$('.chip', chips).forEach(function (c) { var on = c.dataset.scene === e.detail; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
  });
  $('#hero-tilt').addEventListener('click', function () { hero.step(); });

  function tileGlow(el) { return function (c) { el.style.setProperty('--glow', (c[0] | 0) + ', ' + (c[1] | 0) + ', ' + (c[2] | 0)); }; }
  var boards = { hero: hero };
  var story = new MB.Board($('#story-board'), { scenes: ['time', 'lyrics', 'weather'], auto: false, minScale: 10, onGlow: tileGlow($('#story')) });
  boards.story = story;
  boards.color = new MB.Board($('#color-board'), { scenes: ['time', 'lyrics', 'art'], onGlow: tileGlow($('#colors')) });
  boards.room = new MB.Board($('#room-board'), { scenes: ['time', 'art', 'weather'], onGlow: tileGlow($('#room')) });
  boards.roomLive = new MB.Board($('#room-live'), { scenes: ['time', 'weather', 'art'], onGlow: tileGlow($('#room')) });
  boards.wl = new MB.Board($('#wl-board'), { scenes: ['moo', 'time', 'calendar'], onGlow: tileGlow($('#waitlist')) });

  $$('.tile').forEach(function (t) {
    var bz = document.createElement('div'); bz.className = 'bezel'; bz.dataset.frame = t.dataset.frame;
    var led = document.createElement('div'); led.className = 'led'; bz.appendChild(led);
    t.insertBefore(bz, t.firstChild);
    var b = new MB.Board(led, { scenes: [t.dataset.scene], auto: false, weather: 'snow', onGlow: tileGlow(t) });
    t.addEventListener('click', function () { b.moo(); });
  });

  /* ---------- frame colours ---------- */
  var FRAMES = ['black', 'white', 'orange', 'teal'];
  var CBG = { black: '#E9FBF7', white: '#E3F2EE', orange: '#FFE7D6', teal: '#D5F8EF' };
  function setHeroFrame(f) {
    $('#hero-bezel').dataset.frame = f;
    $$('.swatches .sw').forEach(function (s) { s.classList.toggle('on', s.dataset.frame === f); });
  }
  $$('.swatches .sw').forEach(function (s) {
    s.addEventListener('click', function (e) { e.stopPropagation(); setHeroFrame(s.dataset.frame); pulse($('#hero-bezel')); });
  });
  var colorIdx = -1;
  function setColor(i, fromUser) {
    if (i === colorIdx) return; colorIdx = i;
    var f = FRAMES[i];
    $('#color-bezel').dataset.frame = f;
    $('#colors').style.setProperty('--cbg', CBG[f]);
    $$('.cp').forEach(function (c) { c.classList.toggle('on', c.dataset.frame === f); });
    $$('.color-stills img').forEach(function (c) { c.classList.toggle('on', c.dataset.frame === f); });
    if (fromUser) setHeroFrame(f);
    pulse($('#color-bezel'));
  }
  function pulse(el) {
    if (!ANIM || REDUCED) return;
    gsap.fromTo(el, { scale: .97 }, { scale: 1, duration: .6, ease: 'elastic.out(1, .5)' });
  }

  /* ---------- moo ---------- */
  function moo(from) {
    MB.boards.forEach(function (b) { if (b.visible) b.moo(); });
    $$('.mark').forEach(function (m) { m.classList.remove('wiggle'); void m.getBoundingClientRect(); m.classList.add('wiggle'); });
    setTimeout(function () { $$('.mark').forEach(function (m) { m.classList.remove('wiggle'); }); }, 1000);
    var pop = $('#moo-pop'), r = (from || $('#logo')).getBoundingClientRect();
    pop.style.left = Math.min(innerWidth - 90, r.right - 6) + 'px';
    pop.style.top = Math.max(8, r.top - 30) + 'px';
    pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
  }
  $('#logo').addEventListener('click', function () { moo($('#logo')); });
  $('#foot-mark').addEventListener('click', function () { moo($('#foot-mark')); });
  var typed = '';
  addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    typed = (typed + (e.key || '')).slice(-3).toLowerCase();
    if (typed === 'moo') moo();
  });

  /* ---------- the cow's eyes ---------- */
  var marks = $$('.mark'), loads = 0;
  // pupils cycle the brand colours while something loads
  function busy(p) {
    loads++; marks.forEach(function (m) { m.classList.add('loading'); });
    var done = function () { if (--loads <= 0) { loads = 0; marks.forEach(function (m) { m.classList.remove('loading'); }); } };
    Promise.resolve(p).then(done, done);
    return p;
  }
  // happy eyes: pupils flash and glow, ears wiggle, confetti in the brand colours
  var happyT = 0;
  function happy(from) {
    marks.forEach(function (m) { m.classList.remove('happy'); void m.getBoundingClientRect(); m.classList.add('happy'); });
    clearTimeout(happyT); happyT = setTimeout(function () { marks.forEach(function (m) { m.classList.remove('happy'); }); }, 2800);
    if (!REDUCED) confetti(from);
  }
  function confetti(from) {
    var cv = document.createElement('canvas'), dpr = Math.min(devicePixelRatio || 1, 2);
    cv.className = 'confetti'; cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; document.body.appendChild(cv);
    var x = cv.getContext('2d'), r = from ? from.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    var ox = (r.left + r.width / 2) * dpr, oy = (r.top + r.height / 2) * dpr;
    var cols = ['#77EDD7', '#FFB81C', '#FF2E88', '#FF7A21', '#FFB7C9', '#77EDD7', '#F5E9D6', '#FFFFFF'], ps = [];
    for (var i = 0; i < 160; i++) {
      var a = -Math.PI / 2 + (Math.random() - .5) * 2.4, v = (6 + Math.random() * 12) * dpr;
      ps.push({ x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: cols[i % cols.length], s: (4 + Math.random() * 7) * dpr, dot: Math.random() < .55, rot: Math.random() * 6, vr: (Math.random() - .5) * .4 });
    }
    var t0 = performance.now();
    (function frame(now) {
      var t = (now - t0) / 1000;
      x.clearRect(0, 0, cv.width, cv.height);
      x.globalAlpha = Math.max(0, Math.min(1, 3 - t));
      ps.forEach(function (p) {
        p.vy += .38 * dpr; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        x.fillStyle = p.c;
        if (p.dot) { x.shadowColor = p.c; x.shadowBlur = 8 * dpr; x.beginPath(); x.arc(p.x, p.y, p.s / 2, 0, 6.3); x.fill(); x.shadowBlur = 0; }
        else { x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); }
      });
      if (t < 3) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }
  // pupils look toward the pointer, one dot at a time
  if (matchMedia('(pointer: fine)').matches && !REDUCED) {
    var raf = 0, px = 0, py = 0;
    addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        $$('.mark .pupils').forEach(function (p) {
          var r = p.ownerSVGElement.getBoundingClientRect();
          if (r.bottom < 0 || r.top > innerHeight) return;
          var dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height * .45), d = Math.hypot(dx, dy) || 1;
          var sx = d < 30 ? 0 : Math.round(dx / d * 1.3), sy = d < 30 ? 0 : Math.round(dy / d * 1.3);
          p.style.transform = 'translate(' + 4 * Math.max(-1, Math.min(1, sx)) + 'px,' + 4 * Math.max(-1, Math.min(1, sy)) + 'px)';
        });
      });
    });
  }

  /* ---------- sound: the MooBoard song ---------- */
  var snd = $('#sound');
  snd.addEventListener('click', function () {
    var M = window.MooMusic; if (!M) return;
    var singers = [hero, boards.wl];
    if (M.playing()) {
      M.stop(); singers.forEach(function (b) { b.release(); });
    } else if (M.start()) {
      singers.forEach(function (b) { b.hold('song'); });
      $$('.chip', chips).forEach(function (c) { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); });
    }
    var on = M.playing();
    snd.classList.toggle('on', on); snd.setAttribute('aria-pressed', on);
    snd.setAttribute('aria-label', on ? 'Mute the MooBoard song' : 'Play the MooBoard song');
  });

  /* ---------- waitlist ---------- */
  var form = $('#wl-form'), msg = $('#wl-msg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('#wl-email').value.trim(), btn = $('button', form);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'That email looks off.'; $('#wl-email').focus(); return; }
    btn.disabled = true; msg.textContent = '';
    var send = FORMSPREE_ID
      ? fetch('https://formspree.io/f/' + encodeURIComponent(FORMSPREE_ID), { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) })
          .then(function (r) { if (!r.ok) throw new Error('bad'); return 'sent'; })
      : new Promise(function (res) { setTimeout(function () { res('soon'); }, 700); });
    busy(send).then(function (how) {
      if (how === 'sent') { form.classList.add('done'); form.reset(); msg.textContent = "You're on the list. moo."; }
      else { form.classList.add('soon'); msg.textContent = 'Coming soon. The list opens any day now.'; }
      boards.wl.moo(); happy(btn);
    }, function () { msg.textContent = 'Could not send. Try again in a moment.'; })
      .then(function () { btn.disabled = false; });
  });

  /* ---------- render stills (used until the scroll sequences exist) ---------- */
  $$('.stills').forEach(function (st) {
    var sec = st.closest('section'), first = $('img', st);
    if (!first) return;
    function ok() { sec.classList.add('has-stills'); if (ST) ST.refresh(); }
    if (first.complete && first.naturalWidth) ok(); else first.addEventListener('load', ok);
  });

  /* ---------- scroll-scrubbed render sequences ---------- */
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function Seq(section, spec) {
    this.section = section; this.spec = spec; this.n = spec.frames;
    this.cv = $('.seq-canvas', section); this.ctx = this.cv.getContext('2d');
    this.imgs = new Array(this.n); this.ok = new Uint8Array(this.n); this.want = 0; this.started = false;
  }
  Seq.prototype.url = function (i) { var s = this.spec; return 'renders/' + s.dir + '/' + pad(i + 1, s.pad || 4) + '.' + (s.ext || 'webp'); };
  Seq.prototype.load = function (i) {
    var self = this;
    if (this.imgs[i]) return this.imgs[i].p;
    var img = new Image(); img.decoding = 'async';
    img.p = new Promise(function (res) {
      img.onload = function () { self.ok[i] = 1; res(true); if (Math.abs(i - self.want) < 3) self.draw(); };
      img.onerror = function () { res(false); };
    });
    img.src = this.url(i); this.imgs[i] = img;
    return img.p;
  };
  Seq.prototype.preload = function () {
    if (this.started) return; this.started = true;
    var fin; busy(new Promise(function (res) { fin = res; }));
    var self = this, order = [], seen = {};
    [16, 8, 4, 2, 1].forEach(function (st) { for (var i = 0; i < self.n; i += st) if (!seen[i]) { seen[i] = 1; order.push(i); } });
    var k = 0;
    (function next() { var batch = order.slice(k, k + 6); k += 6; if (!batch.length) return fin(); Promise.all(batch.map(function (i) { return self.load(i); })).then(next); })();
  };
  Seq.prototype.size = function () {
    var dpr = Math.min(devicePixelRatio || 1, 2), w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (this.cv.width !== Math.round(w * dpr)) { this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); }
  };
  Seq.prototype.set = function (p) { this.want = Math.round(Math.max(0, Math.min(1, p)) * (this.n - 1)); this.draw(); };
  Seq.prototype.draw = function () {
    var i = this.want, j = -1;
    for (var d = 0; d < this.n; d++) { if (this.ok[i - d]) { j = i - d; break; } if (this.ok[i + d]) { j = i + d; break; } }
    if (j < 0 || j === this.drawn && this.cv.width === this.lastW) return;
    this.drawn = j; this.size(); this.lastW = this.cv.width;
    var img = this.imgs[j], cw = this.cv.width, ch = this.cv.height, ir = img.naturalWidth / img.naturalHeight;
    var cover = cw / ch > 1 && (this.spec.fit || 'cover') === 'cover';
    var s = cover ? Math.max(cw / img.naturalWidth, ch / img.naturalHeight) : Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    var w = img.naturalWidth * s, h = w / ir;
    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  };
  function tint(section, img) {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 1;
      var x = c.getContext('2d'); x.drawImage(img, 2, 2, 1, 1, 0, 0, 1, 1);
      var d = x.getImageData(0, 0, 1, 1).data;
      section.style.background = 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
      section.classList.toggle('on-light', d[0] * .3 + d[1] * .59 + d[2] * .11 > 150);
    } catch (e) { /* keep css background */ }
  }

  function loadManifest() {
    return fetch('renders/manifest.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  var seqs = {};
  function initSeqs(man) {
    var list = (man && man.sequences) || {};
    return Promise.all($$('[data-seq]').map(function (sec) {
      var name = sec.dataset.seq, spec = list[name];
      if (!spec || !(spec.frames > 0)) return null;
      var s = new Seq(sec, spec);
      return s.load(0).then(function (ok) {
        if (!ok) return;
        seqs[name] = s; sec.classList.add('has-frames');
        if (spec.tint !== false) tint(sec, s.imgs[0]);
        s.set(0);
        if ('IntersectionObserver' in window) {
          var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { s.preload(); io.disconnect(); } }, { rootMargin: '150% 0px' });
          io.observe(sec);
        } else s.preload();
      });
    }));
  }
  addEventListener('resize', function () { Object.keys(seqs).forEach(function (k) { seqs[k].drawn = -1; seqs[k].draw(); }); });

  /* ---------- static fallbacks (no GSAP) ---------- */
  function wireStatic() {
    $$('.cp').forEach(function (c, i) { c.addEventListener('click', function () { setColor(i, true); }); });
    $$('.rt').forEach(function (b) { b.addEventListener('click', function () { setPlace(b.dataset.place); }); });
    setColor(0);
  }
  function setPlace(p) {
    $('#room .scene').dataset.place = p;
    $('#room .room-stills').dataset.place = p;
    $$('#room .room-stills img').forEach(function (c) { c.classList.toggle('on', c.dataset.place === p); });
    $$('.rt').forEach(function (b) { b.classList.toggle('on', b.dataset.place === p); });
  }

  /* ---------- motion ---------- */
  function initMotion() {
    gsap.registerPlugin(ST);
    var lenis = null;
    if (window.Lenis && !REDUCED) {
      lenis = new window.Lenis({ lerp: .1, smoothWheel: true });
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
    function scrollTo(y) { if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' }); }
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var t = $(a.getAttribute('href')); if (!t) return;
        e.preventDefault(); scrollTo(t.getBoundingClientRect().top + scrollY);
      });
    });

    // nav
    var lastY = 0, nav = $('#nav');
    ST.create({ start: 0, end: 'max', onUpdate: function (self) {
      var y = self.scroll();
      nav.classList.toggle('solid', y > 40);
      nav.classList.toggle('hide', y > 400 && y > lastY + 2);
      if (y < lastY - 2) nav.classList.remove('hide');
      lastY = y;
    } });

    // hero intro: "mood board" drops its d and becomes mooboard
    var d = $('.pun .d'), gap = $('.pun .gap');
    gsap.set([d, gap], { width: function (i, el) { return el.getBoundingClientRect().width; } });
    if (REDUCED) gsap.set([d, gap], { width: 0, opacity: 0 });
    else {
      var intro = gsap.timeline({ delay: .15 });
      intro.from('.pun .w, .pun .d', { yPercent: 60, opacity: 0, duration: .9, stagger: .08, ease: 'back.out(1.8)' })
        .from('[data-hero]', { y: 40, opacity: 0, duration: 1, stagger: .1, ease: 'power3.out', clearProps: 'transform' }, '-=.5')
        .to(d, { rotation: 38, duration: .35, ease: 'power1.inOut' }, 1.5)
        .to(d, { rotation: 8, duration: .25, ease: 'power1.inOut' })
        .to(d, { y: '120%', rotation: 70, opacity: 0, duration: .6, ease: 'power2.in' })
        .to([d, gap], { width: 0, duration: .55, ease: 'power3.inOut' }, '-=.35')
        .fromTo('.pun', { scale: 1 }, { scale: 1.04, duration: .18, yoyo: true, repeat: 1, ease: 'power1.inOut' }, '-=.1');
    }

    // hero parallax + tilt
    gsap.to('.dotfield', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero .stage', { y: 80, scale: .94, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.pun', { y: -60, opacity: .2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    if (matchMedia('(pointer: fine)').matches && !REDUCED) {
      var tilt = $('#hero-tilt');
      $('.hero').addEventListener('pointermove', function (e) {
        var x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
        tilt.style.transform = 'rotateY(' + (x * 10).toFixed(2) + 'deg) rotateX(' + (-y * 8).toFixed(2) + 'deg)';
      });
      $('.hero').addEventListener('pointerleave', function () { tilt.style.transform = ''; });
    }

    // story
    var storySeq = seqs.hero, caps = $$('#story .cap'), bar = $('#story .progress i'), lastScene = 'time';
    if (!storySeq) gsap.set('#story .spin', { rotateX: 58, rotateZ: -10, scale: .8, y: 40 });
    var storyTl = gsap.timeline({
      scrollTrigger: {
        trigger: '#story', start: 'top top', end: '+=260%', pin: '#story .pin', scrub: .6,
        onUpdate: function (self) {
          var p = self.progress;
          if (storySeq) storySeq.set(p);
          bar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
          var sc = p < .36 ? 'time' : p < .7 ? 'lyrics' : 'weather';
          if (sc !== lastScene) { lastScene = sc; story.go(sc); }
        }
      }
    });
    if (!storySeq) {
      gsap.set('#story .spin', { transformOrigin: '64% 50%' });
      storyTl.to('#story .spin', { rotateX: 0, rotateZ: 0, scale: 1, y: 0, duration: .34, ease: 'power2.out' }, 0)
        .to('#story .spin', { scale: 2.3, duration: .2, ease: 'power2.inOut' }, .38)
        .to('#story .spin', { scale: 1, rotateY: -12, duration: .18, ease: 'power2.inOut' }, .6)
        .to('#story .spin', { rotateY: 10, rotateX: 6, scale: .94, duration: .22, ease: 'sine.inOut' }, .78);
    }
    storyTl.to(caps[0], { opacity: 0, y: -30, duration: .08 }, .3)
      .fromTo(caps[1], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .08 }, .38)
      .to(caps[1], { opacity: 0, y: -30, duration: .08 }, .64)
      .fromTo(caps[2], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .08 }, .72)
      .to({}, { duration: .2 }, .8);

    // colours
    var colorSeq = seqs.colors;
    var colorST = ST.create({
      trigger: '#colors', start: 'top top', end: '+=220%', pin: '#colors .pin', scrub: .5,
      onUpdate: function (self) {
        var p = self.progress;
        if (colorSeq) colorSeq.set(p);
        else gsap.set('#colors .swing', { rotateY: -16 + p * 32, rotateX: 6 - p * 6 });
        setColor(Math.min(3, Math.floor(p * 4)), true);
      }
    });
    setColor(0);
    $$('.cp').forEach(function (c, i) {
      c.addEventListener('click', function () { scrollTo(colorST.start + (colorST.end - colorST.start) * ((i + .5) / 4)); });
    });

    // room
    var roomSeq = seqs.room;
    var roomST = ST.create({
      trigger: '#room', start: 'top top', end: '+=170%', pin: '#room .pin', scrub: .5,
      onUpdate: function (self) {
        var p = self.progress;
        if (roomSeq) roomSeq.set(p);
        var place = p < .5 ? 'wall' : 'desk';
        if ($('#room .scene').dataset.place !== place) setPlace(place);
      }
    });
    setPlace('wall');
    $$('.rt').forEach(function (b) {
      b.addEventListener('click', function () { scrollTo(roomST.start + (roomST.end - roomST.start) * (b.dataset.place === 'wall' ? .2 : .8)); });
    });
    if (!REDUCED) {
      gsap.fromTo('.color-stills', { scale: 1.1 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '#colors', start: 'top top', end: '+=220%', scrub: true } });
      gsap.fromTo('.room-stills', { scale: 1.14 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '#room', start: 'top bottom', end: '+=220%', scrub: true } });
      $$('.card img').forEach(function (im) {
        gsap.to(im, { scale: 1, yPercent: 4, ease: 'none', scrollTrigger: { trigger: im.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }
    if (!roomSeq && !REDUCED) {
      gsap.fromTo('#room .scene', { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '#room', start: 'top bottom', end: 'top top', scrub: true } });
      gsap.to('#room .plant', { x: -40, ease: 'none', scrollTrigger: { trigger: '#room', start: 'top top', end: '+=170%', scrub: true } });
      gsap.to('#room .lamp', { x: 30, ease: 'none', scrollTrigger: { trigger: '#room', start: 'top top', end: '+=170%', scrub: true } });
    }

    if (REDUCED) return;

    // reveals
    $$('[data-reveal]').forEach(function (el) {
      gsap.from(el, { y: 60, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
    });
    gsap.set('.tile', { y: 90, opacity: 0, rotate: function (i) { return i % 2 ? 2 : -2; } });
    ST.batch('.tile', {
      start: 'top 92%',
      onEnter: function (b) { gsap.to(b, { y: 0, opacity: 1, rotate: 0, duration: .9, stagger: .09, ease: 'back.out(1.4)' }); }
    });
    gsap.from('.big em', { x: 80, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.shows .big', start: 'top 85%' } });

    // numbers count up
    $$('[data-count]').forEach(function (el) {
      var end = +el.dataset.count, o = { v: 0 };
      ST.create({ trigger: el, start: 'top 90%', once: true, onEnter: function () {
        gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', onUpdate: function () {
          var v = Math.round(o.v); el.textContent = el.dataset.format === 'comma' ? v.toLocaleString('en-US') : v;
        } });
      } });
    });
    gsap.fromTo('.marquee', { xPercent: 6 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.tech', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.tag', { scale: 0, rotate: -40, duration: .8, ease: 'back.out(2.5)', scrollTrigger: { trigger: '.wl-price', start: 'top 85%' } });
    gsap.from('.foot-mark', { y: 40, rotate: -15, duration: 1, ease: 'elastic.out(1, .5)', scrollTrigger: { trigger: '.foot', start: 'top 95%' } });
  }

  busy(Promise.all([
    new Promise(function (res) { if (document.readyState === 'complete') res(); else addEventListener('load', res); }),
    document.fonts ? document.fonts.ready : null
  ]));
  var boot = busy(loadManifest().then(initSeqs));
  boot.then(function () {
    if (ANIM) {
      try { initMotion(); } catch (e) { root.classList.add('no-anim'); wireStatic(); throw e; }
      if (params.has('y')) setTimeout(function () { window.scrollTo(0, +params.get('y')); ST.update(); }, 300);
    } else wireStatic();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (ST) ST.refresh(); });
  });
})();
