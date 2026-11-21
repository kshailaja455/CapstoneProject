# Live Data Validation

Captured from the local application at `http://localhost:5050` and local MongoDB database `news-pulse` on 2026-11-20. Final algorithm version: `rules-en-v1.1.0`.

## Dataset and run

- Source Articles: **125**
- Publishers represented: **3** (BBC 54, Guardian 60, NPR 11)
- Saved event Clusters: **109**
- Current candidate comparisons / relationships: **137**
- Child narrative candidates: **2**
- Parent narrative candidates: **0**
- Latest scheduled run status: **completed**, 125 articles / 109 clusters, 2 child candidates / 0 parents.
- Latest manual v1.1.0 run status: **completed**, about 2.8 seconds.
- Active current-version proposals: Anthropic IPO/protests (2 events) and APEC summit coverage (2 events). Both remain `CANDIDATE` / `NEEDS_REVIEW`.

## MongoDB safety and idempotency

Read-only snapshots before and after repeated manual analysis showed `articles=125` and `clusters=109` both times. Final counts: `narratives=249` (including retired version history; 2 current candidates), `narrative_events=109`, `narrative_relationships=1181` (137 current-version plus historical rule-version predictions), and `narrative_runs=22`. All **109/109 narrative event records** had stored facet metadata. Repeating analysis twice left narrative/event/relationship document counts unchanged during that check; subsequent rule-version changes retired previous predictions and retained history rather than deleting them.

Current-version relationship outcomes: 1 `SAME_EVENT`, 1 `CONTINUING_STORYLINE`, 5 `BROADER_CONTEXT_ONLY`, and 130 `INSUFFICIENT_EVIDENCE`. The live candidate index does not create `UNRELATED` rows for pairs with no usable shared candidate key. These counts are predictions, not accuracy labels.

The final schema writes only to the five separate narrative collections. No delete/update operation targets Article or Cluster. Prior unreviewed rule-version predictions are marked retired and kept with history.

## Manual, scheduler, concurrency, and disable checks

- Manual analysis: run twice independently; both completed with 125 articles, 109 clusters, 137 relationships, 2 child candidates, 0 parents.
- Scheduled path: executed using an isolated temporary smoke script with a shortened test interval (0.08 minutes); scheduled run completed under the current rule set. The user `.env` was not modified by the smoke script.
- Concurrency: two simultaneous manual requests produced one completed analysis and one HTTP 409 conflict; overlapping work did not start.
- Disable switch: automated config test sets `NARRATIVE_ANALYSIS_ENABLED=false` and confirms narrative analysis is disabled. RSS ingestion configuration is independent.
- API: status, narrative list, detail, relationship list, and narrative timeline endpoints were read successfully. Latest UI build succeeded.

## Live limits

This is a small live snapshot, not a scale test. RSS can change the data after capture. The existing dashboard and backend were already running locally; this evaluation verified build/API behavior and did not perform a full browser-based visual regression pass. Article/Cluster counts do not prove individual source extraction is always complete. Independent reviewers have not labelled the current result set.
