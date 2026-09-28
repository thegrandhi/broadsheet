// Sortable data table with a sticky first column. Sorting happens in the
// browser; the initial order is applied at build time so it works without JS.
import { formatValue } from '../shared/format.js';
import { makeScale } from '../color.js';
import { esc, keyOf, figure, rowsOf, widthClass } from './util.js';

export function renderTable(cfg, ctx) {
  const rows = rowsOf(cfg.rows, 'table', cfg.line);
  const columns = (cfg.columns || Object.keys(rows[0]).map(key => ({ key }))).map(c => (typeof c === 'string' ? { key: c } : c));
  const numeric = c => rows.every(r => r[c.key] == null || typeof r[c.key] === 'number');
  columns.forEach(c => {
    c.num = numeric(c);
    c.label ??= c.key;
    c.format ??= c.num ? 'number' : 'text';
    c.order ??= c.num ? 'desc' : 'asc';
    if (c.swatch) c.scale = makeScale(c.swatch, rows.map(r => r[c.swatch.value]), ctx.palettes);
  });
  const keyCol = cfg.key || columns[0].key;

  let sorted = rows;
  const sortCol = columns.find(c => c.key === cfg.sort);
  if (sortCol) {
    const dir = (cfg.order || sortCol.order) === 'asc' ? 1 : -1;
    sorted = [...rows].sort((a, b) => cmp(a[sortCol.key], b[sortCol.key]) * dir);
  }

  const minWidth = cfg.minWidth ?? (columns.length > 5 ? columns.length * 96 : 0);
  const head = columns.map((c, i) => {
    const sortedHere = sortCol === c;
    const dir = sortedHere ? ((cfg.order || c.order) === 'asc' ? 'ascending' : 'descending') : null;
    return `<th scope="col" class="${c.num ? 'num' : 'txt'}" data-col="${i}" data-order="${c.order}"${dir ? ` aria-sort="${dir}"` : ''}>` +
      `<button type="button">${esc(c.label)}<span class="arrow" aria-hidden="true">${dir === 'ascending' ? ' ↑' : dir === 'descending' ? ' ↓' : ''}</span></button></th>`;
  }).join('');

  const body = sorted.map(r => {
    const cells = columns.map(c => {
      const v = r[c.key];
      let text = c.labels && c.labels[v] !== undefined ? String(c.labels[v]) : formatValue(v, c.format);
      let cls = c.num ? 'num' : 'txt';
      if (c.tone === 'sign' && typeof v === 'number') cls += v > 0 ? ' pos' : v < 0 ? ' neg' : '';
      let sw = '';
      if (c.scale) {
        const col = c.scale(r[c.swatch.value]);
        sw = `<span class="sw dual-bg" style="--gl:${col.light};--gd:${col.dark}" aria-hidden="true"></span>`;
      }
      const sortVal = v == null ? '' : v;
      return `<td class="${cls}" data-sort="${esc(sortVal)}">${sw}${esc(text)}</td>`;
    }).join('');
    return `<tr data-key="${esc(keyOf(r[keyCol]))}" tabindex="0">${cells}</tr>`;
  }).join('\n');

  const table = `<p class="swipe">Swipe the table sideways for more columns →</p>` +
    `<div class="tablewrap"><table class="bs-table" data-sortable${minWidth ? ` style="min-width:${minWidth}px"` : ''}>` +
    `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  return figure({ ...cfg, width: widthClass(cfg.width, 'wide'), cls: 'tablefig', body: table, ctx });
}

function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}
