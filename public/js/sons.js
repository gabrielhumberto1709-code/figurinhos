// Sons do estádio feitos na hora com Web Audio (nada de arquivo): apito, "uuh" da torcida e explosão de gol.
let ctx = null, ligado = (() => { try { return localStorage.getItem('fig.som') !== '0'; } catch { return true; } })();
export const somLigado = () => ligado;
export function alternarSom() { ligado = !ligado; try { localStorage.setItem('fig.som', ligado ? '1' : '0'); } catch { } return ligado; }
const ac = () => { if (!ligado) return null; try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch { return null; } };

function apito(dur = 0.25, vezes = 1) {
  const c = ac(); if (!c) return;
  for (let k = 0; k < vezes; k++) {
    const t = c.currentTime + k * (dur + 0.12), o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'square'; o.frequency.value = 2900; lfo.frequency.value = 38; lg.gain.value = 140;
    lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.02); g.gain.setValueAtTime(0.05, t + dur - 0.04); g.gain.linearRampToValueAtTime(0, t + dur);
    o.start(t); lfo.start(t); o.stop(t + dur); lfo.stop(t + dur);
  }
}
// ruído filtrado: torcida
function torcida(dur, pico, freq = 900) {
  const c = ac(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.7;
  src.buffer = buf; src.connect(f); f.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pico, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.start(t);
}
// pancada de madeira: o martelo do leiloeiro (forte no "vendido", leve no "dou-lhe uma/duas")
function pancada(forca = 1) {
  const c = ac(); if (!c) return;
  const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(forca < 1 ? 320 : 210, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * forca, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.22);
  torcida(0.07, 0.14 * forca, 1900);
}
export const SOM = {
  lance: () => torcida(0.06, 0.05, 2600),
  batidinha: () => pancada(0.45),
  martelo: () => { pancada(1); setTimeout(() => torcida(1.4, 0.09, 650), 120); },
  inicio: () => apito(0.5),
  intervalo: () => apito(0.35, 2),
  fim: () => apito(0.35, 3),
  falta: () => apito(0.18),
  cartao: () => apito(0.22, 2),
  chance: () => torcida(0.9, 0.12, 700),
  gol: () => torcida(2.4, 0.3, 1100),
};
