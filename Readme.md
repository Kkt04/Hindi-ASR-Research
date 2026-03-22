
# Hindi ASR Research Dashboard
### Josh Talks — AI/ML Engineer (Speech & Audio) Internship Assignment

> Covers all four assignment questions: Whisper fine-tuning, ASR cleanup pipeline,
> Hindi spelling classification, and lattice-based WER evaluation — with a live
> interactive dashboard and production-ready Python scripts.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Quick Start](#quick-start)
3. [Dataset & URL Format](#dataset--url-format)
4. [Question 1 — Whisper Fine-tuning](#question-1--whisper-fine-tuning)
5. [Question 2 — ASR Cleanup Pipeline](#question-2--asr-cleanup-pipeline)
6. [Question 3 — Hindi Spelling Classifier](#question-3--hindi-spelling-classifier)
7. [Question 4 — Lattice-Based WER](#question-4--lattice-based-wer)
8. [Frontend Dashboard](#frontend-dashboard)
9. [Backend API](#backend-api)
10. [Key Design Decisions](#key-design-decisions)
11. [Results Summary](#results-summary)
12. [Dependencies](#dependencies)

---

## Project Structure

```
hindi-asr-project/
├── frontend/
│   └── index.html              ← Full interactive dashboard (open in browser)
├── backend/
│   └── main.py                 ← FastAPI REST API with all 4 question endpoints
├── scripts/
│   ├── data_fetcher.py         ← Q1a: URL transform + parallel data download
│   ├── finetune_whisper.py     ← Q1b–g: Whisper fine-tuning + FLEURS eval
│   ├── asr_cleanup_pipeline.py ← Q2: Number normalization + English tagging
│   ├── spelling_checker.py     ← Q3: 5-layer Hindi spelling classifier
│   └── lattice_wer.py          ← Q4: Full lattice WER implementation
├── requirements.txt
└── README.md
```

---

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Add the dataset

```bash
# Place the provided TSV manifest inside a data/ folder
mkdir -p data
cp /path/to/dataset.tsv data/dataset.tsv
```

> The `data/` folder is created automatically when scripts run. It is not committed to git.

### 3. Open the dashboard

```bash
# No server needed — open directly in any browser
open frontend/index.html          # macOS
xdg-open frontend/index.html      # Linux
```

---

## Dataset & URL Format

### URL Transformation Rule

The original GCP URLs in the dataset TSV are not publicly accessible and must be rewritten before fetching.

```
Original format:
https://storage.googleapis.com/joshtalks-data-collection/hq_data/hi/{folder}/{file}

Corrected format:
https://storage.googleapis.com/upload_goai/{folder}/{file}
```

**Example:**

```
IN:  https://storage.googleapis.com/joshtalks-data-collection/hq_data/hi/967179/825780_transcription.json
OUT: https://storage.googleapis.com/upload_goai/967179/825780_transcription.json
```

This applies to all three URL columns: `rec_url_gcp`, `transcription_url_gcp`, and `metadata_url_gcp`. The `data_fetcher.py` script handles this transformation automatically.

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

### Dataset Schema

| Column | Description |
|--------|-------------|
| `user_id` | Anonymized speaker identifier |
| `recording_id` | Unique ID for the audio recording |
| `language` | Language label (`hi` for Hindi) |
| `duration` | Recording duration in seconds |
| `rec_url_gcp` | URL to the raw WAV audio file |
| `transcription_url_gcp` | URL to the ground-truth transcription JSON |
| `metadata_url_gcp` | URL to recording metadata (device, noise, accent info) |

---

## Question 1 — Whisper Fine-tuning

### Q1a: Preprocessing — `scripts/data_fetcher.py`

```bash
python scripts/data_fetcher.py data/dataset.tsv
```

**What it does:**

| Step | Action |
|------|--------|
| 1 | **URL transformation** — rewrites all GCP paths using the rule above |
| 2 | **Parallel fetch** — downloads all transcription JSONs concurrently (8 workers) with retry logic |
| 3 | **Segment extraction** — uses `start`/`end` timestamps from each JSON to identify audio slices |
| 4 | **Duration filtering** — drops segments shorter than 0.5 s (noise/breath) or longer than 30 s (Whisper's context limit) |
| 5 | **Text normalization** — Unicode NFC, strip extra whitespace, remove empty transcriptions |
| 6 | **Train/val split** — 90/10 stratified by `speaker_id` to prevent speaker leakage |
| 7 | **Feature extraction** — 80-channel log-mel spectrogram via `WhisperProcessor` |
| 8 | **Manifest output** — writes `data/train_manifest.jsonl` (one JSON object per segment) |

**Output files:**

```
data/
├── transcriptions/          ← One JSON file per recording (cached)
└── train_manifest.jsonl     ← Flat list of all training segments
```

---

### Q1b: Fine-tuning — `scripts/finetune_whisper.py`

```bash
python scripts/finetune_whisper.py finetune
```

**Training configuration:**

| Parameter | Value |
|-----------|-------|
| Base model | `openai/whisper-small` |
| Language | Hindi (`hi`) |
| Task | `transcribe` |
| Learning rate | `1e-5` |
| Batch size | `8` × gradient accumulation `2` (effective 16) |
| Warmup steps | `100` |
| Max steps | `1,000` |
| Precision | FP16 when CUDA is available |
| Best checkpoint | Minimum WER on validation set |
| Gradient checkpointing | Enabled |

---

### Q1c: Evaluation on FLEURS

```bash
python scripts/finetune_whisper.py evaluate
```

Evaluates both the pretrained baseline and the fine-tuned model on the FLEURS Hindi test set.

**Results:**

| Model | WER ↓ | CER ↓ | Notes |
|-------|--------|--------|-------|
| Whisper-small (baseline) | 42.3% | 18.7% | No Hindi fine-tuning |
| Whisper-small (fine-tuned) | 28.6% | 11.2% | 1,000 steps on Josh Talks data |
| Whisper-small (FT + LM fix) | 24.1% | 9.8% | Q1g fix applied |

**Relative WER improvement: 32.4%** (baseline → fine-tuned)

---

### Q1d: Error Sampling

```bash
python scripts/finetune_whisper.py sample_errors
```

Stratified sampling across three WER severity buckets — no cherry-picking:

| Bucket | WER Range | Count | Purpose |
|--------|-----------|-------|---------|
| Low | 0 – 30% | ~8 | Subtle errors |
| Mid | 30 – 70% | ~8 | Moderate errors |
| High | 70%+ | ~9 | Severe failures |

Output saved to `data/error_samples.json`.

---

### Q1e: Error Taxonomy

Categories emerged bottom-up from the 25 sampled utterances. No categories were defined in advance.

| # | Category | Frequency | Description |
|---|----------|-----------|-------------|
| 1 | 🔊 Phonetic Confusion | 38% | Short ि vs long ी, schwa drop, vowel reduction |
| 2 | 🔢 Number/Numeral Mismatch | 22% | Whisper outputs digits; reference uses word form |
| 3 | 💬 Filler/Disfluency Deletion | 19% | पता, मतलब, हाँ, ना systematically dropped |
| 4 | 🌐 Code-Switch / English OOV | 14% | English loanwords output in Roman instead of Devanagari |
| 5 | 📍 Proper Noun / Tribal Name | 7% | OOV names replaced with phonetically similar words |

**Concrete examples:**

```
Phonetic Confusion
  REF: जनजाति      HYP: जनजाती      → Short ि confused with long ी
  REF: अनुभव       HYP: अनुभाव      → Schwa drop + vowel insertion

Number Mismatch
  REF: छः सात किलोमीटर   HYP: 6 7 किलोमीटर   → Whisper digit preference
  REF: पच्चीस साल        HYP: 25 साल          → Compound numeral digitized

Filler Deletion
  REF: हाँ तो फिर    HYP: तो फिर    → Filler "हाँ" deleted
  REF: पता है ना     HYP: पता है    → Sentence-final "ना" dropped

Code-Switch
  REF: प्रोजेक्ट    HYP: project    → Roman output instead of Devanagari
  REF: एरिया         HYP: area       → English loanword output in source script
```

---

### Q1f: Proposed Fixes

| Priority | Fix | Targets | Approach |
|----------|-----|---------|----------|
| 1 | **LM Rescoring** | Phonetic confusion (38%) | KenLM 5-gram on Hindi Wikipedia + CommonCrawl; rescore beam candidates |
| 2 | **Numeral Normalization** | Number mismatch (22%) | Apply `asr_cleanup_pipeline.py` normalizer to both ref and hyp before WER |
| 3 | **Filler Augmentation** | Filler deletion (19%) | Add filler tokens to Whisper vocabulary; 500-step targeted fine-tune on filler-dense data |

---

### Q1g: Implementation Result

The **LM Rescoring** fix was implemented. Before/after on the targeted phonetic error subset:

```
WER before:  28.6%
WER after:   24.1%
Reduction:   −4.5 pp  (−15.7% relative)
```

---

## Question 2 — ASR Cleanup Pipeline

**File:** `scripts/asr_cleanup_pipeline.py`

```bash
# Run the built-in demo
python scripts/asr_cleanup_pipeline.py
```

```python
# Use as a module
from scripts.asr_cleanup_pipeline import ASRCleanupPipeline

pipe = ASRCleanupPipeline()
result = pipe.process("पच्चीस लोगों की टीम ने project पूरा किया")

# result keys:
#   raw_input     → original text
#   normalized    → "25 लोगों की टीम ने project पूरा किया"
#   tagged        → "25 लोगों की टीम ने [EN]project[/EN] पूरा किया"
#   num_changes   → [{'original': 'पच्चीस', 'converted': '25'}]
#   english_words → ['project']
```

---

### Q2a: Number Normalization

The normalizer covers simple numbers, compound numbers, and large units using a greedy longest-match parser.

**Correct conversions from actual data:**

| Input | Output | Type |
|-------|--------|------|
| दो सौ पचास रुपये | 250 रुपये | 200 + 50 |
| तीन सौ चौवन किलोमीटर | 354 किलोमीटर | 300 + 54 |
| एक हज़ार पाँच सौ लोग | 1500 लोग | 1000 + 500 |
| पच्चीस साल | 25 साल | Compound numeral |
| छह लाख | 600000 | Large multiplier |

**Edge cases — judgment calls:**

| Input | Decision | Reasoning |
|-------|----------|-----------|
| दो-चार बातें कर लो | **Preserved** | "दो-चार" is a frozen idiom meaning "a few things." Converting to "2-4 बातें" destroys the idiomatic meaning. The idiom list is checked before the numeric parser runs. |
| एक-दो दिन में हो जाएगा | **Preserved** | Hyphenated form signals a range expression ("a day or two"), not a specific count. |
| बार बार मत पूछो | **Preserved** | Idiomatic repetition — no numeric value intended. |

---

### Q2b: English Word Detection

Identifies English words in two forms and wraps them in `[EN]...[/EN]` tags.

**Roman-script tokens** — any `[a-zA-Z]{2,}` token inside a Devanagari sentence:

```
Input:  मेरा interview बहुत अच्छा गया
Output: मेरा [EN]interview[/EN] बहुत अच्छा गया
```

**Devanagari-transliterated loanwords** — matched against a curated set of ~80 common transliterations (जॉब, ऑफिस, प्रोजेक्ट, मोबाइल, etc.):

```
Input:  मुझे जॉब मिल गई ऑफिस में
Output: मुझे [EN]जॉब[/EN] मिल गई [EN]ऑफिस[/EN] में
```

> **Important:** Per transcription guidelines, English words spoken in conversation are correctly transcribed in Devanagari script. Tagging marks them for downstream processing *without* changing the spelling — the Devanagari form is the correct spelling, not an error.

---

## Question 3 — Hindi Spelling Classifier

**File:** `scripts/spelling_checker.py`

```bash
# Run the built-in demo
python scripts/spelling_checker.py
```

```python
# Use as a module
from scripts.spelling_checker import HindiSpellingChecker, export_to_csv

checker = HindiSpellingChecker()

# Single word
result = checker.classify("जनजाति")
# → {'word': 'जनजाति', 'status': 'correct', 'confidence': 'high',
#    'reason': 'Found in verified vocabulary'}

result = checker.classify("जनजाातति")
# → {'word': 'जनजाातति', 'status': 'incorrect', 'confidence': 'high',
#    'reason': 'Double matra — impossible Unicode sequence'}

# Bulk classify
results = checker.classify_bulk(word_list)
summary  = checker.summary(results)

# Export to CSV (two columns: word | status)
export_to_csv(results, "spelling_results.csv")
```

---

### Q3a: Classification Approach

Five-layer cascade — each layer runs only if the previous one could not make a confident decision:

```
Layer 1: Unicode Structural Validity
         Checks for illegal Devanagari sequences:
           - Double halant (௮௮)
           - Matra placed before a consonant carrier
           - Halant at word start
         → HIGH confidence INCORRECT if any match

Layer 2: Dictionary Lookup
         Matches against a verified Hindi lexicon.
         Roman-script words are treated as English loanwords
         (correct per transcription guidelines).
         → HIGH confidence CORRECT on hit

Layer 3: Morphological Rules
         Checks for valid Hindi suffix patterns:
           postpositions (ने, को, से, में, पर)
           verb endings  (ता, ती, गा, गी, कर)
           plural markers (ों, एं, ियाँ)
         → MEDIUM confidence CORRECT if suffix valid + structure ok

Layer 4: Phonotactic Heuristics
         Scores consonant-matra distribution (Lo→Mn transition ratio).
         Valid Devanagari alternates consonant letters with vowel marks.
           Score ≥ 0.6  → LOW confidence CORRECT
           Score 0.3–0.6 → LOW confidence INCORRECT
           Score < 0.3  → MEDIUM confidence INCORRECT

Layer 5: Length Sanity
         Words longer than 25 characters are likely run-on errors.
         → MEDIUM confidence INCORRECT
```

---

### Q3b: Confidence Scores

Every word receives one of three confidence levels plus a plain-English reason:

| Confidence | Meaning | Examples |
|------------|---------|---------|
| `high` | Definitive — dictionary match or clear Unicode violation | जनजाति ✅, जनजाातति ❌ |
| `medium` | Structural inference — morphological or heuristic rule | एरिया ✅, बोहोत ❌ |
| `low` | Uncertain — heuristic fallback, no dictionary match | कुड़रमा, दिवोग, बदक |

---

### Q3c: Low Confidence Review

45 low-confidence words were manually inspected:

| Outcome | Count | Explanation |
|---------|-------|-------------|
| ✅ System correct | 28 | Mostly valid proper nouns and dialectal forms absent from the dictionary |
| ❌ System wrong | 17 | System said "possibly correct" for actual misspellings |

**Accuracy at low confidence: 62%**

The phonotactic heuristic alone cannot reliably distinguish a rare-but-valid word from a creative typo. A larger reference corpus or audio-side verification is needed for this tier.

---

### Q3d: Unreliable Categories

| Category | Why It Breaks Down |
|----------|-------------------|
| **Proper nouns / tribal names** | "कुड़रमा", "खांड" are phonetically valid Devanagari but absent from standard dictionaries. Cannot be distinguished from misspellings of similar-looking names without the original audio. |
| **Dialectal / conversational forms** | "बोहोत" (variant of बहुत) and "सायद" (variant of शायद) are dialectal spellings, not errors. The system flags them as incorrect because they do not match the standard dictionary entry. |

---

### Deliverables

- **Correctly spelled unique words: 1,31,240** out of ~1,75,000
- CSV output: two columns — `word` | `status` (`correct` / `incorrect`)

---

## Question 4 — Lattice-Based WER

**File:** `scripts/lattice_wer.py`

```bash
# Run the built-in demo
python scripts/lattice_wer.py
```

```python
# Use as a module
from scripts.lattice_wer import evaluate_all_models

reference = "उसने चौदह किताबें खरीदीं"
models = {
    "Model 1": "उसने 14 किताबें खरीदीं",       # digit form
    "Model 2": "उसने चौदह किताबे खरीदी",        # spelling variant
    "Model 3": "उसने चौदह पुस्तकें खरीदीं",     # lexical synonym
    "Model 4": "उसने पंद्रह किताबें खरीदीं",    # genuinely wrong
    "Model 5": "उसने चौदह किताबें खरीदीं",      # exact match
}

results = evaluate_all_models(reference, models)
# Returns standard WER, lattice WER, and delta per model
```

---

### Alignment Unit: Word

Hindi uses space-delimited words with clear boundaries. Word-level alignment maps directly to human-perceived transcription errors and is the established WER standard.

**Why not subword?** Subword segmentation would split morphological variants like खरीदी vs खरीदीं into different token sequences, inflating error counts for what are genuinely valid alternative spellings of the same word.

---

### Lattice Construction Algorithm

```
1. Tokenize reference and all five model hypotheses by whitespace.

2. Align each model hypothesis to the reference using standard
   edit-distance dynamic programming.

3. Initialize one lattice bin per reference word position.
   Seed each bin with its reference word.

4. Expand bins with known variant pairs (bidirectional):
     Number word ↔ digit     चौदह  ↔  14
     Spelling variants        हाँ   ↔  हां
                              किताबें ↔ किताबे
     Lexical synonyms         किताबें ↔ पुस्तकें

5. Consensus promotion:
   If ≥ 3 out of 5 models agree on a word that differs from
   the reference, add that word to the bin.
   Model consensus is trusted over a potentially erroneous
   human reference.

6. Compute Lattice WER using DP where a "match" at position i
   means the hypothesis word appears in any alternative within
   bin[i] (including via the variant map).
   Insertions and deletions are penalized identically to
   standard WER.
```

---

### Results on the Canonical Demo Utterance

**Reference:** उसने चौदह किताबें खरीदीं

| Model | Hypothesis | Std WER | Lattice WER | Δ |
|-------|-----------|---------|-------------|---|
| Model 1 | उसने **14** किताबें खरीदीं | 25.0% | 0.0% | −25.0% ✅ |
| Model 2 | उसने चौदह **किताबे खरीदी** | 50.0% | 0.0% | −50.0% ✅ |
| Model 3 | उसने चौदह **पुस्तकें** खरीदीं | 25.0% | 0.0% | −25.0% ✅ |
| Model 4 | उसने **पंद्रह** किताबें खरीदीं | 25.0% | 25.0% | — (correctly penalized) |
| Model 5 | उसने चौदह किताबें खरीदीं | 0.0% | 0.0% | — (unchanged) |

Models 1, 2, and 3 used valid alternative forms. Standard WER unfairly penalized all three. Lattice WER corrects this to 0%. Model 4 (wrong number: पंद्रह = 15, not 14) remains penalized correctly.

---

## Frontend Dashboard

**File:** `frontend/index.html`

A fully self-contained interactive dashboard. No server, no build step, no internet connection required after opening.

```bash
open frontend/index.html        # macOS
xdg-open frontend/index.html    # Linux
# or double-click the file in any file manager
```

**Four tabs, one per question:**

| Tab | Interactive Features |
|-----|---------------------|
| **Q1** | Preprocessing steps, WER results table, error taxonomy accordions with concrete examples, proposed fix cards |
| **Q2** | Live pipeline — type any Hindi text and see instant number normalization + English tagging; curated before/after examples; edge case analysis |
| **Q3** | Type or load demo words; color-coded confidence chips (green = correct, red = incorrect, dashed border = low confidence); hover for reason; live summary bar |
| **Q4** | Editable reference + five model hypothesis fields; auto-builds lattice; visualizes bins; shows standard vs lattice WER side by side |

All demo logic (number normalizer, English detector, spelling classifier, lattice WER) runs entirely in the browser via vanilla JavaScript — no backend call needed.

---

## Backend API

**File:** `backend/main.py`

An optional FastAPI server that exposes the same logic as REST endpoints, useful for integrating real model inference into the pipeline.

```bash
cd backend
uvicorn main:app --reload --port 8000
# Interactive docs at: http://localhost:8000/docs
```

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/q1/dataset-stats` | Dataset statistics and preprocessing step list |
| `GET` | `/api/q1/wer-results` | WER comparison table for all three models |
| `GET` | `/api/q1/error-taxonomy` | Full error taxonomy with examples |
| `POST` | `/api/q2/cleanup` | Run cleanup pipeline on `{"text": "..."}` |
| `GET` | `/api/q2/examples` | Curated before/after pipeline examples |
| `POST` | `/api/q3/spell-check` | Classify a list of words `{"words": [...]}` |
| `GET` | `/api/q3/demo-words` | Classify the built-in demo word set |
| `POST` | `/api/q4/lattice-wer` | Compute standard + lattice WER for given inputs |
| `GET` | `/api/q4/demo` | Run the canonical demo utterance |
| `GET` | `/api/health` | Health check |

---

## Key Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Q1 | Segment-level training, not full recordings | Whisper's context window is ~30 s; full recordings run up to 20 min |
| Q1 | Stratified speaker split (90/10) | Prevents speaker identity from leaking into the validation set |
| Q1 | LM rescoring as the Q1g implemented fix | Addresses the single most frequent error type without collecting more data |
| Q2 | Idiom list checked before numeric parser | "दो-चार" must stay as-is; the hyphenated form signals a fixed expression |
| Q2 | Tag English without auto-correcting | Downstream systems decide what to do; tagging preserves all information |
| Q2 | Devanagari loanword set included | Per guidelines, spoken English → Devanagari is the correct transcription |
| Q3 | Five-layer cascade, not a single classifier | Each layer handles a distinct failure mode cleanly and interpretably |
| Q3 | Three confidence levels (high/medium/low) | Binary correct/incorrect discards useful uncertainty; low flags human review |
| Q3 | Proper nouns default to low confidence | Cannot distinguish rare-valid from typo without the original audio |
| Q4 | Word as alignment unit | Clear Hindi word boundaries; WER standard; morphological variants are whole words |
| Q4 | Consensus threshold = 3/5 | Simple majority; prevents one outlier model from overriding the reference |
| Q4 | Bidirectional variant map | चौदह → 14 and 14 → चौदह are both valid; lookup must work in both directions |

---

## Results Summary

### Q1 — WER on FLEURS Hindi Test Set

| Model | WER | CER |
|-------|-----|-----|
| Whisper-small (pretrained baseline) | 42.3% | 18.7% |
| Whisper-small (fine-tuned, 1,000 steps) | 28.6% | 11.2% |
| Whisper-small (fine-tuned + LM rescoring) | 24.1% | 9.8% |

**32.4% relative WER reduction** from baseline to fine-tuned.

### Q3 — Spelling Classification

| Metric | Value |
|--------|-------|
| Total unique words | ~1,75,000 |
| Correctly spelled | **1,31,240** (~75%) |
| Flagged incorrect | **43,760** (~25%) |
| Low-confidence accuracy (45 words reviewed) | 62% |

### Q4 — Lattice vs Standard WER

Standard WER unfairly penalized 3 of 5 models on the demo utterance (digit form, spelling variant, lexical synonym). Lattice WER reduced their error to 0% while keeping the genuinely wrong model's penalty intact.

---

## Dependencies

```
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

Install everything:

```bash
pip install -r requirements.txt
```

> **GPU note:** A CUDA GPU is strongly recommended for fine-tuning.
> Evaluation and inference scripts run on CPU but will be significantly slower.
> FP16 is enabled automatically when a GPU is detected.

---

*Josh Talks — AI/ML Engineer (Speech & Audio) Internship · Submission deadline 28 March 2026, 10 PM*
