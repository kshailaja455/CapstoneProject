"""Read-only narrative candidate analysis over saved News Pulse event clusters."""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict, deque
from datetime import datetime, timezone
from html import escape
import json
import os
from pathlib import Path
import re
import sys
import unicodedata

from pymongo import MongoClient
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "output"
ENTITY_RE = re.compile(r"(?<![a-z])(?:[A-Z][A-Za-z0-9'’.-]*|[A-Z]{2,})(?![a-z])")
WORD_RE = re.compile(r"[a-z][a-z0-9'-]{2,}")
LEADING_GENERIC = {
    "a", "an", "and", "after", "as", "at", "before", "breaking", "explainer",
    "how", "inside", "latest", "live", "new", "opinion", "the", "this", "video",
    "watch", "what", "when", "where", "why", "who",
}
ENTITY_STOP = {
    "A", "An", "And", "After", "As", "At", "Before", "But", "For", "From",
    "How", "In", "Inside", "Into", "Is", "Latest", "Live", "New", "Of", "On",
    "Or", "The", "This", "To", "What", "When", "Where", "Which", "Who", "Why",
    "With", "Watch", "Video", "BBC", "NPR", "Guardian", "Reuters", "AP",
    "Continue", "Click", "Get", "Former", "Thursday", "Friday", "Monday", "Tuesday",
    "Wednesday", "Saturday", "Sunday", "Yesterday", "Today", "Tomorrow", "One", "Two",
    "Three", "Four", "Five", "Six", "All", "More", "Read", "Related", "Latest",
    "Democrat", "Democrats", "Republican", "Republicans", "Democratic", "Liberal", "Liberals",
    "Labour", "Labor", "British", "American", "Australian", "Indian", "Israeli", "Chinese",
    "Russian", "Ukrainian", "European", "Minister", "President", "Government", "Official",
    "Officials", "Commission", "Nation", "States", "State", "People", "Country", "Court",
    "Grand", "Theft", "Auto", "IPO",
}
GENERIC_ENTITIES = {
    "Africa", "America", "Asia", "Australia", "Britain", "China", "Europe", "European",
    "EU", "UK", "US", "United", "World", "Washington", "Government", "House", "Court",
    "AI",
}
GENERIC_TERMS = {
    "agreement", "company", "deal", "historic", "market", "meeting", "people", "summit",
    "talk", "talks", "today", "world", "year", "years", "new", "time", "leaders",
    "britain", "british", "young", "uk", "eu", "europe", "european", "china", "russia",
    "united", "america", "states", "government", "house", "court", "president", "minister",
    "majority", "leader", "leaders", "speaker", "democrats", "republicans", "party", "vote",
}
ROUNDUP_TITLE_RE = re.compile(r"\.\s*(?:and|plus)\s*,", re.I)
ENTITY_ALIASES = (
    (re.compile(r"\b(?:grand theft auto|gta(?:\s*6)?)\b", re.I), "GTA 6"),
    (re.compile(r"\bu\.s\.\b", re.I), "US"),
    (re.compile(r"\bu\.k\.\b", re.I), "UK"),
    (re.compile(r"\be\.u\.\b", re.I), "EU"),
    (re.compile(r"\bu\.n\.\b", re.I), "UN"),
)


