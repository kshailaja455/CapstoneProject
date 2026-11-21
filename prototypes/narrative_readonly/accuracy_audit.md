# Narrative accuracy audit — read-only prototype

Generated: 2026-11-20T06:54:07.560211+00:00

> Offline evaluation of the saved `narrative_results.json` snapshot. No MongoDB connection or writes. Manual labels are human review; predictions are the prototype's dataset-specific rules.

## Snapshot and outcome

- Snapshot: narrative_results.json; 108 articles, 93 saved clusters, 93 analyzed events.
- Original flat proposals: 23 pairwise edges across five connected-component groups.
- Improved output: 5 top-level groupings, with a Trump/Xi/Putin parent and three child narratives; parent-only policy links do not merge child events.
- No saved cluster was split or modified. Article facets are review notes only.

## Original versus improved groupings

Original flat groups:

- **Trump / Xi / Putin / Russia — related event coverage** (8 events): Ukraine / Putin / Europe; Anthony Zurcher: Trilateral summit high on spectacle, short on substance; Watch: What did Trump, Xi and Putin get out of their historic meeting?; China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars; Trump accused of falling asleep during Xi Jinping speech at Apec summit in China; New page in history? Xi, Trump and Putin summit was more of a footnote; Top House Democrat questions what Trump accomplished in Xi-Putin summit; Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in ‘humiliating decline’
- **GTA 6 / GTA — related event coverage** (3 events): GTA 6 breaks records as sales top $2.3bn - industry estimate; Grand Theft Auto fans skip work and pull all-nighters to play new instalment; UK joins in GTA 6 frenzy as game becomes available worldwide
- **joanne / joanne young / drugged — related event coverage** (2 events): 'The bravest woman in Britain' and 'Silence is not an option'; Joanne / Young / Joanne Young
- **rwanda / asylum / countries — related event coverage** (2 events): UK and EU plan first talks on sending refused asylum seekers to third countries; Five EU states announce plans for immigration ‘return hubs’ in Rwanda
- **Anthropic — related event coverage** (2 events): Anthropic / Shares / Company; Protesters rally against Anthropic in New York and San Francisco after $2tn stock market debut

Improved groups:

- **Trump–Xi–Putin meeting at APEC: coverage, outcomes, and reactions** (parent_context; 8 events); child narratives: Trilateral meeting and summit coverage, Summit outcomes and Ukraine diplomacy, Summit optics and political response: Ukraine / Putin / Europe; Anthony Zurcher: Trilateral summit high on spectacle, short on substance; Watch: What did Trump, Xi and Putin get out of their historic meeting?; China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars; Trump accused of falling asleep during Xi Jinping speech at Apec summit in China; New page in history? Xi, Trump and Putin summit was more of a footnote; Top House Democrat questions what Trump accomplished in Xi-Putin summit; Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in ‘humiliating decline’
- **GTA VI global launch and immediate response** (child; 3 events): GTA 6 breaks records as sales top $2.3bn - industry estimate; Grand Theft Auto fans skip work and pull all-nighters to play new instalment; UK joins in GTA 6 frenzy as game becomes available worldwide
- **Joanne Young abuse case and verdict coverage** (child; 2 events): 'The bravest woman in Britain' and 'Silence is not an option'; Joanne / Young / Joanne Young
- **European third-country asylum policy** (parent_context; 2 events); child narratives: UK–EU talks on third-country returns, Five-state Rwanda return hubs proposal: UK and EU plan first talks on sending refused asylum seekers to third countries; Five EU states announce plans for immigration ‘return hubs’ in Rwanda
- **Anthropic IPO and immediate public reaction** (child; 2 events): Anthropic / Shares / Company; Protesters rally against Anthropic in New York and San Francisco after $2tn stock market debut

## Manually labelled edge-set metrics

The fixed evaluation set is the 23 pairwise edges proposed in the original JSON. A positive means same specific event or same continuing storyline. Broader-subject-only, weak, and false-positive labels do not count as positive child-narrative links.

- Original: precision 0.739, recall 1.000, F1 0.850 (TP 17, FP 6, FN 0).
- Improved: precision 1.000, recall 1.000, F1 1.000 (TP 17, FP 0, FN 0).
- These are in-sample, snapshot-specific results: the manual rules were informed by this audit. They are not a held-out accuracy estimate and do not establish generalization.

## Trump / Xi / Putin: transitive bridge audit

