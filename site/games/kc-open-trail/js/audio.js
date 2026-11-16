/* All sound is synthesised with WebAudio: effects, ambience and a small
   generative tune. Nothing plays until the player has pressed something. */
import { clamp } from './util.js';

export function createAudio(game) {
  let ctx = null, master, sfxBus, musicBus, ambBus, noiseBuf, wind, windGain, waterGain, rainGain, engOsc, engGain, unlocked = false;
  let nextBeat = 0, beat = 0, chirpT = 2, cricketT = 1;
  const A = { get ready() { return !!ctx; } };
  const S = () => game.state.settings;
  A.unlock = () => {
    if (ctx) { if (ctx.state === 'suspended' && !document.hidden) ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master); musicBus = ctx.createGain(); musicBus.connect(master); ambBus = ctx.createGain(); ambBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (type, freq, q) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(ambBus); s.start(); return g; };
    windGain = loop('lowpass', 420, 0.3); waterGain = loop('bandpass', 900, 0.6); rainGain = loop('highpass', 2600, 0.4);
    engOsc = ctx.createOscillator(); engOsc.type = 'sawtooth'; engOsc.frequency.value = 55; const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 260; engGain = ctx.createGain(); engGain.gain.value = 0; engOsc.connect(ef); ef.connect(engGain); engGain.connect(sfxBus); engOsc.start();
    unlocked = true; A.applyVolume(); nextBeat = ctx.currentTime + 0.3;
  };
  A.applyVolume = () => { if (!ctx) return; const s = S(); sfxBus.gain.value = clamp(s.sound, 0, 1); ambBus.gain.value = clamp(s.sound, 0, 1) * 0.7; musicBus.gain.value = clamp(s.music, 0, 1) * 0.55; };
  A.suspend = () => { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = () => { if (ctx && unlocked && ctx.state === 'suspended') ctx.resume(); };

  function tone(type, f0, f1, dur, vol, t0 = 0, bus = sfxBus) {
    const t = ctx.currentTime + t0, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(type, f0, f1, dur, vol, t0 = 0, q = 0.8) {
    const t = ctx.currentTime + t0, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loopStart = Math.random(); const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.03);
  }
  const SFX = {
    pickup: () => { tone('sine', 880, 880, 0.08, 0.16); tone('sine', 1320, 1320, 0.12, 0.14, 0.06); },
    gold: () => { [660, 880, 1100, 1320, 1760].forEach((f, i) => tone('triangle', f, f, 0.22, 0.16, i * 0.07)); },
    reward: () => { [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.18, 0.15, i * 0.08)); },
    bark: (o) => { const p = o.pitch || 1, v = (o.vol ?? 1) * 0.3; tone('sawtooth', 520 * p, 250 * p, 0.11, v); tone('square', 380 * p, 200 * p, 0.1, v * 0.5, 0.01); noise('bandpass', 1400 * p, 700 * p, 0.1, v * 0.8, 0, 1.5); },
    jump: () => tone('sine', 300, 560, 0.13, 0.12),
    land: () => { tone('sine', 140, 60, 0.12, 0.2); noise('lowpass', 500, 200, 0.1, 0.12); },
    splash: () => { noise('lowpass', 2400, 400, 0.45, 0.3); noise('bandpass', 1800, 900, 0.25, 0.14, 0.05); },
    dig: () => { for (let i = 0; i < 6; i++) noise('bandpass', 700 + Math.random() * 500, 400, 0.11, 0.18, i * 0.2); },
    shake: () => { for (let i = 0; i < 7; i++) noise('highpass', 2200, 3200, 0.06, 0.1, i * 0.1); },
    honk: (o) => { const v = (o.vol ?? 1) * 0.16; tone('square', 392, 392, 0.22, v); tone('square', 494, 494, 0.22, v); },
    whistle: () => { for (let i = 0; i < 8; i++) tone('sine', i % 2 ? 2300 : 2050, i % 2 ? 2300 : 2050, 0.06, 0.12, i * 0.055); },
    pet: () => { tone('sine', 660, 660, 0.25, 0.12); tone('sine', 990, 990, 0.3, 0.1, 0.12); },
    caught: () => { [440, 370, 311, 262].forEach((f, i) => tone('triangle', f, f, 0.2, 0.16, i * 0.13)); },
    ui: () => tone('sine', 620, 620, 0.05, 0.1),
    door: () => { noise('lowpass', 300, 120, 0.12, 0.3); tone('sine', 110, 70, 0.1, 0.2, 0.02); },
    eat: () => { for (let i = 0; i < 4; i++) noise('bandpass', 900, 500, 0.07, 0.16, i * 0.12, 2); },
    shutter: () => { noise('highpass', 3000, 1500, 0.05, 0.25); noise('highpass', 2500, 1200, 0.06, 0.2, 0.09); },
    baa: () => { tone('sawtooth', 330, 290, 0.5, 0.07); tone('sawtooth', 336, 280, 0.5, 0.05); },
    quack: () => { for (let i = 0; i < 2; i++) { tone('sawtooth', 520, 380, 0.09, 0.08, i * 0.14); } },
    cluck: () => { for (let i = 0; i < 4; i++) tone('square', 700 + Math.random() * 200, 500, 0.04, 0.05, i * 0.09); },
    flap: () => { for (let i = 0; i < 5; i++) noise('bandpass', 1200, 800, 0.05, 0.1, i * 0.07, 1.2); },
    chirp: () => { const f = 2400 + Math.random() * 1600; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone('sine', f, f * (1.1 + Math.random() * 0.3), 0.07, 0.035, i * 0.1, ambBus); },
    cricket: () => { for (let i = 0; i < 4; i++) tone('sine', 4300, 4300, 0.03, 0.02, i * 0.05, ambBus); }
  };
  A.sfx = (name, o = {}) => { if (!ctx || ctx.state !== 'running' || !SFX[name]) return; try { SFX[name](o); } catch (e) { /* ignore */ } };
  let stepFlip = 0;
  A.step = surf => { if (!ctx || ctx.state !== 'running') return; stepFlip ^= 1; if (surf === 4) noise('lowpass', 900, 400, 0.08, 0.06); else noise('bandpass', surf === 1 || surf === 5 ? 1700 : surf === 3 ? 600 : 1000, 500, 0.04, surf === 1 ? 0.05 : 0.035, 0, 1.2); };
  A.engine = v => { if (!ctx) return; engGain.gain.setTargetAtTime(v > 0.02 ? 0.035 + v * 0.05 : 0, ctx.currentTime, 0.15); engOsc.frequency.setTargetAtTime(48 + v * 70, ctx.currentTime, 0.12); };

  /* generative tune: a gentle major-pentatonic stroll, sparser at night */
  const CHORDS = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], ROOT = 146.83, hz = n => ROOT * Math.pow(2, n / 12), PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
  function pluck(f, t, vol, dur = 0.5) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05); }
  function schedule() {
    const night = game.world.night, spb = 60 / (night > 0.5 ? 66 : 88) / 2;
    while (nextBeat < ctx.currentTime + 0.25) {
      const bar = Math.floor(beat / 8) % 4, step = beat % 8, ch = CHORDS[bar], t = nextBeat;
      if (step === 0) { pluck(hz(ch[0] - 12), t, 0.2, spb * 7); for (const n of ch) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = hz(n); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + spb * 2); g.gain.linearRampToValueAtTime(0.0001, t + spb * 8); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + spb * 8 + 0.05); } }
      if (night < 0.5 ? step % 2 === 0 || Math.random() < 0.35 : step % 4 === 0) { const n = step % 4 === 0 ? ch[(beat / 4) % 3 | 0] + 12 : PENTA[Math.floor(Math.random() * PENTA.length)] + 12; pluck(hz(n), t, 0.09 + Math.random() * 0.04, spb * 2.4); }
      if (step === 4) pluck(hz(ch[0] - 5), t, 0.12, spb * 3);
      nextBeat += spb; beat++;
    }
  }
  A.update = dt => {
    if (!ctx || ctx.state !== 'running') return;
    const { kc, world } = game, now = ctx.currentTime;
    if (S().music > 0.01) schedule(); else nextBeat = now + 0.2;
    const nearWater = clamp(1 - Math.min(world.riverDist(kc.pos.x, kc.pos.z), Math.max(0, world.heightAt(kc.pos.x, kc.pos.z) + 1) * 8) / 30, 0, 1);
    windGain.gain.setTargetAtTime(0.05 + clamp(kc.pos.y / 60, 0, 1) * 0.12 + (kc.sprinting ? 0.05 : 0), now, 0.5);
    waterGain.gain.setTargetAtTime(nearWater * 0.09 + (kc.swimming ? 0.05 : 0), now, 0.4); rainGain.gain.setTargetAtTime(world.rain * 0.12, now, 0.6);
    if (world.night < 0.4 && world.rain < 0.3) { chirpT -= dt; if (chirpT <= 0) { chirpT = 1.2 + Math.random() * 4; A.sfx('chirp'); } }
    if (world.night > 0.6) { cricketT -= dt; if (cricketT <= 0) { cricketT = 0.5 + Math.random() * 1.2; A.sfx('cricket'); } }
  };
  return A;
}
