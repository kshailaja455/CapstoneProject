# RUMOUR FLOW TRACKER
Rumor FLow Tracker is an intelligent, full-stack news analytics and narrative intelligence web application. It continuously monitors live RSS feeds from major global news publishers (BBC, NPR, The Guardian), extracts clean article bodies, deduplicates and hashes content, clusters related stories with explainable TF-IDF cosine similarity, and discovers emergent story narratives in real-time.

---

## Key Features & Visual Modes

The dashboard provides four distinct visual exploration modes accessible via the top navigation controls:

1. **Cluster Board (Default View)**: Executive card layout highlighting lead multi-source breaking topics alongside equal-height cards displaying coverage breadth, match strength, TF-IDF terms, and summaries.
2. **Signal Map**: Dynamic bubble-style visual map scaling proportionally to story activity, source diversity, and topic clustering density.
3. **Timeline**: Gantt-style chronological axis plotting active reporting duration bars and point markers across all covered events.
4. **Narrative Intelligence Console**: Shadow-mode narrative tracking system that detects multi-event storylines, distinguishes continuing developments from broader thematic context, tracks parent/child narrative hierarchies, and offers an interactive human review workflow.

---

## System Architecture

```text
RSS Feeds (BBC, NPR, Guardian)
        │
        ▼
  Python Scraper & Extractor (trafilatura, feedparser)
        │
        ▼
  Deduplication & Content Hashing (SHA-256)
        │
        ▼
  MongoDB (articles, clusters, ingestjobs)
        │
        ▼
  Express REST API (Node.js / TypeScript, port 5050)
        ├─► Ingestion & Cluster Endpoints
        └─► Narrative Intelligence Engine (shadow mode)
              │
              ▼
  Vite React Dashboard (port 5173)
        ├─► Cluster Board, Signal Map & Timeline
        └─► Narrative Intelligence Console & Reviewer UI
```

---

## Narrative Intelligence (Shadow Mode)

Narrative Intelligence operates as an incremental analysis layer running against stored article and cluster data. All narrative state is isolated in separate MongoDB collections (`narratives`, `narrative_events`, `narrative_relationships`, `narrative_runs`, `narrative_locks`), guaranteeing that raw event clusters are never modified or corrupted.

### Narrative Hierarchy & Invariants
- **Child Storylines**: Grouped using strict **complete-link clustering** requiring accepted `SAME_EVENT` or `CONTINUING_STORYLINE` classifications across all pairs, preventing transitive graph bridges from merging unrelated stories.
- **Parent Context Narratives**: Grouped under broader issue keys (e.g., `ISSUE:asylum`, `ISSUE:summit`) when multiple distinct child storylines share common context without conflating them into a single continuous event.
- **Review Workflow**: Every discovered relationship carries review statuses (`NEEDS_REVIEW`, `CONFIRMED`, `REJECTED`). Reviewer actions taken in the dashboard are durable and persist across scraper rebuilds and backend restarts.

### Configuration (`backend/.env`)

```dotenv
NARRATIVE_ANALYSIS_ENABLED=true
NARRATIVE_SHADOW_MODE=true
NARRATIVE_POLL_INTERVAL_MINUTES=15
NARRATIVE_MAX_EVENT_CLUSTERS=500
NARRATIVE_INACTIVE_DAYS=45
NARRATIVE_LEASE_MINUTES=30
```

- Disabling narrative intelligence (`NARRATIVE_ANALYSIS_ENABLED=false`) stops scheduled and post-ingest narrative processing while leaving RSS ingestion, event clustering, and the rest of the dashboard completely unaffected.
- Read comprehensive architectural and audit reports in [`docs/narrative_intelligence/`](docs/narrative_intelligence/):
  - [FINAL_NARRATIVE_ARCHITECTURE.md](docs/narrative_intelligence/FINAL_NARRATIVE_ARCHITECTURE.md)
  - [FINAL_RETRIEVAL_AUDIT.md](docs/narrative_intelligence/FINAL_RETRIEVAL_AUDIT.md)
  - [FINAL_CLASSIFICATION_EVALUATION.md](docs/narrative_intelligence/FINAL_CLASSIFICATION_EVALUATION.md)
  - [FINAL_HIERARCHY_VALIDATION.md](docs/narrative_intelligence/FINAL_HIERARCHY_VALIDATION.md)
  - [FINAL_EVIDENCE_RECONCILIATION.md](docs/narrative_intelligence/FINAL_EVIDENCE_RECONCILIATION.md)
  - [FINAL_READINESS_DECISION.md](docs/narrative_intelligence/FINAL_READINESS_DECISION.md)

