"""Sources intentionally removed from active RSS monitoring."""

RETIRED_PUBLISHER_NAMES = {
    "business standard",
    "dd news",
    "european central bank",
    "gazette of india",
    "international monetary fund",
    "pib media invitations",
    "pib national",
    "reserve bank of india",
    "sebi",
    "us fda",
    "united nations",
    "world bank",
}

RETIRED_PUBLISHER_SLUGS = {
    "business-standard",
    "dd-news",
    "european-central-bank",
    "gazette-of-india",
    "imf",
    "pib-media-invitations",
    "pib-national",
    "reserve-bank-of-india",
    "sebi",
    "us-fda",
    "united-nations",
    "world-bank",
}

RETIRED_FEED_URLS = {
    "https://www.business-standard.com/rss/home_page_top_stories.rss",
    "https://ddnews.gov.in/category/national/feed/",
    "https://www.ecb.europa.eu/rss/press.html",
    "https://egazette.gov.in/RssFeed.aspx",
    "https://www.imf.org/en/News/Rss?category=pressrelease",
    "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1",
    "https://pib.gov.in/RssMain.aspx?ModId=10&Lang=1&Regid=1",
    "https://www.rbi.org.in/notifications_rss.xml",
    "https://www.sebi.gov.in/sebirss.xml",
    "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml",
    "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
    "https://www.worldbank.org/en/news/rss.xml",
}
RETIRED_FEED_URLS = {url.strip().lower() for url in RETIRED_FEED_URLS}


def is_retired_publisher(publisher):
    """Match source records by stable slug or name."""
    if (publisher.get("name") or "").strip().lower() in RETIRED_PUBLISHER_NAMES:
        return True
    if (publisher.get("slug") or "").strip().lower() in RETIRED_PUBLISHER_SLUGS:
        return True
    return False


def is_retired_feed(feed):
    return (feed.get("url") or "").strip().lower() in RETIRED_FEED_URLS
