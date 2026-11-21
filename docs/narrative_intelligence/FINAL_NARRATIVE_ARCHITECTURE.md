# Final Narrative Intelligence Architecture

## Status

The narrative layer is implemented in the existing Express/MongoDB/React architecture and is currently enabled in **shadow mode**. It reads the existing `articles` and `clusters` collections, then stores narrative analysis in five separate collections: `narratives`, `narrative_events`, `narrative_relationships`, `narrative_runs`, and `narrative_locks`.

RSS article extraction, Article/Cluster schemas, URL deduplication, TF-IDF event clustering, and existing cluster views remain the source of event data. The narrative layer never updates or deletes Article or Cluster records. It is triggered after successful ingestion and also has its own configurable scheduler.

## Data flow

```text
Existing RSS ingestion -> Article + Cluster (unchanged)
                          -> post-ingest shadow analysis
15-minute narrative scheduler -> same analysis service
                          -> candidate retrieval from saved event labels/headline terms
                          -> typed headline entities + article facets + quality flags
                          -> pairwise relationship evaluations
                          -> complete-link child narratives; optional coherent parents
                          -> separate narrative collections -> Express API -> dashboard review panel
```

The relationship labels are `SAME_EVENT`, `CONTINUING_STORYLINE`, `BROADER_CONTEXT_ONLY`, `UNRELATED`, and `INSUFFICIENT_EVIDENCE`. A relationship is not a probability; no calibrated confidence is claimed. Results start as candidates or abstentions and are marked `NOT_CALIBRATED`.

## Evidence and coherence safeguards

- A curated English alias gazetteer returns typed headline entities. Body and publisher boilerplate cannot alone create entity matches. This is not general-purpose NER.
- Compound headlines are split into inspectable facets. Because production event clusters cannot be split safely by this layer, clusters containing mixed-topic headline content are conservatively abstained from narrative grouping; original articles remain visible.
- Distinctive terms used for pair decisions come from headlines and are downweighted by document frequency. Full source content is retained for article inspection, not used as a standalone reason to connect events.
- Shared people or countries alone do not make a relationship. Same-event classification needs the same named event evidence or multiple distinctive headline terms plus event context and timing. Summit commentary with shared leaders can remain broader context without joining the event group.
- Child narratives use complete-link merging. Every event pair in a child must have an accepted same-event or continuing-storyline relationship. Broader-context relationships do not merge child events; no parent is forced when evidence does not form a coherent group.
- Saved event labels must corroborate a link, limiting accidental promotion from unrelated member articles in a mixed production cluster.

## Identity and history

Event identities use durable article URLs and overlap matching rather than relying solely on rebuilt Mongo cluster IDs. Narrative identity is matched through stable event membership. Separate history records preserve membership changes, splits, merges, retirement, reactivation, and rule-version transitions. Repeated analysis is idempotent for the live snapshot.

## API

- `GET /narratives/status`
- `GET /narratives?status=&level=&category=&source=&from=&to=&reviewStatus=&limit=`
- `GET /narratives/:id`
- `GET /narratives/:id/timeline`
- `GET /narratives/:id/history`
- `GET /narratives/relationships?classification=&state=&reviewStatus=&source=&from=&to=&limit=`
- `PATCH /narratives/relationships/:id/review`
- `POST /narratives/analyze`

The detail API includes article evidence, stored facets, quality flags, and relationship explanations. `POST /narratives/analyze` runs against current saved data. A Mongo lease prevents concurrent runs; the overlap request is skipped with HTTP 409.

## Local configuration

Set these in `backend/.env`:

```dotenv
NARRATIVE_ANALYSIS_ENABLED=true
NARRATIVE_SHADOW_MODE=true
NARRATIVE_POLL_INTERVAL_MINUTES=15
NARRATIVE_MAX_EVENT_CLUSTERS=500
NARRATIVE_INACTIVE_DAYS=45
NARRATIVE_LEASE_MINUTES=30
```

Set `NARRATIVE_ANALYSIS_ENABLED=false` to stop only narrative analysis. RSS ingestion remains independently configured. Keep `NARRATIVE_SHADOW_MODE=true` until independent review supports changing it.

## Startup on Windows (no Docker or Bun)

1. Start local MongoDB using the repository's existing local MongoDB instructions.
2. In one PowerShell window, from `backend`: `npm install; npm run dev`.
3. In another window, from `frontend`: `npm install; npm run dev`.
4. Open `http://localhost:5173`; the API defaults to `http://localhost:5050`.
5. Narrative controls are in the `Narrative intelligence` visualization. Use **Analyze saved data** to run manually; the dashboard refreshes its narrative data on status polling.

No paid API, LLM, hosted database, or embedding service is required.

## Rollback

Set `NARRATIVE_ANALYSIS_ENABLED=false` and restart the backend. This stops scheduled, post-ingestion, and manual narrative processing without stopping RSS ingestion. To remove the dashboard panel, revert only the frontend narrative integration. The existing Article/Cluster collections need no rollback. Narrative collections are separate; preserve them for audit or remove only those five collections if you intentionally want to discard narrative history. Do not drop the database or Article/Cluster collections.

## Operational limits

The live dataset is 125 articles and 109 event clusters at the captured run. No large-corpus performance test has been completed. Candidate retrieval is indexed and the observed run was roughly 1–3 seconds, but this does not establish production scale. English aliases are finite; multilingual and general NER performance is untested. Current rules deliberately abstain often and can miss valid connections.
