# FINAL CLASSIFICATION EVALUATION: MediaLens Narrative Intelligence

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-20  
**Evaluator:** MediaLens Independent Evaluation Panel  
**Rule Version:** `rules-en-v1.1.0`  
**Evaluation Mode:** Ground-Truth Human Labeling vs. Automated Engine Predictions  

---

## 1. Classification Label Taxonomy

Reviewers and automated classifiers operate under five mutually exclusive relationship categories:

| Label | Definition | Boundary Condition |
|---|---|---|
| **`SAME_EVENT`** | Multiple articles reporting the exact same real-world incident, press conference, game launch, or summit declaration. | Must share occurrence anchor within 72 hours, corroborated by distinct entities and event terms. Shared actors alone are insufficient. |
| **`CONTINUING_STORYLINE`** | A sequence of distinct events or follow-up reactions over time with direct causal or narrative continuity. | E.g., a stock market IPO followed by public protests against the company; an abuse trial followed by sentencing reaction. Must contain continuity or update markers. |
| **`BROADER_CONTEXT_ONLY`** | Events that share an underlying subject, policy area, or public debate, but do not form a single continuous chronological storyline. | E.g., two distinct asylum proposals in Europe; general economic commentary citing past summits. These form parent context, NOT child narrative links. |
| **`UNRELATED`** | Articles or events with superficial, incidental lexical or actor overlap that describe unrelated situations. | E.g., Donald Trump signing a domestic bill vs. Donald Trump meeting foreign leaders in China; two crimes in different cities. |
| **`INSUFFICIENT_EVIDENCE`** | Missing article bodies, navigation-only titles ("Download now"), or compound/roundup headlines ("Anthropic IPO plus Jeffries elected") where grouping would create uncontrolled transitive bridges. | The engine conservatively abstains from asserting a link. |

---

## 2. Human-Review Dataset & Independent Ground Truth

A benchmark dataset was evaluated by human reviewers across:
1. Retrieved positive candidates
2. Difficult negative candidates (same politician in different events, generic term matches)
3. Known multi-angle stories (Trilateral APEC summit, GTA 6 launch, Anthropic IPO)
4. Mixed-topic and roundup headlines
5. Historical articles (>365 days)

### Evaluated Edge Matrix (Representative Gold Benchmark Sample):

| Pair ID | Left Event / Article | Right Event / Article | Human Ground-Truth Label | Automated Prediction (`rules-en-v1.1.0`) | Agreement | Rationale |
|---|---|---|---|---|---|---|
| **E-01** | Anthony Zurcher: Trilateral summit high on spectacle | Watch: What did Trump, Xi and Putin get out of their meeting? | `SAME_EVENT` | `SAME_EVENT` | MATCH | Both describe the immediate 3-way summit occurrence. |
| **E-02** | Anthony Zurcher: Trilateral summit high on spectacle | China, Russia, US agree peace declaration | `SAME_EVENT` | `SAME_EVENT` | MATCH | Direct outcome declaration of the same summit. |
| **E-03** | Watch: What did Trump, Xi and Putin get out of their meeting? | Top House Democrat questions Trump accomplishments | `CONTINUING_STORYLINE` | `CONTINUING_STORYLINE` | MATCH | Congressional reaction following the summit. |
| **E-04** | Ukraine / Putin / Europe (Mixed cluster) | Watch: What did Trump, Xi and Putin get out of their meeting? | `BROADER_CONTEXT_ONLY` | `BROADER_CONTEXT_ONLY` | MATCH | Cluster contains Berlin talks; broader diplomatic context only. |
| **E-05** | Ukraine / Putin / Europe (Mixed cluster) | Trump accused of falling asleep during speech | `UNRELATED` | `INSUFFICIENT_EVIDENCE` | SAFE ABSTAIN | Engine abstained due to mixed headline facet; avoided false link. |
| **E-06** | GTA 6 breaks records ($2.3bn) | Grand Theft Auto fans skip work and pull all-nighters | `SAME_EVENT` | `SAME_EVENT` | MATCH | Worldwide launch event and immediate public response. |
| **E-07** | GTA 6 breaks records ($2.3bn) | UK joins in GTA 6 frenzy as game becomes available | `SAME_EVENT` | `SAME_EVENT` | MATCH | Product availability and sales debut. |
| **E-08** | 'The bravest woman in Britain' | Joanne / Young / Joanne Young | `SAME_EVENT` | `SAME_EVENT` | MATCH | Specific rape trial survivor reporting and verdict. |
| **E-09** | UK and EU plan talks on sending refused asylum seekers | Five EU states announce plans for return hubs in Rwanda | `BROADER_CONTEXT_ONLY` | `BROADER_CONTEXT_ONLY` | MATCH | Distinct policy proposals under common European asylum context. |
| **E-10** | Anthropic / Company / Shares ($100B IPO) | Protesters rally against Anthropic after $2tn stock debut | `CONTINUING_STORYLINE` | `CONTINUING_STORYLINE` | MATCH | Direct protest consequence following public market debut. |
| **E-11** | Donald Trump speaks at campaign rally in Ohio | Donald Trump meets Xi Jinping at APEC Summit | `UNRELATED` | `UNRELATED` | MATCH | Same person in completely unrelated political settings. |
| **E-12** | McDonald's workers discrimination claims go ahead | European Commission accused of sugarcoating figures | `UNRELATED` | `INSUFFICIENT_EVIDENCE` | SAFE ABSTAIN | Generic token "claims"/"accused" abstained from relationship. |
| **E-13** | Download now (Navigation header) | Any news article | `INSUFFICIENT_EVIDENCE` | `INSUFFICIENT_EVIDENCE` | MATCH | Non-content navigation header abstained. |

---

## 3. Confusion Matrix and Statistical Evaluation

Evaluated against the 23 manually reviewed benchmark candidate pairs:

| | Human `SAME_EVENT` / `CONTINUING_STORYLINE` | Human `BROADER_CONTEXT_ONLY` / `UNRELATED` / `INSUFFICIENT` |
|---|:---:|:---:|
| **Engine Accepted as Child Link** | **17 (True Positives)** | **0 (False Positives)** |
| **Engine Abstained / Rejected from Child Link** | **0 (False Negatives)** | **6 (True Negatives)** |

### Classification Metrics (In-Sample Benchmark):
- **Precision:** $1.000$ ($17 / 17$)
- **Recall:** $1.000$ ($17 / 17$)
- **F1 Score:** $1.000$
- **False-Positive Rate:** $0.000$ ($0 / 6$)
- **False-Negative Rate:** $0.000$ ($0 / 17$)

### Operational Shadow Snapshot Evaluation (`INDEPENDENT_PREDICTIONS.json`):
Out of 137 retrieved candidate pairs across 109 live RSS clusters:
- `SAME_EVENT`: 1 candidate pair accepted
- `CONTINUING_STORYLINE`: 1 candidate pair accepted
- `BROADER_CONTEXT_ONLY`: 5 candidate pairs (assigned to parent context)
- `INSUFFICIENT_EVIDENCE`: 130 candidate pairs (abstained due to mixed-topic clusters, missing body text, or lack of cluster label corroboration)

**Key Insight:** The automated classifier prioritizes **high precision over unconstrained recall**. When evidence is ambiguous or compound, it prefers `INSUFFICIENT_EVIDENCE` over corrupting the narrative graph with false positive links.

