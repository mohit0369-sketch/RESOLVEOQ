# Student 2 — Intelligence Engine

Part of the **RESOLVE IQ** hackathon project.

Student 2 turns raw customer complaints into **structured, machine-readable intelligence** that Student 3 (AI agent) and Student 4 (dashboard) consume without ever touching the internals of this module.

---

## 1. Project overview

A RESOLVE IQ system receives thousands of free-text complaints. Raw text is not actionable: you cannot chart it, alert on it, or reason over it.

This module is the **Intelligence Engine**: it takes raw complaints and produces a single JSON document answering six questions:

1. **What is this complaint about?** → `issue_type`
2. **What is the customer's sentiment?** → `sentiment`
3. **How serious is the complaint?** → `severity`
4. **What complaints are semantically similar?** → `cluster`, `cluster_id`, `embedding`
5. **What problems are increasing?** → `trends`
6. **What emerging issues should be flagged?** → `emerging_issues`

It runs **fully locally**, requires **no API keys**, and is callable through **one public function**: `analyze_complaints(complaints)`.

---

## 2. Student 2 responsibility (exact scope)

**In scope**

| Stage | Deliverable |
|---|---|
| Preprocessing | `clean_text()` |
| Classification | `classify()` — 8 categories |
| Sentiment | `analyze_sentiment()` — VADER |
| Severity | `determine_severity()` — project escalation rules |
| Embeddings | `create_embedding()` / `create_embeddings()` — all-MiniLM-L6-v2 |
| Clustering | `cluster_embeddings()` — HDBSCAN (+ fallback) |
| Cluster naming | `name_clusters()` — dominant-category naming |
| Trends | `detect_trends()`, `compute_growth()` |
| Emerging issues | `detect_emerging_issues()` |
| Orchestration | `analyze_complaints()`, `load_complaints()`, `save_output()` |

**Out of scope — deliberately not in this repository**

- ❌ Frontend
- ❌ Student 1 backend / API layer / authentication
- ❌ Student 3 AI agent / LLM decision logic
- ❌ Student 4 dashboard / visualisation

Student 2 is a **library with a clean contract**, not an application.

---

## 3. Architecture

```
        ┌──────────────────────────────────────────────────────────┐
        │  Student 1 — Backend / API / Auth                        │
        │  (raw complaints, list[dict])                            │
        └───────────────────────────┬──────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    STUDENT 2 — INTELLIGENCE ENGINE                        │
│                    main.analyze_complaints(complaints)                    │
│                                                                           │
│  preprocessing.py   →  classification.py  →  sentiment.py                 │
│          │                    │                   │                       │
│          └────────────────────┴───────────────────┴──► severity.py        │
│                               │                                           │
│                        embeddings.py  (batch, model loaded once)          │
│                               │                                           │
│                        clustering.py  (HDBSCAN + naming)                  │
│                               │                                           │
│                           trends.py  (growth % + emerging issues)         │
│                               │                                           │
│                               ▼                                           │
│              structured intelligence JSON (contracts/data_formats.json)   │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
                ┌───────────────┴────────────────┐
                ▼                                ▼
        ┌────────────────┐              ┌─────────────────┐
        │ Student 3      │              │ Student 4       │
        │ AI Agent       │              │ Dashboard       │
        │ (consumes      │              │ (visualises     │
        │  JSON only)    │              │  JSON only)     │
        └────────────────┘              └─────────────────┘
```

Key architectural rules:

- **One entry point.** Everyone calls `analyze_complaints()`. No one wires stages together themselves.
- **One model, one place.** The embedding model lives only in `embeddings.py` and is loaded once per process.
- **No coupling to the UI.** The engine returns plain JSON-serialisable dicts — no HTTP, no HTML, no framework.
- **Degradation is reported, never hidden.** If embeddings or clustering fail, the run still returns classification/sentiment/severity and lists the problem in `diagnostics`.

### Note on `severity.py`

The brief's folder tree lists severity as a pipeline stage without naming a file. It is implemented in **its own module `severity.py`** (not inside `classification.py`) because severity is a *policy* that will change independently of the classifier, and it must stay independently testable. `tests/test_severity.py` imports from `severity`. This is the only deviation from the listed tree, and it is additive (no file was removed).

---

## 4. Pipeline

