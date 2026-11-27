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

un_test = "https://news.un.org/feed/subscribe/en/news/topic/climate-change/feed/rss.xml"
try:
    req = urllib.request.Request(un_test, headers=headers)
    with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
        content = resp.read()
    f = feedparser.parse(content)
    print(f"UN Climate Change feed: {len(f.entries)} entries | {f.entries[0].get('title', '') if f.entries else ''}")
except Exception as e:
    print(f"UN error: {e}")

