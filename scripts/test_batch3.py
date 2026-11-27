import urllib.request
import feedparser
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

# Check DD News, SEBI, PIB combinations, NASA, UN, IMF, FDA
checks = {
    "DD News /rss-feeds/": "https://ddnews.gov.in/rss-feeds/",
    "DD News /feed/": "https://ddnews.gov.in/feed/",
    "DD News /national/feed/": "https://ddnews.gov.in/category/national/feed/",
    "SEBI All PR": "https://www.sebi.gov.in/sebirss.xml",
    "PIB Regid=3": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    "PIB Regid=6": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=6",
    "UN News Story": "https://news.un.org/feed/view/en/story/rss.xml",
    "UN News Audio": "https://news.un.org/feed/subscribe/en/audio/all/rss.xml",
    "NASA Breaking": "https://www.nasa.gov/news-release/feed/",
    "NASA Solar": "https://www.nasa.gov/feed/",
    "EC Press": "https://ec.europa.eu/commission/presscorner/api/rss?language=en",
}

for name, url in checks.items():
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8, context=ctx) as resp:
            content = resp.read()
            status = resp.status
        f = feedparser.parse(content)
        print(f"{name:<25} | HTTP {status} | {len(f.entries)} entries | {f.entries[0].get('title', '')[:35] if f.entries else 'EMPTY'}")
    except Exception as e:
        print(f"{name:<25} | ERR: {str(e)[:40]}")

