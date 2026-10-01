# Broadsheet

**Live demo: https://thegrandhi.github.io/broadsheet/**

A static site generator for data-journalism explainers. Write a story in Markdown with a few `:::` blocks for charts and tables, and Broadsheet builds a newspaper-style page: a kicker, headline, deck and meta line, a narrow reading column, wide interactive graphics, and a methods section, in light and dark themes.

- **Charts:** diverging bar charts, multi-series line charts and tile grid maps, drawn at build time as HTML/SVG. They show up without JavaScript and are made interactive in the browser.
- **Tables, timelines and stat tiles,** plus callouts, notes, methods and sources.
- **Linked selection:** click a place on the map, and it lights up in every chart and table on the page.
- **Accessible by default:** keyboard focus, tooltips that never hide data, and a "View the data" table under every chart.
- **Small:** two dependencies (`marked`, `yaml`), no framework, and about 6 KB (gzipped) of browser JavaScript.

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321, rebuilds on save
npm run build        # writes the site to dist/
npm run new "Which cities are growing fastest?"
```

Requires Node 20 or newer.

## Writing a story

Each story is a folder in `content/stories/`. Its data files sit next to it:

```
content/stories/thirty-new-countries/
├── index.md
└── data/
    ├── states.csv
    └── survival.csv
```

`index.md` starts with front matter for the header, then Markdown. Every `##` heading starts a new section.

```markdown
---
title: If Every Indian State Became Its Own Country, Which Ones Would Last?
kicker: A thought experiment
deck: Imagine India splitting into 30 independent nations overnight…
date: 2026-09-26
meta:
  - "**Illustrative model, not a forecast**"
  - Starting figures are rounded 2023–24 estimates
---

## The first shock: the money stops moving

Inside India, richer states pay more in taxes than they get back…

:::chart
type: bar
title: Who gains and who loses when transfers end
data: data/states.csv
label: name
value: net_transfer_pct
format: { type: number, suffix: "%", sign: true }
negativeLabel: Loses money
positiveLabel: Gains money
:::

:::callout
**The takeaway** in one or two sentences.
:::
```

### Blocks

| Block | Body | What it makes |
| --- | --- | --- |
| `:::chart` `type: bar` | YAML | Horizontal bars. Negative values make it diverging. |
| `:::chart` `type: line` | YAML | Multi-series lines with crosshair, tooltips and end labels. |
| `:::chart` `type: tiles` | YAML | Tile grid map colored on a diverging or sequential scale. |
| `:::table` | YAML | Sortable table with a sticky first column and color swatches. |
| `:::timeline` | YAML | Event log, flat or grouped by year, with "What happens next" notes, filters and "Show all". |
| `:::cards` | YAML | Card grid with labelled fields, quotations and ranked mini bars. |
| `:::stats` | YAML | Stat tiles and a hero number. |
| `:::figure` | YAML | An image with a title and caption. |
| `:::callout`, `:::note` | Markdown | A highlighted takeaway, or small print. |
| `:::methods`, `:::sources` | Markdown | End matter styling. |
| `:::wide` | Markdown | Prose at full page width. |
| `:::html` | Raw HTML | An escape hatch for custom interactives. |

Charts, tables and timelines take `data:` as a path to a `.csv`, `.json` or `.yml` file in the story folder, or as an inline YAML list. Every figure also accepts `title`, `subtitle`, `note`, `source`, `width` (`col`, `mid` or `wide`) and `dataView: false`.

The **style guide** story (`content/stories/style-guide/index.md`) shows every block next to the Markdown that makes it, including all the options. It's the best reference.

### Custom interactives

For something the blocks don't cover, such as sliders that rerun a model, put a script in the story folder and add a mount point:

```markdown
---
scripts: [sim.js]
---

:::html width=wide
<div id="simulator"></div>
:::
```

Page colors are CSS custom properties (`--ink`, `--paper`, `--rule`, `--pos`, `--neg`…), so custom code can match the theme in both modes.

## Site settings

`site.yml` holds the site title, description, footer and optional `url`. You can also override chart colors there:

```yaml
palette:
  light: { accent: "#184f95" }
  dark:  { accent: "#8ab8f5" }
```

Files in `static/` are copied to the site root as-is, for example `CNAME` or `robots.txt`.

### Link previews

When you share a story on WhatsApp, iMessage, Slack, X or LinkedIn, the preview shows a 1200×630 image. `npm run build` draws one for every story with headless Chrome: the kicker, headline and a thumbnail of the story's first chart, in the site's own fonts. It also writes the Open Graph and Twitter tags that point to it. GitHub's build machines include Chrome. To build locally you need Google Chrome installed, or `CHROME_PATH` set to a Chromium-based browser.

- Set `url` in `site.yml`. Preview images need absolute URLs.
- To use your own image instead, put it in the story folder and add `image: cover.png` (and optionally `imageAlt:`) to the front matter.
- `npm run build -- --no-og` skips the images. `npm run dev` skips them too, so rebuilds stay fast.
- Apps cache previews for a while. If a link was shared before the image existed, use Facebook's Sharing Debugger or LinkedIn's Post Inspector to refresh it, or share the link with `?v=2` on the end.

## Deploying

`.github/workflows/deploy.yml` tests and builds the site on every push to `main` and publishes `dist/` to GitHub Pages. In the repository, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.

All links are relative, so the site works at `https://<user>.github.io/<repo>/` or on a custom domain without extra configuration.

## Project layout

```
bin/broadsheet.js       CLI: build, dev, new
src/build.js            finds stories, renders pages, copies assets
src/directives.js       ::: block parser
src/render.js           Markdown and block rendering
src/components/         bar, line, tiles, table, timeline, stats
src/shared/             modules used by both the build and the browser
theme/broadsheet.css    the design: tokens, layout, components
theme/runtime.js        browser behavior: tooltips, selection, sorting, theme toggle
content/stories/        your stories
test/                   node --test suite
```

## License

MIT
