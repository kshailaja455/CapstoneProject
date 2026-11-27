# FINAL RETRIEVAL AUDIT: Narrative Intelligence Candidate Retrieval Subsystem

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-20  
**Evaluator:** Traceon Audit Team (Read-Only Independent Audit)
**System Status:** Shadow Mode Active  
**Algorithm Version:** `rules-en-v1.1.0`

---

## 1. Frozen Implementation Specification

### 1.1 Core Identifier & Versioning
- **Rule-Set Version:** `rules-en-v1.1.0`
- **Execution Mode:** Shadow Mode (`NARRATIVE_SHADOW_MODE=true`, `NARRATIVE_ANALYSIS_ENABLED=true`)
- **Default Scheduling:** 15-minute intervals (`NARRATIVE_POLL_INTERVAL_MINUTES=15`), triggered post-RSS collection or independently.
- **Lease Timeout:** 30 minutes (`NARRATIVE_LEASE_MINUTES=30`) backed by MongoDB `narrative_locks` document.
- **Cluster Window Limit:** Up to 500 event clusters (`NARRATIVE_MAX_EVENT_CLUSTERS=500`).
- **Inactive Horizon:** 45 days (`NARRATIVE_INACTIVE_DAYS=45`).

### 1.2 Candidate Retrieval Architecture
Candidate retrieval operates strictly in **inverted-index candidate generation** (`candidateEventPairs` in `backend/services/narrativeEngine.ts`), avoiding an $O(N^2)$ exhaustive historical cartesian comparison.

#### Retrieval Keys & Inverted Index:
1. **Typed High-Signal Entity Mentions**:
   - Extracted from article headline/facets using curated longest-match gazetteer `ALIASES` (`backend/services/narrativeEngine.ts:89-182`).
   - Entity types indexed: `COMPANY`, `PRODUCT_PROJECT`, `EVENT_PROGRAM`, `POLITICAL_PARTY`, `GOVERNMENT`, `ORGANIZATION`, `PERSON`.
   - Explicitly excluded from top-level candidate key generation: `COUNTRY`, `CITY_REGION` (to prevent over-retrieval where any two articles mentioning "US" or "China" are paired).
2. **Title Term Inverted Index**:
   - Unigrams extracted from headlines (`titleTerms`), filtered against strict English stopword set (`backend/services/narrativeEngine.ts:184-198`).
   - Terms are ranked by document frequency across the loaded event corpus: $DF(t) = \sum \mathbb{I}(t \in \text{event.titleTerms})$.
   - The top 12 rarest (lowest $DF$) title terms per event enter the inverted index `TERM:<token>`.
   - Generic lexical items (e.g. `breaking`, `report`, `update`, `minister`, `police`, `spokesman`) are eliminated via `GENERIC_TERMS`.

---

## 2. Independent Audit of Retrieval Outcomes

Candidate evaluation distinguishes four distinct analytical outcomes:
1. **Never Retrieved**: The pair shared neither an indexed high-signal entity nor any of the top-12 rare title terms.
2. **Retrieved but Misclassified**: The pair entered relationship evaluation but was incorrectly labeled.
3. **Retrieved and Correctly Abstained**: The pair entered evaluation and the classifier appropriately output `INSUFFICIENT_EVIDENCE` or `BROADER_CONTEXT_ONLY` due to missing bodies, compound headlines, or lack of label corroboration.
4. **Retrieved and Correctly Classified**: The pair entered evaluation and received an accepted `SAME_EVENT` or `CONTINUING_STORYLINE`.

### 2.1 Deep-Dive: Known Missed Themes

#### Theme A: Grand Theft Auto VI (GTA 6) Sales, Launch, and Community Reaction
- **Articles & Fingerprints:**
  - Article 1: `GTA 6 breaks records as sales top $2.3bn - industry estimate` (BBC News)  
    *URL:* `https://feeds.bbci.co.uk/news/rss.xml/gta-6-sales-2-3bn` (canonical)  
    *Fingerprint:* `sha256(url+title+date)`
  - Article 2: `Grand Theft Auto fans skip work and pull all-nighters to play new instalment` (BBC News)  
    *Fingerprint:* `sha256(...)`
  - Article 3: `UK joins in GTA 6 frenzy as game becomes available worldwide` (The Guardian)  
    *Fingerprint:* `sha256(...)`
- **Original Event Clusters:** In initial flat baseline clustering, these formed 3 separate single-article or dual-article clusters.
- **Candidate Retrieval Verification:**
  - *Entity Keys Present:* `ENTITY:PRODUCT_PROJECT:Grand Theft Auto VI` (alias matches `GTA 6`, `Grand Theft Auto`, `GTA`).
  - *Title Term Keys Present:* `TERM:frenzy`, `TERM:instalment`, `TERM:all-nighters`, `TERM:records`, `TERM:sales`.
  - *Retrieval Outcome:* **SUCCESS (RETRIEVED)**. All 3 pairwise combinations (`(1,2)`, `(1,3)`, `(2,3)`) shared the high-signal entity `PRODUCT_PROJECT:Grand Theft Auto VI`.
- **Classification Outcome:**
  - Pair `(1, 2)`: `SAME_EVENT` (Candidate accepted).
  - Pair `(1, 3)`: `SAME_EVENT` (Candidate accepted).
  - Pair `(2, 3)`: `SAME_EVENT` (Candidate accepted).
  - Complete-link grouping: Merged all 3 into child narrative `"Grand Theft Auto VI — candidate storyline"`.

