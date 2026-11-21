# FINAL EVIDENCE RECONCILIATION: Narrative Intelligence Subsystem

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-20  
**Auditor:** MediaLens Independent Evaluation & Quality Review Panel  
**Operating State:** Shadow Mode Active (`rules-en-v1.1.0`)  
**Scope:** Forensic Provenance Audit, Metric Recalculation, Retrieval Recall Baseline, Human Review State, and Gap Analysis  

---

## 1. Reconciliation of the Evaluation Contradiction

### 1.1 The Identified Contradiction
Previous reports presented a paradoxical juxtaposition:
1. `FINAL_CLASSIFICATION_EVALUATION.md` cited **23 human-verified benchmark pairs** with a precision of **1.000**, recall of **1.000**, and F1 of **1.000**.
2. `FINAL_ACCURACY_EVALUATION.md` explicitly noted that **"Independent accuracy has not been demonstrated"**, that `INDEPENDENT_TEST_CASES.csv` had **0 completed human labels**, and that the 23 relationships in `relationship_evaluation.csv` were **in-sample development examples** used to tune prototype logic.

### 1.2 Forensic Provenance of the 23 Ground-Truth Labels
A strict inspection of `prototypes/narrative_readonly/improve_and_evaluate.py:148-196` and `accuracy_audit.md` establishes the true origin:
- **Originating Code:** The 23 pairs were extracted from the 23 graph links of the initial flat connected-component prototype output (`narrative_results.json`, a 108-article snapshot).
- **Label Assignment:** The labels in `relationship_evaluation.csv` were assigned directly by the automated developer script (`manual_label()` in `improve_and_evaluate.py`), which hard-coded exact string matches for `Anthony Zurcher`, `Ukraine / Putin / Europe`, `GTA 6`, `Joanne Young`, `UK and EU plan first talks`, and `Anthropic / Shares / Company`.
- **Developer vs. Independent Review:** These labels were created by the prototype author during development to diagnose where flat lexical clustering failed. They were **not** produced by an independent double-blind human panel.
- **Tuning Contamination:** The rules implemented in `predict_pair()` (`improve_and_evaluate.py:199-245`) and later codified into `narrativeEngine.ts` were specifically designed and tuned to satisfy these exact 23 pairs.
- **Sequence of Execution:** Prediction logic was formulated *after* inspecting these 23 pairs.

### 1.3 Strict Dataset Classification
Under rigorous machine learning evaluation standards:
$$\text{Status} = \mathbf{Regression\ /\ In-Sample\ Development\ Benchmark}$$
- **Not Held-Out Data:** The 23 pairs cannot be characterized as held-out test data.
- **Not Independent Gold Data:** Because no blinded external annotators provided these labels, describing this set as an "independent evaluation test set" was factually incorrect in prior reports.
- **Valid Role:** The 23 pairs serve as an **in-sample regression test suite** to guarantee that known edge behaviors (e.g. rejecting the Ukraine bridge) remain stable across code refactors.

---

## 2. Metric Recalculation from Actual Evidence

### 2.1 The 23-Row Evaluation Breakdown
Every row of `prototypes/narrative_readonly/relationship_evaluation.csv` was audited across the 5 granular categories:

| Target Class | Row Indices (1-based from CSV) | Count | Automated Engine Prediction |
|---|---|:---:|---|
| **`SAME_EVENT`** | Rows 7, 8, 9, 10, 12, 14, 16, 18, 19, 20, 21 | 11 | 11 predicted `accepted_same_event` |
| **`CONTINUING_STORYLINE`** | Rows 2, 4, 11, 15, 17, 23 | 6 | 6 predicted `accepted_continuing_storyline` |
| **`BROADER_CONTEXT_ONLY`** | Rows 1, 5, 6, 13, 22 | 5 | 5 predicted `parent_context_only` |
| **`UNRELATED` (False Positive)** | Row 3 (`Ukraine` $\leftrightarrow$ `Trump speech optics`) | 1 | 1 predicted `rejected_weak` |
| **`INSUFFICIENT_EVIDENCE`** | *(None in the 23 development links)* | 0 | 0 |
| **Total Benchmark Rows** | | **23** | **23** |

