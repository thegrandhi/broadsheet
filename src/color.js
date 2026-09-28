// Color scales, interpolated in OKLab so steps look evenly spaced.
// Every scale resolves to a pair of colors: one for the light theme and one
// for the dark theme. Pages carry both, and CSS picks one (see .dual).

export const DEFAULT_PALETTES = {
  light: {
    diverging: ['#a4161a', '#e27c62', '#e7e5e0', '#6da7ec', '#184f95'],
    sequential: ['#f1eee9', '#8f1a16'],
    accent: '#184f95',
    categorical: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  },
  dark: {
    diverging: ['#f0705f', '#9c4436', '#3a3a38', '#2f64a8', '#8ab8f5'],
    sequential: ['#2a2a28', '#f0705f'],
    accent: '#8ab8f5',
    categorical: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  },
};

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

function hex2rgb(h) {
  h = h.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const s2l = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const l2s = c => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(clamp(c) * 255); };

export function toLab(hex) {
  const [r, g, b] = hex2rgb(hex).map(s2l);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromLab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    l2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    l2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    l2s(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

function interpolate(stops, t) {
  t = clamp(t);
  const labs = stops.map(toLab);
  const pos = t * (labs.length - 1);
  const k = Math.min(labs.length - 2, Math.floor(pos));
  const f = pos - k;
  return fromLab(labs[k].map((x, j) => x + (labs[k + 1][j] - x) * f));
}

// Text color that stays readable on top of a fill.
export const textOn = hex => (toLab(hex)[0] > 0.64 ? '#121212' : '#ffffff');

// Build a scale from a chart config:
//   scale: diverging | sequential   domain: [min, max]   reverse: bool
// Returns value -> { light, dark } plus the stops needed to draw a legend.
export function makeScale(config, values, palettes = DEFAULT_PALETTES) {
  const kind = config.scale === 'sequential' ? 'sequential' : 'diverging';
  const nums = values.filter(v => typeof v === 'number' && !Number.isNaN(v));
  let [lo, hi] = config.domain || [Math.min(...nums), Math.max(...nums)];
  if (kind === 'diverging' && !config.domain && lo < 0 && hi > 0) {
    const m = Math.max(-lo, hi); lo = -m; hi = m; // centre on zero
  }
  const t = v => {
    const x = hi === lo ? 0.5 : (v - lo) / (hi - lo);
    return config.reverse ? 1 - x : x;
  };
  const scale = v => {
    if (typeof v !== 'number' || Number.isNaN(v)) return { light: '#cfcfcb', dark: '#4a4a47' };
    return { light: interpolate(palettes.light[kind], t(v)), dark: interpolate(palettes.dark[kind], t(v)) };
  };
  scale.domain = [lo, hi];
  scale.gradient = mode => {
    const steps = [0, 0.25, 0.5, 0.75, 1].map(p => interpolate(palettes[mode][kind], config.reverse ? 1 - p : p));
    return `linear-gradient(90deg,${steps.map((c, i) => `${c} ${i * 25}%`).join(',')})`;
  };
  return scale;
}

export function dualStyle(pair, prefix = 'c') {
  return `--${prefix}l:${pair.light};--${prefix}d:${pair.dark}`;
}
