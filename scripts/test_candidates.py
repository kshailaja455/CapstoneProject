import urllib.request
import feedparser
import ssl

candidate_feeds = {
    # --- Indian Media (11) ---
    "The Hindu": "https://www.thehindu.com/feeder/default.rss",
    "The Indian Express": "https://indianexpress.com/feed/",
    "NDTV": "https://feeds.feedburner.com/ndtvnews-top-stories",
    "The Times of India": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    "Hindustan Times": "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
    "Mint": "https://www.livemint.com/rss/news",
    "Business Standard": "https://www.business-standard.com/rss/home_page_top_stories.rss",
    "ThePrint": "https://theprint.in/feed/",
    "Scroll.in": "https://scroll.in/feed",
    "LiveLaw": "https://www.livelaw.in/google_feeds.xml",
    "Alt News": "https://altnews.in/feed/",

    # --- Indian Government (4) ---
    "PIB National": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1",
    "PIB Regional": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=2",
    "PIB Media Invitations": "https://pib.gov.in/RssMain.aspx?ModId=10&Lang=1&Regid=1",
    "DD News": "https://ddnews.gov.in/feed/",

    # --- Indian Regulators & Alerts (5) ---
    "RBI Press Releases": "https://www.rbi.org.in/pressreleases_rss.xml",
    "RBI Notifications": "https://www.rbi.org.in/notifications_rss.xml",
    "SEBI": "https://www.sebi.gov.in/sebirss.xml",
    "NDMA SACHET": "https://sachet.ndma.gov.in/CapFeed",
    "Gazette of India": "https://egazette.gov.in/RssFeed.aspx",

    # --- International Official Sources (11) ---
    "US Federal Reserve": "https://www.federalreserve.gov/feeds/press_all.xml",
    "US FDA": "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml",
    "European Central Bank": "https://www.ecb.europa.eu/rss/press.html",
    "UK Government (GOV.UK)": "https://www.gov.uk/search/news-and-communications.atom",
    "UN News": "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
    "WHO": "https://www.who.int/rss-feeds/news-english.xml",
    "NASA": "https://www.nasa.gov/news-release/feed/",
    "IMF": "https://www.imf.org/en/News/Rss?category=pressrelease",
    "World Bank": "https://www.worldbank.org/en/news/rss",
    "US SEC": "https://www.sec.gov/news/pressreleases.rss",
    "European Commission": "https://ec.europa.eu/commission/presscorner/api/rss?language=en",
}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.9"
}

print(f"{'Source':<25} | {'Status':<8} | {'Entries':<7} | {'First Title'}")
print("-" * 80)

for name, url in candidate_feeds.items():
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=12, context=ctx) as resp:
            content = resp.read()
            status_code = resp.status
        f = feedparser.parse(content)
        entries_count = len(f.entries)
        first_title = f.entries[0].get("title", "")[:45] if entries_count > 0 else "NO_ENTRIES"
        print(f"{name:<25} | {status_code:<8} | {entries_count:<7} | {first_title}")
    except Exception as e:
        err = str(e)[:35]
        print(f"{name:<25} | {'ERROR':<8} | {'0':<7} | {err}")