### 2.2 Confusion Matrix (Target: Child Narrative Link)
When evaluating the binary task of **Child Narrative Link Inclusion** ($\text{Positive} = \{\text{SAME\_EVENT}, \text{CONTINUING\_STORYLINE}\}$; $\text{Negative} = \{\text{BROADER\_CONTEXT\_ONLY}, \text{UNRELATED}, \text{INSUFFICIENT\_EVIDENCE}\}$):

```
                       Actual Positive (Child)   Actual Negative (Non-Child)
Predicted Positive               17                          0
Predicted Negative                0                          6
```

- **In-Sample Regression Accuracy:** $23 / 23 = 100\%$
- **In-Sample Regression Precision:** $17 / 17 = 1.000$
- **In-Sample Regression Recall:** $17 / 17 = 1.000$
- **In-Sample Regression F1:** $1.000$

> [!IMPORTANT]
> **Evaluation Boundary:** These metrics demonstrate that the rule engine achieved $100\%$ adherence to its development specifications on the regression suite. They **do not** prove generalizable $1.000$ precision or recall on unseen RSS news data.

### 2.3 Operational Granular Classification (`INDEPENDENT_PREDICTIONS.json`)
On the live production MongoDB dataset (125 articles, 109 event clusters, 137 retrieved candidate pairs):
- `SAME_EVENT`: **1 pair** (0.7%)
- `CONTINUING_STORYLINE`: **1 pair** (0.7%)
- `BROADER_CONTEXT_ONLY`: **5 pairs** (3.6%)
- `INSUFFICIENT_EVIDENCE`: **130 pairs** (94.9%)
- `UNRELATED`: **0 pairs** (pruned prior to candidate persistence or rejected)

**Abstention Accounting:** $94.9\%$ of live candidates resulted in `INSUFFICIENT_EVIDENCE`. In an operational setting, this reflects an ultra-conservative defense mechanism against false narrative merges, but it prevents claiming high recall on generic live articles.

---

## 3. Verification of Candidate Retrieval Recall

### 3.1 Retrieval Recall Denominator Analysis
- **On the 23 Regression Pairs:** All 17 positive pairs were originally generated by flat TF-IDF links in `narrative_results.json`. The inverted-index candidate generator in `narrativeEngine.ts` retrieves all 17 pairs when provided with the 108-article snapshot.
- **On the Live 125-Article Dataset:**
  - `INDEPENDENT_TEST_CASES.csv` documents that for the uncurated live snapshot, known candidate pairs for **GTA 6** (`R003`, `R004`), **Joanne Young** (`R005`), and **Rwanda/Asylum** (`R006`) were **`NOT_RETRIEVED`** by the live inverted index because the live event clusters lacked the required title term or high-signal entity overlap.
- **Formal Retrieval Recall Determination:**
  $$\mathbf{Retrieval\ Recall\ on\ Independent\ Held-Out\ Data:\ NOT\ INDEPENDENTLY\ ESTABLISHED}$$
  The $100\%$ recall figure belongs strictly to the 23 regression examples. True retrieval recall on open-ended RSS news remains unquantified until an external held-out corpus with verified negative and positive pairings is labeled.

---

## 4. Verification of Known Domain Themes

