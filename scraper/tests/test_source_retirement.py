import unittest
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from feeds import fetch
from feeds.retired_sources import is_retired_feed, is_retired_publisher


class RetiredSourceTests(unittest.TestCase):
    def test_selected_publishers_are_retired_by_name_or_slug(self):
        self.assertTrue(is_retired_publisher({"name": "Business Standard"}))
        self.assertTrue(is_retired_publisher({"slug": "european-central-bank"}))
        self.assertTrue(is_retired_publisher({"name": "Reserve Bank of India"}))
        self.assertFalse(is_retired_publisher({"name": "RBI Press Releases", "slug": "rbi-press-releases"}))

    def test_only_requested_rbi_feed_is_retired(self):
        self.assertTrue(is_retired_feed({"url": "https://www.rbi.org.in/notifications_rss.xml"}))
        self.assertFalse(is_retired_feed({"url": "https://www.rbi.org.in/pressreleases_rss.xml"}))

    def test_retired_feed_url_matching_is_case_insensitive(self):
        self.assertTrue(is_retired_feed({"url": "HTTPS://EGAZETTE.GOV.IN/RSSFEED.ASPX"}))
        self.assertTrue(is_retired_feed({"url": "https://PIB.GOV.IN/RSSMAIN.ASPX?MODID=6&LANG=1"}))

    def test_active_feed_loading_skips_retired_sources_and_feed(self):
        publishers = [
            {
                "name": "Business Standard",
                "slug": "business-standard",
                "enabled": True,
                "feeds": [{"url": "https://www.business-standard.com/rss/home_page_top_stories.rss", "enabled": True}],
            },
            {
                "name": "BBC",
                "slug": "bbc",
                "enabled": True,
                "feeds": [{"url": "https://feeds.bbci.co.uk/news/rss.xml", "enabled": True}],
            },
            {
                "name": "RBI Press Releases",
                "slug": "rbi-press-releases",
                "enabled": True,
                "feeds": [
                    {"url": "https://www.rbi.org.in/notifications_rss.xml", "enabled": True},
                    {"url": "https://www.rbi.org.in/pressreleases_rss.xml", "enabled": True},
                ],
            },
        ]

        class PublisherCollection:
            def find(self, _query):
                return publishers

        with patch.object(fetch, "publishers_collection", PublisherCollection()):
            targets = fetch.get_active_publishers_and_feeds()

        self.assertEqual(
            [(target["publisherName"], target["feedUrl"]) for target in targets],
            [
                ("BBC", "https://feeds.bbci.co.uk/news/rss.xml"),
                ("RBI Press Releases", "https://www.rbi.org.in/pressreleases_rss.xml"),
            ],
        )


if __name__ == "__main__":
    unittest.main()