The original graph has a 8-event connected component. Its `Ukraine / Putin / Europe` cluster contains three articles: Berlin talks on Ukraine, a Yalta-format live report, and a podcast asking about the Trump–Putin–Xi alliance. This cluster is a bridge: edges from that mixed cluster make summit coverage, Ukraine diplomacy, and APEC optics look like one flat narrative.

Improved hierarchy (distinct child angles under one broad parent):

- **Trilateral meeting and summit coverage**: Anthony Zurcher: Trilateral summit high on spectacle, short on substance; Watch: What did Trump, Xi and Putin get out of their historic meeting?; New page in history? Xi, Trump and Putin summit was more of a footnote; Apec summit as it happened:. Shared specific Xi–Trump–Putin/APEC meeting; pairwise links retained only where source text supports the same event.
- **Summit outcomes and Ukraine diplomacy**: Ukraine / Putin / Europe; China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars. The Ukraine cluster contains a Yalta/Ukraine report explicitly discussing the declaration and trilateral summit; other articles in that cluster remain a known mixed-topic risk.
- **Summit optics and political response**: Trump accused of falling asleep during Xi Jinping speech at Apec summit in China; Top House Democrat questions what Trump accomplished in Xi-Putin summit. A speech optics report and an explicit congressional reaction to the same summit; they are response angles, not duplicate event reports.

The following original proposed edges received broader-context-only or weak labels and therefore do not connect child narratives:

- `Ukraine / Putin / Europe` ↔ `Watch: What did Trump, Xi and Putin get out of their historic meeting?` — **related broader subject only**. The Ukraine cluster is internally mixed (Berlin talks, Yalta warning, and alliance podcast); its summit item gives only broad context for this edge.
- `Ukraine / Putin / Europe` ↔ `Top House Democrat questions what Trump accomplished in Xi-Putin summit` — **related broader subject only**. The Ukraine cluster is internally mixed (Berlin talks, Yalta warning, and alliance podcast); its summit item gives only broad context for this edge.
- `Ukraine / Putin / Europe` ↔ `Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in ‘humiliating decline’` — **related broader subject only**. The Ukraine cluster is internally mixed (Berlin talks, Yalta warning, and alliance podcast); its summit item gives only broad context for this edge.

## GTA 6

All three original events are retained: record sales, launch-night players, and worldwide availability. They describe one specific launch and its immediate response. No missed related event was identifiable in this snapshot.

## Joanne Young

The BBC front-page summary and Guardian reports concern the same survivor and abuse case. The old capitalizer missed the full person name in the BBC headline; typed alias matching recovers Joanne Young from linked article content where present. No extra related event was identifiable.

## Rwanda / asylum

Both events are retained under a parent policy subject, but not as one child event: one is UK/EU talks about third-country returns, the other is five EU states' Rwanda return hubs. No missing related event was identifiable.

## Anthropic

IPO/debut coverage and protests after the debut are retained as a continuing storyline with separate event angles. The NPR mixed headline about Anthropic's IPO plus Jeffries is not accepted as a whole-cluster link; the Anthropic item inside it is a potential article-level false negative pending facet splitting.

## Relationship-by-relationship review

See `relationship_evaluation.csv` for all original proposed edges, evidence terms, human labels, and improved decisions.

Manual labels: false positive: 1, related broader subject only: 5, same continuing storyline: 6, same specific event: 11.

## Entity extraction audit

The capitalization regex emits title-case fragments such as sentence-initial adjectives and common nouns. The improved prototype uses longest-match aliases with entity types (person, organization, location, product, event/policy), and does not promote unknown capitalization to an entity.

- **Violent** — sentence-initial adjective, not a named entity.
- **Hasina’s** — possessive surname fragment; normalize only when context/gazetteer supports Sheikh Hasina.
- **Datacentres** — common noun.
- **Haitian** — nationality adjective.
- **Bank** — common noun unless a full organization name is recognized.
- **West** — common directional word; recognize only as part of a complete location such as West Bank.
- **Isolated** — sentence-initial adjective.
- **Thrilling** — sentence-initial adjective.
- **Download** — call-to-action/common verb, not an entity.

Observed cases in this snapshot:

