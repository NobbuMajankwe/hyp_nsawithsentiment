# EventSense AI — Hybrid Sentiment Analysis & NSA Feedback Filter

> Suspicious feedback is blocked by the NSA engine **before** it ever reaches sentiment analysis.

---

## Project structure

```
hyp-sentiment/
├── backend/
│   ├── main.py          # FastAPI app — POST /api/nsa/analyse
│   ├── nsa.py           # Negative Selection Algorithm (pure Python, no sklearn)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── types.ts
│       ├── components/
│       │   ├── WorkflowRail.tsx
│       │   ├── InputPanel.tsx
│       │   ├── FeedbackCanvas.tsx
│       │   └── FindingsPanel.tsx
│       ├── data/mockFeedback.ts
│       └── services/api.ts
└── README.md
```

---

## Backend — run instructions

```bash
cd backend

# (recommended) create a virtual environment
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows

pip install -r requirements.txt

uvicorn main:app --reload --port 8000
```

API will be available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`.

---

## Frontend — run instructions

```bash
cd frontend
npm install
npm run dev
```

UI will be available at `http://localhost:3001`.

> Make sure the backend is running first so the NSA analysis button works.

---

## How the Negative Selection Algorithm works

The NSA is a bio-inspired anomaly detection method modelled on the vertebrate
immune system.

### Biological analogy

T-cells are trained during development to ignore "self" (normal body cells).
Any cell not recognised as self triggers an immune response.
The NSA mirrors this: "self" = normal feedback patterns, and any input that
matches a non-self detector is flagged as anomalous.

### Pipeline (implemented in `nsa.py`)

| Step | What happens |
|------|-------------|
| 1. Preprocess | Lowercase, strip punctuation, collapse whitespace |
| 2. Tokenise | Split on whitespace, remove stopwords, filter single-char tokens |
| 3. Vectorise | Build a bag-of-words vocabulary from the normal corpus; each text -> L2-normalised TF vector (no sklearn — pure Python `math`) |
| 4. Self space | 10 curated "normal" feedback samples define the self region |
| 5. Generate detectors | Random candidates in [0,1]^d are accepted only if `min_distance_to_self > threshold` (censoring step) |
| 6. Detect | Each input vector is tested against all detectors; a match (`distance ≤ radius`) -> Suspicious |
| 7. Score | `anomaly_score = round((1 − closest_distance) × 100)` |

### Key parameters

| Parameter | Default | Effect |
|-----------|---------|--------|
| `detector_count` | 60 | More detectors -> higher sensitivity |
| `detector_radius` | 0.55 | Larger radius -> more matches (more Suspicious) |
| `self_match_threshold` | 0.40 | Higher threshold -> detectors pushed further from self |

---

## API

### `POST /api/nsa/analyse`

**Request body**
```json
{ "feedback": ["string", "string", ...] }
```

**Response**
```json
{
  "totalRecords": 8,
  "validRecords": 5,
  "suspiciousRecords": 3,
  "results": [
    {
      "id": 1,
      "originalText": "The event was well organised",
      "cleanedText": "the event was well organised",
      "tokens": ["event", "well", "organised"],
      "nsaStatus": "Valid",
      "anomalyScore": 0,
      "anomalyReason": "No detector match"
    }
  ]
}
```

---

## Next phase

Part 2 will add a DistilBERT sentiment classification endpoint that only
receives records marked **Valid** by the NSA filter.