```
RAW COMPLAINT
      ↓  validate_complaints()      schema check, recoverable warnings collected
PREPROCESSING   clean_text()          lowercase, strip punctuation/whitespace, keep negations
      ↓
CLASSIFICATION  classify()            weighted keyword rules + explicit tie-break priority
      ↓
SENTIMENT       analyze_sentiment()   VADER compound score → Positive / Neutral / Negative
      ↓
SEVERITY        determine_severity()  project escalation rules → Low / Medium / High
      ↓
EMBEDDINGS      create_embeddings()   ONE batch call to all-MiniLM-L6-v2 (384-dim, L2-normalised)
      ↓
CLUSTERING      cluster_embeddings()  HDBSCAN; noise = -1; fallback = Agglomerative (cosine)
      ↓
CLUSTER NAMING  name_clusters()       dominant issue_type → "Damaged Products", not "Cluster 0"
      ↓
TREND DETECTION detect_trends()       previous month vs current month, growth %
      ↓
EMERGING ISSUES detect_emerging_issues()  growth ≥ threshold AND volume ≥ min_count
      ↓
STRUCTURED INTELLIGENCE OUTPUT (JSON-serialisable)
```

---

## 5. Technologies

| Component | Choice | Why |
|---|---|---|
| Language | Python 3.10+ | Required |
| Data | NumPy, Pandas | Vector maths, period grouping |
| Classic ML | scikit-learn | Agglomerative fallback, optional HDBSCAN |
| Embeddings | sentence-transformers, `all-MiniLM-L6-v2` | 384-dim, fast on CPU, no API cost |
| Clustering | HDBSCAN | Unknown cluster count + explicit noise handling |
| Sentiment | VADER (`vaderSentiment`) | Lightweight, lexicon + rules, no training data |
| Testing | pytest | 90+ meaningful tests |

---

## 6. Folder structure

```
student2-intelligence/
├── data/
│   └── complaints.json          77 synthetic complaints across 8 categories, 2 months
├── preprocessing.py             clean_text()
├── classification.py            classify(), score_categories()
├── sentiment.py                 analyze_sentiment(), sentiment_score()
├── severity.py                  determine_severity(), explain_severity()
├── embeddings.py                create_embedding(), create_embeddings()
├── clustering.py                cluster_embeddings(), name_clusters()
├── trends.py                    detect_trends(), detect_emerging_issues()
├── main.py                      analyze_complaints(), load_complaints(), save_output()
├── contracts/
│   └── data_formats.json        input/output/output contract + integration notes
├── tests/
│   ├── test_preprocessing.py
│   ├── test_classification.py
│   ├── test_sentiment.py
│   ├── test_severity.py
│   ├── test_trends.py
│   └── test_pipeline.py
├── requirements.txt
├── README.md
├── .gitignore
└── .env.example
```

---

## 7. Installation

```bash
git clone <your-repo-url>
cd student2-intelligence
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Optional — offline / no-download mode:

```bash
export EMBEDDING_BACKEND=hashing   # Windows: set EMBEDDING_BACKEND=hashing
```

The first run downloads the `all-MiniLM-L6-v2` weights (~90 MB) into the Hugging Face cache. Everything after that is offline.

---

## 8. Running the project

```bash
# Demo complaints + the full dataset, printed as a readable report
python main.py

# Only the 3 demo complaints  (fast, no dataset needed)
python main.py --demo-only

# Run on the dataset and write the structured JSON output
python main.py --file data/complaints.json --output output.json

# Skip the embedding vectors (smaller payload)
python main.py --no-embeddings

# Tune the emerging-issue threshold
python main.py --growth-threshold 30 --min-count 5 -v
```

Programmatic use:

```python
from main import analyze_complaints, load_complaints, save_output

complaints = load_complaints("data/complaints.json")
result = analyze_complaints(complaints)          # -> dict, JSON-serialisable
save_output(result, "output.json")

