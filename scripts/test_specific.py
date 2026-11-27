import urllib.request
import feedparser
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

feeds = {
    "Scroll.in": "https://feeds.feedburner.com/ScrollinArticles.rss",
    "NDMA SACHET India": "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml",
    "PIB National (ModId=6)": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1",
    "PIB (No Regid)": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1",
    "ThePrint": "https://theprint.in/feed/",
}

for name, url in feeds.items():
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            content = resp.read()
            status = resp.status
        f = feedparser.parse(content)
        print(f"{name:<25} | HTTP {status} | {len(f.entries)} entries | {f.entries[0].get('title', '')[:40] if f.entries else 'EMPTY'}")
    except Exception as e:
        print(f"{name:<25} | ERR: {str(e)[:45]}")

