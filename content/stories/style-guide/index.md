---
title: Every Building Block, With the Markdown That Makes It
kicker: Reference
deck: A working catalog of what Broadsheet can put on a page. Each example shows the block and the Markdown you write to get it. Copy what you need into your own story.
date: 2026-09-20
meta:
  - "**Style guide**"
  - All examples use inline data
---

A story is a Markdown file with front matter on top. Plain paragraphs sit in a narrow reading column. Blocks fenced with `:::` add charts, tables and other pieces. Every `##` heading starts a new section.

## The header

The header comes from front matter at the top of the file:

```yaml
---
title: If Every Indian State Became Its Own Country, Which Ones Would Last?
kicker: A thought experiment          # small caps line above the headline
deck: One or two sentences under the headline.
date: 2026-09-26
byline: Your Name                      # optional
meta:                                  # optional facts under the rule
  - "**Illustrative model, not a forecast**"
  - Starting figures are rounded 2023–24 estimates
draft: true                            # hidden from the published build
scripts: [sim.js]                      # optional custom JS in the story folder
styles: [extra.css]                    # optional custom CSS in the story folder
---
```

## Callouts and notes

:::callout
**A callout** pulls one finding out of the text. Use it for the sentence you most want readers to remember.
:::

```markdown
:::callout
**A callout** pulls one finding out of the text.
:::
```

:::note
A note is small print: caveats, rounding and definitions.
:::

## Bar charts

A bar chart draws one bar per row. If any value is negative, the bars grow left and right from a centre line.

:::chart
type: bar
title: Change in rainfall from the long-run average
subtitle: Monsoon season, percent above or below normal
label: region
value: change
format: { type: number, suffix: "%", sign: true }
negativeLabel: Drier
positiveLabel: Wetter
highlight: [Northwest]
data:
  - { region: South Peninsula, change: 14 }
  - { region: Central, change: 6 }
  - { region: Northwest, change: -3 }
  - { region: East and Northeast, change: -11 }
note: Illustrative numbers.
:::

```yaml
:::chart
type: bar
title: Change in rainfall from the long-run average
subtitle: Monsoon season, percent above or below normal
data: data/rainfall.csv        # or an inline list, as in this example
label: region                  # column with the bar names
value: change                  # column with the numbers
format: { type: number, suffix: "%", sign: true }
negativeLabel: Drier           # axis captions for diverging bars
positiveLabel: Wetter
highlight: [Northwest]         # rows to emphasise
sort: desc                     # desc (default), asc or none
width: mid                     # col, mid (default) or wide
note: Illustrative numbers.
:::
```

## Line charts

Data can be *wide* (an `x` column plus one column per line) or *long* (set `series`, `x` and `y`). With eight or fewer lines, each gets its own color and a legend. With more, set `colorBy: last` to color each line by where it ends.

:::chart
type: line
title: Share of homes with a broadband connection
subtitle: Three illustrative regions
x: year
xName: Year
tipTitle: "{x}"
yFormat: percent
yDomain: [0, 1]
yTicks: [0, 0.25, 0.5, 0.75, 1]
height: 320
data:
  - { year: 2016, Coast: 0.22, Plains: 0.12, Hills: 0.05 }
  - { year: 2018, Coast: 0.34, Plains: 0.2, Hills: 0.09 }
  - { year: 2020, Coast: 0.51, Plains: 0.33, Hills: 0.16 }
  - { year: 2022, Coast: 0.63, Plains: 0.47, Hills: 0.27 }
  - { year: 2024, Coast: 0.72, Plains: 0.58, Hills: 0.4 }
  - { year: 2026, Coast: 0.78, Plains: 0.67, Hills: 0.52 }
:::

```yaml
:::chart
type: line
data: data/broadband.csv
x: year
yFormat: percent               # see "Number formats" below
yDomain: [0, 1]
yTicks: [0, 0.25, 0.5, 0.75, 1]
xFirst: Start                  # optional labels for the first and last x
xLast: Today
refLines:                      # dashed reference lines
  - { y: 0.5, label: Half of homes }
labels: [Coast]                # label these lines at the right edge ("all" labels every line)
labelExtremes: 2               # also label the top and bottom 2
highlight: [Hills]             # draw these lines heavier
colorBy: last                  # color by final value on a scale
scale: diverging               # or sequential
domain: [0, 1]
:::
```

## Tile maps

A tile map places one square per place on a grid and colors it by value. Give each row a `col` and `row` position.

