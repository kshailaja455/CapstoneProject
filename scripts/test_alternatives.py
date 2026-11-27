import urllib.request
import feedparser
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
}

alt_urls = {
    # ThePrint
    "ThePrint (rss)": "https://theprint.in/rss",
    "ThePrint (feed/atom)": "https://theprint.in/feed/atom/",
    "ThePrint (opinion)": "https://theprint.in/category/opinion/feed/",
    # Scroll.in
    "Scroll.in (/feed/rss)": "https://scroll.in/feed/rss",
    "Scroll.in (rss)": "https://scroll.in/rss",
    "Scroll.in (latest)": "https://scroll.in/latest.rss",
    # PIB
    "PIB All Press": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1",
    "PIB English Releases": "https://pib.gov.in/rss/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    # DD News
    "DD News 1": "https://ddnews.gov.in/en/feed/",
    "DD News 2": "https://ddnews.gov.in/category/national/feed/",
    # SEBI
    "SEBI Press": "https://www.sebi.gov.in/sebirss.xml",
    # NDMA
    "NDMA CapFeed": "https://sachet.ndma.gov.in/CapFeed",
    # US FDA
    "US FDA All": "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml",
    "US FDA Consumer": "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/fdagov-rss-feeds/rss.xml",
    "US FDA Recalls": "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls-market-withdrawals-safety-alerts/rss.xml",
    # UN News
    "UN News Global": "https://news.un.org/feed/view/en/story/rss.xml",
    "UN News Audio": "https://news.un.org/feed/subscribe/en/audio/all/rss.xml",
    # IMF
    "IMF News": "https://www.imf.org/en/News/Rss?category=pressrelease",
    "IMF What's New": "https://www.imf.org/external/rss/whatsnew.xml",
    # World Bank
    "World Bank News": "https://www.worldbank.org/en/news/rss.xml",
    "World Bank Press": "https://www.worldbank.org/en/news/press-release/rss.xml",
    # Gazette
    "Gazette": "https://egazette.gov.in/RssFeed.aspx"
}

for name, url in alt_urls.items():
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8, context=ctx) as resp:
            content = resp.read()
            status_code = resp.status
        f = feedparser.parse(content)
        entries_count = len(f.entries)
        first_title = f.entries[0].get("title", "")[:40] if entries_count > 0 else "NO_ENTRIES"
        print(f"{name:<25} | {status_code:<5} | {entries_count:<5} | {first_title}")
    except Exception as e:
        print(f"{name:<25} | ERR   | 0     | {str(e)[:40]}")

