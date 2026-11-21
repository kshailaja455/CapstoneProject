from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
import re
from urllib.request import Request, urlopen
from urllib.parse import urlsplit, urlunsplit

import feedparser

from config import REQUEST_TIMEOUT_SECONDS
from .rss_feeds import RSS_FEEDS
from .language import is_english_content

try:
    from database.mongo import db
    publishers_collection = db["publishers"]
except Exception:
    publishers_collection = None

TAG_RE = re.compile(r"<[^>]+>")


def clean_text(value):
    if not value:
        return ""
    without_tags = TAG_RE.sub(" ", value)
    return re.sub(r"\s+", " ", unescape(without_tags)).strip()


def canonical_url(url):
    if not url:
        return ""
    parsed = urlsplit(url)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def parse_date(entry):
    date_value = entry.get("published") or entry.get("updated") or entry.get("created")
    if not date_value:
        return None
    try:
        parsed = parsedate_to_datetime(date_value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def get_active_publishers_and_feeds():
    """Load enabled publishers and feeds from MongoDB, falling back to static RSS_FEEDS."""
    targets = []
    if publishers_collection is not None:
        try:
            db_publishers = list(publishers_collection.find({"enabled": True}))
            for pub in db_publishers:
                pub_name = pub.get("name")
                pub_id = pub.get("_id")
                feeds = pub.get("feeds", [])
                for feed_item in feeds:
                    if feed_item.get("enabled", True):
                        targets.append({
                            "publisherName": pub_name,
                            "publisherId": pub_id,
                            "sourceCategory": pub.get("category", "Media"),
                            "country": pub.get("country", "Global"),
                            "feedUrl": feed_item.get("url"),
                            "feedName": feed_item.get("name", "Main"),
                            "category": feed_item.get("category", "General"),
                            "publisherLanguage": pub.get("language", "en"),
                        })
        except Exception as e:
            print(f"Warning: Could not load dynamic publishers from MongoDB: {e}")

    # Fallback to static RSS_FEEDS if no targets found in DB
    if not targets:
        for source, url in RSS_FEEDS.items():
            targets.append({
                "publisherName": source,
                "publisherId": None,
                "feedUrl": url,
                "feedName": "Top Stories",
                "category": "General",
                "publisherLanguage": "en",
            })

    return targets


def fetch_articles():
    found_articles = []
    failed_feeds = []
    feed_results = []
    successful_feed_count = 0
    non_english_skipped = 0

    targets = get_active_publishers_and_feeds()

    for target in targets:
        source = target["publisherName"]
        url = target["feedUrl"]
        feed_category = target.get("category", "General")

        try:
            request = Request(
                url,
                headers={
                    "User-Agent": "NewsPulse-FeedIngester/2.0 (+https://github.com/newspulse/ingest)",
                    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
                },
            )
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                response_headers = response.headers
                response_body = response.read()
                response_status = response.status
            feed = feedparser.parse(response_body, response_headers=response_headers)
            feed["status"] = response_status
        except Exception as exc:
            err_msg = str(exc)
            failed_feeds.append({"source": source, "url": url, "error": err_msg})
            feed_results.append({
                "source": source,
                "url": url,
                "status": "error",
                "error": err_msg,
                "articleCount": 0,
            })
            continue

        status = feed.get("status")
        if isinstance(status, int) and status >= 400:
            err_msg = f"HTTP {status}"
            failed_feeds.append({"source": source, "url": url, "error": err_msg})
            feed_results.append({
                "source": source,
                "url": url,
                "status": "error",
                "error": err_msg,
                "articleCount": 0,
            })
            continue

        if feed.get("bozo") and not feed.entries:
            err_msg = str(feed.get("bozo_exception") or "Invalid RSS format")
            failed_feeds.append({"source": source, "url": url, "error": err_msg})
            feed_results.append({
                "source": source,
                "url": url,
                "status": "error",
                "error": err_msg,
                "articleCount": 0,
            })
            continue

        successful_feed_count += 1
        feed_lang = feed.feed.get("language", target.get("publisherLanguage", "en"))
        feed_articles_count = 0

        for entry in feed.entries:
            link = canonical_url(entry.get("link", ""))
            if not link:
                continue

            title = clean_text(entry.get("title", ""))
            summary = clean_text(entry.get("summary", "") or entry.get("description", ""))

            # Language validation (English-only)
            entry_lang = entry.get("language", feed_lang)
            if not is_english_content(title=title, summary=summary, feed_language=entry_lang):
                non_english_skipped += 1
                continue

            # Category detection from tags or feed
            tags = entry.get("tags", [])
            tag_names = [t.get("term", "") for t in tags if isinstance(t, dict)]
            category = tag_names[0] if tag_names else feed_category

            now = datetime.now(timezone.utc)
            found_articles.append({
                "title": title,
                "summary": summary,
                "url": link,
                "publishedAt": parse_date(entry) or now,
                "discoveredAt": now,
                "source": source,
                "publisherId": target.get("publisherId"),
                "sourceCategory": target.get("sourceCategory", "Media"),
                "country": target.get("country", "Global"),
                "category": category,
                "language": "en",
                "processingStatus": "ingested",
            })
            feed_articles_count += 1

        feed_results.append({
            "source": source,
            "url": url,
            "status": "healthy",
            "error": None,
            "articleCount": feed_articles_count,
        })

    print(
        f"Fetched {len(found_articles)} English articles from {successful_feed_count} active feeds "
        f"({non_english_skipped} non-English skipped, {len(failed_feeds)} failed)"
    )

    return {
        "articles": found_articles,
        "successfulFeedCount": successful_feed_count,
        "failedFeeds": failed_feeds,
        "feedResults": feed_results,
        "nonEnglishSkipped": non_english_skipped,
    }