---

## News Sources

The system currently ingests live RSS feeds from:
- **BBC News**: `https://feeds.bbci.co.uk/news/rss.xml`
- **NPR**: `https://feeds.npr.org/1001/rss.xml`
- **The Guardian World**: `https://www.theguardian.com/world/rss`

---

## Quickstart & Local Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- MongoDB (running locally on port 27017 or accessible via connection string)

### 1. Start MongoDB
Using local MongoDB binary:
```powershell
New-Item -ItemType Directory -Force .local-mongo | Out-Null
mongod --dbpath .local-mongo --bind_ip 127.0.0.1 --port 27017
```
Or using Docker Compose:
```bash
docker compose up -d mongo
```

### 2. Configure Environment Files
Copy the example environment templates:
```bash
cp scraper/.env.example scraper/.env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Install Dependencies

**Python Scraper:**
```bash
cd scraper
python -m pip install -r requirements.txt
```

**Backend API:**
```bash
cd backend
npm install
```

**Frontend Dashboard:**
```bash
cd frontend
npm install
```

### 4. Running the Application

Open separate terminal windows for each service:

**Terminal 1 — Backend API (port 5050):**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend Dashboard (port 5173):**
```bash
cd frontend
npm run dev
```

**Terminal 3 — Initial Ingestion (Optional):**
You can trigger ingestion directly from the frontend by clicking **Refresh data**, or run the scraper manually from the repository root:
```bash
python scraper/pipeline.py
```

Open your browser to:
```text
http://localhost:5173
```

---

## API Endpoints Reference

### Core Event Clustering & Ingestion
- `GET /clusters` — Summaries of saved event clusters.
- `GET /clusters/:id` — Full details for an event cluster with member articles.
- `GET /clusters/playground?threshold=0.26` — In-memory preview clusters computed for any chosen similarity threshold.
- `GET /timeline` — Clusters formatted with temporal intensity metrics.
- `POST /ingest/trigger` — Trigger a manual RSS scrape and clustering pipeline run.
- `GET /ingest/status/:jobId` — Check status of an ongoing ingestion job.
- `GET /ingest/summary` — Feed collection summary and live feed monitor statistics.

### Narrative Intelligence
- `GET /narratives/status` — Operational status, active rule set, latest run metrics, and total record counts.
- `GET /narratives/runs/latest` — Detailed execution diagnostics for the most recent narrative analysis run.
- `POST /narratives/analyze` — Trigger an on-demand narrative analysis run under a distributed lock.
- `GET /narratives` — List active/candidate narrative storylines (supports filtering by `status`, `level`, `category`, `source`, `reviewStatus`, `from`, `to`).
- `GET /narratives/:id` — Retrieve detailed narrative records including event nodes, article excerpts, quality flags, and timeline.
- `GET /narratives/:id/timeline` — Chronological timeline of events comprising a narrative.
- `GET /narratives/:id/history` — Audit trail of narrative lifecycle actions (splits, merges, membership changes, rule-set updates).
- `GET /narratives/relationships` — List pairwise relationship evaluations across events.
- `PATCH /narratives/relationships/:id/review` — Submit a persistent human review decision (`CONFIRMED`, `REJECTED`, `NEEDS_REVIEW`).

---

## Testing & Verification

**Frontend Build & Linter:**
```bash
cd frontend
npm run build
npm run lint
```

**Backend Typecheck & Unit Tests:**
```bash
cd backend
npx tsc --noEmit
npm test
```

**Python Scraper Smoke Test:**
```bash
cd scraper
python pipeline.py
```
