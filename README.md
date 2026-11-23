# Rumour Flow Tracker (formerly News Pulse / MediaLens)

An end-to-end, automated news intelligence and narrative detection platform. The system continuously polls multi-source RSS feeds, extracts full text articles, deduplicates and hashes stories, clusters related reports using explainable TF-IDF cosine similarity, tracks event evolution over time, and reconstructs multi-event narrative storylines with evidence-backed relationships.

---

## 1. High-Level Architecture & Workflow

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                LIVE NEWS SOURCES & FEEDS                               │
│  Global: BBC, NPR, The Guardian                                                        │
│  Indian Media: The Hindu, Indian Express, NDTV, Times of India, Hindustan Times, Mint, │
│                Business Standard, ThePrint, Scroll.in, LiveLaw, Alt News               │
│  Official / Regulators: PIB, Supreme Court of India, RBI, SEBI, WHO, UK Gov, US SEC    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Polled automatically (every 60s) or manual
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              SCRAPER & INGESTION PIPELINE                              │
│  • XML/Atom Feed Parsing: fast-xml-parser (Backend) / feedparser (Python)              │
│  • Content Extraction & Cleanup: trafilatura / sanitize-html                           │
│  • Deduplication: SHA-256 content hashing & normalized URL matching                    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Persisted to MongoDB
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              MONGODB DATA LAYER (Port 27017)                           │
│  • articles               • clusters               • ingestjobs                        │
│  • narratives             • narrative_events       • narrative_relationships           │
│  • narrative_runs         • narrative_locks                                            │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
┌───────────────────────────────────────────┐ ┌──────────────────────────────────────────┐
│      EXPRESS / TYPESCRIPT REST API        │ │      NARRATIVE INTELLIGENCE ENGINE       │
│  • Port 5050 (Node.js + tsx watch)        │ │  • Temporal & entity relationship logic   │
│  • Ingestion controllers & job management │ │  • Multi-event candidate pair generation │
│  • Dynamic playground threshold scoring   │ │  • Complete-link & single-link grouping  │
│  • Real-time cluster & timeline endpoints │ │  • Human reviewer audit trail & overrides│
└─────────────────────┬─────────────────────┘ └────────────────────┬─────────────────────┘
                      │                                            │
                      └──────────────────────┬─────────────────────┘
                                             │ JSON REST APIs
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             REACT DASHBOARD (Vite, Port 5173)                          │
│  1. Cluster Board: Multi-publisher coverage, story cards, TF-IDF terms, source badges  │
│  2. Signal Map: Interactive bubble map sizing topics by activity and source diversity  │
│  3. Timeline View: Chronological Gantt-style event reporting duration & trajectory     │
│  4. Narrative Intelligence: Storyline chains, candidate reviews & evidence inspection  │
│  5. Publisher Monitoring & Feed Health: Status, error counts, fetch latency, schedules │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Comprehensive Feature Breakdown

### A. Automated RSS Ingestion & Extraction
* **Purpose**: Gathers raw news reporting across 25+ major international and national publishers without manual intervention.
* **Why it matters**: Breaks publisher silos and aggregates disparate coverage of the same event into a single pipeline in real-time.
* **How it works**:
  * An automated background scheduler triggers every 60 seconds (with configurable intervals).
  * Parses feeds, validates publication timestamps, and extracts full text, clean titles, authors, and summaries.
  * Normalizes URLs and computes a SHA-256 fingerprint of the cleaned text to detect exact duplicates and re-published articles.
* **Key Technologies**: `fast-xml-parser`, `trafilatura` (Python), `feedparser`, `crypto` (Node.js SHA-256), `mongoose`.

### B. Explainable TF-IDF Cosine Similarity Clustering
* **Purpose**: Automatically groups articles reporting on the exact same real-world incident into unified "Event Clusters".
* **Why it matters**: Prevents reading the same story 10 times from different news outlets. Provides an aggregated perspective showing how different media frame the same story.
* **How it works**:
  * Tokenizes headline and body text, removes language-specific stop words, and builds Term Frequency-Inverse Document Frequency (TF-IDF) vectors.
  * Calculates pairwise Cosine Similarity between new articles and active clusters.
  * If the similarity surpasses the chosen threshold (default `0.26`), the article is merged into that cluster; otherwise, a new cluster is created.
  * An interactive **Playground** mode allows dynamically tweaking the threshold in real-time to observe under-clustering vs. over-clustering without polluting the database.
* **Key Technologies**: Python `scikit-learn` / Custom TypeScript TF-IDF vectorizer, Node.js worker threads.

### C. Cluster Board (Executive Overview)
* **Purpose**: Primary dashboard view presenting clustered stories with rich metadata.
* **Why it matters**: Gives analysts an immediate visual hierarchy of breaking news versus single-source reports.
* **Features**:
  * **Lead Breaking Story Banner**: Highlights stories with the highest source diversity and article volume.
  * **Coverage Badges**: Visual indicators for single-source vs. multi-publisher confirmed stories.
  * **Top Term Chips**: Explainable keywords showing why articles were clustered together.
  * **Search & Filters**: Instant full-text filtering by keyword, date range (`6h`, `24h`, `48h`, `All time`), and view modes (`Grouped stories`, `All topics`, `Single articles`).
