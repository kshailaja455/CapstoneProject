import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeNarratives,
  buildEventFeatures,
  classifyRelationship,
  completeLinkGroups,
  extractTypedEntities,
  stableEventKey,
  stableNarrativeKey,
  type EventInput,
} from "./narrativeEngine";

function event(clusterId: string, title: string, summary: string, source = "BBC", publishedAt = new Date("2026-11-20T10:00:00Z"), body = `Detailed reporting about ${title}. ${summary}. Officials and witnesses described the latest verified development. `.repeat(3)): ReturnType<typeof buildEventFeatures> {
  const input: EventInput = {
    clusterId,
    label: title,
    topTerms: [],
    articleIds: [clusterId],
    articles: [{
      title,
      summary,
      body,
      source,
      url: `https://example.test/${clusterId}`,
      publishedAt,
    }],
  };
  return buildEventFeatures(input);
}

test("typed extraction rejects title-case adjectives and resolves complete aliases", () => {
  const entities = extractTypedEntities("Violent protests ahead of Sheikh Hasina’s return to the West Bank; Donald Trump meets Xi Jinping.");
  assert.deepEqual(entities.map((entity) => `${entity.type}:${entity.canonical}`).sort(), [
    "CITY_REGION:West Bank",
    "PERSON:Donald Trump",
    "PERSON:Sheikh Hasina",
    "PERSON:Xi Jinping",
  ]);
});

test("the same prominent person in unrelated events is not a storyline", () => {
  const summit = event("a", "Trump and Xi meet at an APEC summit to discuss regional trade", "The leaders held a summit meeting in China.");
  const golf = event("b", "Trump announces a private golf course plan in Florida", "The property business said the local project would create construction jobs.", "NPR");
  const relationship = classifyRelationship(summit, golf);
  assert.ok(["UNRELATED", "INSUFFICIENT_EVIDENCE"].includes(relationship.type));
  assert.notEqual(relationship.state, "CANDIDATE");
});

test("multiple publishers on one named summit are a same-event candidate", () => {
  const first = event("a", "Trump, Xi and Putin hold an APEC summit in Shenzhen", "The APEC summit opened with a declaration on regional trade.", "BBC");
  const second = event("b", "Xi, Trump and Putin summit at APEC produces a joint declaration", "The leaders met in Shenzhen during APEC and signed a joint declaration.", "NPR", new Date("2026-11-20T15:00:00Z"));
  const relationship = classifyRelationship(first, second);
  assert.equal(relationship.type, "SAME_EVENT");
  assert.equal(relationship.state, "CANDIDATE");
  assert.ok(relationship.explanation.length > 30);
});

test("summit commentary with shared leaders is broader context, not the same occurrence", () => {
  const summit = event("a", "Xi and Trump hold an APEC summit in China", "The leaders meet in Shenzhen.");
  const commentary = event("b", "Xi and Trump summit draws political questions", "A commentator assessed the leaders' meeting.", "NPR", new Date("2026-11-20T15:00:00Z"));
  const relationship = classifyRelationship(summit, commentary);
  assert.equal(relationship.type, "BROADER_CONTEXT_ONLY");
  assert.notEqual(relationship.state, "REJECTED");
});

test("a distinct protest after a company IPO is a continuing storyline", () => {
  const ipo = event("a", "Anthropic shares rise after public market debut", "Anthropic's IPO draws investor interest and sets a technology market record.", "Guardian");
  const protest = event("b", "Protesters rally against Anthropic after its stock market debut", "The demonstrations followed the company's IPO and public listing.", "NPR", new Date("2026-11-20T19:00:00Z"));
  assert.equal(classifyRelationship(ipo, protest).type, "CONTINUING_STORYLINE");
});

