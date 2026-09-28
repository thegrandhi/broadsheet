#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { build } from '../src/build.js';
import { dev } from '../src/dev.js';
import { slugify } from '../src/render.js';

const HELP = `broadsheet — static site generator for data stories

Usage:
  broadsheet build [--drafts] [--out dist]   Build the site into dist/
  broadsheet dev [--port 4321]               Build, serve and rebuild on save
  broadsheet new "Story title"               Start a new story in content/stories/

Options:
  --root <dir>   Project folder (default: current directory)
`;

const args = process.argv.slice(2);
const cmd = args.shift();
const flag = name => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, v && !v.startsWith('--') ? 2 : 1);
  return v && !v.startsWith('--') ? v : true;
};
const root = path.resolve(flag('root') || process.cwd());

try {
  switch (cmd) {
    case 'build':
      build({ root, drafts: !!flag('drafts'), out: flag('out') });
      break;
    case 'dev':
      dev({ root, port: Number(flag('port')) || 4321 });
      break;
    case 'new': {
      const title = args.join(' ').trim();
      if (!title) throw new Error('Give the story a title: broadsheet new "My story"');
      const slug = slugify(title);
      const dir = path.join(root, 'content', 'stories', slug);
      if (fs.existsSync(dir)) throw new Error(`content/stories/${slug} already exists`);
      fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
      const today = new Date().toISOString().slice(0, 10);
      fs.writeFileSync(path.join(dir, 'data', 'example.csv'), 'name,value\nAlpha,12\nBravo,-4\nCharlie,7\nDelta,-9\n');
      fs.writeFileSync(path.join(dir, 'index.md'), `---
title: ${JSON.stringify(title)}
kicker: A new story
deck: One or two sentences that tell the reader what they will learn and why it matters.
date: ${today}
draft: true
meta:
  - "**Illustrative example**"
  - Replace this line with your data source
---

Open with the question the story answers. Keep paragraphs short.

## First section heading

Every \`##\` heading starts a new section. Charts sit between paragraphs.

:::chart
type: bar
title: What the chart shows, in plain words
subtitle: One line on how to read it.
data: data/example.csv
label: name
value: value
negativeLabel: Falls
positiveLabel: Rises
note: Where the numbers come from.
:::

:::callout
**The takeaway.** Say the one thing you want readers to remember.
:::
`);
      console.log(`Created content/stories/${slug}/index.md (marked as a draft; remove "draft: true" to publish)`);
      break;
    }
    case undefined:
    case '-h':
    case '--help':
    case 'help':
      console.log(HELP);
      break;
    default:
      throw new Error(`Unknown command "${cmd}"\n\n${HELP}`);
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