* **Key Technologies**: React 19, Lucide React icons, Tailwind CSS / custom CSS Grid layout.

### D. Signal Map (Interactive Density Visualization)
* **Purpose**: Visual 2D radar/bubble layout representing story importance, clustering density, and multi-source corroboration.
* **Why it matters**: Instantly reveals which news topics are dominating the media landscape without reading hundreds of headlines.
* **How it works**:
  * Visual node size corresponds to the number of articles in the cluster.
  * Border styling and colors indicate multi-source verification (mixed publishers vs. single publisher).
  * Click-to-inspect highlights the cluster details in the side drawer.
* **Key Technologies**: CSS Flex/Grid vector positioning, dynamic SVG coordinate mapping, React hooks (`useMemo`).

### E. Interactive Timeline
* **Purpose**: Chronological Gantt chart mapping when stories first broke, how long they were actively reported, and their latest updates.
* **Why it matters**: Crucial for tracking how rumours start, spread, and evolve over minutes, hours, or days.
* **How it works**:
  * Calculates `firstSeenAt` (earliest article timestamp) and `lastSeenAt` (most recent update) for each cluster.
  * Normalizes cluster times against a dynamic time axis supporting both short-term hour-by-hour spreads and multi-day spans.
  * Displays duration bars and event markers linked to article popups.
* **Key Technologies**: JavaScript `Intl.DateTimeFormat`, SVG timeline rendering, dynamic timestamp normalization.

### F. Narrative Intelligence Engine
* **Purpose**: Discovers how separate events develop over time and relate to one another as broader ongoing storylines (e.g., *Allegation → Minister Response → Official Inquiry → Regulatory Action*).
* **Why it matters**: Article clustering only groups reports on the *same* incident. Narrative Intelligence connects *distinct* incidents that form a larger saga, distinguishing continuing storylines from generic broader context.
* **How it works**:
  * **Entity & Marker Extraction**: Discovers named entities (`PERSON`, `COMPANY`, `GOVERNMENT`, `ORGANIZATION`, `EVENT_PROGRAM`) and temporal continuity markers (`"after"`, `"resigns"`, `"verdict"`, `"agreement"`, `"investigation"`).
  * **Pairwise Classification**: Analyzes candidate event pairs into one of five verified relationship types:
    * `SAME_EVENT`: Both events describe the exact same occurrence.
    * `CONTINUING_STORYLINE`: Subsequent event is an evidence-backed progression of an earlier event.
    * `BROADER_CONTEXT_ONLY`: Events share high-level public topics (e.g., elections, court cases) but lack direct causal linkage.
    * `UNRELATED`: No meaningful link.
    * `INSUFFICIENT_EVIDENCE`: Conservative abstention when text is too short or ambiguous.
  * **Graph Grouping**: Forms child narrative groups using complete-link constraints to prevent weak transitive bridges, while allowing strong direct storyline links to connect.
  * **Human-in-the-Loop Review**: Allows intelligence analysts to mark relationships as `CONFIRMED`, `REJECTED`, or `NEEDS_REVIEW` with an immutable audit log.
* **Key Technologies**: Rule-based NLP classifier, regex-based token matching, Mongoose relational schemas, distributed execution locks.

### G. Publisher Monitoring & Health Panel
* **Purpose**: Real-time diagnostic console tracking all configured news outlets, feed URLs, scraping health, and scheduler states.
* **Why it matters**: Ensures feed failures (e.g., HTTP 403, 404, XML schema changes, rate limits) are caught immediately.
* **Features**:
  * Displays active feeds, last successful fetch timestamp, article discovery count, and error counters.
  * Allows on-demand manual triggers with real-time job progress polling.
* **Key Technologies**: Express Ingest Controller, polling workers, MongoDB error counters.

---

## 3. Database Architecture & Design

### Why MongoDB?
1. **Polymorphic Content Structure**: News articles from 25+ different publishers contain varying fields (some provide full bodies, others provide summaries, enclosure images, varying author structures, or custom RSS tags). A document-oriented schema accommodates this flexibility without requiring endless table migrations.
2. **Embedded Sub-documents & Fast Arrays**: Event clusters store an array of article IDs and term frequencies. Narratives store event keys, entity keys, and audit history entries. Storing these as native BSON arrays allows fast atomic lookups without expensive multi-table SQL joins.
3. **High Write Throughput**: Ingestion cycles fetch and store hundreds of articles in batch operations (`bulkWrite`, `insertMany`). MongoDB excels at concurrent write performance.
4. **Flexible Indexing**: Supports compound indexes on `[source, url]`, `fingerprint` (for instant duplicate detection), and `publishedAt` (for rapid time-range filtering).

### What is Stored & Collection Schemas

