// Number formatting shared by the build and the browser runtime.
// A format spec is either a shorthand string or an object:
//   "number" | "int" | "percent" | "pct" | "usd" | "usd-k" | "text"
//   prefix any shorthand with "+" to sign positive values ("+percent")
//   { type: "number", decimals: 1, prefix: "", suffix: "", sign: false }
//
//   percent  0.42 -> "42%"   (value is a share)
//   pct      42   -> "42%"   (value is already a percentage)
//   usd-k    12400 -> "$12k"; 8400 -> "$8,400"

const EMPTY = '—';

export function normalizeFormat(spec) {
  if (spec == null) return { type: 'number' };
  if (typeof spec === 'object') return { type: 'number', ...spec };
  let s = String(spec).trim();
  let sign = false;
  if (s.startsWith('+')) { sign = true; s = s.slice(1); }
  const m = s.match(/^([a-z-]+)(?::(\d+))?$/i);
  if (!m) return { type: 'number', sign };
  const out = { type: m[1].toLowerCase(), sign };
  if (m[2] !== undefined) out.decimals = Number(m[2]);
  return out;
}

export function formatValue(value, spec) {
  const f = normalizeFormat(spec);
  if (value === null || value === undefined || value === '') return EMPTY;
  if (f.type === 'text' || typeof value !== 'number' || Number.isNaN(value)) {
    return (f.prefix || '') + String(value) + (f.suffix || '');
  }
  let v = value, body;
  const dec = f.decimals;
  const num = (x, d) => x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d === undefined ? 0 : Math.min(d, 20) });
  switch (f.type) {
    case 'int': body = num(Math.round(Math.abs(v)), 0); break;
    case 'percent': body = num(Math.abs(v * 100), dec ?? 0) + '%'; break;
    case 'pct': body = num(Math.abs(v), dec ?? 0) + '%'; break;
    case 'usd': body = '$' + num(Math.abs(v), dec ?? 0); break;
    case 'usd-k': {
      const a = Math.abs(v);
      body = a >= 10000 ? '$' + num(a / 1000, dec ?? 0) + 'k' : '$' + num(a, 0);
      break;
    }
    default: {
      const a = Math.abs(v);
      body = dec === undefined
        ? a.toLocaleString('en-US', { maximumFractionDigits: a < 10 ? 2 : 1 })
        : num(a, dec);
    }
  }
  // Treat values that round to zero as zero, so we never print "-0%".
  const zero = Number(body.replace(/[^0-9.]/g, '')) === 0;
  const neg = v < 0 && !zero;
  const signStr = neg ? '−' : (f.sign && v > 0 && !zero ? '+' : '');
  return signStr + (f.prefix || '') + body + (f.suffix || '');
}

export const makeFormat = spec => v => formatValue(v, spec);
