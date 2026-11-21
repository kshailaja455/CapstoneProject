# MediaLens Narrative Intelligence — gap assessment before implementation

**Inspection date:** 2026-11-20  
**Scope:** source and data inspection only; written before narrative implementation changes.

## Verified current state

- The existing source pipeline stores RSS article fields `title`, `summary`, `body`, `source`, `url`, `publishedAt`, `fetchedAt`, `contentHash`, and `clusterId`. URL deduplication and article extraction are implemented in `scraper/pipeline.py` and `scraper/extractor/article_extractor.py`.
- `scraper/clustering/tfidf.py` builds TF-IDF cosine similarities and connected components. On a successful RSS fetch, `scraper/pipeline.py` calls `clusters.delete_many({})`, clears article `clusterId` values, and recreates cluster documents. Existing cluster ObjectIds are therefore not durable identity.
- The backend exposes cluster and timeline APIs and starts RSS polling from `backend/server.ts` via `backend/services/ingestService.ts`. There are no narrative models, narrative routes, narrative scheduler hooks, or narrative UI components.
- The current React app in `frontend/src/App.jsx` presents cluster board, signal map, timeline, cluster details, similarity playground, and ingestion monitor. No narrative section exists.
- Read-only MongoDB inspection found **123 articles, 107 saved event clusters, 123 article bodies and summaries present, and all 123 articles assigned to a cluster**. Publishers: BBC 53, Guardian 59, NPR 11. Nine saved clusters have nonempty `topTerms`; singleton clusters account for most empty term arrays. Published times range from 2025-04-30 to 2026-11-20. These are a live snapshot and can change with RSS polling.
- The saved prototype JSON is an older 108-article/93-cluster snapshot. Its original grouping and manually reviewed edge set are useful regression material, not an independent test set.

## Prototype gaps

1. `run_prototype.py` reads MongoDB but emits local JSON/Markdown/HTML only. It uses cluster-level lexical similarity and capitalization-based headline entities.
2. `improve_and_evaluate.py` reads the saved snapshot, not live MongoDB. It has a small dataset-specific English alias list and hand-authored hierarchy for five known groupings. Its reported 1.000 precision/recall/F1 was measured on the 23 edges used during review; it is not independent accuracy.
3. Roundup handling flags a narrow title pattern. It does not extract article-level facets from full bodies, despite full article text being present in live MongoDB.
4. Article quality logic is a prototype heuristic; no persisted review state or production eligibility signal exists.
5. The prototype has no durable narrative IDs, event-cluster rebuild resolution, narrative history, idempotent persistence, relationship records, or incremental candidate retrieval.
6. The prototype does not distinguish relationship states in a production API, calibrate confidence, retain rejected decision evidence, or support human review workflows.
7. There is no independent held-out evaluation dataset or second human reviewer. Current sources cover only BBC, NPR, and Guardian; broad language/category/publisher accuracy is unverified.

## Constraints and implementation implications

- Keep all writes in new narrative-only collections. Do not update `articles` or `clusters`.
- Stable event references must use durable article URLs and content/text fingerprints, with current cluster IDs recorded only as observation metadata.
- Run after successful RSS collection and on an independent schedule, under a Mongo-backed lease so a backend restart or second instance cannot duplicate concurrent work.
- Start in shadow mode; feature disablement must leave RSS ingestion untouched. Narrative errors must be logged and must not fail the RSS job.
- Restrict computation to recent/current clusters plus indexed candidate retrieval against active narrative entity/term keys; do not compare every historical event to every other event on every poll.
- Treat independent evaluation as incomplete until a held-out set receives human-verified labels. Do not present the current in-sample metrics as production accuracy.

## Known unresolved evaluation boundary

No independent human-verified gold set exists at the start of implementation. The available live snapshot supports a shadow-mode demonstration and a provisional test set, but a single automated coding agent cannot establish independent human annotation or broad accuracy. The final status must retain this limitation and must not call the system production-accurate.
