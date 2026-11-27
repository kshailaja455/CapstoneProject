import urllib.request
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = [
    ("UN News", "https://news.un.org/en/"),
    ("US FDA", "https://www.fda.gov/news-events/fda-newsroom/press-announcements"),
    ("SEBI", "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&smid=0&smiid=0"),
    ("Gazette of India", "https://egazette.gov.in/"),
]

for name, u in urls:
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
            html = r.read().decode("utf-8", errors="ignore")
        found = re.findall(r'href=["\']([^"\']*(?:rss|feed|atom)[^"\']*)["\']', html, re.I)
        print(f"=== {name} ===")
        print(list(set(found))[:5])
    except Exception as e:
        print(f"=== {name} error: {e} ===")