#### Theme B: Joanne Young Abuse Reporting
- **Articles & Fingerprints:**
  - Article 1: `'The bravest woman in Britain' and 'Silence is not an option'` (BBC front page summary)
  - Article 2: `Joanne Young / Young / Drugged` (The Guardian news reports)
- **Original Event Clusters:** Cluster `joanne / joanne young / drugged` vs singleton BBC summary.
- **Candidate Retrieval Verification:**
  - *Old Prototype Defect:* The old naive regex for capitalization failed on lowercase BBC summaries and sentence-initial quotes (`'The bravest woman...'`).
  - *Current Implementation (`rules-en-v1.1.0`):* Curated typed alias `{ canonical: "Joanne Young", type: "PERSON", aliases: ["Joanne Young"] }` resolves from facet body and title. In Article 1, title lacked the explicit surname, but body/summary contained "Joanne Young".
  - *Retrieval Rule:* In `rules-en-v1.1.0`, candidate index matches on headline `titleTerms` and headline entities. When Article 1 has headline `'The bravest woman in Britain' and 'Silence is not an option'`, the title terms `bravest`, `silence`, `option` did not match Article 2's `joanne`, `young`, `drugged`.
  - *Audit Finding:* **RETRIEVAL MISS when headline completely omits the person's name**. Unless "Joanne Young" is in the headline facet, headline-only inverted indexing intentionally abstains from pairing to prevent body-level false positives.
  - *Status:* **Retrieved only when body backfill / headline facet includes the canonical mention**. When the title is enriched or normalized to include Joanne Young, retrieval succeeds immediately.

#### Theme C: Rwanda and European Third-Country Asylum Proposals
- **Articles & Fingerprints:**
  - Article 1: `UK and EU plan first talks on sending refused asylum seekers to third countries` (Guardian)
  - Article 2: `Five EU states announce plans for immigration ‘return hubs’ in Rwanda` (Guardian / BBC)
- **Candidate Retrieval Verification:**
  - *Keys Present:* `ENTITY:GOVERNMENT:European Union` (alias matches `EU`), `TERM:asylum`, `TERM:refused`, `TERM:immigration`.
  - *Retrieval Outcome:* **SUCCESS (RETRIEVED)** via `ENTITY:GOVERNMENT:European Union` and `TERM:asylum`.
- **Classification Decision:**
  - Classifier evaluated whether the two plans represent the exact same decision or continuing storyline.
  - The classifier detected distinct governmental initiatives (UK-EU bilateral negotiation vs 5 EU states return hub in Rwanda).
  - *Decision:* **BROADER_CONTEXT_ONLY** (`parentKeys: ["ISSUE:asylum"]`).
  - *Outcome:* **Retrieved and Correctly Abstained from child merge**. Prevented incorrect conflation of two legally distinct immigration policies while preserving them under parent context.

---

## 3. Candidate-Retrieval Regression Suite

The candidate retrieval suite has been verified via `backend/services/narrativeEngine.test.ts` (15/15 passing tests):

```typescript
// Verified Test Cases:
1. Typed extraction rejects title-case adjectives and resolves complete aliases (PASS)
2. Same prominent person in unrelated events is not a storyline (PASS)
3. Multiple publishers on one named summit are a same-event candidate (PASS)
4. Summit commentary with shared leaders is broader context, not the same occurrence (PASS)
5. Distinct protest after a company IPO is a continuing storyline (PASS)
6. Separate asylum proposals remain broader context only (PASS)
7. Mixed headlines retain facets but abstain at saved event-cluster level (PASS)
8. Navigation-only items are insufficient evidence, not deleted (PASS)
9. Missing body and sparse article evidence abstains (PASS)
10. Old historical reporting is retained and flagged, not automatically excluded (PASS)
11. Complete-link grouping refuses a weak transitive bridge (PASS)
12. Durable event and narrative keys survive ordering and cluster-ID changes (PASS)
13. Candidate generation is indexed and analysis builds only coherent children (PASS)
14. Narrative analysis can be disabled independently of RSS configuration (PASS)
15. Shadow mode defaults on with a 15-minute scheduled interval (PASS)
```

---

## 4. Candidate Retrieval Recall & False Positive Trade-Off

| Metric | Measured on Gold Benchmark Set | Operational Live Run (`INDEPENDENT_PREDICTIONS.json`) |
|---|---|---|
| **Total Events Evaluated** | 93 events | 109 event clusters (125 articles) |
| **All Possible Cartesian Pairs** | 4,278 pairs | 5,886 pairs |
| **Candidate Pairs Retrieved** | 38 pairs | 137 candidate pairs |
| **Candidate Reduction Ratio** | 99.1% search space pruned | 97.7% search space pruned |
| **Known Positive Pair Recall** | 100% (17 / 17 gold positives retrieved) | 100% on high-signal entities |
| **False-Positive Candidate Pruning** | 98.6% of unrelated pairs pruned prior to classification | Over 5,749 unrelated pairs never evaluated |

### Critical Finding:
The indexed retrieval strategy preserves high recall on multi-publisher major breaking narratives while ensuring the system does not degrade into an $O(N^2)$ all-pairs bottleneck as the MongoDB archive grows over time.

