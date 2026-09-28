import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { renderStory, createMarkdown } from './render.js';
import { storyPage, indexPage } from './template.js';
import { DEFAULT_PALETTES } from './color.js';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text, lineOffset: 0 };
  return { data: YAML.parse(m[1]) || {}, body: text.slice(m[0].length), lineOffset: m[0].split('\n').length - 1 };
}

export function loadSite(root) {
  const file = path.join(root, 'site.yml');
  const site = fs.existsSync(file) ? YAML.parse(fs.readFileSync(file, 'utf8')) || {} : {};
  site.title ??= 'Broadsheet';
  const p = site.palette || {};
  site.palettes = {
    light: { ...DEFAULT_PALETTES.light, ...(p.light || {}) },
    dark: { ...DEFAULT_PALETTES.dark, ...(p.dark || {}) },
  };
  return site;
}

// Stories live in content/stories/<slug>/index.md (with data and images
// alongside) or as a single file, content/stories/<slug>.md.
export function findStories(root) {
  const dir = path.join(root, 'content', 'stories');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'index.md'))) {
      return [{ slug: e.name, file: path.join(dir, e.name, 'index.md'), dir: path.join(dir, e.name) }];
    }
    if (e.isFile() && e.name.endsWith('.md')) {
      return [{ slug: e.name.replace(/\.md$/, ''), file: path.join(dir, e.name), dir }];
    }
    return [];
  });
}

function copyDir(src, dest, skip = () => false) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith('.') || skip(e)) continue;
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d, skip);
    else fs.copyFileSync(s, d);
  }
}

export function build({ root = process.cwd(), out, drafts = false, dev = false, quiet = false } = {}) {
  const started = Date.now();
  out = path.resolve(root, out || 'dist');
  const site = loadSite(root);
  const md = createMarkdown();
  const inline = t => md.parseInline(String(t ?? ''));

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'assets'), { recursive: true });

  const stories = [];
  for (const s of findStories(root)) {
    const rel = path.relative(root, s.file);
    const { data, body, lineOffset } = parseFrontMatter(fs.readFileSync(s.file, 'utf8'));
    if (data.draft && !drafts) continue;
    if (!data.title) throw new Error(`${rel}: front matter needs a "title"`);
    const date = data.date instanceof Date ? data.date : data.date ? new Date(data.date) : null;
    const story = { slug: data.slug || s.slug, meta: data, date, isoDate: date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : '' };
    let rendered;
    try {
      rendered = renderStory(body, { baseDir: s.dir, palettes: site.palettes, lineOffset });
    } catch (e) {
      e.message = `${rel}: ${e.message}`;
      throw e;
    }
    const dest = path.join(out, story.slug);
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'index.html'), storyPage({ site, story, bodyHtml: rendered.html, inline, dev }));
    if (path.basename(s.file) === 'index.md') copyDir(s.dir, dest, e => e.isFile() && e.name.endsWith('.md'));
    stories.push(story);
  }
  stories.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  fs.writeFileSync(path.join(out, 'index.html'), indexPage({ site, stories, inline, dev }));

  // Theme assets plus the modules the runtime shares with the build.
  copyDir(path.join(PKG, 'theme'), path.join(out, 'assets'));
  copyDir(path.join(PKG, 'src', 'shared'), path.join(out, 'assets'));
  // Anything in static/ is copied to the site root as-is (CNAME, robots.txt, images).
  copyDir(path.join(root, 'static'), out);
  fs.writeFileSync(path.join(out, '.nojekyll'), '');

  if (!quiet) console.log(`Built ${stories.length} ${stories.length === 1 ? 'story' : 'stories'} into ${path.relative(process.cwd(), out) || '.'} in ${Date.now() - started}ms`);
  return { out, stories };
}
