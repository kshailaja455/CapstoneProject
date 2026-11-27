import assert from "node:assert/strict";
import test from "node:test";

import { isRetiredFeedUrl, isRetiredPublisher } from "./retiredPublishers";

test("selected source records are omitted from active publisher lists", () => {
  assert.equal(isRetiredPublisher({ name: "Business Standard", slug: "business-standard" }), true);
  assert.equal(isRetiredPublisher({ name: "European Central Bank", slug: "european-central-bank" }), true);
  assert.equal(isRetiredPublisher({ name: "PIB National", slug: "pib-national" }), true);
  assert.equal(isRetiredPublisher({ name: "Reserve Bank of India", slug: "reserve-bank-of-india" }), true);
  assert.equal(isRetiredPublisher({ name: "RBI Press Releases", slug: "rbi-press-releases" }), false);
  assert.equal(isRetiredPublisher({ name: "BBC", slug: "bbc" }), false);
});

test("only the requested RBI Notifications feed is excluded", () => {
  assert.equal(isRetiredFeedUrl("https://www.rbi.org.in/notifications_rss.xml"), true);
  assert.equal(isRetiredFeedUrl("https://www.rbi.org.in/pressreleases_rss.xml"), false);
});