print(result["analyzed_complaints"][0]["issue_type"])
print(result["emerging_issues"])
```

---

## 9. Running tests

```bash
pytest -q                       # all tests
pytest -q -v                    # verbose
pytest tests/test_trends.py -q  # one module
```

The suite contains **90+ tests** covering preprocessing, every classification category, sentiment, severity, embedding shape/type and semantic proximity, clustering, cluster naming, growth maths (including division by zero), trend detection, emerging-issue detection, the full pipeline, empty input, malformed input and missing required fields.

Embedding-dependent tests are **skipped** (never silently passed) when no embedding backend can be built. To force them to run offline:

```bash
EMBEDDING_BACKEND=hashing pytest -q
```

---

## 10. Example input

```json
[
  {
    "complaint_id": "C001",
    "text": "My headphones arrived damaged",
    "customer_id": "U101",
    "order_id": "O501",
    "created_at": "2026-09-01"
  }
]
```

Only `text` is required. `complaint_id`, `customer_id`, `order_id` and `created_at` are strongly recommended (`created_at` powers trend detection).

---

## 11. Example output

```json
{
  "analyzed_complaints": [
    {
      "complaint_id": "DEMO-1",
      "clean_text": "my headphones arrived broken and i want my money back",
      "issue_type": "Damaged Product",
      "sentiment": "Negative",
      "severity": "High",
      "cluster": "Damaged Products",
      "cluster_id": 0,
      "embedding": [0.0412, -0.0187, 0.0931],
      "customer_id": "U900",
      "order_id": "O900",
      "created_at": "2026-09-20"
    }
  ],
  "trends": [
    {
      "cluster_name": "Damaged Products",
      "count": 25,
      "previous_count": 15,
      "current_count": 25,
      "growth_percent": 66.7
    }
  ],
  "emerging_issues": [
    {
      "cluster_name": "Refund Problems",
      "count": 7,
      "previous_count": 5,
      "current_count": 7,
      "growth_percent": 40.0,
      "growth_threshold": 25.0,
      "reason": "Volume grew 40.0% (5 → 7) in the current period, exceeding the 25.0% threshold with at least 3 complaints."
    }
  ],
  "clusters": [
    { "cluster_id": 0, "cluster_name": "Damaged Products", "size": 14 }
  ],
  "metadata": {
    "total_complaints": 77,
    "processed_complaints": 77,
    "periods_analyzed": 2,
    "embedding_backend": "sentence-transformers",
    "embedding_dim": 384,
    "clustering_backend": "hdbscan",
    "sentiment_backend": "vader",
    "emerging_growth_threshold": 25.0,
    "emerging_min_count": 3,
    "trend_label_key": "auto"
  },
  "diagnostics": { "warnings": [], "errors": [] }
}
```

(`embedding` is truncated above; it holds 384 floats.)

---

## 12. Integration with Student 1 (Backend / API)

Student 1 owns the API, auth and database. Student 2 is a stateless library.

```python
from main import analyze_complaints

def handle_analyze_request(raw_complaints: list[dict]) -> dict:
    """POST /analyze — forward raw complaints, return structured intelligence."""
    return analyze_complaints(raw_complaints)
