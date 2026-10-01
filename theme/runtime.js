// Broadsheet browser runtime: theme toggle, tooltips, linked selection,
// line-chart hover and re-rendering, and table sorting. Everything here is
// progressive enhancement; pages are complete without it.
import { renderLine, nearest, layout } from './line-svg.js';
import { formatValue } from './format.js';

const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* Theme toggle */
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const effectiveTheme = () => document.documentElement.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
for (const btn of $$('.theme-toggle')) {
  btn.addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('bs-theme', next); } catch { /* storage unavailable */ }
  });
}

/* Tooltip. Content is built with textContent: labels come from data files. */
const tip = document.getElementById('tip');
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function showTip({ t, rows }, x, y) {
  if (!tip) return;
  tip.replaceChildren();
  if (t) tip.append(el('div', 'tt', t));
  for (const r of rows) {
    const row = el('div', 'row');
    const label = el('span');
    if (r.color) {
      const key = el('i', 'dual');
      key.style.setProperty('--cl', r.color[0]);
      key.style.setProperty('--cd', r.color[1]);
      label.append(key);
    }
    label.append(r.label ?? r[0]);
    const value = el(r.strong === false ? 'span' : 'b', null, r.value ?? r[1]);
    row.append(label, value);
    tip.append(row);
  }
  tip.hidden = false;
  const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
  let left = x + pad, top = y + pad;
  if (left + w > innerWidth - 8) left = x - w - pad;
  if (top + h > innerHeight - 8) top = y - h - pad;
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = Math.max(8, top) + 'px';
}
const hideTip = () => { if (tip) tip.hidden = true; };

const tipData = node => { try { return JSON.parse(node.dataset.tip); } catch { return null; } };
document.addEventListener('pointermove', e => {
  const node = e.target.closest?.('[data-tip]');
  if (!node) return;
  const d = tipData(node);
  if (d) showTip(d, e.clientX, e.clientY);
});
document.addEventListener('pointerout', e => {
  const node = e.target.closest?.('[data-tip]');
  if (node && !node.contains(e.relatedTarget)) hideTip();
});
document.addEventListener('focusin', e => {
  const node = e.target.closest?.('[data-tip]');
  if (!node) return;
  const r = node.getBoundingClientRect(), d = tipData(node);
  if (d) showTip(d, r.right, r.top);
});
document.addEventListener('focusout', hideTip);
addEventListener('scroll', hideTip, { passive: true });

/* Linked selection: marks that share a data-key highlight together. */
let selected = null;
const lineCharts = [];
function select(key) {
  selected = selected === key ? null : key;
  for (const n of $$('.is-sel')) n.classList.remove('is-sel');
  if (selected) for (const n of $$('[data-key]')) if (n.dataset.key === selected && !n.matches('path')) n.classList.add('is-sel');
  for (const c of lineCharts) c.draw();
}
document.addEventListener('click', e => {
  const node = e.target.closest?.('.fig [data-key]');
  if (node && !node.closest('[data-linechart]') && !e.target.closest('a,button,summary')) select(node.dataset.key);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const node = e.target.closest?.('.fig [data-key][tabindex]');
  if (node && node === e.target) { e.preventDefault(); select(node.dataset.key); }
});

