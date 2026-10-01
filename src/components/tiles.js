// Tile grid map: one square per place, positioned by `col`/`row`, colored by value.
import { formatValue } from '../shared/format.js';
import { makeScale, textOn } from '../color.js';
import { esc, keyOf, tipAttr, figure, dataView, rowsOf, requireFields, widthClass } from './util.js';

const T = 58, GAP = 4, PITCH = T + GAP;

export function renderTiles(cfg, ctx) {
  requireFields(cfg, ['value'], 'chart', cfg.line);
  const rows = rowsOf(cfg.rows, 'chart', cfg.line);
  const colK = cfg.col || 'col', rowK = cfg.row || 'row';
  const idK = cfg.id || 'id', nameK = cfg.name || 'name';
  const keyK = cfg.key || nameK;
  const fmt = cfg.format ?? 'number';
  const scale = makeScale(cfg, rows.map(r => r[cfg.value]), ctx.palettes);
  const cols = Math.max(...rows.map(r => r[colK])) + 1;
  const rws = Math.max(...rows.map(r => r[rowK])) + 1;
  const W = cols * PITCH, H = rws * PITCH;
  const extraTip = cfg.tooltip || [];

  const out = [`<svg class="tiles-svg" viewBox="-4 -4 ${W + 8} ${H + 8}" role="group" aria-label="${esc(cfg.title || 'Tile map')}">`];
  for (const a of cfg.annotations || []) {
    const lines = String(a.text).split('\n');
    lines.forEach((t, k) => out.push(`<text class="geo" x="${a.x * PITCH}" y="${a.y * PITCH + k * 13}" text-anchor="${a.anchor || 'middle'}">${esc(t)}</text>`));
  }
  for (const r of rows) {
    const v = r[cfg.value];
    const c = scale(v);
    const tl = textOn(c.light), td = textOn(c.dark);
    const name = r[nameK] ?? r[idK];
    const valueText = formatValue(v, fmt);
    const tipRows = [[cfg.valueLabel || cfg.value, valueText], ...extraTip.map(t => [t.label || t.key, formatValue(r[t.key], t.format)])];
    out.push(
      `<g class="tile dual" transform="translate(${r[colK] * PITCH},${r[rowK] * PITCH})" tabindex="0" role="button" data-key="${esc(keyOf(r[keyK]))}" aria-label="${esc(name)}: ${esc(valueText)}"` +
      ` style="--cl:${c.light};--cd:${c.dark};--tl:${tl};--td:${td}"${tipAttr(name, tipRows)}>` +
      `<rect class="fill" width="${T}" height="${T}" rx="2"/>` +
      `<text class="tid" x="7" y="19">${esc(r[idK] ?? '')}</text>` +
      `<text class="tval" x="7" y="${T - 8}">${esc(valueText)}</text>` +
      `<rect class="sel" x="1.5" y="1.5" width="${T - 3}" height="${T - 3}" rx="1.5"/></g>`
    );
  }
  out.push('</svg>');

  const [lo, hi] = scale.domain;
  const legend = `<div class="legend"><span class="label">${esc(cfg.legend || cfg.valueLabel || cfg.value)}</span>` +
    `<div><div class="lbar dual-bg" style="--gl:${scale.gradient('light')};--gd:${scale.gradient('dark')}"></div>` +
    `<div class="ticks"><span>${esc(formatValue(lo, fmt))}</span><span>${esc(formatValue((lo + hi) / 2, fmt))}</span><span>${esc(formatValue(hi, fmt))}</span></div></div>` +
    (cfg.legendNote ? `<span class="legend-note">${ctx.inline(cfg.legendNote)}</span>` : '') + '</div>';

  const dv = cfg.dataView === false ? '' : dataView(
    [{ key: nameK, label: cfg.nameTitle || 'Name', format: 'text' }, { key: cfg.value, label: cfg.valueLabel || cfg.value, format: fmt }], rows);
  const body = `<div class="tiles" style="max-width:${Math.max(320, W + 8)}px">${out.join('')}</div>${legend}`;
  ctx.thumbs?.push(`<div class="tiles">${out.join('')}</div>`);
  return figure({ ...cfg, width: widthClass(cfg.width, 'mid'), body, dataTable: dv, ctx });
}
