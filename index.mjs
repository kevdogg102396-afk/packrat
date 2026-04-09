/**
 * PackRat — Auto-Learning Codebook Compression
 * Makes AI agent memory files 2-10x smaller while staying LLM-readable.
 *
 * HOW IT WORKS:
 *   1. Scan your files → find repeated entities + phrases
 *   2. Generate short codes ranked by (frequency x length)
 *   3. Compress text by replacing patterns with codes
 *   4. Every compressed file has a header pointing to the codebook
 *   5. Any LLM reads the codebook header → understands the file cold
 *
 * Zero deps. Pure JS. Works with Node 18+ and Bun.
 *
 * @example
 *   import { Codebook, compress, decompress, learn } from 'packrat-compress';
 *
 *   const cb = new Codebook('.packrat/codebook.json');
 *   learn(['.'], cb);                    // scan files, build codebook
 *   const out = compress(text, cb);      // compress
 *   const orig = decompress(out, cb);    // decompress
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── Constants ───

const HEADER_RE = /^<!--\s*packrat:v(\d+)\s+codebook:(.+?)\s*-->/m;

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','is','it',
  'was','are','be','been','do','does','did','will','would','could','should',
  'may','might','can','shall','have','has','had','with','from','by','not',
  'very','just','also','all','each','both','few','more','most','other','some',
  'no','only','so','than','too','while','what','how','where','when','who',
  'which','about','that','this','these','those','i','you','he','she','we',
  'they','me','him','her','us','them','my','your','his','its','our','their',
  'ok','ya','yeah','lol','like','gonna','wanna','dont','im','ive','youre',
  'thats','lets','hey','oh','well','sure','right','got','get','go','went',
  'thing','stuff','something','anything','here','there','then','now','still',
  'been','being','if','else','up','down','out','into','over','after','before',
]);

const COMMON_WORDS = new Set([
  'let','the','this','that','here','there','what','when','where','how','why',
  'now','found','created','built','edit','made','fixed','added','removed',
  'changed','updated','set','got','used','need','make','take','give','keep',
  'start','stop','run','check','look','see','try','done','works','good',
  'new','old','first','last','next','best','file','files','code','test',
]);

// ─── Codebook ───

export class Codebook {
  constructor(codebookPath = '.packrat/codebook.json') {
    this.path = codebookPath;
    this.data = { version: 1, generated: '', entries: {}, phrases: {} };
  }

  load() {
    if (!fs.existsSync(this.path)) return false;
    try {
      this.data = JSON.parse(fs.readFileSync(this.path, 'utf-8'));
      return true;
    } catch { return false; }
  }

  save() {
    const dir = path.dirname(this.path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.data.generated = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
  }

  allPairs() {
    const pairs = [];
    for (const [code, text] of Object.entries(this.data.entries)) pairs.push({ code, text });
    for (const [code, text] of Object.entries(this.data.phrases)) pairs.push({ code, text });
    pairs.sort((a, b) => b.text.length - a.text.length);
    return pairs;
  }

  get size() {
    return Object.keys(this.data.entries).length + Object.keys(this.data.phrases).length;
  }

  hasCode(code) { return code in this.data.entries || code in this.data.phrases; }

  hasText(text) {
    const lower = text.toLowerCase();
    for (const v of Object.values(this.data.entries)) { if (v.toLowerCase() === lower) return true; }
    for (const v of Object.values(this.data.phrases)) { if (v.toLowerCase() === lower) return true; }
    return false;
  }
}

// ─── Learn ───

/**
 * Scan files and update codebook with new patterns.
 * @param {string[]} dirs - Directories to scan
 * @param {Codebook} codebook
 * @param {object} opts - { maxEntities: 40, maxPhrases: 30, minFreq: 3, extensions: ['.md', '.txt'] }
 * @returns {{ newEntries: number, filesScanned: number }}
 */
