const RETIRED_PUBLISHER_NAMES = new Set([
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
]);

const RETIRED_PUBLISHER_SLUGS = new Set([
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
]);

const RETIRED_FEED_URLS = new Set([
  "https://www.business-standard.com/rss/home_page_top_stories.rss",
  "https://ddnews.gov.in/category/national/feed/",
  "https://www.ecb.europa.eu/rss/press.html",
  "https://egazette.gov.in/rssfeed.aspx",
  "https://www.imf.org/en/news/rss?category=pressrelease",
  "https://pib.gov.in/rssmain.aspx?modid=6&lang=1",
  "https://pib.gov.in/rssmain.aspx?modid=10&lang=1&regid=1",
  "https://www.rbi.org.in/notifications_rss.xml",
  "https://www.sebi.gov.in/sebirss.xml",
  "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml",
  "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
  "https://www.worldbank.org/en/news/rss.xml",
]);

type PublisherSource = {
  name?: string;
  slug?: string;
  feeds?: Array<{ url?: string }>;
};

function normalize(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

export function isRetiredPublisher(publisher: PublisherSource): boolean {
  const name = normalize(publisher.name);
  const slug = normalize(publisher.slug);

  return RETIRED_PUBLISHER_NAMES.has(name) || RETIRED_PUBLISHER_SLUGS.has(slug);
}

export function isRetiredFeedUrl(url: string | undefined): boolean {
  return RETIRED_FEED_URLS.has(normalize(url));
}
