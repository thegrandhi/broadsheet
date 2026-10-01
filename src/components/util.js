import { formatValue } from '../shared/format.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const WIDTHS = new Set(['col', 'mid', 'wide']);
export const widthClass = (w, fallback) => (WIDTHS.has(w) ? w : fallback);

// Keys link marks across components: selecting "Punjab" in a table highlights
// Punjab on the map and in the bar chart.
export const keyOf = v => String(v ?? '').trim().toLowerCase();

// Tooltip payload read by the runtime (rendered with textContent, never innerHTML).
export const tipAttr = (title, rows) => ` data-tip="${esc(JSON.stringify({ t: String(title), rows }))}"`;

export function requireFields(config, fields, name, line) {
  for (const f of fields) {
    if (config[f] === undefined) throw new Error(`line ${line}: :::${name} needs a "${f}" field`);
  }
}

export function rowsOf(data, name, line) {
  if (!Array.isArray(data) || !data.length) throw new Error(`line ${line}: :::${name} has no data rows`);
  return data;
}

// Shared figure frame: title, subtitle, body, note, source, optional data table.
export function figure({ width, id, cls = '', title, subtitle, note, source, body, dataTable, attrs = '', ctx }) {
  const parts = [`<figure class="fig ${width}${cls ? ' ' + cls : ''}"${id ? ` id="${esc(id)}"` : ''}${attrs}>`];
  if (title) parts.push(`<p class="gfx-title">${ctx.inline(title)}</p>`);
  if (subtitle) parts.push(`<p class="gfx-sub">${ctx.inline(subtitle)}</p>`);
  parts.push(body);
  const foot = [];
  if (note) foot.push(ctx.inline(note));
  if (source) foot.push(`Source: ${ctx.inline(source)}`);
  if (foot.length || dataTable) {
    parts.push('<figcaption class="note">');
    parts.push(foot.join(' '));
    if (dataTable) parts.push(dataTable);
    parts.push('</figcaption>');
  }
  parts.push('</figure>');
  return parts.join('\n');
}

// Plain accessible table of the underlying numbers, collapsed by default.
export function dataView(columns, rows) {
  const head = columns.map(c => `<th scope="col">${esc(c.label)}</th>`).join('');
  const body = rows.map(r => '<tr>' + columns.map(c => `<td>${esc(formatValue(r[c.key], c.format))}</td>`).join('') + '</tr>').join('');
  return `<details class="dataview"><summary>View the data</summary><div class="dv-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></details>`;
}
