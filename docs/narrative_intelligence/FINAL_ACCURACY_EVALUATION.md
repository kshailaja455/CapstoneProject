# Final Accuracy Evaluation

## Verdict

The Narrative Intelligence feature is implemented and has run against live local RSS-derived MongoDB data in shadow mode. **Independent accuracy has not been demonstrated.** The provided independent-review worksheet has no completed human labels, so precision, recall, and F1 for the current implementation are not calculated. Do not describe the feature as production-accurate.

## Verified live run

Latest recorded run during this evaluation: rule set `rules-en-v1.1.0`, completed, shadow mode on, 125 unique source articles, 109 saved event clusters, 137 candidate comparisons/relationships, 2 child narrative candidates, 0 parent narratives. Latest manual run took about 2.8 seconds; a scheduled run also completed. Relationship classification counts from the current run are captured in [INDEPENDENT_PREDICTIONS.json](INDEPENDENT_PREDICTIONS.json) (the predictions are machine generated, not labels).

The two candidate groups are:

1. **Anthropic IPO / protest coverage** — two event clusters, linked as `CONTINUING_STORYLINE` on headline evidence naming Anthropic and the post-debut protest. This is plausible but still requires review.
2. **APEC summit coverage** — two event clusters: the APEC live coverage and coverage of Trump during Xi's APEC speech. They are linked as `SAME_EVENT`. Other summit commentary remains separate or broader context rather than being forced into this group.

No parent narrative was created. This is intentional: the evidence did not support coherent parents across multiple child storylines.

## Original versus hardened output

The saved earlier prototype snapshot contains 108 articles and 93 event clusters, while the current live database contains 125 articles and 109 clusters. Counts are not directly comparable because the snapshot is older and the live data changed.

On the earlier snapshot, the original prototype made five flat groups, including one eight-event Trump/Xi/Putin/Russia component, a three-event GTA group, Joanne Young, Rwanda/asylum, and Anthropic. The improved offline prototype separated the large geopolitical component into child storylines and kept broader-context edges out of child merges. Its report records 17/23 edge labels as positive and reports in-sample metrics (original F1 0.850; improved F1 1.000). Those labels were authored against the same snapshot used to tune the detector; they are **in-sample**, not an independent held-out benchmark, and must not be used as current production accuracy.

The live rule sequence exposed and corrected multiple errors: publisher/body boilerplate entity leakage; generic body-term matches; unrelated member articles in a saved event cluster; mixed-topic headline bridges; entity evidence pooled across non-selected article facets; and summit commentary being called the same occurrence based only on repeated leaders. Earlier unreviewed narrative records were retired with history rather than deleted. The final live output is intentionally much smaller.

## Required five-theme review

| Theme | Current result | Evidence and limits |
|---|---|---|
| Trump / Xi / Putin / Russia | APEC same-event child contains two APEC event clusters. Other summit commentary is not forced into it; some is broader context or insufficient. | APEC headline/program and title-level participants support the two-event group. The earlier eight-event connected component was overbroad. Human review is still required for disputed summit commentary and Ukraine/Russia diplomacy. |
| GTA 6 | No child narrative in the final live output. | Multiple collected GTA-related events are present; the conservative label/mixed-cluster checks abstain on some pairs. This is a known likely false negative, not evidence the stories are unrelated. |
| Joanne Young | No child narrative in the final live output; a saved cluster labelled `Joanne / Young / Joanne Young` exists. | No accepted cross-event relationship was established from current headlines. The “Young” ambiguity and cluster contents need human source inspection. |
| Rwanda / asylum | No child narrative in the final live output. | Separate Rwanda return-hub coverage and UK/EU asylum policy coverage are related at a broad topic level but are not asserted as one continuing story. The current detector may miss a parent-level policy context. |
| Anthropic | Two-event continuing-storyline child: IPO coverage and post-debut protest coverage. | Headline entity and “debut” evidence; mixed Anthropic/House roundup content is retained but abstained at the cluster level. This can miss valid Anthropic facet-level coverage. |

## Human and independent review status

- Automated tests: 15 passing focused unit/config tests. These test expected rule behavior; they are not accuracy measurements.
- Live output inspection: developer inspection of current proposals and selected relationship evidence; not an independent human-review panel.
- Independent held-out human labels: **0 completed**. `INDEPENDENT_TEST_CASES.csv` is a blind review worksheet with labels pending.
- Accuracy metrics for current live predictions: **not reported**. The denominator and ground truth are not established.
- Multilingual/general-purpose NER: not evaluated.

## Safety judgement

Safe for continued **shadow-mode inspection** with all narrative predictions visibly marked for review. Not safe to present as verified facts or enable as authoritative narrative categorization. Keep the switch on shadow mode until a held-out set is labelled by independent reviewers and disagreement is adjudicated.
