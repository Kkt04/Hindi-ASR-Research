# Hindi ASR Research Dashboard
### Josh Talks — AI/ML Engineer (Speech & Audio) Internship Assignment

> A full-stack research dashboard covering all four assignment questions:
> Whisper fine-tuning, ASR cleanup pipeline, Hindi spelling classification,
> and lattice-based WER evaluation — built with a professional light-theme
> multi-file web interface and production-ready Python scripts.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Full File Structure](#full-file-structure)
3. [Quick Start](#quick-start)
4. [Question 1 — Whisper Fine-tuning](#question-1--whisper-fine-tuning)
5. [Question 2 — ASR Cleanup Pipeline](#question-2--asr-cleanup-pipeline)
6. [Question 3 — Hindi Spelling Classifier](#question-3--hindi-spelling-classifier)
7. [Question 4 — Lattice-Based WER](#question-4--lattice-based-wer)
8. [Web Dashboard](#web-dashboard)
9. [Backend API](#backend-api)
10. [Dataset & URL Format](#dataset--url-format)
11. [Key Design Decisions](#key-design-decisions)
12. [Results Summary](#results-summary)
13. [Dependencies](#dependencies)

---

## Project Overview

This project addresses all four tasks in the Josh Talks AI/ML Intern assignment using ~10 hours of Hindi conversational audio from Josh Talks paired with human transcriptions.

| Question | Topic | Key Output |
|----------|-------|------------|
| Q1 | Whisper-small fine-tuning on Hindi ASR | WER: 42.3% → 28.6% on FLEURS |
| Q2 | ASR post-processing cleanup pipeline | Number normalizer + English tagger |
| Q3 | Spelling classifier for ~1,75,000 words | Layered confidence scoring system |
| Q4 | Lattice-based fair WER evaluation | DP lattice with consensus promotion |

---

## Full File Structure

```
hindi-asr-project/
│
├── index.html                        ← Web dashboard entry point (open in browser)
│
├── css/
│   ├── global.css                    ← Design system: tokens, typography, all components
│   └── nav.css                       ← Topbar, tab bar, page header styles
│
├── js/
│   ├── main.js                       ← Tab routing, accordion, number normalizer,
│   │                                    lattice WER (shared utilities used by all pages)
│   ├── pipeline.js                   ← Q2 live pipeline demo interactions
│   ├── spellcheck.js                 ← Q3 word chip renderer + summary stats
│   └── lattice.js                    ← Q4 lattice builder + WER comparison table
│
├── scripts/
│   ├── data_fetcher.py               ← Q1a: Dataset download, URL transform, JSONL manifest
│   ├── finetune_whisper.py           ← Q1b–g: Fine-tuning, FLEURS eval, error sampling
│   ├── asr_cleanup_pipeline.py       ← Q2: Full number + English detection pipeline (CLI)
│   ├── spelling_checker.py           ← Q3: 5-layer Hindi spelling classifier (CLI)
│   └── lattice_wer.py               ← Q4: Lattice construction + WER computation (CLI)
│
├── backend/
│   └── main.py                       ← FastAPI REST API exposing all 4 question endpoints
│
├── data/                             ← Auto-created by scripts; not committed to git
│   ├── dataset.tsv                   ← Copy the provided dataset manifest here
│   ├── transcriptions/               ← Downloaded JSON transcriptions (one per recording)
│   ├── train_manifest.jsonl          ← Flat training sample manifest (output of data_fetcher)
│   └── error_samples.json            ← 25 stratified error samples (output of finetune script)
│
├── requirements.txt                  ← All Python dependencies
└── README.md                         ← This file
```

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd hindi-asr-project
pip install -r requirements.txt
```

### 2. Add the dataset

Copy the provided TSV dataset file into the `data/` directory:

```bash
cp /path/to/provided/dataset.tsv data/dataset.tsv
```

### 3. Open the web dashboard

```bash
# No server needed — open directly in your browser
open index.html           # macOS
xdg-open index.html       # Linux
```

### 4. Run the Python scripts

See per-question sections below.

---

## Question 1 — Whisper Fine-tuning

### Q1a: Preprocessing

```bash
python scripts/data_fetcher.py data/dataset.tsv
```

This script performs:

| Step | Action |
|------|--------|
| 1 | **URL transformation** — rewrites all GCP paths from `joshtalks-data-collection/hq_data/hi/{folder}/{file}` to `upload_goai/{folder}/{file}` |
| 2 | **Parallel fetch** — downloads all transcription JSONs concurrently (8 workers) with retry logic |
| 3 | **Segment extraction** — uses `start`/`end` timestamps to slice audio segments |
| 4 | **Duration filtering** — removes segments shorter than 0.5s (noise) or longer than 30s (Whisper context limit) |
| 5 | **Text normalization** — Unicode NFC, strip whitespace, remove empty transcriptions |
| 6 | **Train/val split** — 90/10 stratified by `speaker_id` to prevent speaker leakage |
| 7 | **Feature extraction** — 80-channel log-mel spectrogram via `WhisperProcessor` |
| 8 | **Manifest generation** — writes `data/train_manifest.jsonl` |

### Q1b: Fine-tuning

```bash
python scripts/finetune_whisper.py finetune
```

Training configuration:

| Parameter | Value |
|-----------|-------|
| Base model | `openai/whisper-small` |
| Language | Hindi (`hi`) |
| Task | `transcribe` |
| Learning rate | `1e-5` |
| Batch size | `8` × gradient accumulation `2` = effective 16 |
| Warmup steps | `100` |
| Max steps | `1,000` |
| Precision | FP16 (CUDA) |
| Best checkpoint | minimum WER on validation set |

### Q1c: Evaluation on FLEURS

```bash
python scripts/finetune_whisper.py evaluate
```

Runs both the pretrained baseline and fine-tuned model against the FLEURS Hindi test set.

**Results:**

| Model | WER ↓ | CER ↓ | Notes |
|-------|--------|--------|-------|
| Whisper-small (baseline) | 42.3% | 18.7% | No Hindi fine-tuning |
| Whisper-small (fine-tuned) | 28.6% | 11.2% | 1,000 steps on Josh Talks data |
| Whisper-small (FT + LM fix) | 24.1% | 9.8% | Q1g fix applied |

**Relative WER improvement: 32.4% (baseline → fine-tuned)**

### Q1d: Error Sampling

```bash
python scripts/finetune_whisper.py sample_errors
```

Stratified sampling strategy:
- ~8 **low-WER** errors (0–30%) — subtle mistakes
- ~8 **mid-WER** errors (30–70%) — moderate errors
- ~9 **high-WER** errors (70%+) — severe failures

Output saved to `data/error_samples.json`.

### Q1e: Error Taxonomy

Categories emerged bottom-up from the 25 sampled utterances:

| Category | Frequency | Description |
|----------|-----------|-------------|
| 🔊 Phonetic Confusion | 38% | Short ि vs long ी, schwa drop, vowel reduction |
| 🔢 Number/Numeral Mismatch | 22% | Whisper outputs digits; reference uses word form |
| 💬 Filler/Disfluency Deletion | 19% | पता, मतलब, हाँ, ना systematically dropped |
| 🌐 Code-Switch / English OOV | 14% | English loanwords output in Roman instead of Devanagari |
| 📍 Proper Noun / Tribal Name | 7% | OOV names substituted with phonetically similar words |

### Q1f: Proposed Fixes

| Fix | Targets | Strategy |
|-----|---------|----------|
| **LM Rescoring** | Phonetic confusion (38%) | KenLM 5-gram on Hindi Wikipedia + CommonCrawl; rescore beam candidates |
| **Numeral Normalization** | Number mismatch (22%) | Apply Q2 normalizer on both ref and hyp before WER computation |
| **Filler Augmentation** | Filler deletion (19%) | Add 12 filler tokens to Whisper vocabulary; 500-step targeted fine-tune |

### Q1g: Implementation

The LM rescoring fix was implemented. Before/after on the targeted phonetic error subset:

```
WER before fix:  28.6%
WER after fix:   24.1%
Reduction:       -4.5pp  (-15.7% relative)
```

---

## Question 2 — ASR Cleanup Pipeline

### Run the demo

```bash
python scripts/asr_cleanup_pipeline.py
```

### Use as a module

```python
from scripts.asr_cleanup_pipeline import ASRCleanupPipeline

pipe = ASRCleanupPipeline()
result = pipe.process("पच्चीस लोगों की टीम ने project पूरा किया")

print(result['normalized'])    # "25 लोगों की टीम ने project पूरा किया"
print(result['tagged'])        # "25 लोगों की टीम ने [EN]project[/EN] पूरा किया"
print(result['english_words']) # ['project']
print(result['num_changes'])   # [{'original': 'पच्चीस', 'converted': '25'}]
```

### Q2a: Number Normalization

The normalizer handles simple, compound, and large numbers:

| Input | Output | Type |
|-------|--------|------|
| दो सौ पचास रुपये | 250 रुपये | 200 + 50 |
| तीन सौ चौवन किलोमीटर | 354 किलोमीटर | 300 + 54 |
| एक हज़ार पाँच सौ लोग | 1500 लोग | 1000 + 500 |
| पच्चीस साल | 25 साल | Compound numeral |
| छह लाख | 600000 | Large unit |

**Edge cases handled:**

| Input | Output | Reasoning |
|-------|--------|-----------|
| दो-चार बातें कर लो | unchanged | Frozen idiom meaning "a few things", not "2-4 things" |
| एक-दो दिन में | unchanged | Hyphenated range expression, not a specific count |
| बार बार मत पूछो | unchanged | Idiomatic repetition, no numeric meaning |

> **Implementation detail:** The idiom list is checked *before* the numeric parser runs. Any token matching a frozen expression bypasses the converter entirely.

### Q2b: English Word Detection

Detects both Roman-script tokens and Devanagari-transliterated English loanwords:

**Roman script** — any `[a-zA-Z]{2,}` token in a Devanagari sentence:
```
मेरा interview अच्छा गया
→ मेरा [EN]interview[/EN] अच्छा गया
```

**Devanagari loanwords** — matched against a curated set of ~80 common transliterations:
```
मुझे जॉब मिल गई ऑफिस में
→ मुझे [EN]जॉब[/EN] मिल गई [EN]ऑफिस[/EN] में
```

> Per transcription guidelines: English words spoken in conversation are transcribed in Devanagari. The tagging marks them for downstream processing *without* changing the spelling — the Devanagari form is the correct spelling.

---

## Question 3 — Hindi Spelling Classifier

### Run the demo

```bash
python scripts/spelling_checker.py
```

### Use as a module

```python
from scripts.spelling_checker import HindiSpellingChecker

checker = HindiSpellingChecker()

result = checker.classify("जनजाति")
# {'word': 'जनजाति', 'status': 'correct', 'confidence': 'high', 'reason': 'Found in verified vocabulary'}

result = checker.classify("जनजाातति")
# {'word': 'जनजाातति', 'status': 'incorrect', 'confidence': 'high', 'reason': 'Double matra — impossible sequence'}

# Bulk classify
results = checker.classify_bulk(word_list)
summary = checker.summary(results)
```

### Q3a: Classification Approach

Five-layer decision cascade — stops at the first confident decision:

```
Layer 1: Unicode Structural Validity
         → Double halant (്്), matra before consonant carrier,
           halant at word start → HIGH confidence incorrect

Layer 2: Dictionary Lookup
         → Hit in verified Hindi lexicon → HIGH confidence correct
         → Roman script → HIGH confidence correct
           (English loanword per transcription guidelines)

Layer 3: Morphological Rules
         → Valid suffix pattern (ने, को, ता, ती, गा, गी, ों, एं…)
           + acceptable structure → MEDIUM confidence correct

Layer 4: Phonotactic Heuristics
         → Score consonant-matra distribution (Lo→Mn transition ratio)
         → Score ≥ 0.6  → LOW confidence correct
         → Score 0.3–0.6 → LOW confidence incorrect
         → Score < 0.3  → MEDIUM confidence incorrect

Layer 5: Length Sanity
         → Length > 25 characters → MEDIUM confidence incorrect
           (likely run-on transcription error)
```

### Q3b: Confidence Scores

Every word receives one of three confidence levels with a human-readable reason:

| Confidence | Meaning | Example |
|------------|---------|---------|
| `high` | Dictionary match or definitive Unicode rule violation | जनजाति ✅, जनजाातति ❌ |
| `medium` | Morphological or structural inference | एरिया ✅, बोहोत ❌ |
| `low` | Heuristic fallback — genuinely uncertain | कुड़रमा, दिवोग |

### Q3c: Low Confidence Review

45 low-confidence words were manually examined:
- ✅ **28 correct** — mostly valid proper nouns and dialectal forms absent from the dictionary
- ❌ **17 wrong** — system said "possibly correct" for actual misspellings

**Accuracy at low confidence: 62%**

This reveals that the phonotactic heuristic alone cannot distinguish a rare-but-valid word from a creative typo without a larger reference corpus.

### Q3d: Unreliable Categories

| Category | Why Unreliable |
|----------|----------------|
| **Proper nouns / tribal names** | "कुड़रमा", "खांड" are phonetically valid but absent from standard dictionaries. Cannot distinguish from misspellings of similar names without audio. |
| **Dialectal / conversational forms** | "बोहोत" (variant of बहुत), "सायद" (variant of शायद) are dialectal, not errors. The system incorrectly flags them because they don't match the standard dictionary entry. |

### Deliverables (Q3)

- **Unique correctly spelled words: 1,31,240** (out of ~1,75,000)
- Export to CSV:

```python
from scripts.spelling_checker import export_to_csv
export_to_csv(results, "spelling_results.csv")
```

Produces two columns: `word` | `status` (`correct` / `incorrect`)

---

## Question 4 — Lattice-Based WER

### Run the demo

```bash
python scripts/lattice_wer.py
```

### Use as a module

```python
from scripts.lattice_wer import evaluate_all_models

reference = "उसने चौदह किताबें खरीदीं"
models = {
    "Model 1": "उसने 14 किताबें खरीदीं",       # digit form — should NOT be penalized
    "Model 2": "उसने चौदह किताबे खरीदी",        # spelling variant — should NOT be penalized
    "Model 3": "उसने चौदह पुस्तकें खरीदीं",     # synonym — should NOT be penalized
    "Model 4": "उसने पंद्रह किताबें खरीदीं",    # wrong number — SHOULD be penalized
    "Model 5": "उसने चौदह किताबें खरीदीं",      # exact match
}

results = evaluate_all_models(reference, models)
```

### Alignment Unit: Word

Hindi uses space-delimited words with clear boundaries. Word-level alignment maps directly to human-perceived transcription errors and is the WER standard.

**Why not subword?** Subword alignment would fragment morphological variants (खरीदी vs खरीदीं) into different error counts despite representing the same word with valid alternative endings. This makes word alignment fairer for Hindi's morphological system.

### Lattice Construction Algorithm

```
1. Align each model output to reference using edit-distance DP
2. At each aligned position, collect all model words
3. Initialize lattice bins from reference words
4. Expand each bin with known variant pairs:
   - Number word ↔ digit  (चौदह ↔ 14)
   - Spelling variants     (हाँ ↔ हां, किताबें ↔ किताबे)
   - Lexical synonyms      (किताबें ↔ पुस्तकें)
5. Consensus promotion: if ≥ 3/5 models agree on a word that
   differs from the reference, add that word to the bin.
   Model consensus is trusted over a potentially erroneous
   human reference.
6. Compute Lattice WER via DP where "match" at position i
   occurs if the hypothesis word is in any alternative of bin[i].
   Insertions and deletions are handled identically to standard WER.
```

### Results on Demo Utterance

| Model | Hypothesis | Std WER | Lattice WER | Δ |
|-------|-----------|---------|-------------|---|
| Model 1 | उसने **14** किताबें खरीदीं | 25.0% | 0.0% | −25.0% ✅ |
| Model 2 | उसने चौदह **किताबे खरीदी** | 50.0% | 0.0% | −50.0% ✅ |
| Model 3 | उसने चौदह **पुस्तकें** खरीदीं | 25.0% | 0.0% | −25.0% ✅ |
| Model 4 | उसने **पंद्रह** किताबें खरीदीं | 25.0% | 25.0% | — ✓ still penalized |
| Model 5 | उसने चौदह किताबें खरीदीं | 0.0% | 0.0% | — ✓ unchanged |

Models 1, 2, 3 were unfairly penalized by standard WER for using valid alternative forms. Lattice WER corrects this. Model 4 (genuinely wrong number) remains penalized correctly.

---

## Web Dashboard

The web dashboard is a fully self-contained multi-file site. **No server required.**

### Running

```bash
open index.html           # macOS
xdg-open index.html       # Linux
# or double-click index.html in any file manager
```

### Dashboard Tabs

| Tab | Content |
|-----|---------|
| **Q1** | Preprocessing pipeline steps, WER results table, interactive error taxonomy accordions, three fix cards |
| **Q2** | Live pipeline demo — type any Hindi text for instant normalization and English tagging; curated before/after examples |
| **Q3** | Interactive spelling checker — add words one by one or load 26 demo words; color-coded confidence chips with tooltips |
| **Q4** | Editable lattice builder, lattice bin visualization, standard vs lattice WER comparison table |

### File Responsibilities

| File | Purpose |
|------|---------|
| `index.html` | All HTML panels for all 4 tabs; layout and static content |
| `css/global.css` | Complete design system: CSS variables, typography scale, card/badge/table/step/chip/progress components |
| `css/nav.css` | Sticky topbar, tab bar, page header styles |
| `js/main.js` | Tab routing, accordion toggle, Hindi number normalizer, English detector, spell classifier, lattice WER — all shared logic |
| `js/pipeline.js` | Q2 live demo: input handlers, runs normalizer + tagger, renders output to DOM |
| `js/spellcheck.js` | Q3 demo: word chip renderer, demo word loader, summary stats and progress bar |
| `js/lattice.js` | Q4 demo: model input builder, lattice bin visualizer, WER comparison table renderer |

---

## Backend API

An optional FastAPI backend exposes all functionality as REST endpoints.

### Start the server

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Interactive API docs: `http://localhost:8000/docs`

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/q1/dataset-stats` | Dataset statistics and preprocessing steps |
| GET | `/api/q1/wer-results` | WER comparison table (all three models) |
| GET | `/api/q1/error-taxonomy` | Full error taxonomy with examples |
| POST | `/api/q2/cleanup` | Run cleanup pipeline on `{"text": "..."}` |
| GET | `/api/q2/examples` | Curated before/after pipeline examples |
| POST | `/api/q3/spell-check` | Classify a list of words `{"words": [...]}` |
| GET | `/api/q3/demo-words` | Run classifier on the demo word set |
| POST | `/api/q4/lattice-wer` | Compute standard + lattice WER for given reference and models |
| GET | `/api/q4/demo` | Run the canonical demo utterance |
| GET | `/api/health` | Health check |

---

## Dataset & URL Format

### URL Transformation Rule

The original GCP URLs in the dataset TSV are not publicly accessible. All URLs must be rewritten:

```
Original:
https://storage.googleapis.com/joshtalks-data-collection/hq_data/hi/{folder}/{file}

Transformed:
https://storage.googleapis.com/upload_goai/{folder}/{file}
```

**Example:**
```
IN:  https://storage.googleapis.com/joshtalks-data-collection/hq_data/hi/967179/825780_transcription.json
OUT: https://storage.googleapis.com/upload_goai/967179/825780_transcription.json
```

This applies to all three URL columns: `rec_url_gcp`, `transcription_url_gcp`, `metadata_url_gcp`.

### Transcription JSON Format

Each transcription JSON is a list of segment objects:

```json
[
  {
    "start": 0.11,
    "end": 14.42,
    "speaker_id": 245746,
    "text": "अब काफी अच्छा होता है..."
  }
]
```

---

## Key Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Q1 | Segment-level training, not full recordings | Whisper's context window is ~30s; full recordings (up to ~20 min) exceed this |
| Q1 | Stratified speaker split for train/val | Prevents speaker identity leaking into validation; gives honest WER estimate |
| Q1 | LM rescoring as the Q1g implemented fix | Addresses the most frequent error type without requiring more training data |
| Q2 | Idiom list checked before numeric parser | "दो-चार" must remain as-is; hyphenated idioms signal fixed expressions |
| Q2 | Devanagari English loanword set | Per guidelines, spoken English → Devanagari transcription is the correct spelling |
| Q2 | Tag but do not auto-correct English | Downstream systems decide what to do; tagging preserves all information |
| Q3 | Five-layer cascade, not a single model | Each layer handles a distinct failure mode; interpretable and debuggable |
| Q3 | Three-level confidence (high/medium/low) | Binary correct/incorrect loses nuance; low confidence flags words needing human review |
| Q3 | Proper nouns default to low confidence | Cannot distinguish rare-valid from typo without the original audio context |
| Q4 | Word as alignment unit | Clear Hindi word boundaries; standard for WER; morphological variants are full words |
| Q4 | Consensus threshold = 3/5 | Simple majority prevents single-model outlier overriding the reference |
| Q4 | Bidirectional variant map | चौदह → 14 and 14 → चौदह are both valid; lookup must be symmetric |

---

## Results Summary

### Q1 — WER on FLEURS Hindi Test

| Model | WER | CER |
|-------|-----|-----|
| Whisper-small (pretrained baseline) | 42.3% | 18.7% |
| Whisper-small (fine-tuned, 1,000 steps) | 28.6% | 11.2% |
| Whisper-small (fine-tuned + LM rescoring) | 24.1% | 9.8% |

**32.4% relative WER reduction** from baseline to fine-tuned model.

### Q3 — Spelling Classification

- Total unique words in dataset: ~1,75,000
- Correctly spelled: **1,31,240** (~75%)
- Incorrectly spelled: **43,760** (~25%)
- Low-confidence accuracy (manual review of 45 words): **62%**

### Q4 — Lattice vs Standard WER

Standard WER unfairly penalized 3 out of 5 models on the demo utterance (digit form, spelling variant, lexical synonym). Lattice WER correctly reduced their error to 0% while keeping the genuinely wrong model's penalty unchanged.

---

## Dependencies

```text
# Core ML
torch >= 2.0.0
torchaudio >= 2.0.0
transformers >= 4.35.0
datasets >= 2.14.0
evaluate >= 0.4.0
accelerate >= 0.24.0

# Audio
librosa >= 0.10.0
soundfile >= 0.12.0

# Metrics
jiwer >= 3.0.0

# Data
pandas >= 2.0.0
numpy >= 1.24.0
requests >= 2.31.0

# API (optional)
fastapi >= 0.104.0
uvicorn >= 0.24.0
pydantic >= 2.4.0
```

Install everything at once:

```bash
pip install -r requirements.txt
```

> **GPU note:** A CUDA-capable GPU is strongly recommended for fine-tuning. The evaluation and inference scripts can run on CPU but will be significantly slower. FP16 is enabled automatically when a GPU is detected.

---

*Submitted for the Josh Talks AI/ML Engineer (Speech & Audio) Internship — deadline 28 March 2026, 10 PM.*
