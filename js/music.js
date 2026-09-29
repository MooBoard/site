/* MooBoard theme: an original chiptune loop made live with Web Audio, and its lyrics.
   120 bpm, 8th-note steps, 12 bars (6 lines of 2 bars), about 24 s per loop. Starts muted. */
(function () {
  'use strict';

  var BPM = 120, STEP = 60 / BPM / 2, LINE = 16, N = 6 * LINE;

  // lead: [step within line, note, length in steps]; words: [word, step]
  var SONG = [
    { chord: 'C', lead: [[0, 'E5', 2], [2, 'G5', 1], [3, 'G5', 1], [4, 'A5', 2], [6, 'G5', 2], [8, 'E5', 2], [10, 'C5', 2], [12, 'D5', 4]],
      words: [['moo', 0], ['in', 2], ['the', 3], ['morning', 4]] },
    { chord: 'G', lead: [[0, 'D5', 2], [2, 'B4', 1], [3, 'D5', 1], [4, 'G5', 4], [8, 'F5', 2], [10, 'E5', 2], [12, 'D5', 2], [14, 'B4', 2]],
      words: [['light', 0], ['on', 2], ['the', 3], ['wall', 4]] },
    { chord: 'Am', lead: [[0, 'C5', 1], [1, 'C5', 1], [2, 'E5', 2], [4, 'A5', 2], [6, 'G5', 4], [10, 'E5', 2], [12, 'A5', 2], [14, 'C6', 2]],
      words: [['every', 0], ['little', 2], ['mood', 6]] },
    { chord: 'F', lead: [[0, 'A5', 2], [2, 'G5', 2], [4, 'F5', 2], [6, 'E5', 2], [8, 'F5', 4], [12, 'A5', 2], [14, 'G5', 2]],
      words: [['glowing', 0], ['for', 4], ['us', 6], ['all', 8]] },
    { chord: 'C', lead: [[0, 'G5', 1], [1, 'G5', 1], [2, 'E5', 2], [4, 'G5', 2], [6, 'C6', 2], [8, 'B5', 2], [10, 'G5', 2], [12, 'E5', 2], [14, 'G5', 2]],
      words: [['tap', 0], ['along', 2], ['with', 6], ['me', 8]] },
    { chord: 'G', lead: [[0, 'D6', 2], [2, 'B5', 2], [4, 'G5', 2], [6, 'D5', 2], [8, 'G5', 1], [9, 'A5', 1], [10, 'B5', 2], [12, 'G5', 4]],
      words: [['moo', 0], ['moo', 2], ['mooboard', 4]] }
  ];
  var CHORDS = { C: ['C3', 'E4', 'G4', 'C5'], G: ['G2', 'D4', 'G4', 'B4'], Am: ['A2', 'C4', 'E4', 'A4'], F: ['F2', 'C4', 'F4', 'A4'] };

  function midi(n) {
    var m = /^([A-G])(#?)(\d)$/.exec(n), base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
    return 12 * (+m[3] + 1) + base + (m[2] ? 1 : 0);
  }
  function hz(n) { return 440 * Math.pow(2, (midi(n) - 69) / 12); }

  var ac = null, master = null, noiseBuf = null, playing = false, t0 = 0, nextStep = 0, nextTime = 0, timer = 0;

  function tone(type, f, at, dur, vol, slide) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + dur);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + .008);
    g.gain.setTargetAtTime(vol * .6, at + .03, .08);
    g.gain.setTargetAtTime(0, at + dur * .92, .02);
    o.connect(g); g.connect(master);
    o.start(at); o.stop(at + dur + .15);
  }
  function noise(at, dur, vol, freq, type) {
    var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(.001, at + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(at); s.stop(at + dur + .02);
  }

  function schedule(step, at) {
    var li = Math.floor(step / LINE), s = step % LINE, line = SONG[li], ch = CHORDS[line.chord], bar = s % 8;
    line.lead.forEach(function (n) { if (n[0] === s) tone('square', hz(n[1]), at, n[2] * STEP * .95, .11); });
    // bass: root, octave, root, fifth
    var root = hz(ch[0]);
    if (bar % 2 === 0) tone('triangle', [root, root * 2, root, root * 1.5][bar / 2], at, STEP * 1.6, .32);
    // sparkly arpeggio
    tone('square', hz(ch[1 + (s % 3)]) * 2, at, STEP * .5, .025);
    // drums
    if (bar === 0 || bar === 4) tone('sine', 150, at, .16, .5, 42);
    if (bar === 2 || bar === 6) noise(at, .12, .22, 1800, 'bandpass');
    noise(at, .035, .06, 7000, 'highpass');
    if (bar % 2 === 0) beat(at);
  }

  var beatCols = ['#FFB81C', '#FF2E88', '#77EDD7', '#FF7A21'], beatN = 0;
  function beat(at) {
    var ms = Math.max(0, (at - ac.currentTime) * 1000);
    setTimeout(function () {
      if (!playing) return;
      var c = beatCols[beatN++ % beatCols.length];
      document.querySelectorAll('.mark .pupil').forEach(function (p) { p.style.fill = c; });
    }, ms);
  }

  function tick() {
    while (nextTime < ac.currentTime + .15) {
      schedule(nextStep % N, nextTime);
      nextStep++; nextTime += STEP;
    }
  }

  function start() {
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain(); master.gain.value = .5;
      var comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    playing = true;
    t0 = ac.currentTime + .08; nextStep = 0; nextTime = t0;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(.5, ac.currentTime);
    clearInterval(timer); timer = setInterval(tick, 25); tick();
    return true;
  }
  function stop() {
    playing = false; clearInterval(timer);
    if (ac) { master.gain.setTargetAtTime(0, ac.currentTime, .05); }
    document.querySelectorAll('.mark .pupil').forEach(function (p) { p.style.fill = ''; });
  }

  document.addEventListener('visibilitychange', function () {
    if (!ac || !playing) return;
    if (document.hidden) ac.suspend(); else ac.resume();
  });

  window.MooMusic = {
    song: SONG, lineSteps: LINE,
    playing: function () { return playing; },
    // position in the loop: which line, and how far through it in steps
    pos: function () {
      if (!playing || !ac) return null;
      var s = (ac.currentTime - t0) / STEP;
      if (s < 0) return { line: 0, step: -1 };
      s = s % N;
      return { line: Math.floor(s / LINE), step: s % LINE };
    },
    start: start, stop: stop
  };
})();
