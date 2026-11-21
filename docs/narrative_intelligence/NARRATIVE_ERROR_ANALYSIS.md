# Narrative Error Analysis

## Observed live failure modes

1. **Publisher/body boilerplate leakage.** Earlier rules interpreted publisher names appearing in extracted body text as shared story entities. This generated hundreds of false same-event relationships and oversized parents. Publisher names were removed from the entity map; relationship entity support is now taken from article headlines.
2. **Generic full-body term overlap.** Long body text made unrelated events appear alike. Pair retrieval and accepted relationship terms now use headline terms with document-frequency downweighting. Full text remains available for manual inspection.
3. **Mixed production clusters.** A saved TF-IDF event can contain mixed headlines or drifted member articles. One matching member pair could previously promote the whole event cluster. The layer now checks saved event-label corroboration and abstains for mixed-topic clusters; it does not mutate or split production clusters.
4. **Evidence pooled across facets.** Earlier explanations listed entities and terms aggregated from every article-facet pair, even when a different pair justified the classification. Evidence now comes from the selected best pair only.
5. **Summit commentary versus same event.** Shared Trump/Xi/Putin names and one “summit” term were too permissive for `SAME_EVENT`. The current rule requires multiple distinctive title terms for generic event matching; a shared named event such as APEC provides stronger corroboration. Shared leaders and one topic term may be broader context, not a child merge.

## Known false negatives / abstentions

- GTA 6 stories appear in the corpus, but the final pass produced no GTA child narrative. Some pairs are abstained because of mixed or insufficient event-label evidence. This likely sacrifices recall.
- The Joanne Young cluster is present, but the final rules did not establish a cross-event narrative. The short `Young` alias is ambiguous and not used alone.
- UK/EU asylum and Rwanda return-hub stories have a plausible broad policy relationship but are not grouped. A curated policy ontology or human-reviewed issue label could improve this without forcing storyline identity.
- The NPR roundup mentioning Anthropic and a House-speaker nomination is marked mixed-topic and excluded from narrative grouping as a whole. This avoids leakage but misses its Anthropic facet until event-level facet grouping is robust enough to preserve source attribution without attaching the unrelated second topic.

## Remaining false-positive risk

The APEC and Anthropic proposals are plausible predictions, not confirmed labels. A curated alias can still be ambiguous; title-only evidence can miss context or overstate it; a cluster label may be weak or mechanically generated; and candidate retrieval cannot surface pairs with no shared indexed title signals. Reviewers should inspect source links and body excerpts before confirming any relationship.

## Entity extraction limitations

The detector no longer treats capitalization as entity recognition. It uses a finite English alias list and supports only reviewed aliases such as Trump, Xi Jinping, Putin, Joanne Young, Anthropic, APEC, and GTA VI. It will miss unseen people and organizations and can still mishandle ambiguous short aliases. No multilingual or general-purpose NER claim is made. Nationality adjectives such as “British” and bare “Labour” are not aliases; a full “Labour Party” mention is recognized.

## Input-quality decisions

Navigation/download items, promotional wording, missing or short content, mixed-topic headlines, and old items are flagged in separate shadow fields. Historical content is not automatically deleted or excluded solely because it is old. No Article or Cluster source record is changed.
