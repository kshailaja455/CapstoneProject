# Publisher Registry Definitions for Traceon
# Categorized into:
# - Existing International Media (3)
# - Indian Media (10)
# - Indian Government (1)
# - Indian Regulators & Alerts (2)
# - International Official Sources (6)

ALL_NEW_PUBLISHERS = [
    # ─── Existing International Media ───────────────────────────────────────
    {
        "name": "BBC",
        "slug": "bbc",
        "homepageUrl": "https://www.bbc.com/news",
        "description": "British Broadcasting Corporation - World & UK News",
        "language": "en",
        "category": "Existing International Media",
        "country": "United Kingdom",
        "sourceType": "Media",
        "enabled": True,
        "feeds": [
            {
                "url": "https://feeds.bbci.co.uk/news/rss.xml",
                "name": "Top Stories",
                "category": "General",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "NPR",
        "slug": "npr",
        "homepageUrl": "https://www.npr.org",
        "description": "National Public Radio - US & International News",
        "language": "en",
        "category": "Existing International Media",
        "country": "United States",
        "sourceType": "Media",
        "enabled": True,
        "feeds": [
            {
                "url": "https://feeds.npr.org/1001/rss.xml",
                "name": "News",
                "category": "General",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "The Guardian",
        "slug": "guardian",
        "homepageUrl": "https://www.theguardian.com",
        "description": "The Guardian - Global Independent Journalism",
        "language": "en",
        "category": "Existing International Media",
        "country": "United Kingdom",
        "sourceType": "Media",
        "enabled": True,
        "feeds": [
            {
                "url": "https://www.theguardian.com/world/rss",
                "name": "World News",
                "category": "World",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },

    # ─── A. Indian Media (10) ────────────────────────────────────────────────
    {
        "name": "The Hindu",
        "slug": "the-hindu",
        "homepageUrl": "https://www.thehindu.com",
        "description": "The Hindu - India's National Newspaper",
        "language": "en",
        "category": "Indian Media",
        "country": "India",
        "sourceType": "Media",
        "enabled": True,
        "feeds": [
            {
                "url": "https://www.thehindu.com/feeder/default.rss",
                "name": "Main Feed",
                "category": "General",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "The Indian Express",
        "slug": "the-indian-express",
        "homepageUrl": "https://indianexpress.com",
        "description": "The Indian Express - Journalism of Courage",
        "language": "en",
        "category": "Indian Media",
        "country": "India",
        "sourceType": "Media",
        "enabled": True,
        "feeds": [
            {
                "url": "https://indianexpress.com/feed/",
                "name": "Latest News",
                "category": "General",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "NDTV",
        "slug": "ndtv",
        "homepageUrl": "https://www.ndtv.com",
        "description": "NDTV - Top Stories and Breaking News from India",
        "language": "en",
        "category": "Indian Media",
        "country": "India",
        "sourceType": "Media",
        "enabled": True,
        "feeds": [
            {
                "url": "https://feeds.feedburner.com/ndtvnews-top-stories",
                "name": "Top Stories",
                "category": "General",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "The Times of India",
        "slug": "the-times-of-india",
        "homepageUrl": "https://timesofindia.indiatimes.com",
        "description": "The Times of India - Breaking News, India News, Top Stories",
        "language": "en",
        "category": "Indian Media",
        "country": "India",
        "sourceType": "Media",
        "enabled": True,
        "feeds": [
            {
                "url": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
                "name": "Top Stories",
                "category": "General",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "Hindustan Times",
        "slug": "hindustan-times",
        "homepageUrl": "https://www.hindustantimes.com",
        "description": "Hindustan Times - India News & World News",
        "language": "en",
        "category": "Indian Media",
        "country": "India",
        "sourceType": "Media",
        "enabled": True,
        "feeds": [
            {
                "url": "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
                "name": "India News",
                "category": "General",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "Mint",
        "slug": "mint",
        "homepageUrl": "https://www.livemint.com",
        "description": "Livemint - Business, Finance & Economy News",
        "language": "en",
        "category": "Indian Media",
        "country": "India",
        "sourceType": "Media",
        "enabled": True,
        "feeds": [
            {
                "url": "https://www.livemint.com/rss/news",
                "name": "Latest News",
                "category": "Business",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "ThePrint",
        "slug": "theprint",
        "homepageUrl": "https://theprint.in",
        "description": "ThePrint - Indian Politics, Policy & Strategic Affairs",
        "language": "en",
        "category": "Indian Media",
        "country": "India",
        "sourceType": "Media",
        "enabled": False,  # Cloudflare HTTP 403 block on automated RSS requests
        "feeds": [
            {
                "url": "https://theprint.in/feed/",
                "name": "Main Feed",
                "category": "General",
                "enabled": False,
                "lastStatus": "error",
                "lastError": "HTTP 403: Cloudflare anti-bot bot protection blocks automated RSS fetch",
            }
        ]
    },
    {
        "name": "Scroll.in",
        "slug": "scroll-in",
        "homepageUrl": "https://scroll.in",
        "description": "Scroll.in - Independent News, Politics & Culture",
        "language": "en",
        "category": "Indian Media",
        "country": "India",
        "sourceType": "Media",
        "enabled": True,
        "feeds": [
            {
                "url": "https://feeds.feedburner.com/ScrollinArticles.rss",
                "name": "Latest Articles",
                "category": "General",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "LiveLaw",
        "slug": "livelaw",
        "homepageUrl": "https://www.livelaw.in",
        "description": "LiveLaw - Indian Legal News, Supreme Court & High Courts",
        "language": "en",
        "category": "Indian Media",
        "country": "India",
        "sourceType": "Media",
        "enabled": True,
        "feeds": [
            {
                "url": "https://www.livelaw.in/google_feeds.xml",
                "name": "Legal News Feed",
                "category": "Legal",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "Alt News",
        "slug": "alt-news",
        "homepageUrl": "https://altnews.in",
        "description": "Alt News - Fact-Checking & Misinformation Research",
        "language": "en",
        "category": "Indian Media",
        "country": "India",
        "sourceType": "Media",
        "enabled": True,
        "feeds": [
            {
                "url": "https://altnews.in/feed/",
                "name": "Fact Checks",
                "category": "Fact Check",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },

    # ─── B. Indian Government (1) ────────────────────────────────────────────
    {
        "name": "PIB Regional",
        "slug": "pib-regional",
        "homepageUrl": "https://pib.gov.in",
        "description": "Press Information Bureau - Regional Releases & Branch Offices",
        "language": "en",
        "category": "Indian Government",
        "country": "India",
        "sourceType": "Government",
        "enabled": True,
        "feeds": [
            {
                "url": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
                "name": "Regional Releases (Mumbai/Western)",
                "category": "Government",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },

    # ─── C. Indian Regulators & Alerts (2) ───────────────────────────────────
    {
        "name": "RBI Press Releases",
        "slug": "rbi-press-releases",
        "homepageUrl": "https://rbi.org.in",
        "description": "Reserve Bank of India - Official Press Releases & Policy Statements",
        "language": "en",
        "category": "Indian Regulators",
        "country": "India",
        "sourceType": "Regulator",
        "enabled": True,
        "feeds": [
            {
                "url": "https://www.rbi.org.in/pressreleases_rss.xml",
                "name": "Press Releases",
                "category": "Regulatory",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "NDMA SACHET",
        "slug": "ndma-sachet",
        "homepageUrl": "https://sachet.ndma.gov.in",
        "description": "National Disaster Management Authority - SACHET Early Warnings & Alerts",
        "language": "en",
        "category": "Indian Regulators",
        "country": "India",
        "sourceType": "Regulator",
        "enabled": True,
        "feeds": [
            {
                "url": "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml",
                "name": "All-India Disaster Alerts",
                "category": "Disaster Alerts",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },

    # ─── D. International Official Sources (6) ──────────────────────────────
    {
        "name": "US Federal Reserve",
        "slug": "us-federal-reserve",
        "homepageUrl": "https://www.federalreserve.gov",
        "description": "Federal Reserve Board - Press Releases & Monetary Policy",
        "language": "en",
        "category": "International Official Sources",
        "country": "United States",
        "sourceType": "Central Bank",
        "enabled": True,
        "feeds": [
            {
                "url": "https://www.federalreserve.gov/feeds/press_all.xml",
                "name": "All Press Releases",
                "category": "Economy",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "UK Government",
        "slug": "uk-government",
        "homepageUrl": "https://www.gov.uk",
        "description": "GOV.UK - Official Announcements & Communications",
        "language": "en",
        "category": "International Official Sources",
        "country": "United Kingdom",
        "sourceType": "Government",
        "enabled": True,
        "feeds": [
            {
                "url": "https://www.gov.uk/search/news-and-communications.atom",
                "name": "News & Communications",
                "category": "Government",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "World Health Organization",
        "slug": "who",
        "homepageUrl": "https://www.who.int",
        "description": "World Health Organization - Global Public Health News & Advisories",
        "language": "en",
        "category": "International Official Sources",
        "country": "International",
        "sourceType": "International Organization",
        "enabled": True,
        "feeds": [
            {
                "url": "https://www.who.int/rss-feeds/news-english.xml",
                "name": "English News",
                "category": "Health",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "NASA",
        "slug": "nasa",
        "homepageUrl": "https://www.nasa.gov",
        "description": "National Aeronautics and Space Administration - News & Missions",
        "language": "en",
        "category": "International Official Sources",
        "country": "United States",
        "sourceType": "Agency",
        "enabled": True,
        "feeds": [
            {
                "url": "https://www.nasa.gov/news-release/feed/",
                "name": "News Releases",
                "category": "Science",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "US SEC",
        "slug": "us-sec",
        "homepageUrl": "https://www.sec.gov",
        "description": "U.S. Securities and Exchange Commission - Press Releases & Regulatory Actions",
        "language": "en",
        "category": "International Official Sources",
        "country": "United States",
        "sourceType": "Regulator",
        "enabled": True,
        "feeds": [
            {
                "url": "https://www.sec.gov/news/pressreleases.rss",
                "name": "Press Releases",
                "category": "Regulatory",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
    {
        "name": "European Commission",
        "slug": "european-commission",
        "homepageUrl": "https://ec.europa.eu",
        "description": "European Commission - Daily News & Press Corner",
        "language": "en",
        "category": "International Official Sources",
        "country": "European Union",
        "sourceType": "Government",
        "enabled": True,
        "feeds": [
            {
                "url": "https://ec.europa.eu/commission/presscorner/api/rss?language=en",
                "name": "Press Corner (English)",
                "category": "Government",
                "enabled": True,
                "lastStatus": "healthy",
            }
        ]
    },
]