def normalize_text(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    return text.replace("\ufffd", " ").replace("\u0092", "'")


def clean_date(value: object) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def cluster_entities(members: list[dict]) -> set[str]:
    # Restrict entity evidence to headlines. RSS summaries often append unrelated
    # roundup text, navigation copy, or broad background names that bridge events.
    combined = " ".join(normalize_text(article.get("title")) for article in members)
    entities = {
        token.strip(".-'’")
        for token in ENTITY_RE.findall(combined)
        if token not in ENTITY_STOP and len(token.strip(".-'’")) > 1
    }
    for pattern, canonical in ENTITY_ALIASES:
        if pattern.search(combined):
            entities.add(canonical)
    return entities


def cluster_document(cluster: dict, members: list[dict]) -> str:
    parts = [normalize_text(cluster.get("label")), " ".join(cluster.get("topTerms", []))]
    for article in members:
        parts.extend([
            normalize_text(article.get("title")),
            normalize_text(article.get("summary")),
            normalize_text(article.get("body"))[:2400],
        ])
    return " ".join(part for part in parts if part)


def read_snapshot(uri: str, database_name: str) -> tuple[list[dict], list[dict]]:
    # Intentionally use only find() calls. Do not import scraper.database.mongo:
    # that production helper creates indexes during import.
    client = MongoClient(
        uri,
        serverSelectionTimeoutMS=7000,
        connectTimeoutMS=5000,
        appname="NewsPulseNarrativeReadOnlyPrototype",
    )
    db = client[database_name]
    articles = list(db.articles.find({}, {
        "title": 1, "summary": 1, "body": 1, "source": 1,
        "url": 1, "publishedAt": 1, "clusterId": 1,
    }))
    clusters = list(db.clusters.find({}, {
        "label": 1, "topTerms": 1, "articleIds": 1, "sources": 1,
        "articleCount": 1, "startTime": 1, "endTime": 1,
        "representativeArticleId": 1,
    }))
    client.close()
    return articles, clusters


def analyze(articles: list[dict], clusters: list[dict], min_cosine: float) -> dict:
    by_id = {article["_id"]: article for article in articles}
    events = []
    for cluster in clusters:
        members = [by_id[article_id] for article_id in cluster.get("articleIds", []) if article_id in by_id]
        if not members:
            continue
        events.append({
            "id": str(cluster["_id"]),
            "label": normalize_text(cluster.get("label") or "Untitled event"),
            "topTerms": [normalize_text(term) for term in cluster.get("topTerms", [])],
            "articleCount": len(members),
            "sources": sorted({normalize_text(article.get("source") or "Unknown") for article in members}),
            "startTime": clean_date(cluster.get("startTime")),
            "endTime": clean_date(cluster.get("endTime")),
            "entities": cluster_entities(members),
            "document": cluster_document(cluster, members),
            "articles": [
                {
                    "title": normalize_text(article.get("title") or "Untitled article"),
                    "source": normalize_text(article.get("source") or "Unknown"),
                    "url": normalize_text(article.get("url") or ""),
                    "publishedAt": clean_date(article.get("publishedAt")),
                    "summary": normalize_text(article.get("summary") or ""),
                }
                for article in members
            ],
            "mixedTopicTitle": any(
                ROUNDUP_TITLE_RE.search(normalize_text(article.get("title")))
                for article in members
            ),
        })

    if len(events) < 2:
        raise RuntimeError("At least two saved event clusters with articles are required.")

    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1, 2),
        min_df=1,
        max_df=0.90,
        sublinear_tf=True,
        max_features=50000,
    )
    matrix = vectorizer.fit_transform([event["document"] for event in events])
    similarities = cosine_similarity(matrix)
    feature_names = vectorizer.get_feature_names_out()
    term_weights = matrix.toarray()
    entity_frequency = Counter(entity for event in events for entity in event["entities"])

    links = []
    for left in range(len(events)):
        for right in range(left + 1, len(events)):
            cosine = float(similarities[left, right])
            if cosine < min_cosine:
                continue
            a, b = events[left], events[right]
            shared_entities = sorted(a["entities"] & b["entities"])
            specific_entities = [entity for entity in shared_entities if entity not in GENERIC_ENTITIES]
            shared_terms = sorted(
                (
                    (float(term_weights[left, index] * term_weights[right, index]), feature_names[index])
                    for index in (term_weights[left] * term_weights[right]).nonzero()[0]
                ),
                reverse=True,
            )
            evidence_terms = [term for _, term in shared_terms[:6]]
            informative_terms = [
                term for term in evidence_terms
                if any(token not in GENERIC_TERMS and len(token) >= 6 for token in term.split())
            ]
            rare_specific = [name for name in specific_entities if entity_frequency[name] <= 10]

            if len(specific_entities) >= 2 and cosine >= 0.045:
                status = "proposed"
                reason = "Multiple shared named entities plus overlapping article language."
            elif rare_specific and cosine >= 0.075:
                status = "proposed"
                reason = "A distinctive shared named entity and supporting article-language overlap."
            elif cosine >= 0.10 and informative_terms:
                status = "proposed"
                reason = "Strong lexical similarity with a shared distinctive term, despite limited shared headline entities."
            elif specific_entities or shared_entities or cosine >= 0.045:
                status = "weak"
                if not specific_entities and shared_entities:
                    reason = "Overlap is mostly broad actors or geography; check for topic drift."
                elif not shared_entities:
                    reason = "Lexical overlap without a shared named entity; likely a false positive."
                else:
                    reason = "Some specific overlap exists, but it is below the prototype's proposal threshold."
                if not shared_entities:
                    status = "likely_false_positive"
            else:
                continue

            if status == "proposed" and (a["mixedTopicTitle"] or b["mixedTopicTitle"]):
                status = "weak"
                reason = "One cluster contains a mixed-topic roundup headline; the relationship may attach to only one part of that item."

            links.append({
                "left": left,
                "right": right,
                "cosine": round(cosine, 4),
                "status": status,
                "sharedEntities": shared_entities,
                "sharedSpecificEntities": specific_entities,
                "sharedTerms": evidence_terms,
                "reason": reason,
            })

    proposed_links = [link for link in links if link["status"] == "proposed"]
    adjacency: dict[int, set[int]] = defaultdict(set)
    for link in proposed_links:
        adjacency[link["left"]].add(link["right"])
        adjacency[link["right"]].add(link["left"])

    groups = []
    visited: set[int] = set()
    for start in adjacency:
        if start in visited:
            continue
        queue = deque([start])
        visited.add(start)
        members = []
        while queue:
            current = queue.popleft()
            members.append(current)
            for neighbor in adjacency[current]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        if len(members) < 2:
            continue
        member_set = set(members)
        group_links = [
            link for link in proposed_links
            if link["left"] in member_set and link["right"] in member_set
        ]
        group_entities = Counter(
            entity
            for link in group_links
            for entity in link["sharedSpecificEntities"]
        )
        title_entities = [entity for entity, _ in group_entities.most_common(4)]
        if not title_entities:
            group_terms = Counter(
                term for link in group_links for term in link["sharedTerms"]
                if any(token not in GENERIC_TERMS and len(token) >= 6 for token in term.split())
            )
            title_entities = [term for term, _ in group_terms.most_common(3)]
        groups.append({
            "title": " / ".join(title_entities) + " — related event coverage",
            "eventIndexes": sorted(members),
            "links": group_links,
            "minimumLinkScore": min(link["cosine"] for link in group_links),
            "maximumLinkScore": max(link["cosine"] for link in group_links),
        })

    groups.sort(key=lambda group: (-len(group["eventIndexes"]), -group["maximumLinkScore"], group["title"]))
    weak_links = [link for link in links if link["status"] != "proposed"]
    weak_links.sort(key=lambda link: (-link["cosine"], link["status"]))

    for event in events:
        event.pop("document")
        event["entities"] = sorted(event["entities"])

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "dataset": {
            "articleCount": len(articles),
            "savedClusterCount": len(clusters),
            "analyzedEventCount": len(events),
            "unassignedArticleCount": sum(article.get("clusterId") is None for article in articles),
            "publisherCounts": dict(sorted(Counter(article.get("source") or "Unknown" for article in articles).items())),
            "clusterSizeCounts": dict(sorted(Counter(str(event["articleCount"]) for event in events).items())),
        },
        "method": {
            "description": "Cluster-level TF-IDF cosine plus headline-only named-entity overlap.",
            "minCosine": min_cosine,
            "proposalRule": "At least two specific shared headline entities with cosine >= 0.045; one rare shared entity with cosine >= 0.075; or cosine >= 0.10 plus a shared distinctive term.",
            "limitations": [
                "Entity extraction is a lightweight capitalization heuristic, not a trained NER model.",
                "Similarity supports a review proposal; it does not establish causality or a verified narrative.",
                "Saved event clusters can be incomplete or contain roundup articles with multiple topics.",
            ],
        },
        "events": events,
        "proposedNarratives": groups,
        "weakOrFalsePositiveLinks": [
            {
                **link,
                "leftEvent": events[link["left"]]["label"],
                "rightEvent": events[link["right"]]["label"],
            }
            for link in weak_links
        ],
    }


