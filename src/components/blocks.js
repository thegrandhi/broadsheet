// Timeline (event log), stat tiles, and image figures.
import { esc, keyOf, figure, rowsOf, widthClass } from './util.js';

export function renderTimeline(cfg, ctx) {
  const items = rowsOf(cfg.rows ?? cfg.items, 'timeline', cfg.line);
  const f = { when: 'when', sub: 'sub', kind: 'kind', title: 'title', detail: 'detail', soft: 'soft', key: 'key', ...(cfg.fields || {}) };
  const li = it => {
    const soft = it[f.soft] === true || it[f.soft] === 'true' || it[f.soft] === 'yes';
    const key = it[f.key] ? ` data-key="${esc(keyOf(it[f.key]))}"` : '';
    return `<li${key}><div class="y">${esc(it[f.when] ?? '')}${it[f.sub] ? `<small>${esc(it[f.sub])}</small>` : ''}</div><div>` +
      (it[f.kind] ? `<div class="k${soft ? ' soft' : ''}">${esc(it[f.kind])}</div>` : '') +
      `<div class="t">${ctx.inline(String(it[f.title] ?? ''))}</div>` +
      (it[f.detail] ? `<div class="d">${ctx.inline(String(it[f.detail]))}</div>` : '') + '</div></li>';
  };
  const limit = cfg.limit ?? items.length;
  let body = `<ol class="log">${items.slice(0, limit).map(li).join('\n')}</ol>`;
  if (items.length > limit) {
    body += `<details class="more"><summary>Show all ${items.length} events</summary>` +
      `<ol class="log" start="${limit + 1}">${items.slice(limit).map(li).join('\n')}</ol></details>`;
  }
  if (cfg.count) body = `<p class="note count">${ctx.inline(cfg.count)}</p>` + body;
  return figure({ ...cfg, width: widthClass(cfg.width, 'col'), body, ctx });
}

export function renderStats(cfg, ctx) {
  const parts = [];
  if (cfg.hero) {
    const h = cfg.hero;
    parts.push(`<div class="hero"><div class="big">${esc(h.value)}${h.unit ? `<small> ${esc(h.unit)}</small>` : ''}</div><div class="desc">${ctx.inline(h.text || '')}</div></div>`);
  }
  const items = cfg.items || [];
  if (items.length) {
    parts.push(`<div class="kv" style="--kv-cols:${cfg.columns || 2}">` + items.map(it =>
      `<div${it.wide ? ' class="span"' : ''}><b${it.tone ? ` class="${it.tone === 'pos' ? 'pos' : 'neg'}"` : ''}>${esc(it.value)}</b><span>${ctx.inline(String(it.label ?? ''))}</span></div>`
    ).join('') + '</div>');
  }
  return figure({ ...cfg, width: widthClass(cfg.width, 'col'), cls: 'stats', body: parts.join(''), ctx });
}

export function renderImage(cfg, ctx) {
  if (!cfg.src) throw new Error(`line ${cfg.line}: :::figure needs a "src" field`);
  const img = `<img src="${esc(cfg.src)}" alt="${esc(cfg.alt || '')}" loading="lazy">`;
  return figure({ ...cfg, width: widthClass(cfg.width, 'wide'), cls: 'image', body: img, ctx });
}