| Theme | Underlying Evidence | Ground-Truth Category | System Classification | Consistency Verification |
|---|---|---|---|:---:|
| **GTA 6 Launch** | 3 articles covering sales ($2.3B), fan all-nighters, and worldwide release within a 48-hour window. | `SAME_EVENT` | `SAME_EVENT` (Regression) / `NOT_RETRIEVED` (Live cluster index) | **CONSISTENT**: All 3 describe the same real-world event. Not forced into continuing storyline. |
| **Joanne Young** | BBC summary vs. Guardian coverage of the same rape trial verdict and survivor testimony. | `SAME_EVENT` | `SAME_EVENT` (Regression) / `NOT_RETRIEVED` (Live cluster index) | **CONSISTENT**: Same judicial occurrence. Correctly distinguishes specific case from general crime. |
| **Rwanda / Asylum** | UK-EU bilateral negotiations on returns vs. 5 EU member states proposing return hubs in Rwanda. | `BROADER_CONTEXT_ONLY` | `BROADER_CONTEXT_ONLY` | **CONSISTENT**: Correctly kept separate as distinct state policy proposals under a parent context. |
| **APEC Summit** | Trilateral Xi-Trump-Putin meeting, formal peace declaration, congressional reaction, and speech optics. | Multi-tier: `SAME_EVENT` (Summit), `CONTINUING_STORYLINE` (House reaction), `BROADER_CONTEXT_ONLY` (Optics) | Formed 3 distinct child storylines under parent context | **CONSISTENT**: Distinct diplomatic and political angles are not flattened into one event. |
| **Anthropic IPO** | $100B stock market debut on Nasdaq followed by public activist protests in NY and SF. | `CONTINUING_STORYLINE` | `CONTINUING_STORYLINE` | **CONSISTENT**: Distinct subsequent development causally linked to market debut. |

---

## 5. Audit of Human Review State

The review worksheet (`HUMAN_REVIEW_WORKSHEET.csv`), test cases (`INDEPENDENT_TEST_CASES.csv`), and live MongoDB collections were reconciled:

| Metric | Recorded Value | Source File / Collection |
|---|:---:|---|
| **Total Worksheet Items** | 15 | `HUMAN_REVIEW_WORKSHEET.csv` |
| **Confirmed Review Decisions** | 13 | `HUMAN_REVIEW_WORKSHEET.csv` (Rows 2–14) |
| **Pending Review Decisions** | 2 | `HUMAN_REVIEW_WORKSHEET.csv` (Rows 15–16: `event-unreviewed-candidate-*`) |
| **Independent External Annotators** | **0** | All existing confirmed reviews are developer/internal sanity checks. |
| **Reviewer Disagreements Recorded** | **0** | No dual-blind adjudication has been conducted (`reviewDisagreement: NO`). |
| **Live Database Candidate Reviews** | **0 reviewed** | All 137 live relationships in `narrative_relationships` remain `reviewStatus: "NEEDS_REVIEW"` or `"PENDING"`. |

> [!NOTE]
> No automated engine prediction in MongoDB has been treated as human approval. All live proposals remain in `shadowMode: true` with review status `NEEDS_REVIEW`.

---

## 6. Identified Evidence Gaps & Operational Constraints

1. **Absence of Blind Multi-Annotator Gold Set:** No external journalist or independent researcher has labeled a held-out set of candidate pairs.
2. **Entity Gazetteer Coverage Limits:** `ALIASES` contains ~50 entries. Entities outside this gazetteer cannot create high-signal candidate pairs or same-event links.
3. **High Abstention on Real-World Clusters:** The engine requires both article-level evidence and event-cluster label corroboration. If upstream TF-IDF generates an uncorroborated label (e.g. `Eu Uk / Deal / Food`), the narrative layer conservatively abstains.
4. **Monolingual Evaluation:** Evaluation is restricted to English-language RSS feeds (BBC, NPR, The Guardian).

---

## 7. Final Operational Readiness Confirmation

The findings of this evidence reconciliation **fully support and uphold** the declared operational status:

> ### **STATUS: Limited Internal Narrative Review Ready**

- **Why Not "Not Ready"?** Engineering reliability, persistence, crash recovery, UI review actions, and regression accuracy are completely validated.
- **Why Not "Production Categorization Ready"?** In-sample regression metrics ($F_1 = 1.000$) cannot substitute for independent held-out evaluation.
- **Operational Directive:** Maintain `NARRATIVE_SHADOW_MODE=true`. Present all narrative outputs as candidate proposals requiring human review.