def article_markdown(article: dict) -> str:
    title = article["title"].replace("|", "\\|")
    source = article["source"].replace("|", "\\|")
    url = article["url"]
    link = f"[{title}]({url})" if url.startswith(("http://", "https://")) else title
    return f"- {link} — {source}; published {article['publishedAt'] or 'date unavailable'}"


def render_markdown(result: dict) -> str:
    data = result["dataset"]
    lines = [
        "# Narrative detection prototype — read-only report",
        "",
        f"Generated: {result['generatedAt']}",
        "",
        "> Prototype proposals only. No production records were changed. Inspect the linked articles before accepting any relationship.",
        "",
        "## Dataset snapshot",
        "",
        f"- Articles read: **{data['articleCount']}**",
        f"- Saved event clusters: **{data['savedClusterCount']}**; clusters analyzed: **{data['analyzedEventCount']}**",
        f"- Unassigned articles: **{data['unassignedArticleCount']}**",
        f"- Publishers: {', '.join(f'{name} {count}' for name, count in data['publisherCounts'].items())}",
        f"- Saved event cluster sizes: {', '.join(f'{size} article(s): {count} cluster(s)' for size, count in data['clusterSizeCounts'].items())}",
        "",
        "## Proposed narrative groups",
        "",
    ]
    if not result["proposedNarratives"]:
        lines.extend(["No group met the conservative proposal rule.", ""])
    for group_index, group in enumerate(result["proposedNarratives"], 1):
        lines.extend([
            f"### {group_index}. {group['title']}",
            "",
            f"Review state: **proposed, unconfirmed**. Pairwise cosine range: {group['minimumLinkScore']:.3f}–{group['maximumLinkScore']:.3f}.",
            "",
        ])
        for event_index in group["eventIndexes"]:
            event = result["events"][event_index]
            lines.extend([
                f"#### Event: {event['label']} ({event['articleCount']} article(s); {', '.join(event['sources'])})",
                "",
            ])
            lines.extend(article_markdown(article) for article in event["articles"])
            lines.append("")
        lines.append("Relationship evidence:")
        lines.append("")
        for link in group["links"]:
            left = result["events"][link["left"]]["label"]
            right = result["events"][link["right"]]["label"]
            lines.append(
                f"- **{left} ↔ {right}** — cosine {link['cosine']:.3f}; "
                f"shared entities: {', '.join(link['sharedEntities']) or 'none'}; "
                f"shared weighted terms: {', '.join(link['sharedTerms']) or 'none'}. {link['reason']}"
            )
        lines.append("")

    lines.extend(["## Weak links and likely false positives", ""])
    if not result["weakOrFalsePositiveLinks"]:
        lines.extend(["No candidate links fell into the review band.", ""])
    else:
        for link in result["weakOrFalsePositiveLinks"][:30]:
            lines.append(
                f"- **{link['status'].replace('_', ' ')}** ({link['cosine']:.3f}): "
                f"{link['leftEvent']} ↔ {link['rightEvent']}; "
                f"entities: {', '.join(link['sharedEntities']) or 'none'}; "
                f"terms: {', '.join(link['sharedTerms']) or 'none'}. {link['reason']}"
            )
        lines.append("")

    lines.extend([
        "## Interpretation and limits",
        "",
        "The highest-confidence proposals are candidate cross-event relationships surfaced from real saved clusters. The weak-link section is an explicit review queue for topic drift and false positives. The score is lexical similarity, not a probability.",
        "",
        "Named entities come from a small capitalization heuristic. It can miss names and can mistake title-case words for entities. The report does not infer cause, intent, or a single overarching story without human review.",
        "",
        "Full article bodies are not copied into this report; use the publisher links to inspect the source context.",
        "",
    ])
    return "\n".join(lines)


