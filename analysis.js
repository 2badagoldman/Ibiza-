// Audio analysis: tempo, beat phase, musical key (Camelot), energy, loudness.
// Runs in the browser on each 30-second preview. No external services.
(function () {
  'use strict';

  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        const half = len >> 1;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = a + half;
          const xr = re[b] * cr - im[b] * ci;
          const xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }

  function hann(n) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    return w;
  }

  // Spectrogram magnitudes for frames
  function frames(x, size, hop, cb) {
    const w = hann(size);
    const re = new Float64Array(size), im = new Float64Array(size);
    const half = size / 2;
    const mag = new Float32Array(half);
    let idx = 0;
    for (let start = 0; start + size <= x.length; start += hop, idx++) {
      for (let i = 0; i < size; i++) { re[i] = x[start + i] * w[i]; im[i] = 0; }
      fft(re, im);
      for (let k = 0; k < half; k++) mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      cb(mag, idx);
    }
    return idx;
  }

  const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  function corr(a, b) {
    const n = a.length;
    let ma = 0, mb = 0;
    for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
      const x = a[i] - ma, y = b[i] - mb;
      num += x * y; da += x * x; db += y * y;
    }
    return num / Math.sqrt(da * db || 1);
  }

  function camelot(pc, minor) {
    const majorPc = minor ? (pc + 3) % 12 : pc;
    const num = (((majorPc * 7) % 12) + 7) % 12 + 1;
    return { num, letter: minor ? 'A' : 'B', code: num + (minor ? 'A' : 'B') };
  }

  async function toMono(buffer, rate) {
    const len = Math.ceil(buffer.duration * rate);
    const off = new OfflineAudioContext(1, len, rate);
    const src = off.createBufferSource();
    src.buffer = buffer;
    src.connect(off.destination);
    src.start();
    const out = await off.startRendering();
    return out.getChannelData(0);
  }

  async function analyze(buffer, bpmHint) {
    const SR = 11025;
    const x = await toMono(buffer, SR);

    // Loudness (from the full-rate buffer, all channels)
    let sum = 0, cnt = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < d.length; i += 4) { sum += d[i] * d[i]; cnt++; }
    }
    const rms = Math.sqrt(sum / Math.max(1, cnt));
    const rmsDb = 20 * Math.log10(rms + 1e-9);

    // Onset envelope (spectral flux), ~43 frames/sec
    const OS = 1024, OH = 256;
    const fps = SR / OH;
    const onset = [];
    let prev = null;
    let centroidSum = 0, centroidN = 0;
    frames(x, OS, OH, (mag) => {
      let flux = 0, num = 0, den = 0;
      const cur = new Float32Array(mag.length);
      for (let k = 1; k < mag.length; k++) {
        const v = Math.log1p(10 * mag[k]);
        cur[k] = v;
        if (prev) { const d = v - prev[k]; if (d > 0) flux += d; }
        const f = (k * SR) / OS;
        num += f * mag[k]; den += mag[k];
      }
      if (den > 0) { centroidSum += num / den; centroidN++; }
      onset.push(flux);
      prev = cur;
    });
    // smooth & remove local mean
    const n = onset.length;
    const env = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0, c = 0;
      for (let j = Math.max(0, i - 8); j < Math.min(n, i + 8); j++) { m += onset[j]; c++; }
      env[i] = Math.max(0, onset[i] - m / c);
    }
    let onsetMean = 0;
    for (let i = 0; i < n; i++) onsetMean += env[i];
    onsetMean /= Math.max(1, n);

    // Tempo by autocorrelation with a preference around 120 BPM
    const minLag = Math.floor((60 * fps) / 180), maxLag = Math.ceil((60 * fps) / 68);
    const ac = new Float32Array(maxLag + 2);
    for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
      let s = 0;
      for (let i = 0; i + lag < n; i++) s += env[i] * env[i + lag];
      ac[lag] = s / (n - lag);
    }
    let bestLag = minLag, bestVal = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      const bpm = (60 * fps) / lag;
      const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
      // reward agreement with half/double tempo peaks
      const dbl = lag * 2 <= maxLag ? ac[lag * 2] * 0.5 : 0;
      const v = (ac[lag] + dbl) * w;
      if (v > bestVal) { bestVal = v; bestLag = lag; }
    }
    // parabolic refinement
    const a = ac[bestLag - 1], b = ac[bestLag], c2 = ac[bestLag + 1];
    const shift = (a - c2) / (2 * (a - 2 * b + c2) || 1);
    const lagF = bestLag + (Math.abs(shift) < 1 ? shift : 0);
    let bpm = (60 * fps) / lagF;
    if (bpmHint && bpmHint > 60 && bpmHint < 220) {
      // trust the catalog's tempo if it is close to a multiple of ours
      for (const m of [1, 2, 0.5]) if (Math.abs(bpmHint * m - bpm) / bpm < 0.04) bpm = bpmHint * m;
    }
    while (bpm < 75) bpm *= 2;
    while (bpm > 165) bpm /= 2;

    // Beat phase: offset (seconds) of the strongest beat train
    const period = (60 * fps) / bpm;
    let bestPhase = 0, bestPhaseVal = -1;
    for (let ph = 0; ph < period; ph += 0.5) {
      let s = 0;
      for (let t = ph; t < n; t += period) s += env[Math.round(t)] || 0;
      if (s > bestPhaseVal) { bestPhaseVal = s; bestPhase = ph; }
    }
    const beatOffset = (bestPhase + OS / 2 / OH) / fps % (60 / bpm);
    const beatStrength = bestPhaseVal / Math.max(1e-6, onsetMean * (n / period)); // >1 means clear pulse

    // Key from chroma
    const KS = 4096, KH = 2048;
    const chroma = new Float64Array(12);
    const kmin = Math.ceil((55 * KS) / SR), kmax = Math.floor((2000 * KS) / SR);
    frames(x, KS, KH, (mag) => {
      for (let k = kmin; k <= kmax; k++) {
        const f = (k * SR) / KS;
        const midi = Math.round(12 * Math.log2(f / 440) + 69);
        chroma[midi % 12] += Math.sqrt(mag[k]);
      }
    });
    let best = { r: -2, pc: 0, minor: false }, second = -2;
    for (let pc = 0; pc < 12; pc++) {
      for (const minor of [false, true]) {
        const prof = minor ? MINOR : MAJOR;
        const rot = new Array(12);
        for (let i = 0; i < 12; i++) rot[(i + pc) % 12] = prof[i];
        const r = corr(chroma, rot);
        if (r > best.r) { second = best.r; best = { r, pc, minor }; } else if (r > second) second = r;
      }
    }
    const cam = camelot(best.pc, best.minor);
    const keyName = NAMES[best.pc] + (best.minor ? 'm' : '');

    const centroid = centroidN ? centroidSum / centroidN : 1500;
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const energy = clamp(
      0.45 * clamp((rmsDb + 30) / 22) +
      0.35 * clamp((onsetMean - 0.3) / 1.6) +
      0.2 * clamp((centroid - 900) / 2200)
    );

    return {
      bpm: Math.round(bpm * 10) / 10,
      beatOffset,
      beatStrength: Math.round(beatStrength * 100) / 100,
      key: keyName,
      camelot: cam.code,
      camNum: cam.num,
      camLetter: cam.letter,
      keyConfidence: Math.round((best.r - second) * 1000) / 1000,
      energy: Math.round(energy * 1000) / 1000,
      rmsDb: Math.round(rmsDb * 10) / 10,
    };
  }

  // Compatibility of two Camelot keys: 1 = perfect
  function harmonic(a, b) {
    if (!a || !b) return 0.5;
    const d = Math.min((a.camNum - b.camNum + 12) % 12, (b.camNum - a.camNum + 12) % 12);
    if (a.camLetter === b.camLetter) {
      if (d === 0) return 1;
      if (d === 1) return 0.9;
      if (d === 2) return 0.5;
      if (d === 7) return 0.55; // energy boost (+1 semitone)
      return 0.15;
    }
    if (d === 0) return 0.85; // relative major/minor
    if (d === 1) return 0.4;
    return 0.1;
  }

  // Best playback rate to match tempo (handles half/double time)
  function tempoMatch(fromBpm, toBpm) {
    let best = { ratio: 1, diff: Infinity };
    for (const m of [1, 2, 0.5]) {
      const target = fromBpm * m;
      const ratio = target / toBpm;
      const diff = Math.abs(1 - ratio);
      if (diff < best.diff) best = { ratio, diff };
    }
    return best; // ratio = rate to apply to incoming track
  }

  window.DJAnalysis = { analyze, harmonic, tempoMatch };
})();
