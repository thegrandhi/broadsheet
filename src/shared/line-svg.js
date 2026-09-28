// Line chart renderer shared by the build (static SVG fallback) and the
// browser runtime (re-rendered at the container's real width, with hover).
// Pure: takes a JSON spec, returns an SVG string. No DOM access.

import { formatValue } from './format.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHAR_W = 6.6; // average glyph width of 12px Libre Franklin, for label sizing

export function layout(spec, width) {
  const W = Math.max(300, Math.round(width));
  const narrow = W < 560;
  const H = spec.height ? (narrow ? Math.round(spec.height * 0.82) : spec.height) : (narrow ? 340 : 420);
  const yLabels = spec.y.ticks.map(v => formatValue(v, spec.y.format));
  const ml = Math.max(28, Math.max(...yLabels.map(s => s.length)) * CHAR_W + 12);
  const labelled = spec.series.filter(s => s.label || s.emph);
  const longest = Math.max(0, ...labelled.map(s => endLabel(spec, s, narrow).length));
  const mr = labelled.length ? Math.min(narrow ? 128 : 210, longest * CHAR_W + 22) : 14;
  const mt = 12, mb = 34;
  const [x0, x1] = [spec.xs[0], spec.xs[spec.xs.length - 1]];
  const { min, max } = spec.y;
  const x = v => ml + (W - ml - mr) * (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0));
  const y = v => mt + (H - mt - mb) * (1 - (v - min) / (max - min || 1));
  return { W, H, ml, mr, mt, mb, narrow, x, y, yLabels };
}

function endLabel(spec, s, narrow) {
  const name = narrow && s.short ? s.short : s.name;
  const last = lastValue(s);
  return spec.endFormat === false || last == null ? name : `${name} ${formatValue(last, spec.endFormat ?? spec.y.format)}`;
}

function lastValue(s) {
  for (let i = s.values.length - 1; i >= 0; i--) if (s.values[i] != null) return s.values[i];
  return null;
}

function pathFor(L, xs, values) {
  let d = '', pen = false;
  values.forEach((v, i) => {
    if (v == null || Number.isNaN(v)) { pen = false; return; }
    d += (pen ? 'L' : 'M') + L.x(xs[i]).toFixed(1) + ',' + L.y(v).toFixed(1);
    pen = true;
  });
  return d;
}

function colorStyle(s) {
  return s.cl ? ` style="--cl:${s.cl};--cd:${s.cd || s.cl}"` : '';
}

