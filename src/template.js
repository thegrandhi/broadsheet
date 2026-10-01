import { esc } from './components/util.js';

const FONTS = 'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,500;6..72,600;6..72,700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap';

// Runs before first paint so a saved theme choice never flashes.
const THEME_BOOT = `<script>try{var t=localStorage.getItem('bs-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>`;

const LIVE_RELOAD = `<script>new EventSource('/__reload').onmessage=function(){location.reload()}</script>`;

export function formatDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(String(d) + (String(d).length === 10 ? 'T12:00:00Z' : ''));
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function shell({ site, root, title, description, url, body, head = '', foot = '', dev, type = 'website', image, published, touchIcon }) {
  const fullTitle = title ? `${title} · ${site.title}` : site.title;
  return `<!doctype html>
<html lang="${esc(site.language || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(fullTitle)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(title || site.title)}">
${description ? `<meta property="og:description" content="${esc(description)}">` : ''}
${url ? `<meta property="og:url" content="${esc(url)}"><link rel="canonical" href="${esc(url)}">` : ''}
${image ? `<meta property="og:image" content="${esc(image.url)}">
<meta property="og:image:width" content="${image.width || 1200}">
<meta property="og:image:height" content="${image.height || 630}">
<meta property="og:image:alt" content="${esc(image.alt || title || site.title)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title || site.title)}">
${description ? `<meta name="twitter:description" content="${esc(description)}">` : ''}
${image ? `<meta name="twitter:image" content="${esc(image.url)}">` : ''}
${published ? `<meta property="article:published_time" content="${esc(published)}">` : ''}
<meta name="color-scheme" content="light dark">
${THEME_BOOT}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${root}assets/broadsheet.css">
<link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml">
${touchIcon ? `<link rel="apple-touch-icon" href="${root}assets/apple-touch-icon.png">` : ''}
${head}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="masthead"><div class="wide mast">
<a class="brand" href="${root || './'}">${esc(site.title)}</a>
<button class="theme-toggle" type="button" aria-label="Switch between light and dark theme"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor"/></svg></button>
</div></header>
<main id="main">
${body}
</main>
<footer class="colophon"><div class="wide">${site.footer ? site.footer : `<a href="${root || './'}">${esc(site.title)}</a>`}</div></footer>
<div id="tip" role="tooltip" hidden></div>
<script type="module" src="${root}assets/runtime.js"></script>
${foot}
${dev ? LIVE_RELOAD : ''}
</body>
</html>
`;
}

export function storyPage({ site, story, bodyHtml, inline, dev, touchIcon }) {
  const fm = story.meta;
  const meta = [];
  if (fm.byline) meta.push(`<span>By <b>${esc(fm.byline)}</b></span>`);
  if (fm.date) meta.push(`<span><time datetime="${esc(story.isoDate)}">${esc(formatDate(fm.date))}</time></span>`);
  for (const m of [].concat(fm.meta || [])) meta.push(`<span>${inline(String(m))}</span>`);
  const header = `<header class="story col">
${fm.kicker ? `<p class="kicker">${inline(fm.kicker)}</p>` : ''}
<h1>${inline(fm.title)}</h1>
${fm.deck ? `<p class="deck">${inline(fm.deck)}</p>` : ''}
${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
</header>`;
  const head = [].concat(fm.styles || []).map(s => `<link rel="stylesheet" href="${esc(s)}">`).join('\n');
  const foot = [].concat(fm.scripts || []).map(s => `<script src="${esc(s)}" defer></script>`).join('\n');
  return shell({
    site, root: '../', title: fm.title, description: fm.description || stripTags(inline(fm.deck || '')),
    url: site.url ? `${site.url.replace(/\/$/, '')}/${story.slug}/` : null,
    body: `<article>${header}\n${bodyHtml}</article>`, head, foot, dev,
    type: 'article', image: story.image, published: story.isoDate, touchIcon,
  });
}

export function indexPage({ site, stories, inline, dev, image, touchIcon }) {
  const card = (s, lead) => {
    const fm = s.meta;
    return `<article class="card${lead ? ' lead' : ''}"><a href="${s.slug}/">
${fm.kicker ? `<p class="kicker">${inline(fm.kicker)}</p>` : ''}
<h2>${inline(fm.title)}</h2>
${fm.deck ? `<p class="deck">${inline(fm.deck)}</p>` : ''}
<p class="card-meta">${fm.draft ? '<span class="draft">Draft</span> ' : ''}${esc(formatDate(fm.date))}</p>
</a></article>`;
  };
  const [lead, ...rest] = stories;
  const body = `<header class="front wide">
<h1>${esc(site.title)}</h1>
${site.description ? `<p class="front-desc">${inline(site.description)}</p>` : ''}
</header>
<section class="wide storylist">
${lead ? card(lead, true) : '<p class="empty">No stories yet. Run <code>npm run new "My first story"</code> to start one.</p>'}
${rest.length ? `<div class="grid">${rest.map(s => card(s, false)).join('\n')}</div>` : ''}
</section>`;
  return shell({ site, root: '', title: null, description: site.description, url: site.url || null, body, dev, image, touchIcon });
}

const stripTags = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
