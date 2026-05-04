/* js/audio.js — Gestion audio via Web Audio API */

const Audio = (() => {
  let ctx = null;
  let muted = false;
  let volume = 0.7;
  let musicGain = null;
  let musicOsc = [];
  let musicPlaying = false;
  let musicEnabled = true;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playTone({ freq = 440, type = 'sine', duration = 0.1, gain = 0.3, decay = true, delay = 0 }) {
    if (muted) return;
    const c = getCtx();
    const g = c.createGain();
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime + delay);
    g.gain.setValueAtTime(gain * volume, c.currentTime + delay);
    if (decay) g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime + delay);
    o.stop(c.currentTime + delay + duration + 0.01);
  }

  function playNoise({ duration = 0.05, gain = 0.15, freq = 800 }) {
    if (muted) return;
    const c = getCtx();
    const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1;
    const g = c.createGain();
    g.gain.setValueAtTime(gain * volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start();
    src.stop(c.currentTime + duration + 0.01);
  }

  const sounds = {
    paddleHit() {
      playTone({ freq: 300, type: 'triangle', duration: 0.07, gain: 0.4 });
      playTone({ freq: 450, type: 'sine', duration: 0.04, gain: 0.2 });
    },
    blockBreak(row = 0) {
      const freqs = [200, 220, 250, 280, 320, 360];
      const freq = freqs[row % freqs.length];
      playTone({ freq, type: 'square', duration: 0.06, gain: 0.3 });
      playNoise({ duration: 0.08, gain: 0.12, freq: freq * 2 });
    },
    wallHit() {
      playTone({ freq: 180, type: 'triangle', duration: 0.06, gain: 0.2 });
    },
    powerupCollect() {
      [0, 1, 2].forEach(i => playTone({
        freq: 440 + i * 220, type: 'sine', duration: 0.12,
        gain: 0.25, delay: i * 0.06
      }));
    },
    lifeLost() {
      [0,1,2,3].forEach(i => playTone({
        freq: 440 - i * 80, type: 'sawtooth', duration: 0.15,
        gain: 0.3, delay: i * 0.1
      }));
    },
    levelComplete() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => playTone({ freq: f, type: 'triangle', duration: 0.2, gain: 0.35, delay: i * 0.12 }));
    },
    gameOver() {
      [400, 300, 200, 150].forEach((f, i) => playTone({
        freq: f, type: 'sawtooth', duration: 0.3, gain: 0.4, delay: i * 0.15
      }));
    },
    menuClick() {
      playTone({ freq: 600, type: 'sine', duration: 0.06, gain: 0.2 });
    }
  };

  // ---- Musique générative ----
  function startMusic() {
    if (!musicEnabled || musicPlaying || muted) return;
    const c = getCtx();
    musicPlaying = true;
    musicGain = c.createGain();
    musicGain.gain.value = 0.07 * volume;
    musicGain.connect(c.destination);

    const bpm = 120;
    const beat = 60 / bpm;
    const pattern = [130.8, 0, 130.8, 0, 164.8, 0, 196, 0, 130.8, 0, 164.8, 0, 0, 0, 196, 220];
    let step = 0;

    function scheduleNote() {
      if (!musicPlaying) return;
      const freq = pattern[step % pattern.length];
      if (freq > 0 && !muted) {
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq;
        const g = c.createGain();
        g.gain.setValueAtTime(1, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + beat * 0.8);
        o.connect(g);
        g.connect(musicGain);
        o.start();
        o.stop(c.currentTime + beat);
      }
      step++;
      setTimeout(scheduleNote, beat * 1000);
    }
    scheduleNote();
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicGain) {
      musicGain.gain.exponentialRampToValueAtTime(0.001, getCtx().currentTime + 0.3);
    }
  }

  return {
    play(name, ...args) { if (sounds[name]) sounds[name](...args); },
    setMuted(v) { muted = v; if (v) stopMusic(); else if (musicEnabled) startMusic(); },
    isMuted() { return muted; },
    setVolume(v) { volume = v / 100; if (musicGain) musicGain.gain.value = 0.07 * volume; },
    setMusicEnabled(v) { musicEnabled = v; v ? startMusic() : stopMusic(); },
    startMusic,
    stopMusic
  };
})();
