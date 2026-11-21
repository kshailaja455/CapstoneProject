# Implementation Changelog

## Final narrative layer

- Added a separate analysis engine with typed English aliases, headline facets, input-quality flags, term-frequency-aware candidate retrieval, relationship evidence, complete-link child grouping, optional parent grouping, and stable URL-based event identity.
- Added separate MongoDB models for narratives, event references, relationships/reviews, run history, and a lease lock. Event facets are stored separately from source Article records.
- Added narrative list/detail/timeline/history/status/relationship/review/analyze API routes.
- Added 15-minute scheduler, post-ingest shadow analysis trigger, independent enable switch, failure isolation, and overlap lock.
- Added a Narrative Intelligence view to the dashboard with proposal review, article/facet/evidence inspection, and confirm/reject/needs-review controls.
- Added architecture, evaluation, blind review worksheet, predictions snapshot, error analysis, live validation, and rollback/setup documentation.

## Accuracy hardening by live observation

- `rules-en-v1.0.0`: 13 child / 203 parent proposals; live inspection found publisher boilerplate causing extensive false positives.
- `rules-en-v1.0.1`: 12 child / 14 parent proposals; still over-grouped due body-term overlap.
- `rules-en-v1.0.2` to `v1.0.5`: moved to title evidence, stricter parent evidence, event-label corroboration, and mixed-cluster abstention; live runs exposed and corrected remaining bad groups.
- `rules-en-v1.0.6` to `v1.0.9`: constrained evidence to the selected facet and headline entities, and prevented same-person summit commentary from automatically joining an event.
- `rules-en-v1.1.0`: classifies shared-leader summit commentary as broader context when supported, without merging it into the child event. Latest live output: 2 child candidates, no parent, 137 comparisons.
- Earlier unreviewed narrative candidates were retired, not deleted. Source article and saved cluster documents were preserved.

## Test results

- `npm test` in `backend`: 15/15 passing (engine behavior and config behavior).
- `npx tsc --noEmit` in `backend`: passed.
- `npm run build` in `frontend`: passed.
- Live repeat, concurrency, scheduler, disable-switch, API, and Mongo source-count checks: see `LIVE_DATA_VALIDATION.md`.
- No independent accuracy metrics are claimed.
