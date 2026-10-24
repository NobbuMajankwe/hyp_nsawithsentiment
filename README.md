# EventSense AI — Hybrid Anomaly Detection and Sentiment Analysis

EventSense AI is a research platform that combines the **Negative Selection Algorithm (NSA)** with **Word2Vec** and **DistilBERT sentiment analysis**.

The system first checks whether a comment looks normal or unusual compared with known normal text.

Comments are classified as:

- **SELF** — similar to normal text
- **NON_SELF** — unusual or anomalous text
- **OOV** — the comment cannot be represented properly using the Word2Vec vocabulary

Comments classified as **SELF** can then be passed to DistilBERT for sentiment analysis.

Sentiment is classified as:

- Positive
- Neutral
- Negative

Anomaly detection and sentiment analysis are kept separate because a negative comment is not automatically an anomaly.

---

## Project Structure

```text
hyp-sentiment/
├── backend/
│   ├── main.py
│   ├── nsa.py
│   ├── experiment_service.py
│   ├── database.py
│   ├── sentiment.py
│   ├── dataset_handler.py
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── NsaPage.tsx
│       │   ├── ExperimentPage.tsx
│       │   └── DatasetsPage.tsx
│       ├── components/
│       └── services/
│           └── api.ts
│
└── README.md
```

---

# Running the Backend

Open the backend folder:

```bash
cd backend
```

Create a virtual environment:

```bash
python3 -m venv .venv
```

Activate it on macOS or Linux:

```bash
source .venv/bin/activate
```

On Windows:

```bash
.venv\Scripts\activate
```

Install the required packages:

```bash
pip install -r requirements.txt
```

Download the required NLTK resources:

```bash
python -m nltk.downloader stopwords wordnet omw-1.4
```

Start the FastAPI backend:

```bash
python -m uvicorn main:app --reload --port 8000
```

The backend will run at:

```text
http://localhost:8000
```

FastAPI documentation is available at:

```text
http://localhost:8000/docs
```

---

# Running the Frontend

Open the frontend folder:

```bash
cd frontend
```

Install the packages:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the URL shown by Vite in the terminal, normally:

```text
http://localhost:5173
```

The backend should also be running before experiments are started.

---

# Dataset Roles

The platform separates datasets according to their purpose.

## SELF_CORPUS

A SELF corpus is used to represent normal behaviour.

When a labelled dataset is used, only records labelled **SELF** are used to train the Word2Vec representation and define normal behaviour.

Evaluation labels are not used during training.

## EVALUATION

An evaluation dataset contains known:

- SELF records
- NON_SELF records

These labels are used to calculate anomaly-detection performance.

## ANALYSIS

An analysis dataset contains new or unlabelled text.

It can be analysed after the model has been configured.

---

# Experimental Dataset

The current experiments use the **YouTube Spam Collection**.

The dataset contains **1,956 comments** from five YouTube videos.

The labels are mapped as follows:

```text
Legitimate / Ham → SELF
Spam             → NON_SELF
```

The complete collection contains:

```text
SELF:      951
NON_SELF: 1005
Total:    1956
```

The YouTube dataset is used because suitable labelled event-feedback anomaly data was not available.

Event feedback remains the intended application area for future validation.

---

# Text Preprocessing

Before a comment is analysed, the text is prepared using the same preprocessing process.

The main steps are:

```text
Raw text
   ↓
Lowercase
   ↓
Remove punctuation
   ↓
Tokenise
   ↓
Lemmatise
   ↓
Remove NLTK English stopwords
   ↓
Word2Vec
   ↓
Average recognised word vectors
   ↓
L2 normalisation
```

The system uses the standard **NLTK English stopword list**.

Database stopwords are not used by the current NSA preprocessing pipeline.

---

# Word2Vec Representation

Word2Vec is used to convert text into numerical vectors.

The Word2Vec model is trained using only the selected **SELF corpus**.

This helps prevent evaluation data from leaking into model training.

Each recognised word receives a vector.

The vectors for all recognised words in a comment are averaged to create one vector representing the whole comment.

The result is then L2-normalised before NSA detection.

### Baseline Word2Vec settings

| Parameter | Default |
|---|---:|
| Vector size | 100 |
| Window size | 5 |
| Minimum count | 1 |
| Epochs | 50 |
| Random seed | 42 |

These settings can be changed when experiments are run.

---

# OOV — Out of Vocabulary

A comment is classified as **OOV** when none of its usable words exist in the Word2Vec vocabulary learned from the SELF corpus.

For example:

```text
"sub4subbbb xxpromo77 linkzzz"
```

If none of these tokens exist in the SELF vocabulary, Word2Vec cannot create a meaningful comment vector.

The result is therefore:

```text
OOV
```

OOV does not mean the comment is SELF or NON_SELF.

It means the system does not have enough known vocabulary to classify it properly.

OOV records are reported separately.

---

# How the Negative Selection Algorithm Works

The Negative Selection Algorithm is inspired by the human immune system.

The immune system learns what belongs to the body, known as **self**, and reacts to patterns that appear foreign.

The NSA applies a similar idea to text.

In this project:

```text
SELF
= normal or expected comments

NON_SELF
= unusual or anomalous comments
```

---

## NSA Process

### 1. Learn SELF

The selected SELF corpus is preprocessed and converted into Word2Vec vectors.

