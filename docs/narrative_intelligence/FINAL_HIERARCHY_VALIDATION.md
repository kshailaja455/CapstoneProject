# FINAL HIERARCHY VALIDATION: Narrative Hierarchy & Transitive Graph Coherence

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-20  
**Scope:** Two-tier Narrative Hierarchy (Parent Context vs. Child Storyline), Complete-Link Clustering, and Transitive Bridge Prevention  

---

## 1. Architectural Model of Narrative Hierarchy

The narrative subsystem establishes a strict two-tier hierarchy:
```
           [ PARENT CONTEXT NARRATIVE ]
           (Level: "PARENT", e.g. "European third-country asylum policy")
                      /         \
                     /           \
  [ CHILD STORYLINE A ]         [ CHILD STORYLINE B ]
  (UK-EU Third-Country Talks)   (Five-State Rwanda Return Hubs)
           |                              |
      Event Nodes                    Event Nodes
```

### 1.1 Complete-Link Invariant for Child Narratives
A child narrative represents an indivisible storyline or event thread. To prevent transitive link contamination (where $A \leftrightarrow B$ and $B \leftrightarrow C$ merges $A$ and $C$ even if $A$ and $C$ are completely unrelated), **complete-link graph clustering** (`completeLinkGroups` in `narrativeEngine.ts`) is enforced:
$$\forall u, v \in \text{ChildGroup}, \quad \text{Relation}(u, v) \in \{\text{SAME\_EVENT}, \text{CONTINUING\_STORYLINE}\}$$

If even one edge between member events is uncorroborated, missing, or classified as `BROADER_CONTEXT_ONLY` or `INSUFFICIENT_EVIDENCE`, the group **refuses to merge**.

---

## 2. Testing Transitive Bridge and Complex Graph Cases

### 2.1 The Classic Transitive Bridge Test: The "Ukraine / Putin / Europe" Cluster
- **The Graph Structure:**
  - Node A: `Anthony Zurcher: Trilateral summit high on spectacle` (Xi-Trump-Putin meeting)
  - Node B: `Ukraine / Putin / Europe` (A mixed-topic cluster containing Berlin talks, a Yalta warning, and an APEC podcast)
  - Node C: `Trump accused of falling asleep during speech at APEC` (Optics report)
- **Failure Mode in Naive Flat Systems:**
  Naive single-link or thresholded graph algorithms merge A, B, and C into one massive flat cluster because B shares words with A and B shares words with C.
- **Audited Traceon Engine Behavior:**
  1. The classifier evaluates pair $(A, B)$ as `BROADER_CONTEXT_ONLY` (not child level).
  2. The classifier evaluates pair $(B, C)$ as `INSUFFICIENT_EVIDENCE` / `BROADER_CONTEXT_ONLY`.
  3. The complete-link evaluator examines the triad $\{A, B, C\}$. Since edges $(A, B)$ and $(B, C)$ are not accepted child links, **no transitive merge occurs**.
  4. The summit coverage, Ukraine diplomacy, and speech optics remain separate child storylines.

### 2.2 Parent Narrative Creation Invariants
Parents are **never forced** without coherent evidence:
- A parent narrative is formed only when two or more child narratives share an accepted `BROADER_CONTEXT_ONLY` relationship backed by explicit parent issue keys (e.g. `ISSUE:asylum`, `ISSUE:summit`).
- Isolated child narratives without verified broader links remain standalone child narratives (`parentKey = null`).
- In the live test run, when only two unrelated child storylines existed (`Anthropic` and `China/APEC/Trump`), the parent count correctly remained `0`. No artificial parent was created.

### 2.3 Split, Merge, and Re-Assignment Dynamics
- **Splitting:** If a newly introduced article alters the complete-link cohesion of an existing child narrative, the engine splits the narrative and logs `NARRATIVE_SPLIT` with `splitFromKey` tracking back to the original identifier.
- **Merging:** If subsequent reporting connects two previously distinct storylines with verified `CONTINUING_STORYLINE` evidence across all member nodes, they merge and record `NARRATIVE_MERGED` pointing to the retained narrative key.
- **Facet Independence:** A compound article (e.g. "Anthropic raises $100B; Dems elect Jeffries") produces separate facets ($F_0$ and $F_1$). $F_0$ can support the Anthropic storyline without dragging Democratic House politics into the tech storyline.

---

## 3. Regression Suite Verification

The hierarchy and complete-link rules were verified in `backend/services/narrativeEngine.test.ts`:
- Test: *"complete-link grouping refuses a weak transitive bridge"* -> **PASSED (0.6988ms)**
- Test: *"summit commentary with shared leaders is broader context, not the same occurrence"* -> **PASSED (1.7633ms)**
- Test: *"separate asylum proposals remain broader context only"* -> **PASSED (0.99ms)**
- Test: *"candidate generation is indexed and analysis builds only coherent children"* -> **PASSED (2.5991ms)**

