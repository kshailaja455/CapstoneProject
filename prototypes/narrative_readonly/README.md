# Read-only narrative detection prototype

This prototype reads the existing `articles` and `clusters` collections and writes local report files only. It does not import the production MongoDB helper (which creates indexes), and it does not issue MongoDB writes.

The detector treats each saved cluster as an event, builds a TF-IDF representation from its real article titles, RSS summaries, and extracted body text, and compares different events. Named-entity evidence is extracted from headlines only because RSS summaries can include roundup text and unrelated background names. The results are review candidates, not verified causal claims.

The HTML and Markdown reports show proposed groups, article-level evidence, low-confidence links, and likely false positives. Article bodies are not copied into the reports. The evidence links open the original publisher URLs for manual inspection.

From the repository root, run:

```powershell
python prototypes/narrative_readonly/run_prototype.py
```

Optional flags: `--mongo-uri`, `--database`, `--output-dir`, `--min-cosine`, and `--max-weak-links`.

## Offline accuracy evaluation

To compare the original saved result with the dataset-audited hierarchical prototype, run:

```powershell
python prototypes/narrative_readonly/improve_and_evaluate.py
```

This command reads only `output/narrative_results.json`; it does not connect to MongoDB or the production application. It writes `accuracy_audit.md`, `improved_narrative_results.json`, and `relationship_evaluation.csv` in this directory. The relationship labels are manually reviewed for this snapshot, and the measured metrics are in-sample; they are not a held-out accuracy estimate.