/* Line charts: re-render at the real width, crosshair + tooltip on hover. */
for (const host of $$('[data-linechart]')) {
  const plot = host.querySelector('.lc-plot');
  let spec;
  try { spec = JSON.parse(host.querySelector('script[type="application/json"]').textContent); } catch { continue; }
  const state = { hover: null, cursor: null };
  let width = 0;
  const draw = () => {
    width = plot.clientWidth || width;
    if (!width) return;
    plot.innerHTML = renderLine(spec, width, { ...state, emph: selected ? [selected] : [] });
  };
  const fmtX = x => (spec.tipTitle || `${spec.xName} {x}`).replace('{x}', formatValue(x, spec.x.format));
  plot.addEventListener('pointermove', e => {
    const svg = plot.querySelector('svg');
    const r = svg.getBoundingClientRect(), L = layout(spec, width);
    const px = (e.clientX - r.left) * (L.W / r.width), py = (e.clientY - r.top) * (L.H / r.height);
    const n = nearest(spec, width, px, py);
    if (!n.inPlot) { if (state.cursor != null) { state.cursor = state.hover = null; draw(); } hideTip(); return; }
    const hover = n.series && n.dist <= 24 ? n.series.key : null;
    if (hover !== state.hover || n.x !== state.cursor) { state.hover = hover; state.cursor = n.x; draw(); }
    const fmt = spec.tipFormat;
    let rows;
    if (spec.series.length <= 6) {
      rows = spec.series.filter(s => s.values[n.index] != null)
        .sort((a, b) => b.values[n.index] - a.values[n.index])
        .map(s => ({ label: s.name, value: formatValue(s.values[n.index], fmt), color: [s.cl, s.cd], strong: !hover || s.key === hover }));
    } else if (hover) {
      rows = [{ label: n.series.name, value: formatValue(n.series.values[n.index], fmt), color: [n.series.cl, n.series.cd] }];
    }
    if (rows?.length) showTip({ t: fmtX(n.x), rows }, e.clientX, e.clientY); else hideTip();
  });
  plot.addEventListener('pointerleave', () => { state.hover = state.cursor = null; draw(); hideTip(); });
  plot.addEventListener('click', () => { if (state.hover) select(state.hover); });
  new ResizeObserver(() => { if (plot.clientWidth !== width) draw(); }).observe(plot);
  lineCharts.push({ draw });
  draw();
}

/* Sortable tables */
for (const table of $$('table[data-sortable]')) {
  const heads = $$('thead th', table);
  heads.forEach((th, col) => {
    th.querySelector('button')?.addEventListener('click', () => {
      const current = th.getAttribute('aria-sort');
      const dir = current ? (current === 'ascending' ? -1 : 1) : (th.dataset.order === 'asc' ? 1 : -1);
      const num = th.classList.contains('num');
      const body = table.tBodies[0];
      const rows = [...body.rows].sort((a, b) => {
        const va = a.cells[col].dataset.sort, vb = b.cells[col].dataset.sort;
        if (va === '' || vb === '') return va === vb ? 0 : va === '' ? 1 : -1;
        return (num ? va - vb : va.localeCompare(vb)) * dir;
      });
      body.append(...rows);
      for (const h of heads) {
        h.removeAttribute('aria-sort');
        const arrow = h.querySelector('.arrow');
        if (arrow) arrow.textContent = '';
      }
      th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending');
      th.querySelector('.arrow').textContent = dir > 0 ? ' ↑' : ' ↓';
    });
  });
}
for (const fig of $$('.tablefig')) {
  const wrap = fig.querySelector('.tablewrap');
  const check = () => fig.classList.toggle('overflowing', wrap.scrollWidth > wrap.clientWidth + 1);
  new ResizeObserver(check).observe(wrap);
}

/* Timelines: collapse long logs behind "Show all", and filter by key / major. */
for (const fig of $$('[data-timeline]')) {
  const more = fig.querySelector('.tl-more');
  if (more && fig.querySelector('[data-extra]')) {
    fig.classList.add('collapsed');
    more.hidden = false;
    more.addEventListener('click', () => { fig.classList.remove('collapsed'); more.hidden = true; });
  }
  const tools = fig.querySelector('.tl-tools');
  if (!tools) continue;
  tools.hidden = false;
  const select = tools.querySelector('.tl-filter');
  const major = tools.querySelector('.tl-major');
  const apply = () => {
    const key = select?.value || '';
    const onlyMajor = !!major?.checked;
    for (const item of $$('.tl-item', fig)) {
      const keys = item.dataset.keys ? item.dataset.keys.split('|') : [];
      const show = (!key || keys.includes(key)) && (!onlyMajor || item.dataset.major === '1');
      item.classList.toggle('filtered', !show);
    }
    const name = select?.selectedOptions[0]?.textContent || '';
    for (const group of $$('.tl-group', fig)) {
      const quiet = group.querySelector('.tl-quiet');
      const visible = group.querySelector('.tl-item:not(.filtered)');
      quiet.hidden = !!visible;
      quiet.textContent = key ? fig.dataset.quietFiltered.replace('{name}', name) : fig.dataset.quiet;
    }
  };
  select?.addEventListener('change', apply);
  major?.addEventListener('change', apply);
}
