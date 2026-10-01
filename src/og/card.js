// Link-preview ("Open Graph") images: a 1200×630 card per story with the
// kicker, headline and a thumbnail of the story's first chart.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { esc } from '../components/util.js';
import { findChrome, screenshot } from './chrome.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const THEME_CSS = path.resolve(HERE, '..', '..', 'theme', 'broadsheet.css');
const FAVICON = path.resolve(HERE, '..', '..', 'theme', 'favicon.svg');
export const OG_WIDTH = 1200, OG_HEIGHT = 630;

const FONTS = [
  ['Newsreader', 600, 'Newsreader-SemiBold.ttf'],
  ['Libre Franklin', 500, 'LibreFranklin-Medium.ttf'],
  ['Libre Franklin', 700, 'LibreFranklin-Bold.ttf'],
  ['Libre Franklin', 800, 'LibreFranklin-ExtraBold.ttf'],
];
let fontCss;
const fontFaces = () => (fontCss ??= FONTS.map(([family, weight, file]) =>
  `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/ttf;base64,${fs.readFileSync(path.join(HERE, 'fonts', file)).toString('base64')}) format("truetype")}`
).join('\n'));

const CARD_CSS = `
html,body{margin:0;padding:0;width:${OG_WIDTH}px;height:${OG_HEIGHT}px;overflow:hidden;background:#fff}
.og{box-sizing:border-box;width:${OG_WIDTH}px;height:${OG_HEIGHT}px;padding:40px 64px 0;display:flex;flex-direction:column;background:var(--paper);color:var(--ink)}
.og-top{display:flex;justify-content:space-between;align-items:baseline;font-family:var(--sans);padding-bottom:16px;border-bottom:2px solid var(--ink)}
.og-brand{font-weight:800;font-size:22px;letter-spacing:.12em;text-transform:uppercase}
.og-date{font-weight:500;font-size:20px;color:var(--muted)}
.og-body{flex:1;min-height:0;display:flex;gap:52px;padding:34px 0 30px}
.og-text{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.og-text > *{flex-shrink:0}
.og-kicker{font-family:var(--sans);font-weight:700;font-size:19px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:0 0 16px}
.og-title{font-family:var(--serif-d);font-weight:600;font-size:64px;line-height:1.06;letter-spacing:-.012em;margin:0;text-wrap:balance}
.og-deck{font-family:var(--sans);font-weight:500;font-size:22px;line-height:1.4;color:var(--ink-2);margin:18px 0 0;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.og-foot{margin-top:auto;padding-top:14px;font-family:var(--sans);font-weight:500;font-size:19px;color:var(--muted)}
.og-thumb{flex:none;width:400px;position:relative;overflow:hidden}
.og-thumb > .inner{position:absolute;left:0;top:0;width:520px;transform-origin:top left}
.og-thumb .tiles{max-width:none!important}
.og-thumb .legend,.og-thumb .bars-axis{display:none}
.og-stripe{height:10px;margin:0 -64px;background:linear-gradient(90deg,#a4161a,#e27c62,#e7e5e0,#6da7ec,#184f95)}
`;

// Shrinks the headline until everything fits, then scales the thumbnail into its box.
const FIT_JS = `
document.fonts.ready.then(() => {
  const text = document.querySelector('.og-text'), title = document.querySelector('.og-title'), deck = document.querySelector('.og-deck');
  const fits = () => text.scrollHeight <= text.clientHeight + 1;
  let ok = false;
  for (const withDeck of deck ? [true, false] : [false]) {
    if (deck) deck.style.display = withDeck ? '' : 'none';
    for (let s = 84; s >= 40 && !ok; s -= 2) { title.style.fontSize = s + 'px'; ok = fits() && s <= 68 + (title.textContent.length < 24 ? 16 : 0) && (!withDeck || s >= 50); }
    if (ok) break;
  }
  const box = document.querySelector('.og-thumb'), inner = box && box.querySelector('.inner');
  if (inner) {
    const w = inner.scrollWidth, h = inner.scrollHeight;
    const s = Math.min(box.clientWidth / w, box.clientHeight / h, 1.25);
    inner.style.transform = 'scale(' + s + ')';
    inner.style.left = (box.clientWidth - w * s) / 2 + 'px';
    inner.style.top = Math.max(0, (box.clientHeight - h * s) / 2) + 'px';
  }
});`;

export function cardHtml({ brand, kicker, title, deck, date, domain, thumb }) {
  const theme = fs.readFileSync(THEME_CSS, 'utf8');
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8">
<style>${fontFaces()}\n${theme}\n${CARD_CSS}</style></head><body>
<div class="og">
  <div class="og-top"><span class="og-brand">${esc(brand)}</span><span class="og-date">${esc(date || '')}</span></div>
  <div class="og-body">
    <div class="og-text">
      ${kicker ? `<p class="og-kicker">${kicker}</p>` : ''}
      <h1 class="og-title">${title}</h1>
      ${deck ? `<p class="og-deck">${deck}</p>` : ''}
      ${domain ? `<div class="og-foot">${esc(domain)}</div>` : ''}
    </div>
    ${thumb ? `<div class="og-thumb"><div class="inner">${thumb}</div></div>` : ''}
  </div>
  <div class="og-stripe"></div>
</div>
<script>${FIT_JS}</script></body></html>`;
}

function iconHtml(size) {
  const svg = fs.readFileSync(FAVICON).toString('base64');
  return `<!doctype html><style>html,body{margin:0;width:${size}px;height:${size}px;background:#121212}img{display:block;width:${size}px;height:${size}px}</style><img src="data:image/svg+xml;base64,${svg}">`;
}

// Renders each job's HTML to a PNG, reusing earlier renders from the cache
// folder when the HTML hasn't changed. Returns the set of jobs that succeeded.
export async function renderImages(jobs, { cacheDir, log = console.log }) {
  const chrome = findChrome();
  if (!chrome) {
    log('! Link-preview images skipped: Chrome not found. Install Google Chrome or set CHROME_PATH.');
    return new Set();
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broadsheet-og-'));
  const ok = new Set();
  try {
    for (const job of jobs) {
      const { html } = job;
      const hash = crypto.createHash('sha1').update(`${job.width}x${job.height}\n${html}`).digest('hex').slice(0, 16);
      const cached = path.join(cacheDir, hash + '.png');
      try {
        if (!fs.existsSync(cached)) {
          const htmlFile = path.join(tmp, hash + '.html');
          fs.writeFileSync(htmlFile, html);
          await screenshot(chrome, htmlFile, cached, { width: job.width, height: job.height });
        }
        fs.mkdirSync(path.dirname(job.out), { recursive: true });
        fs.copyFileSync(cached, job.out);
        ok.add(job);
      } catch (e) {
        log(`! Could not render ${path.basename(path.dirname(job.out))}/${path.basename(job.out)}: ${e.message}`);
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return ok;
}

export const iconJob = (out, size = 180) => ({ out, width: size, height: size, html: iconHtml(size) });