export function learn(dirs, codebook, opts = {}) {
  const { maxEntities = 40, maxPhrases = 30, minFreq = 3, extensions = ['.md', '.txt'] } = opts;
  const extSet = new Set(extensions);

  // Walk directories and collect text
  const texts = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.claude') continue;
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (extSet.has(path.extname(entry.name).toLowerCase())) {
        try { texts.push(fs.readFileSync(full, 'utf-8')); } catch {}
      }
    }
  }
  for (const d of dirs) walk(d);

  const allText = texts.join('\n');
  const sizeBefore = codebook.size;

  // ── Entity extraction ──
  const entityFreq = {};
  for (const raw of allText.split(/\s+/)) {
    const clean = raw.replace(/[^a-zA-Z0-9._-]/g, '');
    if (clean.length < 4) continue;
    const lower = clean.toLowerCase();
    if (STOP_WORDS.has(lower) || COMMON_WORDS.has(lower)) continue;
    if (/^\d/.test(clean) || /[.!?,;:)]$/.test(clean)) continue;

    const isCap = clean[0] === clean[0].toUpperCase() && clean[0] !== clean[0].toLowerCase();
    const isTech = /[._-]/.test(clean) || (/[a-z]/.test(clean) && /[A-Z]/.test(clean.slice(1)));
    if (isCap || isTech) entityFreq[clean] = (entityFreq[clean] || 0) + 1;
  }

  // Merge case-insensitive
  const merged = {};
  for (const [w, f] of Object.entries(entityFreq)) {
    const lower = w.toLowerCase();
    if (!merged[lower] || f > merged[lower].f) merged[lower] = { w, f };
    else merged[lower].f += f;
  }

  const entities = Object.values(merged)
    .filter(e => e.f >= minFreq)
    .sort((a, b) => (b.f * b.w.length) - (a.f * a.w.length))
    .slice(0, maxEntities);

  for (const { w } of entities) {
    if (codebook.hasText(w)) continue;
    let code = _genCode(w);
    let attempt = 0;
    while (codebook.hasCode(code) && attempt < 5) {
      code += (w[Math.min(attempt + 3, w.length - 1)] || String(attempt)).toUpperCase();
      attempt++;
    }
    if (!codebook.hasCode(code)) codebook.data.entries[code] = w;
  }

  // ── Phrase extraction ──
  const phraseFreq = {};
  for (const sentence of allText.split(/[.!?\n]+/)) {
    const tokens = sentence.trim().split(/\s+/).filter(w => w.length > 0);
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i <= tokens.length - n; i++) {
        const phrase = tokens.slice(i, i + n).join(' ');
        const meaningful = tokens.slice(i, i + n).filter(w => {
          const l = w.toLowerCase().replace(/[^a-z]/g, '');
          return l.length > 1 && !STOP_WORDS.has(l);
        });
        if (meaningful.length < 1 || phrase.length < 8) continue;
        phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
      }
    }
  }

  // Filter phrases
  const PHRASE_BLACKLIST = /^(let me|i'll|user:|muxie:|assistant:|- user|- muxie|# conversation|conversation summary|memory from|saved to vault|you're right|from earlier)/i;
  const phraseCandidates = Object.entries(phraseFreq)
    .filter(([p, f]) => f >= minFreq && !PHRASE_BLACKLIST.test(p))
    .sort((a, b) => (b[1] * b[0].length) - (a[1] * a[0].length))
    .slice(0, maxPhrases);

  let pidx = Object.keys(codebook.data.phrases).length;
  for (const [phrase] of phraseCandidates) {
    if (codebook.hasText(phrase)) continue;
    codebook.data.phrases[`$p${++pidx}`] = phrase;
  }

  codebook.save();
  return { newEntries: codebook.size - sizeBefore, filesScanned: texts.length };
}

// ─── Compress ───

/**
 * Compress text using codebook.
 * @param {string} text - Raw text
 * @param {Codebook} codebook
 * @returns {string} Compressed text with PackRat header
 */
export function compress(text, codebook) {
  const pairs = codebook.allPairs();
  let out = text;
  for (const { code, text: pattern } of pairs) {
    const escaped = _escRe(pattern);
    const re = code.startsWith('$p')
      ? new RegExp(escaped, 'gi')
      : new RegExp(`\\b${escaped}\\b`, 'gi');
    out = out.replace(re, code);
  }
  return `<!-- packrat:v1 codebook:${codebook.path} -->\n${out}`;
}

/**
 * Compress a file in-place or to .pr.md.
 * @param {string} filePath
 * @param {Codebook} codebook
 * @param {boolean} inPlace - Overwrite original (default: false, writes .pr.md)
 * @returns {{ outPath: string, originalSize: number, compressedSize: number, ratio: string }}
 */
export function compressFile(filePath, codebook, inPlace = false) {
  const original = fs.readFileSync(filePath, 'utf-8');
  const compressed = compress(original, codebook);
  const outPath = inPlace ? filePath : filePath.replace(/\.md$/, '.pr.md');
  fs.writeFileSync(outPath, compressed);
  const ratio = (original.length / (compressed.length - compressed.indexOf('\n'))).toFixed(1);
  return { outPath, originalSize: original.length, compressedSize: compressed.length, ratio: ratio + 'x' };
}

// ─── Decompress ───

/**
 * Decompress PackRat-compressed text.
 * @param {string} compressed
 * @param {Codebook} codebook
 * @returns {string}
 */
export function decompress(compressed, codebook) {
  let text = compressed.replace(HEADER_RE, '').trim();
  const pairs = codebook.allPairs().reverse(); // shortest first for safe expansion
  for (const { code, text: pattern } of pairs) {
    text = text.replace(new RegExp(_escRe(code), 'g'), pattern);
  }
  return text;
}

// ─── Stats ───

/**
 * Get codebook statistics.
 * @param {Codebook} codebook
 * @returns {object}
 */
export function stats(codebook) {
  const all = [...Object.entries(codebook.data.entries), ...Object.entries(codebook.data.phrases)];
  all.sort((a, b) => (b[1].length - b[0].length) - (a[1].length - a[0].length));
  return {
    version: codebook.data.version,
    generated: codebook.data.generated,
    entities: Object.keys(codebook.data.entries).length,
    phrases: Object.keys(codebook.data.phrases).length,
    total: codebook.size,
    topEntries: all.slice(0, 15).map(([code, text]) => ({
      code, text, savings: text.length - code.length,
    })),
  };
}

// ─── Helpers ───

function _escRe(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function _genCode(word) {
  const clean = word.replace(/[^a-zA-Z]/g, '');
  if (clean.length <= 3) return '$' + clean.toUpperCase();
  const first = clean[0].toUpperCase();
  const cons = clean.slice(1).replace(/[aeiou]/gi, '');
  return '$' + first + (cons.length >= 2 ? cons.slice(0, 2).toUpperCase() : clean.slice(1, 3).toUpperCase());
}
