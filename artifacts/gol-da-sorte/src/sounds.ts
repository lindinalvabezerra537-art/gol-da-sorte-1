let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function gain(ac: AudioContext, v: number, t = 0): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(v, t);
  g.connect(ac.destination);
  return g;
}

function osc(ac: AudioContext, type: OscillatorType, freq: number, g: GainNode, start: number, stop: number) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  o.connect(g);
  o.start(start);
  o.stop(stop);
}

function noise(ac: AudioContext, dur: number, gainVal: number, when: number) {
  const bufSize = ac.sampleRate * dur;
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.setValueAtTime(gainVal, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  src.connect(g);
  g.connect(ac.destination);
  src.start(when);
  src.stop(when + dur);
}

// ── ADVENTURE — upbeat arpeggio ───────────────────────────────────────────────
function playAdventure() {
  const ac = ctx();
  const now = ac.currentTime;
  const notes = [261.6, 329.6, 392, 523.3];
  notes.forEach((freq, i) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.28, now + i * 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.35);
    g.connect(ac.destination);
    const o = ac.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, now + i * 0.1);
    o.connect(g);
    o.start(now + i * 0.1);
    o.stop(now + i * 0.1 + 0.35);
  });
}

// ── BIRDS / CALMARIA ─────────────────────────────────────────────────────────
function playBirds() {
  const ac = ctx();
  const now = ac.currentTime;
  for (let i = 0; i < 3; i++) {
    const baseFreq = 1200 + Math.random() * 800;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now + i * 0.18);
    g.gain.linearRampToValueAtTime(0.18, now + i * 0.18 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.28);
    g.connect(ac.destination);
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(baseFreq, now + i * 0.18);
    o.frequency.linearRampToValueAtTime(baseFreq * 1.15, now + i * 0.18 + 0.14);
    o.frequency.linearRampToValueAtTime(baseFreq, now + i * 0.18 + 0.28);
    o.connect(g);
    o.start(now + i * 0.18);
    o.stop(now + i * 0.18 + 0.30);
  }
}

// ── FLUTE ────────────────────────────────────────────────────────────────────
function playFlute() {
  const ac = ctx();
  const now = ac.currentTime;
  const melody = [523.3, 587.3, 659.3, 698.5];
  melody.forEach((freq, i) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now + i * 0.2);
    g.gain.linearRampToValueAtTime(0.22, now + i * 0.2 + 0.06);
    g.gain.setValueAtTime(0.18, now + i * 0.2 + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.38);
    g.connect(ac.destination);
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, now + i * 0.2);
    const vib = ac.createOscillator();
    vib.frequency.setValueAtTime(5, now + i * 0.2);
    const vibGain = ac.createGain();
    vibGain.gain.setValueAtTime(4, now + i * 0.2);
    vib.connect(vibGain);
    vibGain.connect(o.frequency);
    vib.start(now + i * 0.2);
    vib.stop(now + i * 0.2 + 0.38);
    o.connect(g);
    o.start(now + i * 0.2);
    o.stop(now + i * 0.2 + 0.38);
  });
}

// ── DRUMS TENSOS ─────────────────────────────────────────────────────────────
function playDrums() {
  const ac = ctx();
  const now = ac.currentTime;
  for (let i = 0; i < 4; i++) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.7, now + i * 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.22 + 0.18);
    g.connect(ac.destination);
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(120, now + i * 0.22);
    o.frequency.exponentialRampToValueAtTime(40, now + i * 0.22 + 0.18);
    o.connect(g);
    o.start(now + i * 0.22);
    o.stop(now + i * 0.22 + 0.20);
    noise(ac, 0.06, 0.3, now + i * 0.22);
  }
}

// ── MOEDAS DE OURO ───────────────────────────────────────────────────────────
function playCoins() {
  const ac = ctx();
  const now = ac.currentTime;
  const coinFreqs = [1047, 1319, 1568, 2093, 1568, 2093];
  coinFreqs.forEach((freq, i) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.30, now + i * 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.22);
    g.connect(ac.destination);
    const o = ac.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, now + i * 0.08);
    o.connect(g);
    o.start(now + i * 0.08);
    o.stop(now + i * 0.08 + 0.22);
  });
}

// ── ESPADA AFIADA ─────────────────────────────────────────────────────────────
function playSword() {
  const ac = ctx();
  const now = ac.currentTime;
  noise(ac, 0.12, 0.5, now);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.4, now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  g.connect(ac.destination);
  const o = ac.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(800, now + 0.05);
  o.frequency.exponentialRampToValueAtTime(200, now + 0.5);
  o.connect(g);
  o.start(now + 0.05);
  o.stop(now + 0.55);
}

// ── GRITO DE HORROR (knockback) ───────────────────────────────────────────────
export function playHorrorScream() {
  const ac = ctx();
  const now = ac.currentTime;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.8, now);
  g.gain.setValueAtTime(0.9, now + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  g.connect(ac.destination);
  const o = ac.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(600, now);
  o.frequency.exponentialRampToValueAtTime(150, now + 0.8);
  o.frequency.linearRampToValueAtTime(80, now + 1.2);
  o.connect(g);
  o.start(now);
  o.stop(now + 1.3);
  noise(ac, 0.5, 0.4, now + 0.05);
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0.5, now + 0.15);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
  g2.connect(ac.destination);
  const o2 = ac.createOscillator();
  o2.type = "sawtooth";
  o2.frequency.setValueAtTime(900, now + 0.15);
  o2.frequency.exponentialRampToValueAtTime(200, now + 0.9);
  o2.connect(g2);
  o2.start(now + 0.15);
  o2.stop(now + 1.1);
}

// ── FANFARRA CAMPEÃO ─────────────────────────────────────────────────────────
export function playChampionFanfare() {
  const ac = ctx();
  const now = ac.currentTime;
  const notes = [523.3, 659.3, 783.9, 1046.5];
  notes.forEach((freq, i) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.35, now + i * 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.5);
    g.connect(ac.destination);
    const o = ac.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, now + i * 0.15);
    o.connect(g);
    o.start(now + i * 0.15);
    o.stop(now + i * 0.15 + 0.5);
  });
}

// ── EXPORTAR FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────
export function playZoneSound(pos: number) {
  try {
    if (pos >= 1 && pos <= 7) { playAdventure(); return; }
    if (pos >= 8 && pos <= 13) { playBirds(); return; }
    if (pos >= 25 && pos <= 31) { playFlute(); return; }
    if (pos >= 35 && pos <= 41) { playDrums(); return; }
    if (pos >= 45 && pos <= 51) { playCoins(); return; }
    if (pos >= 64 && pos <= 70) { playSword(); return; }
    playAdventure();
  } catch {
  }
}
