# PackRat

**Auto-learning codebook compression for AI agent memory.**

Makes context files 2-10x smaller while staying fully readable by any LLM — no decoder needed.

## The Problem

AI agents forget because memory bloats their context window. PackRat fixes this by compressing memory files with a self-learning codebook that any LLM can read without a decoder.

## How It Works

1. **Learn** — Scans your files, finds repeated entities and phrases, generates short codes ranked by `frequency x length`
2. **Compress** — Replaces patterns with codes. Every file gets a header pointing to the codebook
3. **Read** — Any LLM reads the codebook header, loads it, and understands the compressed content cold

```
Original:  "Kevin decided to switch from Flash to Nemotron via OpenRouter for free"
Compressed: "$K decided to switch from $FLS to $NEM $p1"
```

The codebook tells the LLM: `$K = Kevin`, `$FLS = Flash`, `$NEM = Nemotron`, `$p1 = via OpenRouter for free`.

## Install

```bash
npm install -g packrat-compress
```

Or use directly:

```bash
npx packrat-compress init
```

## Usage

```bash
# Initialize in your project
packrat init

# Scan files and build codebook
packrat learn .
packrat learn ./memory/
packrat learn ./docs/

# Compress a file
packrat compress context.md
# → context.pr.md (compressed)

# Decompress for humans
packrat decompress context.pr.md
# → context.expanded.md

# Check stats
packrat stats
```

## Programmatic API

```js
import { Codebook, learn, compress, decompress, stats } from 'packrat-compress';

// Load or create codebook
const cb = new Codebook('.packrat/codebook.json');
cb.load();

// Learn from files
learn(['.'], cb);

// Compress text
const compressed = compress('Your long context text here...', cb);

// Decompress
const original = decompress(compressed, cb);

// Stats
const info = stats(cb);
console.log(`${info.total} entries, ${info.entities} entities, ${info.phrases} phrases`);
```

## Compressed File Format

Every PackRat-compressed file starts with a header:

```markdown
<!-- packrat:v1 codebook:.packrat/codebook.json -->
```

This tells any LLM: "load that codebook, then read this file." The format is self-documenting.

## Codebook Format

```json
{
  "version": 1,
  "generated": "2026-04-09",
  "entries": {
    "$K": "Kevin",
    "$RR": "ReelRecipes",
    "#D": "[DECISION]",
    "#T": "[TECHNICAL]"
  },
  "phrases": {
    "$p1": "via OpenRouter for free",
    "$p2": "context window"
  }
}
```

- **Entries**: Short codes for entities (people, tools, services, technical terms)
- **Phrases**: Short codes for repeated multi-word patterns
- Human-editable JSON — add your own entries anytime
- Additive-only: old codes are never removed (backward compatibility)

## Claude Code Skill

PackRat is also available as a Claude Code skill:

```
/packrat init
/packrat learn ./memory
/packrat compress context.md
/packrat stats
```

## Design Principles

- **Zero dependencies** — Pure Node.js, works with Node 18+ and Bun
- **Self-documenting** — Codebook reference in every compressed file
- **LLM-native** — Any model can read compressed files without fine-tuning
- **Deterministic** — No AI needed to compress/decompress, just string replacement
- **Backward-compatible** — Codebook is additive-only, old files always readable

## License

MIT — Kevin Cline / [ClawdWorks](https://github.com/kevdogg102396-afk)
