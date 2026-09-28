import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

// RFC 4180-ish CSV: quoted fields, escaped quotes, CRLF, embedded newlines.
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, coerce(r[i])])));
}

const NUMERIC = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
function coerce(v) {
  if (v === undefined) return null;
  const t = v.trim();
  if (t === '') return null;
  return NUMERIC.test(t) ? Number(t) : t;
}

// `source` is an inline array/object or a path relative to the story folder.
export function loadData(source, baseDir) {
  if (source == null) return null;
  if (typeof source !== 'string') return source;
  const file = path.resolve(baseDir, source);
  if (!file.startsWith(path.resolve(baseDir))) throw new Error(`Data path escapes the story folder: ${source}`);
  if (!fs.existsSync(file)) throw new Error(`Data file not found: ${source}`);
  const text = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  if (ext === '.csv') return parseCSV(text);
  if (ext === '.json') return JSON.parse(text);
  if (ext === '.yml' || ext === '.yaml') return YAML.parse(text);
  throw new Error(`Unsupported data format: ${source} (use .csv, .json or .yml)`);
}
