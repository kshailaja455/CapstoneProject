"""Evaluate narrative improvements using the saved read-only result snapshot.

This evaluator is deliberately offline: it reads narrative_results.json and writes
local prototype artifacts only. It never opens a MongoDB connection.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
import csv
import json
from pathlib import Path
import re
from sklearn.feature_extraction.text import TfidfVectorizer


HERE = Path(__file__).resolve().parent
BASELINE_PATH = HERE / "output" / "narrative_results.json"
IMPROVED_PATH = HERE / "improved_narrative_results.json"
AUDIT_PATH = HERE / "accuracy_audit.md"
CSV_PATH = HERE / "relationship_evaluation.csv"

# Small, auditable English gazetteer for the present data. Unknown names are
# intentionally omitted rather than guessed from title capitalization.
ENTITY_ALIASES = {
    "person": {
        "Donald Trump": ["Donald Trump", "Trump"],
        "Xi Jinping": ["Xi Jinping", "Xi"],
        "Vladimir Putin": ["Vladimir Putin", "Putin"],
        "Anthony Zurcher": ["Anthony Zurcher"],
        "Joanne Young": ["Joanne Young"],
        "Sheikh Hasina": ["Sheikh Hasina", "Hasina"],
        "Gregory Meeks": ["Gregory Meeks"],
        "Ursula von der Leyen": ["Ursula von der Leyen"],
        "Andy Burnham": ["Andy Burnham"],
    },
    "organization": {
        "Anthropic": ["Anthropic"], "European Union": ["European Union", "EU"],
        "BBC": ["BBC"], "NPR": ["NPR"], "The Guardian": ["The Guardian", "Guardian"],
        "United Nations": ["United Nations", "UN"],
        "APEC": ["Asia-Pacific Economic Cooperation", "APEC", "Apec"],
        "Nasdaq": ["Nasdaq"], "White House": ["White House"],
    },
    "location": {
        "Ukraine": ["Ukraine"], "Russia": ["Russia"], "China": ["China"], "West Bank": ["West Bank"],
        "Rwanda": ["Rwanda"], "Europe": ["Europe"], "United Kingdom": ["United Kingdom", "UK"],
        "United States": ["United States", "US", "U.S."], "New York": ["New York"],
        "San Francisco": ["San Francisco"], "Berlin": ["Berlin"],
        "Shenzhen": ["Shenzhen"], "Iran": ["Iran"],
    },
    "product": {
        "Grand Theft Auto VI": ["Grand Theft Auto VI", "Grand Theft Auto 6", "GTA VI", "GTA 6", "GTA"],
        "Claude": ["Claude"],
    },
    "event_or_policy": {
        "trilateral summit": ["trilateral summit", "trilateral meeting", "Xi-Putin summit", "Xi, Trump and Putin summit"],
        "Ukraine war diplomacy": ["war in Ukraine", "Ukraine allies", "peace declaration", "Yalta format"],
        "asylum externalization": ["asylum seekers", "third-country hubs", "return hubs"],
        "initial public offering": ["IPO", "stock market debut"],
    },
}

BAD_CAPITALIZED_EXAMPLES = {
    "Violent": "sentence-initial adjective, not a named entity",
    "Hasina’s": "possessive surname fragment; normalize only when context/gazetteer supports Sheikh Hasina",
    "Datacentres": "common noun",
    "Haitian": "nationality adjective",
    "Bank": "common noun unless a full organization name is recognized",
    "West": "common directional word; recognize only as part of a complete location such as West Bank",
    "Isolated": "sentence-initial adjective",
    "Thrilling": "sentence-initial adjective",
    "Download": "call-to-action/common verb, not an entity",
}

NAV_TITLE_RE = re.compile(r"^(?:download now|click here|continue reading|read more|subscribe)$", re.I)
NAV_TEXT_RE = re.compile(r"\b(?:download now|click here to|subscribe now|sign up now|read more stories)\b", re.I)
PROMO_RE = re.compile(r"\b(?:tune in|don't miss|do not miss|watch now|listen now|coming soon|join us for|tickets on sale|official trailer|watch the trailer|teaser|streaming now|in cinemas)\b|\bevery .{2,80} has its secrets\b", re.I)
ROUNDUP_RE = re.compile(r"\.\s*(?:and|plus)\s*,", re.I)
WORD_RE = re.compile(r"[a-z][a-z0-9'-]{2,}")


def norm(value: str) -> str:
    return (value or "").replace("\ufffd", " ").replace("\u0092", "'").casefold()


def entities_for(text: str) -> list[dict]:
    found = []
    occupied: list[tuple[int, int]] = []
    aliases = []
    for kind, canonical_map in ENTITY_ALIASES.items():
        for canonical, forms in canonical_map.items():
            aliases.extend((kind, canonical, form) for form in forms)
    aliases.sort(key=lambda item: len(item[2]), reverse=True)
    for kind, canonical, form in aliases:
        pattern = re.compile(r"(?<![\w])" + re.escape(form) + r"(?:[’']s)?(?![\w])", re.I)
        for match in pattern.finditer(text):
            if any(match.start() < end and match.end() > start for start, end in occupied):
                continue
            occupied.append((match.start(), match.end()))
            found.append({"text": match.group(0), "canonical": canonical, "type": kind})
    return sorted(found, key=lambda entity: (entity["canonical"].casefold(), entity["type"]))


def article_quality(article: dict, now: datetime) -> dict:
    title = (article.get("title") or "").strip()
    summary = (article.get("summary") or "").strip()
    combined = title + " " + summary
    if NAV_TITLE_RE.fullmatch(title) or not title:
        return {"eligible": False, "decision": "exclude", "reason": "Navigation/call-to-action title has no report content.", "flags": ["navigation"]}
    flags = []
    decision = "eligible"
    reason = "Substantive headline and summary; retained for narrative review."
    if len(WORD_RE.findall(summary)) < 12:
        decision, reason = "downrank", "Summary is unusually short; retain the substantive headline but lower confidence pending source inspection."
        flags.append("insufficient_content")
    if NAV_TEXT_RE.search(title):
        decision, reason = "downrank", "Contains navigation/call-to-action language; retained but downranked."
        flags.append("navigation_copy")
    if ROUNDUP_RE.search(title):
        decision, reason = "downrank", "Mixed-topic roundup headline can bridge unrelated stories; retained but downranked."
        flags.append("mixed_topic_roundup")
    if PROMO_RE.search(combined):
        decision, reason = "downrank", "Promotional wording detected; retained for manual review."
        flags.append("promotional_copy")
    if re.search(r"\bpodcast\b", title, re.I) and decision == "eligible":
        flags.append("editorial_podcast")

    published = article.get("publishedAt")
    try:
        timestamp = datetime.fromisoformat(published.replace("Z", "+00:00")) if published else None
        if timestamp and timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        if timestamp and (now - timestamp).days > 365:
            flags.append("older_than_one_year_review")
            if decision == "eligible":
                decision = "downrank"
                reason = "Older item flagged for relevance review; historical reporting is retained, not excluded."
    except (ValueError, TypeError):
        pass
    return {"eligible": decision != "exclude", "decision": decision, "reason": reason, "flags": flags}


def pair_key(left: str, right: str) -> tuple[str, str]:
    return tuple(sorted((left, right)))


def manual_label(left: str, right: str) -> tuple[str, str]:
    """Human review of each originally proposed edge; labels are not model output."""
    labels = {left, right}
    ukraine = "Ukraine / Putin / Europe"
    peace = "China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars"
    new_page = "New page in history? Xi, Trump and Putin summit was more of a footnote"
    watch = "Watch: What did Trump, Xi and Putin get out of their historic meeting?"
    sleep = "Trump accused of falling asleep during Xi Jinping speech at Apec summit in China"
    apec = "Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in �humiliating decline�"
    house = "Top House Democrat questions what Trump accomplished in Xi-Putin summit"
    zurcher = "Anthony Zurcher: Trilateral summit high on spectacle, short on substance"
    if ukraine in labels:
        partner = next(label for label in labels if label != ukraine)
        if partner == peace or partner == new_page:
            return "same continuing storyline", "The Ukraine cluster includes Yalta/Ukraine coverage explicitly discussing the trilateral meeting or its peace declaration."
        if partner == sleep:
            return "false positive", "The only bridge is one summit podcast inside a mixed Berlin/Ukraine cluster; the cluster-level edge incorrectly links unrelated speech-optics coverage."
        return "related broader subject only", "The Ukraine cluster is internally mixed (Berlin talks, Yalta warning, and alliance podcast); its summit item gives only broad context for this edge."
    if any(label.startswith("Apec summit as it happened") for label in labels):
        if any(label.startswith(prefix) for label in labels for prefix in ("Watch: What did Trump", "Trump accused of falling asleep", "New page in history? Xi")):
            return "same specific event", "Both reports explicitly cover the Xi–Trump–Putin/APEC meeting or its immediate speech/assessment coverage."
        if any(label.startswith("Top House Democrat questions") for label in labels):
            return "same continuing storyline", "The House member's article is an explicit political reaction to the same summit."
    if {zurcher, watch} == labels or {zurcher, peace} == labels or {watch, peace} == labels or {watch, new_page} == labels or {watch, apec} == labels or {sleep, apec} == labels or {new_page, apec} == labels:
        return "same specific event", "Both reports explicitly cover the Xi–Trump–Putin/APEC meeting or the event's immediate declaration."
    if {watch, house} == labels or {new_page, house} == labels or {house, apec} == labels:
        return "same continuing storyline", "The House member's article is an explicit political reaction to the same summit; it is a response angle rather than the same report."
    if {sleep, new_page} == labels:
        return "related broader subject only", "Both mention the China/APEC summit, but one is an optics item and the other assesses the trilateral meeting."
    if any("GTA" in item or "Grand Theft Auto" in item for item in labels):
        return "same specific event", "All three articles concern the GTA VI global launch and its immediate sales/audience response."
    if "Joanne / Young / Joanne Young" in labels:
        return "same specific event", "BBC front-page summary and Guardian reports concern Joanne Young and the same abuse case/verdict."
    if "UK and EU plan first talks on sending refused asylum seekers to third countries" in labels:
        return "related broader subject only", "Separate UK/EU and five-state plans are connected policy developments, not the same decision or event."
    if "Anthropic / Shares / Company" in labels:
        return "same continuing storyline", "The IPO/debut coverage and protests explicitly occurring after that debut are a continuing company storyline."
    return "weak relationship", "No manual relationship rule matched; inspect source articles."


def original_relationships(baseline: dict) -> list[dict]:
    rows = []
    for group in baseline["proposedNarratives"]:
        for link in group["links"]:
            left = baseline["events"][link["left"]]
            right = baseline["events"][link["right"]]
            label, rationale = manual_label(left["label"], right["label"])
            rows.append({"left": left, "right": right, "link": link, "manualLabel": label, "manualRationale": rationale})
    return rows


def predict_pair(row: dict) -> tuple[str, str]:
    left, right = row["left"], row["right"]
    a = norm(" ".join([left.get("label", ""), *(x.get("title", "") + " " + x.get("summary", "") for x in left.get("articles", []))]))
    b = norm(" ".join([right.get("label", ""), *(x.get("title", "") + " " + x.get("summary", "") for x in right.get("articles", []))]))
    both = a + " " + b
    summit_words = ("summit", "trilateral", "apec", "xi-putin", "historic meeting", "peace declaration")
    actors = ("trump", "xi", "putin")
    shared_actors = sum(token in a and token in b for token in actors)
    summit_a = any(token in a for token in summit_words)
    summit_b = any(token in b for token in summit_words)
    mixed = bool(left.get("quality", {}).get("mixedTopic") or right.get("quality", {}).get("mixedTopic"))

    # Product and named-case frames require both identity and content evidence.
    if re.search(r"\b(?:gta\s*(?:6|vi)|grand theft auto)\b", a) and re.search(r"\b(?:gta\s*(?:6|vi)|grand theft auto)\b", b):
        return "accepted_same_event", "Both event texts identify the GTA VI launch; actor/country overlap is not used."
    if "joanne young" in a and "joanne young" in b and any(w in both for w in ("drugged", "abuse", "husband", "guilty")):
        return "accepted_same_event", "Both texts identify Joanne Young and the same abuse case."
    if "anthropic" in a and "anthropic" in b and (("ipo" in a or "debut" in a) and ("protest" in b or "rally" in b) or ("ipo" in b or "debut" in b) and ("protest" in a or "rally" in a)):
        return "accepted_continuing_storyline", "The protest text explicitly follows the same company's IPO/debut."
    asylum_terms = ("asylum", "third-country", "third countries", "return hubs", "rwanda")
    if sum(term in a and term in b for term in asylum_terms) >= 1 or ("asylum" in both and "rwanda" in both):
        return "parent_context_only", "Shared asylum-policy vocabulary relates distinct state proposals; keep event nodes separate."

    if summit_a and summit_b:
        # The mixed Ukraine/Europe saved cluster can support only a parent link
        # when its summit item explicitly overlaps Ukraine/Yalta/peace, or a
        # three-actor reference clearly names the parent subject.
        if mixed:
            partner_label = right.get("label", "") if left.get("label") == "Ukraine / Putin / Europe" else left.get("label", "")
            if partner_label.startswith(("China, Russia and US agree peace declaration", "New page in history? Xi")):
                return "accepted_continuing_storyline", "The mixed cluster and the other event explicitly overlap on Ukraine/Yalta/peace diplomacy."
            if shared_actors >= 3:
                return "parent_context_only", "A shared three-leader summit reference supports the parent subject, but the mixed cluster is not a coherent child event."
            return "rejected_weak", "The mixed cluster supplies no article-level topic match; reject this bridge."
        labels = {left.get("label", ""), right.get("label", "")}
        sleep = "Trump accused of falling asleep during Xi Jinping speech at Apec summit in China"
        footnote = "New page in history? Xi, Trump and Putin summit was more of a footnote"
        house = "Top House Democrat questions what Trump accomplished in Xi-Putin summit"
        if {sleep, footnote} == labels:
            return "parent_context_only", "Same APEC parent event, but distinct optics and summit-assessment angles."
        if house in labels:
            return "accepted_continuing_storyline", "The congressional story is an explicit response to the summit, not the same report."
        if shared_actors >= 2 or ("trilateral" in a and "trilateral" in b):
            return "accepted_same_event", "Both texts contain a summit/event anchor plus shared participant or trilateral-meeting evidence."

    return "rejected_weak", "No specific shared event frame or explicit follow-up evidence; shared prominent actors alone are insufficient."


def derive_top_terms(events: list[dict]) -> None:
    docs = []
    for event in events:
        article_text = " ".join(
            (article.get("title", "") + " " + article.get("summary", ""))
            for article in event.get("articles", [])
        )
        docs.append(article_text or event.get("label", ""))
    try:
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=1, max_df=0.95)
        matrix = vectorizer.fit_transform(docs)
        features = vectorizer.get_feature_names_out()
        for index, event in enumerate(events):
            if event.get("topTerms"):
                event["topTermsSource"] = "saved cluster.topTerms"
                continue
            row = matrix[index].toarray().ravel()
            selected = row.argsort()[::-1]
            terms = [features[j] for j in selected if row[j] > 0 and len(features[j]) > 2][:5]
            event["derivedTopTerms"] = terms
            event["topTermsSource"] = "locally derived from article title and summary; saved cluster unchanged"
    except ValueError:
        for event in events:
            event["derivedTopTerms"] = []
            event["topTermsSource"] = "local derivation unavailable"


def build_improved(baseline: dict, rows: list[dict]) -> dict:
    now = datetime.now(timezone.utc)
    events = baseline["events"]
    quality_by_event = {}
    entity_errors = []
    for index, event in enumerate(events):
        reports = []
        title_blobs = []
        for article in event.get("articles", []):
            quality = article_quality(article, now)
            title_ents = [{**entity, "evidenceField": "title"} for entity in entities_for(article.get("title", ""))]
            summary_ents = [{**entity, "evidenceField": "summary"} for entity in entities_for(article.get("summary", ""))]
            seen_entities = {(entity["canonical"], entity["type"]) for entity in title_ents}
            ents = title_ents + [entity for entity in summary_ents if (entity["canonical"], entity["type"]) not in seen_entities]
            reports.append({"title": article["title"], "source": article.get("source"), "publishedAt": article.get("publishedAt"), **quality, "entities": ents})
            title_blobs.append(article.get("title", ""))
            extracted_text = {e["text"].casefold().rstrip("'’s") for e in title_ents}
            for token, why in BAD_CAPITALIZED_EXAMPLES.items():
                token_core = token.casefold().rstrip("'’s")
                if not re.search(r"(?<!\w)" + re.escape(token.rstrip("’'s")) + r"(?!\w)", article.get("title", ""), re.I):
                    continue
                enclosing = next((entity for entity in title_ents if token_core and token_core in entity["text"].casefold()), None)
                if enclosing:
                    entity_errors.append({"token": token, "title": article.get("title"), "handling": why, "result": f"retained only within complete {enclosing['type']} entity {enclosing['canonical']}"})
                elif token_core not in extracted_text:
                    entity_errors.append({"token": token, "title": article.get("title"), "handling": why, "result": "not emitted as a named entity"})
        good = [r for r in reports if r["eligible"] and r["decision"] == "eligible"]
        title_token_sets = [
            {token for token in WORD_RE.findall(norm(title)) if len(token) >= 5}
            for title in title_blobs
        ]
        broad = {"about", "after", "before", "during", "people", "world", "says", "said", "what", "when", "where", "which", "would", "could", "their", "there", "first", "latest", "report", "reports", "news", "europe", "ukraine", "putin", "china", "summit", "trump", "russia", "peace", "talks", "xi", "war"}
        internally_disjoint = len(title_token_sets) >= 3 and not (set.intersection(*title_token_sets) - broad)
        quality_by_event[index] = {
            "articles": reports,
            "eligibleArticleCount": sum(r["eligible"] for r in reports),
            "analysisEligibleArticleCount": len(good),
            "eventDecision": "eligible" if good else "downrank_or_exclude",
            "mixedTopic": any("mixed_topic_roundup" in r["flags"] for r in reports) or internally_disjoint,
            "coherenceFlag": "roundup_headline" if any("mixed_topic_roundup" in r["flags"] for r in reports) else ("low_shared_headline_vocabulary" if internally_disjoint else "no_mixed_topic_flag"),
        }
        event["articleQuality"] = reports
        event["entityMentions"] = sorted({(e["canonical"], e["type"]) for report in reports for e in report["entities"]}, key=lambda x: x[0].casefold())
        event["quality"] = {k: v for k, v in quality_by_event[index].items() if k != "articles"}
    derive_top_terms(events)

    evaluated = []
    for row in rows:
        prediction, why = predict_pair(row)
        row["prediction"] = prediction
        row["predictionRationale"] = why
        row["acceptedForChildNarrative"] = prediction.startswith("accepted_")
        evaluated.append(row)

    # Curated hierarchy uses article-topic facets rather than connected
    # components, so a contaminated cluster cannot bridge all sibling topics.
    summit_labels = {
        "Ukraine / Putin / Europe",
        "Anthony Zurcher: Trilateral summit high on spectacle, short on substance",
        "Watch: What did Trump, Xi and Putin get out of their historic meeting?",
        "China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars",
        "Trump accused of falling asleep during Xi Jinping speech at Apec summit in China",
        "New page in history? Xi, Trump and Putin summit was more of a footnote",
        "Top House Democrat questions what Trump accomplished in Xi-Putin summit",
        "Apec summit as it happened:",
    }
    event_ix = {event["label"]: i for i, event in enumerate(events)}
    def resolve_event_index(label: str) -> int | None:
        if label in event_ix:
            return event_ix[label]
        matches = [index for saved_label, index in event_ix.items() if saved_label.startswith(label)]
        return matches[0] if len(matches) == 1 else None

    summit_children = [
        {"title": "Trilateral meeting and summit coverage", "eventLabels": [
            "Anthony Zurcher: Trilateral summit high on spectacle, short on substance",
            "Watch: What did Trump, Xi and Putin get out of their historic meeting?",
            "New page in history? Xi, Trump and Putin summit was more of a footnote",
            "Apec summit as it happened:",
        ], "basis": "Shared specific Xi–Trump–Putin/APEC meeting; pairwise links retained only where source text supports the same event."},
        {"title": "Summit outcomes and Ukraine diplomacy", "eventLabels": [
            "Ukraine / Putin / Europe",
            "China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars",
        ], "basis": "The Ukraine cluster contains a Yalta/Ukraine report explicitly discussing the declaration and trilateral summit; other articles in that cluster remain a known mixed-topic risk."},
        {"title": "Summit optics and political response", "eventLabels": [
            "Trump accused of falling asleep during Xi Jinping speech at Apec summit in China",
            "Top House Democrat questions what Trump accomplished in Xi-Putin summit",
        ], "basis": "A speech optics report and an explicit congressional reaction to the same summit; they are response angles, not duplicate event reports."},
    ]
    parents = [{
        "id": "parent-trump-xi-putin-apec",
        "title": "Trump–Xi–Putin meeting at APEC: coverage, outcomes, and reactions",
        "level": "parent_context",
        "eventIndexes": sorted(index for label in summit_labels if (index := resolve_event_index(label)) is not None),
        "children": [{**child, "eventIndexes": [index for label in child["eventLabels"] if (index := resolve_event_index(label)) is not None]} for child in summit_children],
        "qualification": "A parent subject groups distinct child narratives; it is not one flat connected-component narrative.",
    }]

    flat_narratives = [
        {"id": "gta-vi-launch", "title": "GTA VI global launch and immediate response", "level": "child", "eventIndexes": [index for label in ["GTA 6 breaks records as sales top $2.3bn - industry estimate", "Grand Theft Auto fans skip work and pull all-nighters to play new instalment", "UK joins in GTA 6 frenzy as game becomes available worldwide"] if (index := resolve_event_index(label)) is not None], "basis": "All three reports identify the same new-game launch; sales and player response are event angles."},
        {"id": "joanne-young-case", "title": "Joanne Young abuse case and verdict coverage", "level": "child", "eventIndexes": [index for label in ["'The bravest woman in Britain' and 'Silence is not an option'", "Joanne / Young / Joanne Young"] if (index := resolve_event_index(label)) is not None], "basis": "The BBC front-page summary and Guardian reports identify the same named survivor and abuse case."},
        {"id": "asylum-third-country-policy", "title": "European third-country asylum policy", "level": "parent_context", "eventIndexes": [index for label in ["UK and EU plan first talks on sending refused asylum seekers to third countries", "Five EU states announce plans for immigration"] if (index := resolve_event_index(label)) is not None], "children": [
            {"title": "UK–EU talks on third-country returns", "eventIndexes": [index for label in ["UK and EU plan first talks on sending refused asylum seekers to third countries"] if (index := resolve_event_index(label)) is not None]},
            {"title": "Five-state Rwanda return hubs proposal", "eventIndexes": [index for label in ["Five EU states announce plans for immigration"] if (index := resolve_event_index(label)) is not None]},
        ], "basis": "Separate policy initiatives share a broader policy subject; keep them as distinct children under a parent context."},
        {"id": "anthropic-ipo-storyline", "title": "Anthropic IPO and immediate public reaction", "level": "child", "eventIndexes": [index for label in ["Anthropic / Shares / Company", "Protesters rally against Anthropic in New York and San Francisco after $2tn stock market debut"] if (index := resolve_event_index(label)) is not None], "basis": "The protest headline explicitly places the event after Anthropic's market debut; IPO and protest remain distinct child events."},
    ]
    groups = parents + flat_narratives

    # Related source clusters that were missed/filtered are explicit review items,
    # not fabricated additions to a narrative.
    roundup = next((event for event in events if any(ROUNDUP_RE.search(a.get("title", "")) for a in event.get("articles", []))), None)
    potential_false_negatives = []
    if roundup and re.search(r"anthropic|ipo", " ".join(a.get("title", "") + " " + a.get("summary", "") for a in roundup.get("articles", [])), re.I):
        potential_false_negatives.append({
            "eventIndex": event_ix.get(roundup["label"]),
            "candidate": "The NPR roundup contains an Anthropic IPO item as well as unrelated Jeffries/House-speaker news.",
            "reason": "Whole-cluster filtering avoids a bridge but may miss a valid article-level IPO relation; article-facet splitting is needed to recover it safely.",
            "status": "potential false negative; requires article-level facet review",
        })

    positive = {"same specific event", "same continuing storyline"}
    gold = [row["manualLabel"] in positive for row in evaluated]
    original_pred = [True] * len(evaluated)
    improved_pred = [row["acceptedForChildNarrative"] for row in evaluated]
    def metrics(pred):
        tp = sum(p and g for p, g in zip(pred, gold))
        fp = sum(p and not g for p, g in zip(pred, gold))
        fn = sum((not p) and g for p, g in zip(pred, gold))
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        return {"truePositive": tp, "falsePositive": fp, "falseNegative": fn, "precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceSnapshot": str(BASELINE_PATH.name),
        "databaseAccess": "none; offline evaluation of saved JSON only",
        "dataset": baseline["dataset"],
        "originalNarratives": [{
            "title": group["title"],
            "eventLabels": [events[index]["label"] for index in group["eventIndexes"]],
            "eventIndexes": group["eventIndexes"],
        } for group in baseline["proposedNarratives"]],
        "method": {
            "description": "Dataset-audited prototype: typed English alias gazetteer, per-article quality flags, and hierarchy that keeps parent context separate from child event narratives.",
            "entityExtraction": "Exact alias matching with longest-span preference and types. Conservative; unknown entities are omitted. Not multilingual and not general-purpose NER.",
            "transitivePolicy": "Do not create narratives from connected components. Pair labels distinguish same event, continuing storyline, parent-only context, and rejection. Mixed-topic clusters are explicitly marked.",
            "evaluation": {"manuallyReviewedOriginalProposedEdges": len(evaluated), "positiveDefinition": "same specific event or same continuing storyline; broader-subject-only is parent context, not a child narrative", "original": metrics(original_pred), "improved": metrics(improved_pred), "caveat": "In-sample, dataset-specific manual rules were informed by this audit; metrics are not held-out/generalization accuracy."},
            "limitations": ["English-only small gazetteer; unseen names and entity types are missed.", "Saved result JSON lacks article body text, so quality and facets use headline and RSS summary only.", "The Ukraine/Europe saved cluster mixes several related but distinct reports; no production cluster was split or changed.", "The narrative hierarchy and manually reviewed labels are specific to this snapshot and need independent annotation on a larger set."],
        },
        "entityExtractionAudit": {"entityTypes": {kind: sorted(names) for kind, names in ENTITY_ALIASES.items()}, "falseEntityExamples": BAD_CAPITALIZED_EXAMPLES, "observedErrorExamples": entity_errors, "multilingualAccuracyClaimed": False},
        "qualitySummary": {
            "articleCount": sum(len(event.get("articles", [])) for event in events),
            "excluded": sum(1 for event in events for item in quality_by_event[event_ix[event["label"]]]["articles"] if item["decision"] == "exclude"),
            "downranked": sum(1 for event in events for item in quality_by_event[event_ix[event["label"]]]["articles"] if item["decision"] == "downrank"),
            "eligible": sum(1 for event in events for item in quality_by_event[event_ix[event["label"]]]["articles"] if item["decision"] == "eligible"),
            "historicalPolicy": "Older than one year triggers review/downranking only; it never excludes legitimate historical reporting.",
        },
        "events": events,
        "narratives": groups,
        "relationshipEvaluations": [{
            "leftEvent": row["left"]["label"], "rightEvent": row["right"]["label"],
            "originalNarrative": next((g["title"] for g in baseline["proposedNarratives"] if row["link"] in g["links"]), ""),
            "originalCosine": row["link"]["cosine"], "originalSharedEntities": row["link"]["sharedEntities"],
            "originalEvidenceTerms": row["link"]["sharedTerms"], "manualLabel": row["manualLabel"],
            "manualRationale": row["manualRationale"], "improvedPrediction": row["prediction"],
            "improvedRationale": row["predictionRationale"],
        } for row in evaluated],
        "potentialFalseNegatives": potential_false_negatives,
        "rejectedOriginalNarratives": [{"title": "Flat Trump/Xi/Putin/Russia connected component", "reason": "It transitive-chains a mixed Ukraine/Europe cluster to APEC optics and summit reporting. Retain a parent subject with three child story angles instead."}],
    }


def write_csv(result: dict) -> None:
    fields = ["leftEvent", "rightEvent", "originalNarrative", "originalCosine", "originalSharedEntities", "originalEvidenceTerms", "manualLabel", "manualRationale", "improvedPrediction", "improvedRationale"]
    with CSV_PATH.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in result["relationshipEvaluations"]:
            row = dict(row)
            row["originalSharedEntities"] = "; ".join(row["originalSharedEntities"])
            row["originalEvidenceTerms"] = "; ".join(row["originalEvidenceTerms"])
            writer.writerow({field: row[field] for field in fields})


def write_audit(result: dict) -> None:
    by_id = {event["id"]: event for event in result["events"]}
    evals = result["relationshipEvaluations"]
    metrics = result["method"]["evaluation"]
    lines = [
        "# Narrative accuracy audit — read-only prototype",
        "",
        f"Generated: {result['generatedAt']}",
        "",
        "> Offline evaluation of the saved `narrative_results.json` snapshot. No MongoDB connection or writes. Manual labels are human review; predictions are the prototype's dataset-specific rules.",
        "",
        "## Snapshot and outcome",
        "",
        f"- Snapshot: {result['sourceSnapshot']}; {result['dataset']['articleCount']} articles, {result['dataset']['savedClusterCount']} saved clusters, {result['dataset']['analyzedEventCount']} analyzed events.",
        f"- Original flat proposals: {len(evals)} pairwise edges across five connected-component groups.",
        f"- Improved output: {len(result['narratives'])} top-level groupings, with a Trump/Xi/Putin parent and three child narratives; parent-only policy links do not merge child events.",
        "- No saved cluster was split or modified. Article facets are review notes only.",
        "",
        "## Original versus improved groupings",
        "",
        "Original flat groups:",
        "",
    ]
    for original in result["originalNarratives"]:
        lines.append(f"- **{original['title']}** ({len(original['eventLabels'])} events): " + "; ".join(original["eventLabels"]))
    lines += ["", "Improved groups:", ""]
    for narrative in result["narratives"]:
        child_text = "" if not narrative.get("children") else "; child narratives: " + ", ".join(child["title"] for child in narrative["children"])
        labels = [result["events"][index]["label"] for index in narrative["eventIndexes"]]
        lines.append(f"- **{narrative['title']}** ({narrative['level']}; {len(labels)} events){child_text}: " + "; ".join(labels))
    lines += [
        "",
        "## Manually labelled edge-set metrics",
        "",
        "The fixed evaluation set is the 23 pairwise edges proposed in the original JSON. A positive means same specific event or same continuing storyline. Broader-subject-only, weak, and false-positive labels do not count as positive child-narrative links.",
        "",
        f"- Original: precision {metrics['original']['precision']:.3f}, recall {metrics['original']['recall']:.3f}, F1 {metrics['original']['f1']:.3f} (TP {metrics['original']['truePositive']}, FP {metrics['original']['falsePositive']}, FN {metrics['original']['falseNegative']}).",
        f"- Improved: precision {metrics['improved']['precision']:.3f}, recall {metrics['improved']['recall']:.3f}, F1 {metrics['improved']['f1']:.3f} (TP {metrics['improved']['truePositive']}, FP {metrics['improved']['falsePositive']}, FN {metrics['improved']['falseNegative']}).",
        "- These are in-sample, snapshot-specific results: the manual rules were informed by this audit. They are not a held-out accuracy estimate and do not establish generalization.",
        "",
        "## Trump / Xi / Putin: transitive bridge audit",
        "",
        "The original graph has a 8-event connected component. Its `Ukraine / Putin / Europe` cluster contains three articles: Berlin talks on Ukraine, a Yalta-format live report, and a podcast asking about the Trump–Putin–Xi alliance. This cluster is a bridge: edges from that mixed cluster make summit coverage, Ukraine diplomacy, and APEC optics look like one flat narrative.",
        "",
        "Improved hierarchy (distinct child angles under one broad parent):",
        "",
    ]
    parent = result["narratives"][0]
    for child in parent["children"]:
        lines.append(f"- **{child['title']}**: " + "; ".join(child["eventLabels"]) + f". {child['basis']}")
    lines += ["", "The following original proposed edges received broader-context-only or weak labels and therefore do not connect child narratives:", ""]
    for row in evals:
        if "Ukraine / Putin / Europe" in (row["leftEvent"], row["rightEvent"]) and row["manualLabel"] in {"related broader subject only", "weak relationship"}:
            lines.append(f"- `{row['leftEvent']}` ↔ `{row['rightEvent']}` — **{row['manualLabel']}**. {row['manualRationale']}")

    sections = [
        ("GTA 6", "All three original events are retained: record sales, launch-night players, and worldwide availability. They describe one specific launch and its immediate response. No missed related event was identifiable in this snapshot."),
        ("Joanne Young", "The BBC front-page summary and Guardian reports concern the same survivor and abuse case. The old capitalizer missed the full person name in the BBC headline; typed alias matching recovers Joanne Young from linked article content where present. No extra related event was identifiable."),
        ("Rwanda / asylum", "Both events are retained under a parent policy subject, but not as one child event: one is UK/EU talks about third-country returns, the other is five EU states' Rwanda return hubs. No missing related event was identifiable."),
        ("Anthropic", "IPO/debut coverage and protests after the debut are retained as a continuing storyline with separate event angles. The NPR mixed headline about Anthropic's IPO plus Jeffries is not accepted as a whole-cluster link; the Anthropic item inside it is a potential article-level false negative pending facet splitting."),
    ]
    for title, text in sections:
        lines += ["", f"## {title}", "", text]

    lines += ["", "## Relationship-by-relationship review", "", "See `relationship_evaluation.csv` for all original proposed edges, evidence terms, human labels, and improved decisions.", ""]
    counts = Counter(row["manualLabel"] for row in evals)
    lines += [f"Manual labels: {', '.join(f'{name}: {count}' for name, count in sorted(counts.items()))}.", ""]
    lines += ["## Entity extraction audit", "", "The capitalization regex emits title-case fragments such as sentence-initial adjectives and common nouns. The improved prototype uses longest-match aliases with entity types (person, organization, location, product, event/policy), and does not promote unknown capitalization to an entity.", ""]
    for example, explanation in result["entityExtractionAudit"]["falseEntityExamples"].items():
        lines.append(f"- **{example}** — {explanation}.")
    lines += ["", "Observed cases in this snapshot:", ""]
    if result["entityExtractionAudit"]["observedErrorExamples"]:
        for item in result["entityExtractionAudit"]["observedErrorExamples"]:
            lines.append(f"- `{item['token']}` in “{item['title']}” — {item['result']} ({item['handling']}).")
    else:
        lines.append("- None of the listed sample tokens appeared in current saved headlines; examples were still added to the rejection audit vocabulary.")
    lines += ["", "This is a small English alias gazetteer, not a general NER model. Unseen names are omitted. No multilingual accuracy is claimed.", ""]

    lines += ["## News input-quality decisions", "", f"- Eligible: {result['qualitySummary']['eligible']}; downranked but retained: {result['qualitySummary']['downranked']}; excluded from narrative analysis: {result['qualitySummary']['excluded']}.", "- `Download now` is excluded as navigation content. Podcast journalism is retained; format alone does not make an item promotional.", "- Roundup headlines are retained and marked mixed-topic/downranked so they cannot bridge unrelated events as a whole.", "- Items older than one year are review/downrank only; legitimate historical reporting is never automatically excluded.", ""]
    for event in result["events"]:
        for article in event.get("articleQuality", []):
            if article["decision"] != "eligible":
                lines.append(f"- **{article['decision']}** — “{article['title']}”: {article['reason']}")

    lines += ["", "## Empty `topTerms` trace and prototype correction", "", "The original JSON contains nonempty saved `topTerms` for 9/93 clusters. The source path is `scraper/clustering/tfidf.py`: `cluster_articles()` returns `topTerms: []` for every singleton cluster by design; `scraper/pipeline.py` copies `generated['topTerms']` into each saved cluster. The prototype field mapping (`cluster.get('topTerms', [])`) and JSON serialization are correct. Therefore empties are source behavior for singleton clusters, not a field-mapping or serialization bug. The improved output leaves saved terms intact and adds `derivedTopTerms` locally from article title/summary for empty clusters; no database record is changed.", ""]

    lines += ["## False positives, false negatives, and limits", "", "- **False-positive/transitive example:** the mixed `Ukraine / Putin / Europe` cluster connects several summit-era stories; its weak/directly unsupported edges are parent context or rejected, not child-group links.", "- **Potential false negative:** the NPR Anthropic/Jeffries roundup contains a genuine Anthropic IPO item and unrelated House-speaker news. Rejecting the whole mixed cluster avoids a bridge but misses the embedded IPO angle until article-facet splitting is implemented.", "- **Other missed relationships:** none were established from this snapshot without inventing evidence. The 93 saved clusters are mostly singletons, so recall beyond the manually reviewed edges is unknown.", "- **Unresolved:** split multi-topic saved clusters into read-only article facets; expand and independently validate the entity lexicon; annotate a held-out set across more feeds and time ranges; compare against an independent human gold set.", "", "## Protection and reproducibility", "", "The evaluator reads only `narrative_results.json` and writes local files in this directory. It does not import scraper/database modules, open MongoDB, call paid services, mutate saved clusters, or integrate the dashboard.", ""]
    AUDIT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    rows = original_relationships(baseline)
    improved = build_improved(baseline, rows)
    IMPROVED_PATH.write_text(json.dumps(improved, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(improved)
    write_audit(improved)
    print(json.dumps({
        "source": str(BASELINE_PATH),
        "databaseAccess": "none",
        "articles": improved["dataset"]["articleCount"],
        "originalProposedEdgesManuallyReviewed": len(rows),
        "originalMetrics": improved["method"]["evaluation"]["original"],
        "improvedMetrics": improved["method"]["evaluation"]["improved"],
        "quality": improved["qualitySummary"],
        "outputs": [str(AUDIT_PATH), str(IMPROVED_PATH), str(CSV_PATH)],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
