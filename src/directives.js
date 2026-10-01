// Splits a story's Markdown into prose and ::: directive blocks.
//
//   :::callout                  <- markdown body (may nest other directives)
//   Some **markdown**.
//   :::
//
//   :::chart                    <- YAML body (config + optional inline data)
//   type: bar
//   data: data/transfers.csv
//   :::
//
// Opening fences may carry attributes: `:::callout width=wide id="key-point"`.

export const YAML_BODY = new Set(['chart', 'table', 'timeline', 'cards', 'stats', 'figure']);
export const RAW_BODY = new Set(['html']);

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const OPEN = /^(:{3,})\s*([a-zA-Z][\w-]*)\s*(.*?)\s*$/;
const CLOSE = /^:{3,}\s*$/;

export class DirectiveError extends Error {
  constructor(message, line) { super(`line ${line}: ${message}`); this.line = line; }
}

export function parseAttrs(str) {
  const attrs = {};
  str = str.trim().replace(/^\{|\}$/g, '');
  const re = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m;
  while ((m = re.exec(str))) attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? true;
  return attrs;
}

export function parseBlocks(src, lineOffset = 0) {
  const lines = src.split(/\r?\n/);
  let i = 0;

  function parseLevel(depth, openerLine) {
    const nodes = [];
    let buf = [], bufStart = i, fence = null;
    const flush = () => {
      if (buf.some(l => l.trim())) nodes.push({ type: 'md', text: buf.join('\n'), line: bufStart + 1 + lineOffset });
      buf = [];
      bufStart = i + 1;
    };
    while (i < lines.length) {
      const line = lines[i];
      const f = line.match(FENCE);
      if (fence) {
        if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
        buf.push(line); i++; continue;
      }
      if (f) { fence = f[1]; buf.push(line); i++; continue; }

      if (CLOSE.test(line)) {
        if (depth === 0) throw new DirectiveError('closing ::: without a matching opening block', i + 1 + lineOffset);
        flush(); i++;
        return nodes;
      }
      const o = line.match(OPEN);
      if (o) {
        flush();
        const start = i + 1 + lineOffset;
        const name = o[2].toLowerCase();
        const attrs = parseAttrs(o[3]);
        i++;
        if (YAML_BODY.has(name) || RAW_BODY.has(name)) {
          const body = [];
          while (i < lines.length && !CLOSE.test(lines[i])) body.push(lines[i++]);
          if (i >= lines.length) throw new DirectiveError(`:::${name} is never closed`, start);
          i++;
          nodes.push({ type: 'directive', name, attrs, body: body.join('\n'), line: start });
        } else {
          const children = parseLevel(depth + 1, start);
          nodes.push({ type: 'directive', name, attrs, children, line: start });
        }
        bufStart = i;
        continue;
      }
      buf.push(line); i++;
    }
    if (depth > 0) throw new DirectiveError('block is never closed', openerLine);
    flush();
    return nodes;
  }

  return parseLevel(0, 0);
}

// Group top-level nodes into sections, starting a new one at every `## ` heading.
export function splitSections(nodes) {
  const sections = [[]];
  for (const node of nodes) {
    if (node.type !== 'md') { sections[sections.length - 1].push(node); continue; }
    let fence = null, buf = [];
    const push = () => { if (buf.some(l => l.trim())) sections[sections.length - 1].push({ type: 'md', text: buf.join('\n'), line: node.line }); buf = []; };
    for (const line of node.text.split('\n')) {
      const f = line.match(FENCE);
      if (fence) { if (f && f[1][0] === fence[0]) fence = null; }
      else if (f) fence = f[1];
      else if (/^##\s/.test(line)) { push(); sections.push([]); }
      buf.push(line);
    }
    push();
  }
  return sections.filter(s => s.length);
}