test("separate asylum proposals remain broader context only", () => {
  const ukEu = event("a", "UK and EU plan talks on third-country asylum returns", "The governments will discuss a returns policy after new migration talks.");
  const rwanda = event("b", "Five EU states announce Rwanda return hubs", "The asylum initiative sets out a separate immigration policy proposal.", "Guardian");
  assert.ok(["BROADER_CONTEXT_ONLY", "UNRELATED", "INSUFFICIENT_EVIDENCE"].includes(classifyRelationship(ukEu, rwanda).type));
});

test("mixed headlines retain facets but abstain at the saved event-cluster level", () => {
  const mixed = event("a", "Anthropic raises funds in IPO. And, Democrats nominate a House speaker", "Anthropic completed its public offering.");
  assert.equal(mixed.facets.length, 2);
  assert.ok(mixed.facets[0]!.entities.some((entity) => entity.canonical === "Anthropic"));
  assert.ok(mixed.facets[1]!.entities.some((entity) => entity.canonical === "Democratic Party"));
  const company = event("b", "Anthropic shares rise after public listing", "The IPO was the company's first day on the stock market.");
  const relationship = classifyRelationship(mixed, company);
  assert.equal(relationship.type, "INSUFFICIENT_EVIDENCE");
  assert.equal(relationship.evidence.mixedHeadline, true);
});

test("navigation-only items are insufficient evidence, not deleted", () => {
  const nav = event("a", "Download now", "Download the app for latest news and alerts.");
  const story = event("b", "Local court issues a public safety notice", "Officials described the latest safety information for the community.");
  assert.equal(nav.excludedArticleCount, 1);
  assert.equal(classifyRelationship(nav, story).type, "INSUFFICIENT_EVIDENCE");
});

test("missing body and sparse article evidence abstains", () => {
  const first = event("a", "Trump and Putin summit meeting", "", "BBC", new Date(), "");
  const second = event("b", "Trump and Putin summit", "", "NPR", new Date(), "");
  const relationship = classifyRelationship(first, second);
  assert.equal(relationship.type, "INSUFFICIENT_EVIDENCE");
  assert.ok(first.qualityFlags.includes("body_missing_or_short"));
});

test("old historical reporting is retained and flagged, not automatically excluded", () => {
  const old = event("a", "Yalta conference history and postwar diplomacy", "A historical account of the 1945 negotiations and their long-term legacy.", "Guardian", new Date("2025-04-30T14:00:00Z"));
  assert.equal(old.excludedArticleCount, 0);
  assert.ok(old.qualityFlags.some((flag) => flag.includes("historical") || flag.includes("older_item")));
});

test("complete-link grouping refuses a weak transitive bridge", () => {
  const groups = completeLinkGroups(3, [
    { left: 0, right: 1, type: "SAME_EVENT" },
    { left: 1, right: 2, type: "CONTINUING_STORYLINE" },
  ]);
  assert.deepEqual(groups, [[0, 1]]);
});

test("durable event and narrative keys survive ordering and cluster-ID changes", () => {
  assert.equal(stableEventKey(["https://example.test/a", "https://example.test/b"], "x"), stableEventKey(["https://example.test/b", "https://example.test/a"], "different"));
  assert.equal(stableNarrativeKey(["event-b", "event-a"], "child"), stableNarrativeKey(["event-a", "event-b"], "child"));
});

test("candidate generation is indexed and analysis builds only coherent children", () => {
  const relatedA = event("a", "GTA 6 launch breaks sales records", "The Grand Theft Auto VI launch sets a new sales record.");
  const relatedB = event("b", "Grand Theft Auto fans attend launch events", "The GTA VI game launched worldwide after a long wait.", "NPR");
  const unrelated = event("c", "US election officials investigate polling sites", "The government announced a new vote counting review.");
  const analysis = analyzeNarratives([relatedA, relatedB, unrelated]);
  assert.ok(analysis.candidatePairCount < 3);
  assert.ok(analysis.children.every((child) => child.eventIndexes.length >= 2));
  assert.ok(analysis.relationships.every((relation) => relation.evaluation.explanation));
});