These vectors represent normal behaviour.

### 2. Generate detectors

Random detector vectors are created in the same vector space.

A detector is rejected if it is too close to known SELF vectors.

This prevents detectors from representing normal behaviour.

### 3. Analyse a new comment

A new comment is:

1. preprocessed
2. converted into a Word2Vec vector
3. compared with the generated detectors

### 4. Classification

The result can be:

```text
SELF
NON_SELF
OOV
```

If the comment vector matches a detector within the configured detector radius:

```text
→ NON_SELF
```

If it does not match a detector:

```text
→ SELF
```

If a useful vector cannot be created:

```text
→ OOV
```

---

# NSA Parameters

The behaviour of the algorithm can be controlled using several settings.

| Parameter | Purpose |
|---|---|
| `detector_count` | Number of detectors generated |
| `detector_radius` | Distance within which a detector can identify NON_SELF |
| `self_match_threshold` | Minimum distance detectors must maintain from SELF |
| `max_attempts` | Maximum detector-generation attempts |
| `random_seed` | Makes experiments more reproducible |

The original baseline configuration is:

```text
Detector count:       200
Detector radius:      0.20
SELF match threshold: 0.30
Maximum attempts:     10000
Random seed:          42
```

These settings are changed during controlled experiments to study how they affect performance.

---

# Experiment Evaluation

For evaluation, **NON_SELF is treated as the positive anomaly class**.

The confusion matrix is calculated as:

```text
True Positive
Actual NON_SELF → Predicted NON_SELF

False Positive
Actual SELF → Predicted NON_SELF

True Negative
Actual SELF → Predicted SELF

False Negative
Actual NON_SELF → Predicted SELF
```

The system reports:

- Accuracy
- Precision
- Recall
- F1-score
- Specificity
- False-positive rate
- False-negative rate

OOV records are not automatically counted as correctly detected anomalies.

They are reported separately.

This allows the system to also report **coverage**:

```text
Coverage =
classified records / total evaluation records
```

---

# Current Experimental Results

Early configurations produced no NON_SELF predictions.

After tuning the Word2Vec and NSA configuration, the model began detecting anomalous comments.

The strongest current run is **Experiment 6**:

| Metric | Result |
|---|---:|
| Accuracy | 0.4358 |
| Precision | 0.4889 |
| Recall | 0.1905 |
| F1-score | 0.2741 |

This means the model is now identifying some NON_SELF comments.

However, the recall is still low, which means many actual NON_SELF comments are still being classified as SELF.

Further tuning is therefore required.

---

# Sentiment Analysis

Sentiment analysis is handled separately using **DistilBERT**.

The sentiment model produces three classes:

```text
Positive
Neutral
Negative
```

The current workflow is:

```text
Comment
   ↓
Word2Vec
   ↓
NSA
   ↓
SELF ─────────→ DistilBERT
                 ↓
           Positive
           Neutral
           Negative

NON_SELF ─────→ Flagged as anomalous

OOV ──────────→ Reported separately
```

Only comments predicted as SELF are sent to the sentiment stage.

---

# Why Anomaly Detection and Sentiment Are Separate

A negative comment should not automatically be treated as suspicious.

For example:

```text
"The registration queue was too long."
```

This is negative feedback, but it can still be completely valid.

NSA answers:

```text
Does this comment look unusual compared with normal data?
```

DistilBERT answers:

```text
What sentiment does the comment express?
```

Keeping these two tasks separate prevents normal negative feedback from being incorrectly treated as an anomaly.

---

# Sentiment Evaluation Limitation

The YouTube Spam Collection contains ground-truth spam labels but does not contain ground-truth sentiment labels.

This means the dataset can be used to evaluate NSA anomaly detection.

It cannot be used to calculate reliable sentiment:

- accuracy
- precision
- recall
- F1-score

for DistilBERT.

The sentiment model can still be used to describe sentiment patterns, but sentiment accuracy cannot be claimed using this dataset.

---

# Current System Flow

```text
React Frontend
      ↓
FastAPI
      ↓
Text preprocessing
NLTK + lemmatisation
      ↓
Word2Vec
      ↓
NSA
      ↓
 ┌──────────┬────────────┬──────────┐
 │          │            │          │
SELF     NON_SELF       OOV
 │          │            │
 ↓          ↓            ↓
DistilBERT  Flagged      Reported
 │
 ↓
Positive / Neutral / Negative
      ↓
PostgreSQL
      ↓
Dashboard and experiment results
```

---

# Current Project Status

The project currently supports:

- dataset upload and management
- SELF, EVALUATION and ANALYSIS dataset roles
- NLTK text preprocessing
- Word2Vec text representation
- NSA detector generation
- SELF/NON_SELF/OOV classification
- labelled experiment evaluation
- configurable NSA parameters
- configurable Word2Vec parameters
- experiment history
- anomaly metrics
- OOV reporting
- DistilBERT sentiment classification
- PostgreSQL result storage
- React dashboard

---

# Next Steps

The next stage is to improve the experimental performance by testing different NSA configurations.

The main areas for further testing are:

- detector count
- detector radius
- SELF match threshold
- Word2Vec vector size
- OOV behaviour

The aim is to improve **recall and F1-score** without creating too many false positives.

The system should also eventually be tested using labelled event-feedback data so that its performance can be evaluated in the intended event-management context.