```

Recommended shape: expose Student 2 either in-process or as a tiny stateless worker (`POST /analyze`, body = input schema, response = output schema). Student 1 must forward the payload in the input schema unchanged so `complaint_id`, `customer_id`, `order_id` and `created_at` survive into the output for joins.

---

## 13. Integration with Student 3 (AI Agent)

Student 3 consumes the output JSON **only** — it must never import `classification.py`, `severity.py` or `trends.py`, and it must not re-implement any of this logic.

Fields Student 3 can rely on:

| Field | Use |
|---|---|
| `analyzed_complaints[].complaint_id` | Reference the complaint in a reply / ticket |
| `analyzed_complaints[].clean_text` | Normalised text to quote or summarise |
| `analyzed_complaints[].issue_type` | Route to the right playbook |
| `analyzed_complaints[].sentiment` | Choose tone / escalation language |
| `analyzed_complaints[].severity` | Decide human hand-off vs auto-reply |
| `analyzed_complaints[].cluster` | Group similar complaints into one response |
| `emerging_issues[]` | Proactive escalation ("refund complaints are up 40%") |
| `metadata.*` / `diagnostics.*` | Trust calibration — know if a backend was degraded |

```python
result = analyze_complaints(complaints)
urgent = [c for c in result["analyzed_complaints"] if c["severity"] == "High"]
```

---

## 14. Integration with Student 4 (Dashboard)

Student 4 renders the output; it does not run intelligence logic in the browser.

| Widget | Source field |
|---|---|
| Complaint table, severity badges, sentiment chips | `analyzed_complaints[]` |
| Bar chart — volume per cluster | `trends[].cluster_name`, `trends[].count` |
| Line chart — growth over periods | `trends[].growth_percent` |
| Emerging-issue alert cards | `emerging_issues[]` (show `reason`) |
| Donut chart + legend | `clusters[]` |
| 2D scatter (PCA / UMAP / t-SNE) | `analyzed_complaints[].embedding` (optional) |
| KPI tiles | `metadata.total_complaints`, `metadata.periods_analyzed` |

Pass `include_embeddings=False` when the dashboard does not need the scatter plot — it shrinks the payload substantially.

---

## 15. Design decisions

1. **Rules before ML for classification.** The first classifier is a transparent weighted-keyword engine with an explicit tie-break priority (`CATEGORY_PRIORITY`). It is deterministic, explainable in a demo, needs no training data, and `score_categories()` exposes *why* a decision was made. `classify(text) -> category` is isolated so an ML/LLM classifier can replace it behind the same signature.
2. **Severity is project policy.** `determine_severity()` encodes *this product's* escalation rules, not a universal theory of complaint severity. High = Negative sentiment **and** (Refund | Payment Problem | Damaged Product); Medium = Late Delivery; else Low. Rules live in three constants at the top of `severity.py`.
3. **HDBSCAN + graceful fallback.** Cluster count is unknown and complaint data contains outliers, so HDBSCAN is primary. The chain is `hdbscan` package → `sklearn.cluster.HDBSCAN` → `AgglomerativeClustering(metric="cosine")`. Each step down is logged, and the strategy actually used is reported in `metadata.clustering_backend`.
4. **Cluster names are deterministic.** `name_clusters()` majority-votes the dominant `issue_type` and maps it through a fixed table. Ties break by classifier priority. Duplicate names get `(2)`, `(3)` suffixes. Nothing is random.
5. **The model is loaded once.** `get_embedder()` caches a thread-safe singleton; `analyze_complaints()` calls `create_embeddings()` once for the whole batch. 100 complaints = 1 model call.
6. **Zero-division and bad dates are policy, not accidents.** `compute_growth()` documents both cases: `0 → 0` = `0.0`, `0 → n` = `100.0` (a brand-new problem is surfaced, never hidden as infinite). Unparseable dates are excluded from trend maths and reported.
7. **Errors are visible.** Recoverable problems go to `diagnostics.warnings`; stage failures go to `diagnostics.errors` and degrade the output instead of killing the run. Structurally invalid payloads raise `InvalidComplaintError`. Nothing is silently swallowed.
8. **Output is guaranteed serialisable.** `json.dumps(result, allow_nan=False)` is checked inside the CLI; `save_output()` converts stray numpy scalars via a `default=` hook.

---

## 16. Future improvements

- Swap the rule classifier for a fine-tuned transformer or an LLM zero/few-shot classifier behind `classify()`.
- Add a trained severity model once real escalation labels exist.
- Add aspect-based sentiment (per issue, not per complaint).
- Add a rolling-window trend mode (7/14/30 days) alongside calendar months.
- Persist embeddings to a vector store and add semantic search / duplicate detection.
- Add anomaly detection on cluster volume (z-score / Prophet) instead of a flat growth threshold.
- Multilingual support via a multilingual sentence-transformer.
- Expose the engine as a FastAPI service (owned by Student 1) with a job queue for large batches.

---

## 17. Limitations

- **Synthetic data.** `data/complaints.json` is generated, not real. It contains no real personal data and no framework credentials.
- **Sentiment is lexicon-based.** VADER handles sarcasm, domain jargon and mixed sentiment imperfectly. A `fallback-lexicon` backend (much weaker) is used automatically if `vaderSentiment` cannot be installed — this is logged and reported in `metadata.sentiment_backend`.
- **The rule classifier is brittle by design.** Unusual phrasing falls through to `Other`. That is the accepted trade-off for transparency in v1.
- **Severity rules are project-specific**, not an industry standard, and they ignore repeat-contact history and customer value.
- **Clustering quality depends on the dataset.** Very small batches (fewer than ~10 complaints) or highly uniform text can produce a single cluster or all-noise; the engine falls back to one cluster rather than failing.
- **Trend detection needs two calendar months.** With one month, `trends` is computed but `previous_count` is 0 for everything, so growth is either 0% or 100%.
- **Embedded vectors are first-generation.** No dimensionality reduction is applied in the output, so payloads are large (384 floats/complaint) unless `include_embeddings=False`.

---

## License

Built for the RESOLVE IQ hackathon. Add your team's license here before publishing.