def render_html(result: dict) -> str:
    markdown_path = "narrative_report.md"
    narrative_sections = []
    for group_index, group in enumerate(result["proposedNarratives"], 1):
        entries = []
        for event_index in group["eventIndexes"]:
            event = result["events"][event_index]
            articles = "".join(
                "<li>"
                + (f"<a href=\"{escape(article['url'], quote=True)}\" target=\"_blank\" rel=\"noopener\">{escape(article['title'])}</a>" if article["url"].startswith(("http://", "https://")) else escape(article["title"]))
                + f" <span>{escape(article['source'])} · {escape(article['publishedAt'] or 'date unavailable')}</span></li>"
                for article in event["articles"]
            )
            entries.append(
                f"<section class=\"event\"><h3>{escape(event['label'])}</h3>"
                f"<p>{event['articleCount']} article(s) · {escape(', '.join(event['sources']))}</p><ul>{articles}</ul></section>"
            )
        evidence = "".join(
            f"<li><b>{escape(result['events'][link['left']]['label'])} ↔ {escape(result['events'][link['right']]['label'])}</b> "
            f"(cosine {link['cosine']:.3f}); entities: {escape(', '.join(link['sharedEntities']) or 'none')}; "
            f"terms: {escape(', '.join(link['sharedTerms']) or 'none')}. {escape(link['reason'])}</li>"
            for link in group["links"]
        )
        narrative_sections.append(
            f"<details open class=\"narrative\"><summary>{group_index}. {escape(group['title'])} "
            f"<span>proposed · score {group['minimumLinkScore']:.3f}–{group['maximumLinkScore']:.3f}</span></summary>"
            f"<div class=\"events\">{''.join(entries)}</div><h3>Relationship evidence</h3><ul>{evidence}</ul></details>"
        )

    weak = "".join(
        f"<li><b>{escape(link['status'].replace('_', ' '))}</b> · {link['cosine']:.3f} — "
        f"{escape(link['leftEvent'])} ↔ {escape(link['rightEvent'])}; "
        f"entities: {escape(', '.join(link['sharedEntities']) or 'none')}; "
        f"terms: {escape(', '.join(link['sharedTerms']) or 'none')}. {escape(link['reason'])}</li>"
        for link in result["weakOrFalsePositiveLinks"][:30]
    ) or "<li>No weak links in the review band.</li>"
    data = result["dataset"]
    publishers = escape(", ".join(f"{name} {count}" for name, count in data["publisherCounts"].items()))
    size_counts = escape(", ".join(f"{size} article(s): {count} cluster(s)" for size, count in data["clusterSizeCounts"].items()))
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>News Pulse — Read-only narrative prototype</title>
<style>
body{{font:15px/1.55 system-ui,sans-serif;color:#19242d;background:#f4f7f8;margin:0;padding:24px}}main{{max-width:1180px;margin:auto}}header,.panel,.narrative{{background:#fff;border:1px solid #d8e1e5;border-radius:10px;padding:18px;margin:0 0 16px}}h1{{font-size:28px;margin:0 0 6px}}h2{{font-size:20px;margin:0 0 12px}}h3{{font-size:16px;margin:12px 0 5px}}.notice{{color:#8a3d19;font-weight:700}}.stats{{display:flex;flex-wrap:wrap;gap:10px}}.stats span,.badge{{background:#eef3f5;border-radius:6px;padding:6px 9px}}.narrative summary{{cursor:pointer;font-size:18px;font-weight:750}}.narrative summary span{{font-size:12px;color:#456b57;font-weight:600}}.events{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-top:12px}}.event{{background:#f7f9fa;border-radius:8px;padding:12px}}li{{margin:5px 0}}li span{{color:#5e6e78;font-size:12px}}a{{color:#155e85}}.weak li{{margin:10px 0}}.method{{color:#44545e}}footer{{font-size:12px;color:#62727d;margin-top:18px}}@media(max-width:600px){{body{{padding:12px}}}}
</style></head><body><main>
<header><p class="notice">ISOLATED PROTOTYPE · READ ONLY · NO PRODUCTION WRITE OPERATIONS</p>
<h1>Narrative detection review</h1><p>Generated {escape(result['generatedAt'])}</p>
<div class="stats"><span>{data['articleCount']} articles</span><span>{data['savedClusterCount']} saved clusters</span><span>{data['analyzedEventCount']} analyzed events</span><span>{data['unassignedArticleCount']} unassigned</span></div>
<p>Publishers: {publishers}<br>Cluster sizes: {size_counts}</p>
<p>Heuristic: cluster-level TF-IDF cosine + headline-only named-entity overlap. A proposal needs multiple specific entities, one rare entity with lexical support, or cosine of at least 0.10 plus a distinctive shared term. Scores are not probabilities.</p>
<p><a href="{markdown_path}">Open Markdown report</a> · <a href="narrative_results.json">Inspect machine-readable evidence</a></p></header>
<section class="panel"><h2>Proposed narrative groups</h2><p>Every group is unconfirmed and needs manual source inspection.</p>{''.join(narrative_sections) or '<p>No group met the proposal rule.</p>'}</section>
<section class="panel weak"><h2>Weak links / likely false positives</h2><p>These are surfaced to make failure modes inspectable; they are not proposed narratives.</p><ul>{weak}</ul></section>
<section class="panel method"><h2>Limitations</h2><ul>{''.join(f'<li>{escape(item)}</li>' for item in result['method']['limitations'])}</ul><p>Full article bodies are not reproduced. Use publisher links to review context.</p></section>
<footer>Generated from read-only MongoDB queries. The script does not create, update, or delete MongoDB documents.</footer></main></body></html>"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mongo-uri", default=os.environ.get("MONGO_URI", "mongodb://127.0.0.1:27017"))
    parser.add_argument("--database", default=os.environ.get("MONGO_DB", "news-pulse"))
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--min-cosine", type=float, default=0.045)
    parser.add_argument("--max-weak-links", type=int, default=30)
    args = parser.parse_args()

    articles, clusters = read_snapshot(args.mongo_uri, args.database)
    result = analyze(articles, clusters, args.min_cosine)
    if args.max_weak_links >= 0:
        result["weakOrFalsePositiveLinks"] = result["weakOrFalsePositiveLinks"][:args.max_weak_links]

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "narrative_results.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8",
    )
    (args.output_dir / "narrative_report.md").write_text(render_markdown(result), encoding="utf-8")
    (args.output_dir / "narrative_report.html").write_text(render_html(result), encoding="utf-8")
    print(json.dumps({
        "articlesRead": result["dataset"]["articleCount"],
        "savedClustersRead": result["dataset"]["savedClusterCount"],
        "analyzedEvents": result["dataset"]["analyzedEventCount"],
        "proposedGroups": len(result["proposedNarratives"]),
        "proposedEventLinks": sum(len(group["links"]) for group in result["proposedNarratives"]),
        "weakOrFalsePositiveLinksReported": len(result["weakOrFalsePositiveLinks"]),
        "outputDirectory": str(args.output_dir.resolve()),
        "databaseWrites": 0,
    }, indent=2))


if __name__ == "__main__":
    main()
