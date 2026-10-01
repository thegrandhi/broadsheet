// Stat tiles and image figures.
import { esc, figure, widthClass } from './util.js';

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
