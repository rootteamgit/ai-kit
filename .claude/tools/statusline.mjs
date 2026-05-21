import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync(0, 'utf8'));
const m = d.model?.display_name || '?';
const cw = d.context_window || {};
const p = cw.used_percentage || 0;
const max = cw.context_window_size || 0;
const now = Math.round((max * p) / 100);
const k = (v) => (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v));

const TRACK = 236;
const fillColor = p >= 80 ? 196 : p >= 50 ? 220 : null;

const CHARS = 10;
const halves = Math.round(p / 5);

const fillBg = fillColor == null ? `\x1b[7m` : `\x1b[48;5;${fillColor}m`;
const fillFg = fillColor == null ? `\x1b[0m` : `\x1b[38;5;${fillColor}m`;

let bar = '';
for (let i = 0; i < CHARS; i++) {
  const h = Math.max(0, Math.min(2, halves - i * 2));
  if (h === 2) {
    bar += `${fillBg} \x1b[0m`;
  } else if (h === 1) {
    bar += `${fillFg}\x1b[48;5;${TRACK}m▄\x1b[0m`;
  } else {
    bar += `\x1b[48;5;${TRACK}m \x1b[0m`;
  }
}

const pct = fillColor == null ? `${p.toFixed(1)}%` : `\x1b[38;5;${fillColor}m${p.toFixed(1)}%\x1b[0m`;

let cacheInfo = '?';
try {
  const tp = d.transcript_path;
  if (tp && fs.existsSync(tp)) {
    const size = fs.statSync(tp).size;
    const readSize = Math.min(size, 64 * 1024);
    const fd = fs.openSync(tp, 'r');
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, size - readSize);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n');
    const startIdx = size > readSize ? 1 : 0;
    for (let i = lines.length - 1; i >= startIdx; i--) {
      const line = lines[i];
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type !== 'assistant') continue;
        const u = obj.message?.usage;
        const cc = u?.cache_creation;
        if (!cc) continue;
        const h = cc.ephemeral_1h_input_tokens || 0;
        const m5 = cc.ephemeral_5m_input_tokens || 0;
        if (h === 0 && m5 === 0) continue;
        const tier = h > 0 ? '1h' : '5m';
        const write = h > 0 ? h : m5;
        const read = u.cache_read_input_tokens || 0;
        const creation = u.cache_creation_input_tokens || 0;
        const denom = read + creation;
        const hit = denom > 0 ? Math.round((read / denom) * 100) : 0;
        cacheInfo = `${tier} +${k(write)} ${hit}%`;
        break;
      } catch {}
    }
  }
} catch {}

process.stdout.write(`${bar} ${pct} (${k(now)} / ${k(max)}) | ${cacheInfo} | ${m}`);
