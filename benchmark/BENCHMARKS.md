# PackRat v2 Benchmarks

**Version:** 2.0.0
**Date:** 2026-04-10
**Tokenizer:** tiktoken cl100k_base (GPT-4 / Claude compatible)
**Platform:** Node.js v25.6.1, Windows 11

## Summary

| Metric | Result |
|--------|--------|
| Round-trip accuracy | **100%** (144/144 tests) |
| Token savings (avg) | **2.4%** |
| Token savings (best) | **17.3%** (path/URL-heavy files) |
| Byte savings (avg) | **2.5%** |
| Search speedup | **12.03x** |
| Codebook entries | 72 (auto-learned) |
| Negative-savings entries | 0 |

## Comparison: PackRat vs MemPalace

| Metric | PackRat v2 | MemPalace (AAAK) |
|--------|-----------|-----------------|
| Accuracy | **100%** (lossless) | 84.2% (lossy) |
| Compression type | Lossless codebook | Lossy summarization |
| Token savings | 2-17% | Higher (lossy) |
| Data loss | **Zero** | Information dropped |
| Dependencies | Zero | Multiple |
| Decoder needed | No (self-documenting) | Yes |

PackRat trades peak compression for perfect fidelity. No information is ever lost.

## Real-World Results (65 Production Files)

Tested on 65 markdown memory files totaling 249KB / 70,014 tokens.
Codebook auto-learned from the same files (72 entries: 20 paths, 35 entities, 17 phrases).

| File | Bytes | Tokens | Compressed Tokens | Token Savings | Round-Trip |
|------|-------|--------|-------------------|---------------|------------|
| telegram_channels.md | 782 | 197 | 163 | **17.3%** | PASS |
| deployed_urls.md | 5,481 | 1,666 | 1,415 | **15.1%** | PASS |
| nvidia_api_endpoints.md | 2,331 | 756 | 684 | **9.5%** | PASS |
| comfyui-setup.md | 1,939 | 623 | 565 | **9.3%** | PASS |
| anymodel_promo.md | 1,703 | 471 | 433 | **8.1%** | PASS |
| mulerun-agents.md | 2,408 | 760 | 704 | **7.4%** | PASS |
| feedback_nano_pictures.md | 585 | 143 | 133 | **7.0%** | PASS |
| feedback_comfyui_mcp.md | 1,589 | 511 | 479 | **6.3%** | PASS |
| session_state_2026_03_21.md | 1,934 | 568 | 532 | **6.3%** | PASS |
| 3d_pipeline.md | 5,820 | 1,748 | 1,652 | **5.5%** | PASS |
| PLATFORMS.md | 1,644 | 639 | 604 | **5.5%** | PASS |
| opencli_rs.md | 2,056 | 590 | 564 | **4.4%** | PASS |
| PROJECTS.md | 6,508 | 2,002 | 1,921 | **4.0%** | PASS |
| grokbot_status.md | 2,143 | 621 | 597 | **3.9%** | PASS |
| nemocode.md | 7,267 | 2,031 | 1,953 | **3.8%** | PASS |
| git_hooks_installed.md | 1,576 | 420 | 405 | **3.6%** | PASS |
| youtube_comment_adapter.md | 1,751 | 459 | 443 | **3.5%** | PASS |
| MEMORY.md | 7,140 | 2,131 | 2,064 | **3.1%** | PASS |
| anymodel.md | 3,313 | 1,027 | 996 | **3.0%** | PASS |
| preston_plumbing.md | 1,163 | 302 | 293 | **3.0%** | PASS |
| feedback_morning_surprise.md | 1,946 | 421 | 409 | **2.9%** | PASS |
| local_image_gen.md | 4,822 | 1,671 | 1,625 | **2.8%** | PASS |
| LESSONS.md | 13,814 | 3,776 | 3,715 | **1.6%** | PASS |
| TASKS.md | 12,543 | 3,983 | 3,909 | **1.9%** | PASS |
| reelrecipes.md | 35,578 | 9,555 | 9,540 | **0.2%** | PASS |
| **TOTAL** | **249,111** | **70,014** | **68,317** | **2.4%** | **65/65 PASS** |

*25 of 65 files shown. All 65 files passed round-trip. Full results in benchmark/output/v2-test-results.json.*

## Token Savings by Pattern Type

Measured with tiktoken cl100k_base:

| Pattern Type | Example | Original Tokens | Code Tokens | Savings Per Hit |
|-------------|---------|-----------------|-------------|-----------------|
| Windows file path | `C:/Users/dev/projects/app/` | 8 | 3 | **5** |
| Deep file path | `C:/Users/dev/projects/reelrecipes/src/` | 12 | 3 | **9** |
| Very deep path | `C:/Users/dev/Downloads/ComfyUI_portable/` | 19 | 3 | **16** |
| GitHub URL | `https://github.com/user/repo` | 14 | 3 | **11** |
| Markdown header | `## CRITICAL REMINDERS` | 6 | 2 | **4** |
| Multi-word phrase | `via OpenRouter for free` | 5 | 2 | **3** |
| Tech name (multi-token) | `ReelRecipes` | 3 | 2 | **1** |
| Tech name (single-token) | `JavaScript` | 1 | 3 | **-2** (rejected) |

v2's token-aware scoring automatically rejects entries like "JavaScript" that cost tokens.

## Test Suite (144 tests, 0 failures)

| Category | Tests | Description |
|----------|-------|-------------|
| Edge cases | 40 | Unicode, emoji, CJK, whitespace, code blocks, markdown, literal code-like strings, special chars, fake headers, private use area chars |
| Stress tests | 14 | 200x repeated words, 100x repeated paths, 50K char files, null bytes, 1-char files, long paths/URLs |
| Real-world files | 65 | Production AI agent memory files (read-only, no modification) |
| CLAUDE.md files | 12 | Project config files across multiple repos |
| v1 backward compat | 12 | v2 engine with v1 codebook format |
| Production codebook | 1 | v2 engine with Muxie's live codebook |

## How to Reproduce

```bash
git clone https://github.com/kevdogg102396-afk/packrat
cd packrat
pip install tiktoken
PYTHON_PATH=$(which python) node benchmark/bench.mjs
PYTHON_PATH=$(which python) node benchmark/tests/v2-edge-cases.mjs
```

## Methodology

- **Token counting**: tiktoken cl100k_base via Python subprocess (batch mode)
- **Round-trip test**: `decompress(compress(original)) === original` (exact string equality)
- **Codebook**: Auto-learned from the same files being tested (no external training data)
- **No cherry-picking**: All 65 files in the memory directory were tested, results reported for every file
- **Secrets filter**: Lines containing API keys, tokens, or credentials are stripped before learning
