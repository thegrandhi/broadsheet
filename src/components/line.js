// Multi-series line chart. The SVG is rendered at build time (so it shows
// without JavaScript) and re-rendered by the runtime at the real width.
import { renderLine } from '../shared/line-svg.js';
import { formatValue } from '../shared/format.js';
import { makeScale } from '../color.js';
import { esc, keyOf, figure, dataView, rowsOf, requireFields, widthClass } from './util.js';

function niceTicks(lo, hi, count = 5) {
  const span = hi - lo || 1;
  const step0 = span / (count - 1);
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || step0;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

export function renderLineChart(cfg, ctx) {
  requireFields(cfg, ['x'], 'chart', cfg.line);
  const rows = rowsOf(cfg.rows, 'chart', cfg.line);
  let xs, series;
  if (cfg.series) {
    // Long format: one row per (series, x, y).
    requireFields(cfg, ['y'], 'chart', cfg.line);
    xs = [...new Set(rows.map(r => r[cfg.x]))].sort((a, b) => a - b);
    const bySeries = new Map();
    for (const r of rows) {
      const s = String(r[cfg.series]);
      if (!bySeries.has(s)) bySeries.set(s, new Map());
      bySeries.get(s).set(r[cfg.x], r[cfg.y]);
    }
    series = [...bySeries].map(([name, m]) => ({ name, values: xs.map(x => m.get(x) ?? null) }));
  } else {
    // Wide format: an x column plus one column per series.
    const sorted = [...rows].sort((a, b) => a[cfg.x] - b[cfg.x]);
    xs = sorted.map(r => r[cfg.x]);
    const cols = cfg.columns || Object.keys(rows[0]).filter(k => k !== cfg.x);
    series = cols.map(name => ({ name, values: sorted.map(r => (typeof r[name] === 'number' ? r[name] : null)) }));
  }

  const all = series.flatMap(s => s.values).filter(v => v != null);
  const [ymin, ymax] = cfg.yDomain || [Math.min(0, ...all), Math.max(...all)];
  const yTicks = cfg.yTicks || niceTicks(ymin, ymax);
  const yFormat = cfg.yFormat ?? 'number';

  // Color: by each series' last value on a scale, fixed per series, or one accent.
  const pal = ctx.palettes;
  const last = s => [...s.values].reverse().find(v => v != null);
  const scale = cfg.colorBy === 'last' ? makeScale(cfg, series.map(last), pal) : null;
  const fixed = cfg.colors || {};
  const labels = new Set((Array.isArray(cfg.labels) ? cfg.labels : []).map(keyOf));
  if (cfg.labelExtremes) {
    const byLast = [...series].sort((a, b) => last(b) - last(a));
    byLast.slice(0, cfg.labelExtremes).forEach(s => labels.add(keyOf(s.name)));
    byLast.slice(-cfg.labelExtremes).forEach(s => labels.add(keyOf(s.name)));
  }
  const emph = new Set((cfg.highlight || []).map(keyOf));
  series = series.map((s, i) => {
    let c;
    if (fixed[s.name]) c = typeof fixed[s.name] === 'object' ? fixed[s.name] : { light: fixed[s.name], dark: fixed[s.name] };
    else if (scale) c = scale(last(s));
    else if (series.length <= 8 && cfg.color !== 'accent') c = { light: pal.light.categorical[i], dark: pal.dark.categorical[i] };
    else c = { light: pal.light.accent, dark: pal.dark.accent };
    const key = keyOf(s.name);
    return {
      key, name: s.name, short: cfg.shortNames?.[s.name], values: s.values, cl: c.light, cd: c.dark,
      label: cfg.labels === 'all' || labels.has(key) || series.length <= 4, emph: emph.has(key),
    };
  });

  const spec = {
    xs, series, height: cfg.height,
    y: { min: ymin, max: ymax, ticks: yTicks, format: yFormat },
    x: { format: cfg.xFormat ?? 'text', first: cfg.xFirst, last: cfg.xLast, every: cfg.xEvery ?? Math.max(1, Math.ceil(xs.length / 10)), everyNarrow: cfg.xEveryNarrow ?? Math.max(1, Math.ceil(xs.length / 4)), ticks: [] },
    refs: cfg.refLines || [],
    endFormat: cfg.endFormat ?? yFormat,
    tipFormat: cfg.tipFormat ?? yFormat,
    tipTitle: cfg.tipTitle,
    xName: cfg.xName || cfg.x,
    aria: cfg.title ? String(cfg.title) : 'Line chart',
  };

  // Legend: a scale bar when colored by value, line keys for a handful of series.
  let legend = '';
  if (scale) {
    const [lo, hi] = scale.domain;
    legend = `<div class="legend"><span class="label">${esc(cfg.legend || 'Color')}</span><div><div class="lbar dual-bg" style="--gl:${scale.gradient('light')};--gd:${scale.gradient('dark')}"></div>` +
      `<div class="ticks"><span>${esc(formatValue(lo, yFormat))}</span><span>${esc(formatValue(hi, yFormat))}</span></div></div></div>`;
  } else if (series.length > 1 && series.length <= 8) {
    legend = `<div class="legend keys">${series.map(s => `<span class="key"><i class="dual" style="--cl:${s.cl};--cd:${s.cd}"></i>${esc(s.name)}</span>`).join('')}</div>`;
  }

  ctx.thumbs?.push(`<div class="linechart">${renderLine(spec, 1000)}</div>`);
  const json = JSON.stringify(spec).replace(/</g, '\\u003c');
  const body = `${legend}<div class="linechart" data-linechart><div class="lc-plot">${renderLine(spec, 1000)}</div><script type="application/json">${json}</script></div>`;
  const cols = [{ key: cfg.x, label: cfg.xName || cfg.x, format: cfg.xFormat ?? 'text' }, ...series.map(s => ({ key: s.name, label: s.name, format: yFormat }))];
  const dvRows = xs.map((x, i) => Object.fromEntries([[cfg.x, x], ...series.map(s => [s.name, s.values[i]])]));
  const dv = cfg.dataView === false ? '' : dataView(cols, dvRows);
  return figure({ ...cfg, width: widthClass(cfg.width, 'wide'), body, dataTable: dv, ctx });
}