// state: { emph: Set<key>, hover: key|null }
export function renderLine(spec, width, state = {}) {
  const L = layout(spec, width);
  const emph = new Set([...(state.emph || []), ...spec.series.filter(s => s.emph).map(s => s.key)]);
  if (state.hover != null) emph.add(state.hover);
  const dim = state.hover != null;
  const out = [];
  out.push(`<svg${spec.series.length <= 8 ? ' class="few"' : ''} viewBox="0 0 ${L.W} ${L.H}" width="${L.W}" height="${L.H}" role="img" aria-label="${esc(spec.aria || 'Line chart')}">`);

  // Grid: solid hairlines; reference lines are dashed and labelled.
  spec.y.ticks.forEach((v, i) => {
    const yy = L.y(v).toFixed(1);
    out.push(`<line class="grid${v === spec.y.min ? ' base' : ''}" x1="${L.ml}" x2="${L.W - L.mr}" y1="${yy}" y2="${yy}"/>`);
    out.push(`<text class="ax" x="${L.ml - 8}" y="${(+yy + 4).toFixed(1)}" text-anchor="end">${esc(L.yLabels[i])}</text>`);
  });
  for (const r of spec.refs || []) {
    const yy = L.y(r.y).toFixed(1);
    out.push(`<line class="ref" x1="${L.ml}" x2="${L.W - L.mr}" y1="${yy}" y2="${yy}"/>`);
    const label = L.narrow && r.short ? r.short : r.label;
    if (label) out.push(`<text class="ax halo" x="${L.W - L.mr - 6}" y="${yy - 5}" text-anchor="end">${esc(label)}</text>`);
  }
  const every = L.narrow ? spec.x.everyNarrow : spec.x.every;
  const ticks = [];
  spec.xs.forEach((v, i) => {
    const first = i === 0, last = i === spec.xs.length - 1;
    if (!first && !last && every && i % every) return;
    if (!every && !spec.x.ticks.includes(v)) return;
    let label = formatValue(v, spec.x.format);
    if (first && spec.x.first) label = spec.x.first;
    if (last && spec.x.last) label = spec.x.last;
    const anchor = first && spec.x.first ? 'start' : last && spec.x.last ? 'end' : 'middle';
    const px = L.x(v), w = label.length * CHAR_W * 0.96;
    const [a, b] = anchor === 'start' ? [px, px + w] : anchor === 'end' ? [px - w, px] : [px - w / 2, px + w / 2];
    ticks.push({ px, label, anchor, a, b, last });
  });
  // Drop inner ticks that would collide with a neighbour; the ends always stay.
  const kept = [];
  for (const t of ticks) {
    while (t.last && kept.length > 1 && kept[kept.length - 1].b + 8 > t.a) kept.pop();
    if (!kept.length || t.last || kept[kept.length - 1].b + 8 <= t.a) kept.push(t);
  }
  for (const t of kept) out.push(`<text class="ax" x="${t.px.toFixed(1)}" y="${L.H - 12}" text-anchor="${t.anchor}">${esc(t.label)}</text>`);
  if (state.cursor != null) {
    const cx = L.x(state.cursor).toFixed(1);
    out.push(`<line class="xhair" x1="${cx}" x2="${cx}" y1="${L.mt}" y2="${L.H - L.mb}"/>`);
  }

  // Lines: emphasised series drawn last, on a surface-coloured halo.
  const order = [...spec.series].sort((a, b) => (emph.has(a.key) ? 1 : 0) - (emph.has(b.key) ? 1 : 0));
  out.push('<g class="lines">');
  for (const s of order) {
    const d = pathFor(L, spec.xs, s.values);
    const on = emph.has(s.key);
    if (on) out.push(`<path class="halo" d="${d}"/>`);
    out.push(`<path class="ln dual${on ? ' on' : ''}${dim && !on ? ' dim' : ''}" data-key="${esc(s.key)}" d="${d}"${colorStyle(s)}/>`);
  }
  out.push('</g>');

  // Direct labels at the right edge, dodged so they never overlap.
  const labs = spec.series
    .filter(s => (s.label || emph.has(s.key)) && lastValue(s) != null)
    .map(s => ({ s, y0: L.y(lastValue(s)), y: L.y(lastValue(s)) }))
    .sort((a, b) => a.y - b.y);
  const gap = 14;
  for (let k = 1; k < labs.length; k++) if (labs[k].y - labs[k - 1].y < gap) labs[k].y = labs[k - 1].y + gap;
  const over = labs.length ? labs[labs.length - 1].y - (L.H - L.mb + 4) : 0;
  if (over > 0) labs.forEach(l => (l.y -= over));
  for (let k = labs.length - 2; k >= 0; k--) if (labs[k + 1].y - labs[k].y < gap) labs[k].y = labs[k + 1].y - gap;
  const xEnd = L.x(spec.xs[spec.xs.length - 1]);
  for (const l of labs) {
    out.push(`<line class="leader" x1="${(xEnd + 3).toFixed(1)}" x2="${(xEnd + 10).toFixed(1)}" y1="${l.y0.toFixed(1)}" y2="${l.y.toFixed(1)}"/>`);
    out.push(`<text class="lab${emph.has(l.s.key) ? ' on' : ''}" x="${(xEnd + 13).toFixed(1)}" y="${(l.y + 4).toFixed(1)}">${esc(endLabel(spec, l.s, L.narrow))}</text>`);
  }
  out.push(`<rect class="hit" x="${L.ml}" y="${L.mt}" width="${L.W - L.ml - L.mr}" height="${L.H - L.mt - L.mb}"/>`);
  out.push('</svg>');
  return out.join('');
}

// Nearest series to a pointer position, in SVG coordinates.
export function nearest(spec, width, px, py) {
  const L = layout(spec, width);
  let i = 0, bestDx = Infinity;
  spec.xs.forEach((v, k) => { const dx = Math.abs(L.x(v) - px); if (dx < bestDx) { bestDx = dx; i = k; } });
  let best = null, bd = Infinity;
  for (const s of spec.series) {
    const v = s.values[i];
    if (v == null) continue;
    const d = Math.abs(L.y(v) - py);
    if (d < bd) { bd = d; best = s; }
  }
  return { index: i, x: spec.xs[i], series: best, dist: bd, inPlot: px >= L.ml - 4 && px <= L.W - L.mr + 4 };
}
