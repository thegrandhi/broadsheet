import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV } from '../src/data.js';
import { parseBlocks, splitSections } from '../src/directives.js';
import { formatValue } from '../src/shared/format.js';
import { renderStory } from '../src/render.js';
import { build, parseFrontMatter } from '../src/build.js';
import { DEFAULT_PALETTES } from '../src/color.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const render = src => renderStory(src, { baseDir: ROOT, palettes: DEFAULT_PALETTES }).html;

test('CSV: quotes, escaped quotes, CRLF and number coercion', () => {
  const rows = parseCSV('name,value,note\r\n"Smith, J",1.5,"said ""hi"""\r\nLee,-2,\r\n');
  assert.deepEqual(rows, [
    { name: 'Smith, J', value: 1.5, note: 'said "hi"' },
    { name: 'Lee', value: -2, note: null },
  ]);
});

test('directives: prose, YAML bodies, nesting and code fences', () => {
  const nodes = parseBlocks([
    'Intro',
    ':::callout width=wide',
    'Inside **callout**',
    ':::',
    '```',
    ':::chart',
    '```',
    ':::chart',
    'type: bar',
    ':::',
  ].join('\n'));
  assert.equal(nodes.length, 4);
  assert.equal(nodes[1].name, 'callout');
  assert.equal(nodes[1].attrs.width, 'wide');
  assert.equal(nodes[2].type, 'md', 'a ::: line inside a code fence stays text');
  assert.equal(nodes[3].body, 'type: bar');
});

test('directives: unclosed blocks report their line', () => {
  assert.throws(() => parseBlocks('a\n\n:::callout\nnever closed'), /line 3/);
  assert.throws(() => parseBlocks(':::chart\ntype: bar'), /never closed/);
});

test('sections split on ## headings', () => {
  const secs = splitSections(parseBlocks('Lead\n\n## One\n\nText\n\n## Two\n\nMore'));
  assert.equal(secs.length, 3);
});

test('number formats', () => {
  assert.equal(formatValue(0.426, 'percent'), '43%');
  assert.equal(formatValue(0.426, '+percent:1'), '+42.6%');
  assert.equal(formatValue(-2.5, { type: 'number', suffix: '%', sign: true }), '−2.5%');
  assert.equal(formatValue(12400, 'usd-k'), '$12k');
  assert.equal(formatValue(8400, 'usd-k'), '$8,400');
  assert.equal(formatValue(-0.001, 'percent'), '0%', 'no negative zero');
  assert.equal(formatValue(null, 'int'), '—');
});

test('bar chart renders a diverging layout for negative values', () => {
  const html = render(':::chart\ntype: bar\nlabel: n\nvalue: v\ndata:\n  - { n: A, v: 3 }\n  - { n: B, v: -1 }\n:::');
  assert.match(html, /class="bars diverging"/);
  assert.match(html, /data-key="a"/);
});

test('labels from data are escaped', () => {
  const html = render(':::chart\ntype: bar\nlabel: n\nvalue: v\ndata:\n  - { n: "<img src=x onerror=alert(1)>", v: 3 }\n:::');
  assert.doesNotMatch(html, /<img src=x/);
});

test('line chart embeds its spec and a static SVG', () => {
  const html = render(':::chart\ntype: line\nx: t\ndata:\n  - { t: 0, a: 1, b: 2 }\n  - { t: 1, a: 2, b: 1 }\n:::');
  assert.match(html, /<svg[^>]*viewBox/);
  assert.match(html, /application\/json/);
});

test('helpful errors for bad blocks', () => {
  assert.throws(() => render(':::chart\ntype: pie\n:::'), /unknown chart type "pie"/);
  assert.throws(() => render(':::sparkle\nhi\n:::'), /unknown block ":::sparkle"/);
  assert.throws(() => render(':::table\ndata: missing.csv\n:::'), /not found/);
});

test('front matter offsets error lines to the file', () => {
  const { data, lineOffset } = parseFrontMatter('---\ntitle: Hi\n---\nBody');
  assert.equal(data.title, 'Hi');
  assert.equal(lineOffset, 3);
});

test('the example site builds', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'broadsheet-'));
  try {
    const { stories } = build({ root: ROOT, out, quiet: true });
    assert.ok(stories.length >= 2);
    const page = fs.readFileSync(path.join(out, 'thirty-new-countries', 'index.html'), 'utf8');
    for (const cls of ['tiles-svg', 'bars diverging', 'data-linechart', 'bs-table', 'class="tl-group"', 'class="cardgrid"', 'col callout']) {
      assert.ok(page.includes(cls), `story page contains ${cls}`);
    }
    for (const f of ['assets/runtime.js', 'assets/line-svg.js', 'assets/format.js', 'assets/broadsheet.css', 'thirty-new-countries/data/states.csv', '.nojekyll']) {
      assert.ok(fs.existsSync(path.join(out, f)), `${f} exists`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('cards render fields, quotes and linked mini bars', () => {
  const html = render(':::cards\ntone: neg\nitems:\n  - title: Debt default\n    stat: "**2** hit"\n    fields:\n      - { label: Rule, text: Debt over 100% }\n      - { label: Before, text: Sri Lanka 2022, quote: true }\n      - { label: Exposed, format: percent, bars: [{ name: Punjab, value: 0.5 }] }\n:::');
  assert.match(html, /class="ccard tone-neg"/);
  assert.match(html, /<dd class="quote">/);
  assert.match(html, /class="mb"[^>]*data-key="punjab"/);
  assert.match(html, /width:50\.0%/);
  assert.match(html, />50%</);
});

test('grouped timeline: headings, quiet groups, filters and collapse', () => {
  const html = render([
    ':::timeline', 'filter: true', 'limitGroups: 1', 'quiet: A quiet year.', 'groups:',
    '  - { title: Year 1, note: Dry, tone: bad, items: [{ title: Default, next: Cuts, keys: [Punjab], major: true }] }',
    '  - { title: Year 2, items: [] }', ':::',
  ].join('\n'));
  assert.match(html, /class="tl-note bad"/);
  assert.match(html, /<b>What happens next:<\/b> Cuts/);
  assert.match(html, /data-keys="punjab" data-major="1"/);
  assert.match(html, /<section class="tl-group" data-extra>/);
  assert.match(html, /<p class="tl-quiet">A quiet year\.<\/p>/);
  assert.match(html, /<option value="punjab">Punjab<\/option>/);
});