- `Violent` in “Violent protests and killings in Bangladesh ahead of exiled Sheikh Hasina’s planned return” — not emitted as a named entity (sentence-initial adjective, not a named entity).
- `Hasina’s` in “Violent protests and killings in Bangladesh ahead of exiled Sheikh Hasina’s planned return” — retained only within complete person entity Sheikh Hasina (possessive surname fragment; normalize only when context/gazetteer supports Sheikh Hasina).
- `Haitian` in “Florida pastor found guilty over 2021 assassination of Haitian president” — not emitted as a named entity (nationality adjective).
- `Bank` in “Israel delays building contracts for West Bank settlement after UK sanctions” — retained only within complete location entity West Bank (common noun unless a full organization name is recognized).
- `West` in “Israel delays building contracts for West Bank settlement after UK sanctions” — retained only within complete location entity West Bank (common directional word; recognize only as part of a complete location such as West Bank).
- `Isolated` in “Isolated Brazilian tribe emerges amid alarm over threats to group’s way of life” — not emitted as a named entity (sentence-initial adjective).
- `Haitian` in “Eight-year-old Haitian boy returns home after release from ICE custody” — not emitted as a named entity (nationality adjective).
- `Thrilling` in “Thrilling dark comedy starring Blake Lively and Anna Kendrick” — not emitted as a named entity (sentence-initial adjective).
- `Download` in “Download now” — not emitted as a named entity (call-to-action/common verb, not an entity).

This is a small English alias gazetteer, not a general NER model. Unseen names are omitted. No multilingual accuracy is claimed.

## News input-quality decisions

- Eligible: 101; downranked but retained: 6; excluded from narrative analysis: 1.
- `Download now` is excluded as navigation content. Podcast journalism is retained; format alone does not make an item promotional.
- Roundup headlines are retained and marked mixed-topic/downranked so they cannot bridge unrelated events as a whole.
- Items older than one year are review/downrank only; legitimate historical reporting is never automatically excluded.

- **downrank** — “Europe ready for talks with Russia on ending war in Ukraine, leaders say”: Summary is unusually short; retain the substantive headline but lower confidence pending source inspection.
- **downrank** — “Attempted murder arrest after councillor stabbed in Bradford”: Summary is unusually short; retain the substantive headline but lower confidence pending source inspection.
- **downrank** — “Dutch watchdog tells people not to buy AI smart glasses”: Summary is unusually short; retain the substantive headline but lower confidence pending source inspection.
- **downrank** — “Anthropic raises more than $100B in IPO. And, Dems nominate Jeffries for House speaker”: Mixed-topic roundup headline can bridge unrelated stories; retained but downranked.
- **downrank** — “Poppy Jay explores the appeal of being a tradwife”: Summary is unusually short; retain the substantive headline but lower confidence pending source inspection.
- **downrank** — “Thrilling dark comedy starring Blake Lively and Anna Kendrick”: Promotional wording detected; retained for manual review.
- **exclude** — “Download now”: Navigation/call-to-action title has no report content.

## Empty `topTerms` trace and prototype correction

The original JSON contains nonempty saved `topTerms` for 9/93 clusters. The source path is `scraper/clustering/tfidf.py`: `cluster_articles()` returns `topTerms: []` for every singleton cluster by design; `scraper/pipeline.py` copies `generated['topTerms']` into each saved cluster. The prototype field mapping (`cluster.get('topTerms', [])`) and JSON serialization are correct. Therefore empties are source behavior for singleton clusters, not a field-mapping or serialization bug. The improved output leaves saved terms intact and adds `derivedTopTerms` locally from article title/summary for empty clusters; no database record is changed.

## False positives, false negatives, and limits

- **False-positive/transitive example:** the mixed `Ukraine / Putin / Europe` cluster connects several summit-era stories; its weak/directly unsupported edges are parent context or rejected, not child-group links.
- **Potential false negative:** the NPR Anthropic/Jeffries roundup contains a genuine Anthropic IPO item and unrelated House-speaker news. Rejecting the whole mixed cluster avoids a bridge but misses the embedded IPO angle until article-facet splitting is implemented.
- **Other missed relationships:** none were established from this snapshot without inventing evidence. The 93 saved clusters are mostly singletons, so recall beyond the manually reviewed edges is unknown.
- **Unresolved:** split multi-topic saved clusters into read-only article facets; expand and independently validate the entity lexicon; annotate a held-out set across more feeds and time ranges; compare against an independent human gold set.

## Protection and reproducibility

The evaluator reads only `narrative_results.json` and writes local files in this directory. It does not import scraper/database modules, open MongoDB, call paid services, mutate saved clusters, or integrate the dashboard.