#### 1. `articles`
Represents individual news reports scraped from feeds.
* `title`: Clean headline string.
* `body`: Extracted full-text article body.
* `summary`: RSS lead paragraph or excerpt.
* `source`: Publisher name (e.g. "The Hindu", "BBC News", "RBI").
* `url`: Canonical article link.
* `fingerprint`: SHA-256 hash of clean text for duplicate rejection.
* `publishedAt`: Publication date extracted from RSS/Atom headers.
* `clusterId`: Reference to the cluster this article belongs to.
* `qualityFlags`: Diagnostic tags (e.g., `["body_missing_or_short"]`).

#### 2. `clusters`
Represents grouped events formed by similar articles.
* `label`: Representative cluster title or top terms.
* `articleIds`: Array of MongoDB ObjectIDs referencing member `articles`.
* `articleCount`: Total articles in the cluster.
* `sources`: Array of distinct publisher names present in this cluster.
* `topTerms`: Key TF-IDF terms characterizing the story.
* `firstSeenAt` / `lastSeenAt`: Earliest and latest reporting timestamps.

#### 3. `narratives`
High-level storyline entities connecting multiple events.
* `narrativeKey`: Stable, content-derived unique identifier.
* `title`: Descriptive storyline label.
* `level`: `"CHILD"` (focused storyline) or `"PARENT"` (broader thematic context).
* `eventKeys`: Array of constituent `NarrativeEvent` fingerprints.
* `entityKeys`: Named entities identified across member events.
* `status`: `"CANDIDATE"`, `"ACTIVE"`, or `"REJECTED"`.
* `history`: Audit log of all state changes, merges, or splits.

#### 4. `narrative_events`
Normalized event nodes derived from saved clusters.
* `eventKey`: Stable SHA-256 fingerprint based on member article URLs and label.
* `currentClusterId`: Associated cluster ID.
* `label`: Event description.
* `facets`: Article title, text, entities, and publication dates.

#### 5. `narrative_relationships`
Pairwise evaluations between event nodes.
* `relationshipKey`: Unique identifier for the event pair (`eventA:eventB`).
* `leftEventKey` / `rightEventKey`: References to the two events.
* `classification`: `SAME_EVENT`, `CONTINUING_STORYLINE`, `BROADER_CONTEXT_ONLY`, or `UNRELATED`.
* `state`: `CANDIDATE`, `INSUFFICIENT_EVIDENCE`, or `REJECTED`.
* `supportingEntities` & `supportingTerms`: Evidence items proving the link.
* `reviewStatus`: `PENDING`, `CONFIRMED`, or `REJECTED`.

#### 6. `narrative_runs` & `narrative_locks`
* `narrative_runs`: Execution logs recording run duration, processed article counts, candidate pairs evaluated, and engine versions.
* `narrative_locks`: Distributed locking document ensuring that concurrent background pollers and manual analysis triggers never execute simultaneously.

---

## 4. Technology Stack Summary

| Layer | Technologies Used | Purpose |
|---|---|---|
| **Frontend** | React 19, Vite, Lucide Icons, Vanilla CSS Grid | Responsive UI, interactive Signal Map, Gantt Timeline, Narrative Graph explorer |
| **Backend** | Node.js, Express 5, TypeScript, `tsx` | RESTful API, ingestion scheduler, TF-IDF calculation, Narrative Intelligence Engine |
| **Data Ingestion** | `fast-xml-parser`, `trafilatura`, `feedparser`, `crypto` | RSS feed harvesting, HTML cleanup, full-text extraction, SHA-256 deduplication |
| **Database** | MongoDB 8, Mongoose ODM | Flexible schema storage, geospatial/temporal indexing, atomic updates, audit histories |
| **Testing** | Node test runner (`tsx --test`), Vite Build | Comprehensive backend classification test suite and frontend production verification |

---

## 5. Local Setup & Running Instructions

### 1. Prerequisites
* **Node.js** (v18 or higher)
* **MongoDB** (v6+ running locally on port `27017`)
* **Python** (v3.10+ for standalone scraper scripts)

### 2. Start Services

**Step A — Start MongoDB:**
```powershell
mongod --dbpath "c:\Users\Shailaja\Downloads\newspulse\data\db" --bind_ip 127.0.0.1 --port 27017
```

**Step B — Start Backend API:**
```powershell
cd c:\Users\Shailaja\Downloads\newspulse\backend
npm run dev
# Starts on http://localhost:5050 with auto-reloading
```

**Step C — Start Frontend Dashboard:**
```powershell
cd c:\Users\Shailaja\Downloads\newspulse\frontend
npm run dev -- --host 0.0.0.0
# Access via browser at http://localhost:5173
```

---

## 6. Verification & Test Commands

* **Run Backend Unit Tests (15 tests covering engine rules, transitive bridges, shadow mode):**
  ```powershell
  cd c:\Users\Shailaja\Downloads\newspulse\backend
  npm test
  ```
* **Verify Frontend Production Build:**
  ```powershell
  cd c:\Users\Shailaja\Downloads\newspulse\frontend
  npm run build
  ```
* **Query Live Narrative Status via API:**
  ```powershell
  curl http://127.0.0.1:5050/narratives/status
  ```