:::chart
type: tiles
title: A four-by-three grid
value: score
format: int
scale: sequential
domain: [0, 100]
legend: Score
data:
  - { id: A1, name: North Alpha, col: 0, row: 0, score: 12 }
  - { id: B1, name: North Bravo, col: 1, row: 0, score: 35 }
  - { id: C1, name: North Charlie, col: 2, row: 0, score: 58 }
  - { id: A2, name: Mid Alpha, col: 0, row: 1, score: 44 }
  - { id: B2, name: Mid Bravo, col: 1, row: 1, score: 71 }
  - { id: C2, name: Mid Charlie, col: 2, row: 1, score: 90 }
  - { id: D2, name: Mid Delta, col: 3, row: 1, score: 66 }
  - { id: B3, name: South Bravo, col: 1, row: 2, score: 27 }
annotations:
  - { text: SEA, x: 3.4, y: 2.6 }
:::

```yaml
:::chart
type: tiles
data: data/places.csv
id: id                         # short code printed on the tile
name: name                     # full name for tooltips
col: col                       # grid position
row: row
value: score
scale: diverging               # diverging (default) or sequential
domain: [20, 80]               # values outside are clamped
tooltip:                       # extra tooltip rows
  - { key: population, label: People, format: number }
annotations:                   # grid-unit labels such as seas or neighbours
  - { text: "BAY OF\nBENGAL", x: 4.4, y: 5.5 }
:::
```

## Tables

Tables can be sorted by clicking a column heading. The first column stays in place when the table scrolls sideways.

:::table
title: Four made-up cities
sort: growth
width: col
columns:
  - { key: city, label: City, swatch: { value: growth, scale: diverging, domain: [-0.05, 0.05] } }
  - { key: people, label: Population, format: int }
  - { key: growth, label: Growth, format: +percent:1, tone: sign }
  - { key: income, label: Income, format: usd-k }
data:
  - { city: Northport, people: 1250000, growth: 0.031, income: 18400 }
  - { city: Eastvale, people: 640000, growth: -0.012, income: 9200 }
  - { city: Riverton, people: 310000, growth: 0.004, income: 12650 }
  - { city: Lakeside, people: 95000, growth: -0.027, income: 7300 }
:::

```yaml
:::table
data: data/cities.csv
sort: growth                   # initial sort column
order: desc                    # asc or desc
key: city                      # links rows to other charts (see below)
columns:
  - { key: city, label: City, swatch: { value: growth, scale: diverging } }
  - { key: growth, label: Growth, format: +percent:1, tone: sign }
  - { key: clock, label: Years, labels: { 21: "20+" } }   # show text for specific values
:::
```

## Timelines

:::timeline
limit: 2
items:
  - { when: Year 1, kind: Diplomacy, soft: true, title: Talks over river water break down, detail: Relations sink to their lowest point. }
  - { when: Year 3, kind: Debt default, title: The smallest country defaults on its debt, detail: Debt had reached 107% of GDP. }
  - { when: Year 6, kind: Mass unrest, title: Protests topple a government, detail: Years of weak growth bring crowds into the streets. }
:::

```yaml
:::timeline
data: data/events.json         # or items: [...]
limit: 14                      # the rest hide behind "Show all"
fields: { when: year }         # rename fields if your data uses other names
:::
```

## Stats

:::stats
hero: { value: "8", unit: yrs, text: "**Survival clock.** In half of all futures, the country gets this far before its first crisis." }
items:
  - { value: 100%, label: Chance of at least one crisis in 20 years, tone: neg }
  - { value: −45%, label: Income in year 20 compared with staying whole, tone: neg }
:::

```yaml
:::stats
hero: { value: "8", unit: yrs, text: "**Survival clock.** ..." }
columns: 2
items:
  - { value: 100%, label: Chance of a crisis, tone: neg }   # tone: pos or neg
  - { value: "13 of 30", label: Survive 20 years, wide: true }
:::
```

## Linked selection

Charts on the same page are linked by a key, which is the label or name column unless you set `key:`. Select Northport in a table, and Northport lights up in every other chart with the same key. The demo story links its tile map, bar chart, line chart and table this way.

## Number formats

Use `format`, `yFormat` and column formats to control how numbers print:

| Format | 0.426 prints as | 12400 prints as |
| --- | --- | --- |
| `number` | 0.43 | 12,400 |
| `int` | 0 | 12,400 |
| `percent` | 43% | — |
| `percent:1` | 42.6% | — |
| `+percent` | +43% | — |
| `pct` (already in percent) | 0% | 12,400% |
| `usd` / `usd-k` | $0 | $12,400 / $12k |
| `{ type: number, suffix: "m" }` | 0.43m | 12,400m |

## Everything else

:::methods
- **`:::methods`** sets a numbered list of steps in a smaller size, like the end of a long story.
- **`:::sources`** is for citations and data downloads.
- **`:::figure`** places an image: `src`, `alt`, `title`, `subtitle` and `note`.
- **`:::wide`** runs Markdown at the full page width.
- **`:::html`** passes raw HTML through untouched. Together with `scripts:` in the front matter, it lets you build a bespoke interactive, such as the simulation sliders in the original piece.
:::
