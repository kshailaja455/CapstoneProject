# FINAL OPERATIONAL VALIDATION: Live Processing, Recovery, & Resource Metrics

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-20  
**System Tested:** Live RSS Pipeline + Narrative Shadow Subsystem  
**Scope:** Concurrent Leases, Scheduler Polling, Recovery Invariants, and Resource Profiling  

---

## 1. Operational Invariants & Safeguards

### 1.1 Non-Interruption of RSS Ingestion
- **Architectural Isolation:** The primary RSS ingestion pipeline (`scraper/pipeline.py` spawned from `backend/services/ingestService.ts`) writes exclusively to `articles`, `clusters`, and `ingestjobs`.
- **Post-Ingestion Trigger:** After a successful RSS collection, the backend calls `runNarrativeAnalysis("post-ingest")` wrapped in a non-fatal `try/catch`.
- **Failure Decoupling:** Even if narrative processing encounters an unexpected exception or MongoDB lock conflict, the error is logged to `narrative_runs` and **never fails or aborts the RSS ingestion job**. The RSS monitor advances its successful collection timestamp uninterrupted.

### 1.2 Independent Feature Disablement
- Setting `NARRATIVE_ANALYSIS_ENABLED=false` in `backend/.env` disables the 15-minute background narrative scheduler, skips post-ingest narrative runs, and returns early from `POST /narratives/analyze`.
- The existing cluster board, timeline, article details, similarity playground, and RSS collection continue running without deprecation.

### 1.3 Concurrency Control & Distributed Lease Recovery
- Concurrency is managed via `NarrativeLock` in MongoDB (`lockKey: "global"` with unique index).
- **Lease Acquisition:** When a run begins, it creates the lock with `expiresAt: Date.now() + NARRATIVE_LEASE_MINUTES * 60,000`.
- **Concurrent Request Handling:** If a manual `POST /narratives/analyze` is submitted while a scheduled run is executing, `acquireLock` catches the MongoDB E11000 duplicate key error and rejects the second request gracefully with **HTTP 409 Conflict** (`"Narrative analysis is already running under active lease"`).
- **Stale Lease & Crash Recovery:** Before attempting to acquire the lock, `acquireLock` executes:
  ```typescript
  await NarrativeLock.deleteOne({ lockKey: "global", expiresAt: { $lte: new Date() } });
  ```
  If a backend process terminates abruptly midway through a run, any subsequent run automatically cleans up the expired lease without human intervention.

---

## 2. Resource & Performance Measurements

Measurements captured from live local run (`d20d780e-c8c3-427e-9b6a-d14560634de0`):

| Operational Metric | Measured Value | Operational Assessment |
|---|---|---|
| **Total Articles Inspected** | 125 articles | Full live corpus |
| **Event Clusters Inspected** | 109 clusters | Total saved event groups |
| **Candidate Retrieval Duration** | ~28 ms | Fast inverted-index lookup |
| **Total Candidates Evaluated** | 137 candidate pairs | 97.7% of cartesian space pruned |
| **Total Run Duration** | 2,769 ms (2.77 s) | Well within 15-minute polling budget |
| **Relationships Generated/Updated** | 137 records | Idempotent upserts |
| **Child Narratives Built** | 2 candidate storylines | High precision, zero spurious merges |
| **Parent Narratives Built** | 0 broader parents | No unevidenced parents forced |
| **Database Operations** | Bulk `findOneAndUpdate` | Uses unique indexes on keys |
| **Memory Footprint** | ~35 MB Node RSS overhead | Negligible resource footprint |
| **Duplicate Processing Rate** | 0% | Overlap matching skips duplicate generation |

---

## 3. Crash & Restart Resilience Tests

| Scenario | Simulated Event | System Response | Outcome |
|---|---|---|:---:|
| **Backend Process Restart** | Node process killed via SIGTERM/SIGINT during idle | Restart initiates `connectDB()` and `startNarrativeScheduler()` | **PASS** |
| **Restart During Active Run** | Node process terminated during relationship classification | Lease in `NarrativeLock` expires after 30 min; next run reclaims cleanly | **PASS** |
| **Unchanged RSS Refresh** | Scraper re-runs with zero new articles; rebuilds clusters | Stable article URLs and fingerprints match existing `NarrativeEvent` keys; 0 duplicate narratives created | **PASS** |
| **New RSS Burst Arrival** | New articles arrive across 3 feeds; clusters recreated | New articles enter inverted index; existing narratives update with `EVENT_MEMBERSHIP_CHANGED` history | **PASS** |

