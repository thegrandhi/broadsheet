// Horizontal bar chart built from HTML, so it reflows at any width.
// Negative values switch it to a diverging layout around a centre line.
import { formatValue } from '../shared/format.js';
import { esc, keyOf, tipAttr, figure, dataView, rowsOf, requireFields, widthClass } from './util.js';

export function renderBar(cfg, ctx) {
  requireFields(cfg, ['label', 'value'], 'chart', cfg.line);
  let rows = rowsOf(cfg.rows, 'chart', cfg.line).filter(r => typeof r[cfg.value] === 'number');
  if (cfg.sort !== 'none') {
    const dir = cfg.sort === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => (a[cfg.value] - b[cfg.value]) * dir);
  }
  const vals = rows.map(r => r[cfg.value]);
  const diverging = cfg.diverging ?? vals.some(v => v < 0);
  const max = cfg.max ?? (Math.max(...vals.map(Math.abs)) || 1);
  const fmt = cfg.format ?? (diverging ? '+number' : 'number');
  const pal = ctx.palettes;
  const pos = cfg.positiveColor || { light: pal.light.diverging.at(-1), dark: pal.dark.diverging.at(-1) };
  const neg = cfg.negativeColor || { light: pal.light.diverging[0], dark: pal.dark.diverging[0] };
  const one = { light: pal.light.accent, dark: pal.dark.accent };
  const keyCol = cfg.key || cfg.label;
  const highlight = new Set((cfg.highlight || []).map(keyOf));

  const out = [`<div class="bars${diverging ? ' diverging' : ''}" role="list">`];
  if (diverging && (cfg.negativeLabel || cfg.positiveLabel)) {
    out.push(`<div class="bars-axis" aria-hidden="true"><span></span><div class="lr"><span class="neg">${esc(cfg.negativeLabel ? '◂ ' + cfg.negativeLabel : '')}</span><span class="pos">${esc(cfg.positiveLabel ? cfg.positiveLabel + ' ▸' : '')}</span></div><span></span></div>`);
  }
  for (const r of rows) {
    const v = r[cfg.value];
    const w = (Math.min(Math.abs(v), max) / max) * (diverging ? 50 : 100);
    const c = !diverging ? one : v >= 0 ? pos : neg;
    const place = !diverging ? 'left:0' : v >= 0 ? 'left:50%' : 'right:50%';
    const label = String(r[cfg.label]);
    const valueText = formatValue(v, fmt);
    out.push(
      `<div class="brow${highlight.has(keyOf(r[keyCol])) ? ' is-hl' : ''}" role="listitem" tabindex="0" data-key="${esc(keyOf(r[keyCol]))}" aria-label="${esc(label)}: ${esc(valueText)}"` +
      tipAttr(label, [[cfg.valueLabel || cfg.value, valueText]]) + '>' +
      `<span class="nm">${esc(label)}</span>` +
      `<span class="track"><span class="b dual ${v >= 0 ? 'up' : 'dn'}" style="${place};width:${w.toFixed(2)}%;--cl:${c.light};--cd:${c.dark}"></span></span>` +
      `<span class="v">${esc(valueText)}</span></div>`
    );
  }
  out.push('</div>');
  const dv = cfg.dataView === false ? '' : dataView(
    [{ key: cfg.label, label: cfg.labelTitle || cfg.label, format: 'text' }, { key: cfg.value, label: cfg.valueLabel || cfg.value, format: fmt }], rows);
  return figure({ ...cfg, width: widthClass(cfg.width, 'mid'), body: out.join(''), dataTable: dv, ctx });
}
