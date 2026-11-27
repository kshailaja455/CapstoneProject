# FINAL IDENTITY AND HISTORY AUDIT: Persistent Identity & Audit Record Integrity

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-20  
**Scope:** Durable Key Resolution, Rebuild Resilience, MongoDB Counts Audit, and Lifecycle State Transitions  

---

## 1. Durable Identity Under Event Cluster Rebuilding

### 1.1 The Critical Architectural Dilemma
In `scraper/pipeline.py:91`, whenever new RSS articles are fetched, the legacy clustering system executes:
```python
clusters.delete_many({})
articles.update_many({}, {"$set": {"clusterId": None}})
```
This means MongoDB `Cluster._id` values are completely ephemeral and wiped on every scraper run. If the narrative layer relied on `Cluster._id`, all narrative relationships, timelines, and identifiers would break upon every RSS refresh.

### 1.2 The Traceon Solution: Content & URL Fingerprints
The narrative layer implements three tiers of durable keys:

1. **Article Fingerprint:**
   $$\text{ArticleFingerprint} = \text{sha256}(\text{url} + "\backslash n" + \text{title} + "\backslash n" + \text{publishedAt})$$
2. **Stable Event Key:**
   $$\text{EventKey} = \text{"event-"} + \text{sha256}\left(\text{sorted}(\text{articleUrls}).\text{join}("\backslash n")\right)[0:24]$$
   - Even when `Cluster._id` changes from `673d...` to `673e...`, `EventKey` remains identical if the article URL set is unchanged.
   - If cluster membership shifts partially, `selectEventMatches` performs Jaccard overlap matching ($\ge 0.5$) to maintain identity continuity, recording `EVENT_MEMBERSHIP_CHANGED`.
3. **Stable Narrative Key:**
   $$\text{NarrativeKey} = \text{"narrative-"} + \text{sha256}(\text{level} + "|" + \text{parentKey} + "|" + \text{sorted}(\text{eventKeys}).\text{join}("|"))[0:24]$$
   - Key remains stable across analysis runs, backend restarts, and repeated polls.

---

## 2. Investigation of Current Database Counts

The inspection of the live MongoDB storage identified the following historical distribution:

### Count 1: 249 Narrative Records Across Statuses
- **Active / Candidate Narratives:** Current active storyline candidates (typically 2 to 15 at any active snapshot).
- **Historical Inactive / Retired / Split Narratives:** Approximately 230+ records representing previous rule iterations (`rules-en-v1.0.0`, experimental passes), merged storylines, and retired events.
- **Audit Requirement:** The system **must not delete historical records merely to make counts appear smaller**. The Mongoose model schema (`backend/models/Narrative.ts`) defines an explicit `status` enumeration:
  - `CANDIDATE`: Newly detected proposal awaiting reviewer inspection.
  - `ACTIVE`: Accepted live storyline.
  - `INACTIVE`: Stale storyline whose events have exceeded `NARRATIVE_INACTIVE_DAYS`.
  - `SPLIT`: Historical record replaced by two or more new split narratives.
  - `MERGED`: Historical record merged into another primary narrative (`mergedIntoKey`).
  - `RETIRED`: Archived historical storyline.
- Query filters (`status: { $in: ["CANDIDATE", "ACTIVE"] }`) ensure the dashboard displays only active and reviewable narratives while preserving full forensic auditability.

### Count 2: 109 Narrative Event Records
- Represents the 109 event clusters formed from the 125 stored articles in the live MongoDB snapshot.
- Each event record stores extracted article facets, quality flags, entity keys, and publication bounds.
- Status is tracked as `ACTIVE`, with `currentClusterId` updated idempotently without losing historical event keys.

### Count 3: 1,181 Relationship Records Across Rule Versions
- Reflects the cumulative pairwise relationship evaluations generated across multiple development runs and rule-set versions.
- Every relationship record is explicitly tagged with `algorithmVersion` (e.g. `rules-en-v1.0.0` vs. `rules-en-v1.1.0`).
- When `rules-en-v1.1.0` executes, it evaluates current candidate pairs and updates or creates records under its own version identifier.
- The Express controller (`backend/controllers/narrativeController.ts:98`) filters relationships by the active version:
  ```typescript
  algorithmVersion: narrativeConfig().algorithmVersion
  ```
  This ensures reviewers only see relationships evaluated under the certified rule-set while historical evaluations remain preserved for regression tracing.

---

## 3. Human Review Persistence Invariants

When a reviewer sets a relationship to `CONFIRMED` or `REJECTED` via `PATCH /narratives/relationships/:id/review`:
1. `reviewStatus` is set to `CONFIRMED` or `REJECTED`.
2. `reviewedBy` and `reviewedAt` timestamps are recorded.
3. On subsequent analysis runs (`narrativeService.ts`), the engine evaluates whether existing relationships have user review decisions. A human decision **is never overwritten by automated candidate re-evaluation**.
4. Even if the scraper wipes clusters and re-runs TF-IDF, the durable relationship key (`relationship-<sha256(leftKey, rightKey)>`) matches the human review record and preserves the reviewer's decision intact.

