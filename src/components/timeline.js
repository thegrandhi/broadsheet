// Timeline / event log. Two layouts:
//   flat     items with a `when` column on the left
//   grouped  items under group headings (e.g. one per year), each heading with
//            an optional note; empty groups say so ("A quiet year.")
// Items can carry a body, a "what happens next" note, a tone (crisis, soft,
// good), the keys they involve (for the filter) and a `major` flag.
import { loadData } from '../data.js';
import { esc, keyOf, figure, rowsOf, widthClass } from './util.js';

const TONES = new Set(['crisis', 'soft', 'good']);

export function renderTimeline(cfg, ctx) {
  let groups = typeof cfg.groups === 'string' ? loadData(cfg.groups, ctx.baseDir) : cfg.groups;
  const rows = cfg.rows ?? cfg.items;
  if (!groups && Array.isArray(rows) && rows.length && rows.every(r => Array.isArray(r.items))) groups = rows;
  const f = {
    when: 'when', sub: 'sub', kind: 'kind', title: 'title', detail: 'detail', body: 'body', next: 'next',
    soft: 'soft', tone: 'tone', key: 'key', keys: 'keys', major: 'major', ...(cfg.fields || {}),
  };
  const nextLabel = cfg.nextLabel ?? 'What happens next:';
  const truthy = v => v === true || v === 'true' || v === 'yes';

  const keysOf = it => [].concat(it[f.keys] ?? [], it[f.key] ?? []).filter(k => k !== '' && k != null).map(String);
  const toneOf = it => (TONES.has(it[f.tone]) ? it[f.tone] : truthy(it[f.soft]) ? 'soft' : 'crisis');
  const attrs = it => {
    const keys = keysOf(it);
    return ` data-keys="${esc(keys.map(keyOf).join('|'))}" data-major="${truthy(it[f.major]) ? 1 : 0}"`;
  };
  const content = it => {
    const tone = toneOf(it);
    const body = it[f.body] ?? it[f.detail];
    return (it[f.kind] ? `<div class="k ${tone}">${esc(it[f.kind])}</div>` : '') +
      `<div class="t">${ctx.inline(String(it[f.title] ?? ''))}</div>` +
      (body ? `<div class="b">${ctx.inline(String(body))}</div>` : '') +
      (it[f.next] ? `<div class="n">${nextLabel ? `<b>${esc(nextLabel)}</b> ` : ''}${ctx.inline(String(it[f.next]))}</div>` : '');
  };

  const allItems = groups ? groups.flatMap(g => g.items || []) : rowsOf(rows, 'timeline', cfg.line);
  let body = '';

  if (cfg.stats) {
    body += `<div class="tl-stats">${cfg.stats.map(s => `<span><b>${esc(s.value)}</b>${ctx.inline(String(s.label ?? ''))}</span>`).join('')}</div>`;
  }
  if (cfg.count) body += `<p class="note count">${ctx.inline(cfg.count)}</p>`;

  let limit, moreLabel;
  if (groups) {
    limit = cfg.limitGroups ?? cfg.limit ?? groups.length;
    moreLabel = cfg.moreLabel ?? `Show all ${groups.length} ${cfg.groupNoun ?? 'groups'}`;
    const quiet = cfg.quiet ?? 'Nothing happened.';
    body += '<div class="tl">' + groups.map((g, gi) => {
      const items = g.items || [];
      const note = g.note ? `<span class="tl-note${g.tone === 'bad' ? ' bad' : ''}">${ctx.inline(String(g.note))}</span>` : '';
      return `<section class="tl-group"${gi >= limit ? ' data-extra' : ''}>` +
        `<div class="tl-head"><span class="tl-title">${esc(g.title ?? '')}</span>${note}</div>` +
        items.map(it => `<div class="ev tl-item ${toneOf(it)}"${attrs(it)}><span class="dot" aria-hidden="true"></span><div>${content(it)}</div></div>`).join('\n') +
        `<p class="tl-quiet"${items.length ? ' hidden' : ''}>${esc(quiet)}</p></section>`;
    }).join('\n') + '</div>';
  } else {
    limit = cfg.limit ?? allItems.length;
    moreLabel = cfg.moreLabel ?? `Show all ${allItems.length} events`;
    body += '<ol class="log">' + allItems.map((it, i) =>
      `<li class="tl-item"${attrs(it)}${i >= limit ? ' data-extra' : ''}><div class="y">${esc(it[f.when] ?? '')}${it[f.sub] ? `<small>${esc(it[f.sub])}</small>` : ''}</div><div>${content(it)}</div></li>`
    ).join('\n') + '</ol>';
  }
  body += `<button class="btn tl-more" type="button" hidden>${esc(moreLabel)}</button>`;

  // Filter controls, revealed by the runtime (they need JavaScript to work).
  let tools = '';
  if (cfg.filter) {
    const names = new Map();
    for (const it of allItems) for (const k of keysOf(it)) names.set(keyOf(k), k);
    const options = [...names].sort((a, b) => a[1].localeCompare(b[1]));
    tools = `<div class="tl-tools" hidden>` +
      `<label>${esc(cfg.filterLabel ?? 'Show')} <select class="tl-filter"><option value="">${esc(cfg.filterAll ?? 'Everything')}</option>` +
      options.map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('') + `</select></label>` +
      (allItems.some(it => truthy(it[f.major])) ? `<label class="chk"><input type="checkbox" class="tl-major"> ${esc(cfg.majorLabel ?? 'Major events only')}</label>` : '') +
      `</div>`;
  }
  const quietFiltered = cfg.quietFiltered ?? 'Nothing for {name}.';
  return figure({
    ...cfg, width: widthClass(cfg.width, 'col'), cls: 'timeline', ctx,
    body: tools + body,
    attrs: ` data-timeline data-quiet="${esc(cfg.quiet ?? 'Nothing happened.')}" data-quiet-filtered="${esc(quietFiltered)}"`,
  });
}
