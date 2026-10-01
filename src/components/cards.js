// Card grid: one card per item, each with a title, a summary line, and labelled
// fields. A field can be text, a quotation, or a short ranked list of mini bars.
import { formatValue } from '../shared/format.js';
import { esc, keyOf, tipAttr, figure, rowsOf, widthClass } from './util.js';

const TONES = new Set(['neg', 'pos', 'accent', 'none']);

export function renderCards(cfg, ctx) {
  const cards = rowsOf(cfg.rows ?? cfg.items, 'cards', cfg.line);
  const card = c => {
    const tone = TONES.has(c.tone) ? c.tone : TONES.has(cfg.tone) ? cfg.tone : 'none';
    const fields = (c.fields || []).map(fl => {
      let dd;
      if (fl.bars) {
        const fmt = fl.format ?? 'number';
        const max = fl.max ?? (fmt === 'percent' || fmt === '+percent' ? 1 : Math.max(...fl.bars.map(b => Math.abs(b.value))) || 1);
        dd = fl.bars.length
          ? `<div class="minibars">${fl.bars.map(b => {
              const v = formatValue(b.value, fmt);
              return `<div class="mb" tabindex="0" role="button" data-key="${esc(keyOf(b.key ?? b.name))}" aria-label="${esc(b.name)}: ${esc(v)}"${tipAttr(b.name, [[fl.valueLabel || c.title, v]])}>` +
                `<span class="nm">${esc(b.name)}</span><span class="tr"><i style="width:${(Math.min(Math.abs(b.value), max) / max * 100).toFixed(1)}%"></i></span><span class="p">${esc(v)}</span></div>`;
            }).join('')}</div>`
          : `<span class="none">${esc(fl.empty ?? 'None.')}</span>`;
      } else {
        dd = ctx.inline(String(fl.text ?? ''));
      }
      return `<dt>${esc(fl.label ?? '')}</dt><dd${fl.quote ? ' class="quote"' : ''}>${dd}</dd>`;
    }).join('');
    return `<article class="ccard tone-${tone}">` +
      `<h3>${ctx.inline(String(c.title ?? ''))}</h3>` +
      (c.stat ? `<div class="cstat">${ctx.inline(String(c.stat))}</div>` : '') +
      (c.text ? `<div class="ctext">${ctx.md(String(c.text))}</div>` : '') +
      (fields ? `<dl>${fields}</dl>` : '') + '</article>';
  };
  const body = `<div class="cardgrid" style="--cards:${Number(cfg.columns) || 3}">${cards.map(card).join('\n')}</div>`;
  return figure({ ...cfg, width: widthClass(cfg.width, 'wide'), cls: 'cards', body, ctx });
}
