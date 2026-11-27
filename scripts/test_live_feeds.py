import urllib.request
import feedparser

feeds = {
    'BBC': 'https://feeds.bbci.co.uk/news/rss.xml',
    'NPR': 'https://feeds.npr.org/1001/rss.xml',
    'The Guardian': 'https://www.theguardian.com/world/rss'
}

for name, url in feeds.items():
    print(f'=== {name} ===')
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Traceon-FeedIngester/2.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read()
        f = feedparser.parse(content)
        print(f'Status: OK | Entries count: {len(f.entries)}')
        if f.entries:
            for i in range(min(3, len(f.entries))):
                e = f.entries[i]
                print(f"  [{i+1}] Title: {e.get('title')}")
                print(f"      Pub: {e.get('published')}")
                print(f"      Link: {e.get('link')}")
    except Exception as e:
        print(f'Error fetching {name}: {e}')

