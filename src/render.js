import YAML from 'yaml';
import { Marked } from 'marked';
import { parseBlocks, splitSections } from './directives.js';
import { loadData } from './data.js';
import { esc, widthClass } from './components/util.js';
import { renderBar } from './components/bar.js';
import { renderTiles } from './components/tiles.js';
import { renderLineChart } from './components/line.js';
import { renderTable } from './components/table.js';
import { renderStats, renderImage } from './components/blocks.js';
import { renderTimeline } from './components/timeline.js';
import { renderCards } from './components/cards.js';

export const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function createMarkdown() {
  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        return `<h${depth} id="${slugify(html)}">${html}</h${depth}>\n`;
      },
    },
  });
  return md;
}

const CHARTS = { bar: renderBar, line: renderLineChart, tiles: renderTiles };

// Prose containers: body is Markdown, wrapped at a given width with a class.
const PROSE = {
  callout: { width: 'col', cls: 'callout' },
  note: { width: 'col', cls: 'note-block' },
  methods: { width: 'col', cls: 'methods' },
  sources: { width: 'col', cls: 'sources' },
  prose: { width: 'col', cls: 'prose' },
  wide: { width: 'wide', cls: 'prose' },
};

export function renderStory(source, { baseDir, palettes, lineOffset = 0 }) {
  const md = createMarkdown();
  const ctx = {
    baseDir, palettes, thumbs: [],
    md: text => md.parse(text),
    inline: text => md.parseInline(String(text)),
  };
  const nodes = parseBlocks(source, lineOffset);
  const sections = splitSections(nodes);
  const html = sections.map(sec => {
    const inner = sec.map(n => renderNode(n, ctx)).join('\n');
    return `<section class="sec">\n${inner}\n</section>`;
  }).join('\n\n');
  return { html, thumb: ctx.thumbs[0] || null };
}

function renderNode(node, ctx) {
  if (node.type === 'md') return `<div class="col prose">${ctx.md(node.text)}</div>`;
  const { name, attrs } = node;
  const idAttr = attrs.id ? ` id="${esc(attrs.id)}"` : '';
  const extra = attrs.class ? ' ' + esc(attrs.class) : '';

  if (PROSE[name]) {
    const p = PROSE[name];
    const inner = node.children.map(c => (c.type === 'md' ? ctx.md(c.text) : renderNode(c, ctx))).join('\n');
    return `<div class="${widthClass(attrs.width, p.width)} ${p.cls}${extra}"${idAttr}>${inner}</div>`;
  }
  if (name === 'html') {
    const w = attrs.width ? widthClass(attrs.width, 'col') : null;
    return w ? `<div class="${w}${extra}"${idAttr}>${node.body}</div>` : node.body;
  }

  if (node.body === undefined) {
    throw new Error(`line ${node.line}: unknown block ":::${name}" (known blocks: ${KNOWN_BLOCKS.join(', ')})`);
  }
  let cfg;
  try {
    cfg = YAML.parse(node.body) || {};
  } catch (e) {
    throw new Error(`line ${node.line}: invalid YAML in :::${name}: ${e.message}`);
  }
  cfg = { ...cfg, ...attrs, line: node.line };
  if (cfg.data !== undefined) {
    try { cfg.rows = loadData(cfg.data, ctx.baseDir); }
    catch (e) { throw new Error(`line ${node.line}: ${e.message}`); }
  }
  switch (name) {
    case 'chart': {
      const fn = CHARTS[cfg.type];
      if (!fn) throw new Error(`line ${node.line}: unknown chart type "${cfg.type}" (use ${Object.keys(CHARTS).join(', ')})`);
      return fn(cfg, ctx);
    }
    case 'table': return renderTable(cfg, ctx);
    case 'timeline': return renderTimeline(cfg, ctx);
    case 'stats': return renderStats(cfg, ctx);
    case 'cards': return renderCards(cfg, ctx);
    case 'figure': return renderImage(cfg, ctx);
  }
  throw new Error(`line ${node.line}: unknown block ":::${name}"`);
}

export const KNOWN_BLOCKS = [...Object.keys(PROSE), 'html', 'chart', 'table', 'timeline', 'cards', 'stats', 'figure'];
