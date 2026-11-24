import assert from "node:assert/strict";
import test from "node:test";

import {
  assessClusterQuality,
  analyzeNarratives,
  buildCandidateCorpusStats,
  buildEventFeatures,
  classifyRelationship,
  completeLinkGroups,
  extractQualityEntities,
  extractTypedEntities,
  stableEventKey,
  stableNarrativeKey,
  type EventInput,
} from "./narrativeEngine";

const CORPUS_BACKGROUND = [
  { title: "Meteorologists forecast monsoon rain", summary: "Weather tracking reports storm movement and heavy rainfall." },
  { title: "Cricket tournament begins in Delhi", summary: "Players prepare for the opening match and tournament schedule." },
  { title: "Film festival announces its annual programme", summary: "Actors and directors gather for a new cinema season." },
  { title: "Hospital expands cancer treatment services", summary: "Doctors discuss patient recovery and medical research." },
  { title: "Court hears housing appeal", summary: "Judges review a local property dispute and public notice." },
];

function quality(articles: Array<Record<string, any>>, corpusArticles = [...articles, ...CORPUS_BACKGROUND]) {
  return assessClusterQuality({
    clusterId: "quality-test",
    label: "Test cluster",
    topTerms: [],
    articleIds: articles.map((_, index) => "article-" + index),
    articles,
    corpusArticles,
  });
}

function qualityArticle(title: string, summary: string, body = (summary + " ").repeat(8), index = 0) {
  return {
    _id: "article-" + index,
    title, summary, body,
    url: "https://example.test/" + index,
  };
}

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

function multiArticleEvent(clusterId: string, articles: Array<{ title: string; summary: string; source?: string; publishedAt?: Date; body?: string }>): ReturnType<typeof buildEventFeatures> {
  return buildEventFeatures({
    clusterId, label: clusterId, topTerms: [], articleIds: articles.map((_, index) => `${clusterId}-${index}`),
    articles: articles.map((article, index) => ({
      _id: `${clusterId}-${index}`, url: `https://example.test/${clusterId}/${index}`,
      source: article.source || `Publisher ${index}`, publishedAt: article.publishedAt || new Date("2026-11-20T10:00:00Z"),
      title: article.title, summary: article.summary, body: article.body ?? `${article.summary} `.repeat(4),
    })),
  });
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

test("quality entity aliases recognize Dhanraj without changing relationship entity extraction", () => {
  assert.ok(extractQualityEntities("CV Dhanraj murder verdict").some((entity) => entity.canonical === "CV Dhanraj"));
  assert.ok(extractQualityEntities("Compass plans US share listing").some((entity) => entity.canonical === "Compass Group"));
  assert.ok(extractQualityEntities("WhatsApp Web warning").some((entity) => entity.canonical === "WhatsApp"));
  assert.ok(!extractTypedEntities("CV Dhanraj murder verdict").some((entity) => entity.canonical === "CV Dhanraj"));
});

test("cluster quality recognizes consistent coverage of one event", () => {
  const result = quality([
    qualityArticle("APEC summit opens in Shenzhen", "APEC leaders opened the summit in Shenzhen and signed a regional trade declaration.", undefined, 0),
    qualityArticle("Leaders sign trade declaration at Shenzhen APEC summit", "The APEC summit in Shenzhen ended with leaders signing a declaration on regional trade.", undefined, 1),
  ]);
  assert.ok(result.score >= 55, JSON.stringify(result));
  assert.equal(result.evidence.comparedArticlePairs, 1);
  assert.ok(result.evidence.sharedImportantEntities.includes("APEC"));
  assert.equal(result.outlierArticleIds.length, 0);
});

test("cluster quality flags unrelated topics within one cluster", () => {
  const result = quality([
    qualityArticle("Wedding photographers complain about unpaid bookings", "Wedding photographers say clients cancelled bookings and refused payments.", undefined, 0),
    qualityArticle("Cricket players complain about damaged balls", "Cricket players reported damaged match balls during the tournament.", undefined, 1),
  ]);
  assert.ok(result.flags.includes("LOW_TOPIC_COHERENCE"), JSON.stringify(result));
  assert.ok(result.flags.includes("POSSIBLE_MIXED_CLUSTER"), JSON.stringify(result));
  assert.ok(result.score < 55);
});

test("cluster quality identifies a single unrelated outlier article", () => {
  const result = quality([
    qualityArticle("Microsoft investigates global cloud service outage", "Microsoft engineers investigate a cloud outage affecting business customers worldwide.", undefined, 0),
    qualityArticle("Microsoft restores cloud services after global outage", "Microsoft says engineers restored cloud services after the outage disrupted business customers.", undefined, 1),
    qualityArticle("Cricket board receives complaints about damaged balls", "Cricket players complain that match balls were damaged during the tournament.", undefined, 2),
  ]);
  assert.ok(result.flags.includes("POSSIBLE_OUTLIER_ARTICLE"), JSON.stringify(result));
  assert.ok(result.evidence.outlierTitles.some((title) => title.includes("Cricket")));
});

test("shared entity does not hide evidence of different incidents inside a cluster", () => {
  const result = quality([
    qualityArticle("Microsoft investigates global cloud outage", "Microsoft engineers investigate a cloud outage affecting business customers.", undefined, 0),
    qualityArticle("Microsoft launches new Xbox console", "Microsoft unveiled a new Xbox gaming console for players.", undefined, 1),
  ]);
  assert.ok(result.evidence.sharedImportantEntities.includes("Microsoft"));
  assert.ok(result.flags.includes("POSSIBLE_MIXED_CLUSTER"), JSON.stringify(result));
});

test("cluster quality reports limited article content without treating missing text as mismatch", () => {
  const result = quality([
    qualityArticle("Microsoft outage affects customers", "", "", 0),
    qualityArticle("Microsoft restores service", "", "", 1),
  ]);
  assert.ok(result.flags.includes("LIMITED_ARTICLE_CONTENT"));
  assert.equal(result.signals.articleContentSimilarity, null);
  assert.equal(result.evidence.contentAvailableArticleCount, 0);
});

test("cluster quality handles different wording for the same named event", () => {
  const result = quality([
    qualityArticle("APEC summit begins in Shenzhen", "Asia-Pacific Economic Cooperation leaders began their regional summit in Shenzhen.", undefined, 0),
    qualityArticle("Asia-Pacific Economic Cooperation leaders gather for Shenzhen talks", "Leaders gathered in Shenzhen for the APEC meeting and discussed regional trade.", undefined, 1),
  ]);
  assert.ok(result.evidence.sharedImportantEntities.includes("APEC"));
  assert.ok(result.score >= 45, JSON.stringify(result));
});

test("Dhanraj murder verdict coverage across publishers is not scored as low coherence", () => {
  const result = quality([
    qualityArticle("Dhanraj murder case: Court convicts three accused, acquits 17 others", "The court delivered its verdict in the murder of CV Dhanraj in Kannur.", undefined, 0),
    qualityArticle("Kerala Court Convicts 3 BJP-RSS Workers In CPI(M) Worker CV Dhanraj's Murder, Acquits 16", "The verdict concerns the killing of CV Dhanraj and the accused workers.", undefined, 1),
    qualityArticle("Kannur court convicts three RSS activists in murder of CPI(M) worker stabbed 37 times", "Judges convicted three activists in the Dhanraj murder case.", undefined, 2),
  ]);
  assert.ok(result.score >= 45, JSON.stringify(result));
  assert.ok(result.evidence.sharedImportantEntities.includes("CV Dhanraj"));
  assert.ok(!result.flags.includes("LOW_TOPIC_COHERENCE"));
});

test("Compass listing change with different headline wording keeps reasonable coherence", () => {
  const result = quality([
    qualityArticle("NHS caterer Compass plans stock market switch in blow to London", "Compass Group plans to move its main share listing to the United States.", undefined, 0),
    qualityArticle("Catering giant to switch main share listing to US in further blow to UK", "The catering group Compass will move its primary listing from London to the US.", undefined, 1),
  ]);
  assert.ok(result.score >= 48, JSON.stringify(result));
  assert.ok(result.evidence.sharedImportantEntities.includes("Compass Group"));
});

test("WhatsApp Web warning coverage across publishers survives headline variation", () => {
  const result = quality([
    qualityArticle("WhatsApp Web users beware: govt warns against leaving accounts logged in on shared computers", "Government warns WhatsApp Web users that shared computers can leave accounts accessible.", undefined, 0),
    qualityArticle("Closing browser not enough: Government has WhatsApp Web warning", "The warning says closing a browser can leave WhatsApp Web sessions active.", undefined, 1),
    qualityArticle("Cyber Crime Coordination Centre warns of WhatsApp Web session misuse", "Authorities warn users about unauthorized access to WhatsApp Web sessions.", undefined, 2),
    qualityArticle("Avoid WhatsApp Web for official work: ministry flags cybersecurity risks", "The ministry warns about account access and WhatsApp Web security risks.", undefined, 3),
  ]);
  assert.ok(result.score >= 45, JSON.stringify(result));
  assert.ok(!result.flags.includes("POSSIBLE_MIXED_CLUSTER"), JSON.stringify(result));
  assert.ok(result.evidence.sharedImportantEntities.includes("WhatsApp"));
});

test("Court and Judge cluster identifies the unrelated Delhi vehicle restriction as an outlier", () => {
  const result = quality([
    qualityArticle("Stop acting like Baahubali, Supreme Court tells Bihar judicial officer", "The Supreme Court rebuked the Bihar judge over the police FIR dispute.", undefined, 0),
    qualityArticle("SC raps Bihar judicial officer for FIR against SP: Stop acting like Baahubali", "The Supreme Court hearing concerned the Bihar judge and the Superintendent of Police.", undefined, 1),
    qualityArticle("Supreme Court chides Bihar sessions judge over order punishing SP", "The judge and police superintendent appeared before the Supreme Court in Bihar.", undefined, 2),
    qualityArticle("SC rebukes Bihar judge for convicting SP: Do not act like Bahubali", "The Supreme Court criticized the Bihar judge during the police officer case.", undefined, 3),
    qualityArticle("Only BS-VI vehicles to ply in Delhi during winter: Supreme Court", "The Supreme Court ordered restrictions on vehicle use in Delhi during winter.", undefined, 4),
  ]);
  assert.ok(result.outlierArticleIds.includes("article-4"), JSON.stringify(result));
  assert.ok(result.evidence.outlierEvidence.some((item) => item.articleId === "article-4" && item.peerArticleIds.length === 4));
});

test("Nepal cluster identifies the Rahul Gandhi Asia Power Index article as an outlier", () => {
  const result = quality([
    qualityArticle("Lord Ram incomplete without Nepal: Modi, Balen Shah underline cultural ties", "Narendra Modi and Nepal leader Balen Shah discussed cultural and religious ties.", undefined, 0),
    qualityArticle("PM Modi meets Nepal PM Balendra Shah, announces aid for flood recovery", "Narendra Modi met Nepal PM Balendra Shah and announced an aid package.", undefined, 1),
    qualityArticle("India announces package for Nepal as Modi, Balen Shah unveil joint vision", "Narendra Modi and Balen Shah announced a package to strengthen India Nepal ties.", undefined, 2),
    qualityArticle("India announces development package for Nepal", "The Indian government announced a development package for Nepal.", undefined, 3),
    qualityArticle("BJP takes jibe at Rahul Gandhi after India ranks third on Asia Power Index", "The BJP criticized Rahul Gandhi over comments about the Asia Power Index.", undefined, 4),
  ]);
  assert.ok(result.outlierArticleIds.includes("article-4"), JSON.stringify(result));
  assert.ok(result.evidence.outlierEvidence.some((item) => item.remainingClusterAgreement > item.peerAgreement));
});

test("Visa event evidence excludes generic body terms from distinctive support", () => {
  const result = quality([
    qualityArticle("China says ready to work with India to facilitate visa issuance for business people", "China will facilitate visa issuance for business travellers.", "annual applicants announced government officials " .repeat(30), 0),
    qualityArticle("China says ready to work with India to facilitate visa issuance for businessmen", "China will facilitate visas for business travellers.", "annual applicants announced government officials " .repeat(30), 1),
  ]);
  const shared = result.evidence.pairExamples[0]!.sharedDistinctiveTerms;
  assert.ok(!shared.some((term) => ["annual", "applicants", "announced"].includes(term)));
  assert.ok(!result.evidence.consistentDistinctiveTerms.some((term) => ["annual", "applicants", "announced"].includes(term)));
  assert.equal(result.evidence.termFrequencyScope, "AVAILABLE_ARTICLE_CORPUS");
});

test("a long single article is insufficient cluster evidence but not limited content", () => {
  const result = quality([qualityArticle("Ministry announces a detailed policy decision", "Substantive article summary. ".repeat(15), "Detailed article content. ".repeat(20), 0)]);
  assert.ok(result.flags.includes("INSUFFICIENT_CLUSTER_EVIDENCE"));
  assert.ok(!result.flags.includes("LIMITED_ARTICLE_CONTENT"));
});

test("a single article with genuinely short content receives the limited-content flag", () => {
  const result = quality([qualityArticle("Brief report", "", "", 0)]);
  assert.ok(result.flags.includes("INSUFFICIENT_CLUSTER_EVIDENCE"));
  assert.ok(result.flags.includes("LIMITED_ARTICLE_CONTENT"));
});

test("generic shared words do not make unrelated topics coherent", () => {
  const result = quality([
    qualityArticle("People complain about wedding photographers cancelling bookings", "Officials said wedding clients reported photographer booking problems.", undefined, 0),
    qualityArticle("People complain about cricket balls during the tournament", "Officials said cricket players reported damaged match balls.", undefined, 1),
  ]);
  assert.ok(result.score < 45, JSON.stringify(result));
  assert.ok(!result.evidence.pairExamples[0]!.sharedDistinctiveTerms.some((term) => ["people", "officials", "complain"].includes(term)));
});

test("the same named incident described with varied terms retains entity and context evidence", () => {
  const result = quality([
    qualityArticle("Hasina will be arrested if she returns to Bangladesh, government says", "Bangladesh says former prime minister Sheikh Hasina faces arrest on return.", undefined, 0),
    qualityArticle("Dhaka vows to detain ex-premier on return from India", "Officials reaffirmed that Sheikh Hasina will face arrest if she comes back.", undefined, 1),
  ]);
  assert.ok(result.evidence.sharedImportantEntities.includes("Sheikh Hasina"));
  assert.ok(result.score >= 45, JSON.stringify(result));
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

test("a specific incident inside a shared APEC summit is broader context only", () => {
  const speech = event("apec-speech", "Trump accused of falling asleep during Xi Jinping speech at APEC summit in China", "The incident occurred during the leaders' summit session.");
  const overview = event("apec-overview", "APEC summit as it happened: Xi welcomes Trump on China visit", "The live coverage follows the leaders' summit meetings in China.", "NPR", new Date("2026-11-20T12:00:00Z"));
  const result = classifyRelationship(speech, overview);
  assert.equal(result.type, "BROADER_CONTEXT_ONLY", JSON.stringify(result));
  assert.equal(result.evidence.alternatives && (result.evidence.alternatives as any).sameEvent, false);
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

test("mixed headlines retain facets and a secondary subject cannot strengthen the main event", () => {
  const mixed = event("a", "Anthropic raises funds in IPO. And, Democrats nominate a House speaker", "Anthropic completed its public offering.");
  assert.equal(mixed.facets.length, 2);
  assert.ok(mixed.facets[0]!.entities.some((entity) => entity.canonical === "Anthropic"));
  assert.ok(mixed.facets[1]!.entities.some((entity) => entity.canonical === "Democratic Party"));
  const company = event("b", "Anthropic shares rise after public listing", "The IPO was the company's first day on the stock market.");
  const relationship = classifyRelationship(mixed, company);
  assert.equal(relationship.type, "UNRELATED");
  assert.equal((relationship.evidence.supportingArticlePairs as Array<any>).length, 0);
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

test("same company alone does not connect unrelated incidents", () => {
  const cloud = event("ms-cloud", "Microsoft investigates global cloud outage", "Engineers examined the Azure service disruption.");
  const xbox = event("ms-xbox", "Microsoft launches a new Xbox console", "The company unveiled a gaming device for players.", "NPR");
  const result = classifyRelationship(cloud, xbox);
  assert.equal(result.type, "UNRELATED");
  assert.equal(result.state, "REJECTED");
  assert.ok(result.evidence.supportingArticlePairs instanceof Array);
});

test("related company allegation and response are a continuing storyline", () => {
  const allegation = event("privacy-claim", "Microsoft faces allegations over Azure location tracking", "Users alleged Azure retained location tracking data.");
  const response = event("privacy-response", "Microsoft responds to Azure tracking allegations", "The company changed its Azure location tracking and data retention policy.", "NPR", new Date("2026-11-21T10:00:00Z"));
  const result = classifyRelationship(allegation, response);
  assert.equal(result.type, "CONTINUING_STORYLINE", JSON.stringify(result));
  assert.deepEqual((result.evidence.stages as any).complementary, true);
  assert.equal((result.evidence.supportingArticlePairs as unknown[]).length, 1);
});

test("allegation and unrelated response at the same company are unrelated", () => {
  const allegation = event("billing-claim", "Microsoft faces allegations over cloud billing dispute", "Customers alleged unexpected charges.");
  const response = event("work-response", "Microsoft responds to workplace discrimination complaint", "The company denied claims concerning staff treatment.", "NPR", new Date("2026-11-21T10:00:00Z"));
  assert.equal(classifyRelationship(allegation, response).type, "UNRELATED");
});

test("investigation followed by related regulatory action is a continuing storyline", () => {
  const investigation = event("azure-probe", "Regulator investigates Microsoft cloud security practices", "The inquiry examines Azure data access controls.");
  const action = event("azure-action", "Regulator orders Microsoft to change cloud security controls", "The authority issued a compliance order after investigating Azure.", "NPR", new Date("2026-11-25T10:00:00Z"));
  const result = classifyRelationship(investigation, action);
  assert.equal(result.type, "CONTINUING_STORYLINE", JSON.stringify(result));
  assert.equal((result.evidence.stages as any).complementary, true);
});

test("unrelated investigations involving the same company are unrelated", () => {
  const cloud = event("azure-investigation", "Regulator investigates Microsoft cloud security practices", "Inquiry examines Azure access controls.");
  const workplace = event("work-investigation", "Microsoft faces investigation over workplace conduct", "Officials opened an inquiry into staff complaints.", "NPR", new Date("2026-11-22T10:00:00Z"));
  assert.equal(classifyRelationship(cloud, workplace).type, "UNRELATED");
});

test("a 120-day gap does not prevent a specifically linked storyline", () => {
  const first = event("old-recall", "Microsoft investigates Recall cloud data retention complaint", "An inquiry began into Recall account retention.", "BBC", new Date("2026-01-01T10:00:00Z"));
  const later = event("new-recall", "Regulator rules on Microsoft Recall retention investigation", "The authority ordered Recall policy changes after the inquiry.", "NPR", new Date("2026-05-05T10:00:00Z"));
  const result = classifyRelationship(first, later);
  assert.equal(result.type, "CONTINUING_STORYLINE", JSON.stringify(result));
  assert.ok(result.temporalEvidence.gapHours! > 24 * 120);
  assert.match(result.explanation, /long|gap|timing|publication/i);
});

test("Phase 3.2: separate Nvidia chip-export and suspected-spy investigations are unrelated", () => {
  const exports = event("nvidia-exports", "California investigates Nvidia over chip exports to China", "The state opened a probe into whether advanced chips were sent to China.");
  const affair = event("nvidia-affair", "California subpoenas Nvidia over Jensen Huang suspected-spy affair", "The attorney general requested records about a personal relationship involving the chief executive.", "NPR", new Date("2026-11-21T10:00:00Z"));
  const result = classifyRelationship(exports, affair);
  assert.equal(result.type, "UNRELATED", JSON.stringify(result));
  assert.ok((result.evidence.supportingArticlePairs as unknown[]).length === 0);
  assert.match(result.explanation, /do not connect|incidental/i);
});

test("Phase 3.2: separate probes by the same regulator do not become one storyline", () => {
  const chip = event("probe-chip", "California investigates Nvidia chip exports to China", "The attorney general is examining advanced semiconductor shipments.");
  const privacy = event("probe-privacy", "California investigates Meta location tracking", "The attorney general opened a separate inquiry into user location data.", "NPR");
  assert.equal(classifyRelationship(chip, privacy).type, "UNRELATED");
});

test("Phase 3.2: same company and country do not connect unrelated incidents", () => {
  const exports = event("company-export", "Nvidia chip exports from California draw scrutiny", "Officials examined semiconductor shipments to China.");
  const affair = event("company-affair", "Nvidia board reviews Jensen Huang suspected-spy affair", "Directors considered a personal conduct matter involving the chief executive.", "NPR");
  assert.equal(classifyRelationship(exports, affair).type, "UNRELATED");
});

test("Phase 3.2: different publishers reporting the same investigation classify as same event", () => {
  const one = event("chip-probe-a", "California investigates Nvidia over chip exports to China", "The state opened an investigation into Nvidia chip exports to China.", "BBC");
  const two = event("chip-probe-b", "Nvidia faces California probe over China chip shipments", "California is conducting an investigation into Nvidia chip exports to China.", "NPR", new Date("2026-11-20T13:00:00Z"));
  const result = classifyRelationship(one, two);
  assert.equal(result.type, "SAME_EVENT", JSON.stringify(result));
  assert.ok((result.evidence.supportingArticlePairs as Array<any>).length > 0);
});

test("Phase 3.2: a later order tied to the same chip-export investigation continues the story", () => {
  const inquiry = event("chip-inquiry", "California investigates Nvidia chip exports to China", "The investigation into Nvidia chip exports to China examines whether advanced chips were diverted.", "BBC");
  const order = event("chip-order", "California orders Nvidia to disclose records in chip-export probe", "The order follows the investigation into Nvidia chip exports to China and requires shipment records.", "NPR", new Date("2026-11-25T10:00:00Z"));
  const result = classifyRelationship(inquiry, order);
  assert.equal(result.type, "CONTINUING_STORYLINE", JSON.stringify(result));
  assert.equal((result.evidence.stages as any).complementary, true);
});

test("Phase 3.2: differently worded company response remains linked to the specific allegation", () => {
  const allegation = event("wedding-allegation", "Bride's family alleges Delhi constable demanded Brezza before Sonipat wedding", "The family says the groom sought a car and the wedding was called off.", "BBC");
  const response = event("wedding-response", "Delhi cop denies car-demand claim after Sonipat wedding cancelled", "Constable Kuldeep rejected the allegation about the Brezza demand and disputed the family's account.", "NPR", new Date("2026-11-21T10:00:00Z"));
  const result = classifyRelationship(allegation, response);
  assert.equal(result.type, "CONTINUING_STORYLINE", JSON.stringify(result));
  assert.ok((result.evidence.supportingArticlePairs as Array<any>).length > 0);
});

test("Phase 3.2: a compound wedding headline is compared through its incident facet", () => {
  const compound = event("wedding-compound", "Delhi cop suspended after bride alleges ₹13 lakh car demand; groom denies claim", "Police suspended Constable Kuldeep after the bride's family alleged he demanded a Brezza and cancelled their Sonipat wedding.", "BBC");
  const other = event("wedding-other", "Sonipat wedding called off over Delhi constable's Brezza demand", "The bride's family says the groom demanded a car and seeks reimbursement of wedding expenses.", "NPR", new Date("2026-11-21T10:00:00Z"));
  const result = classifyRelationship(compound, other);
  assert.ok(["SAME_EVENT", "CONTINUING_STORYLINE"].includes(result.type), JSON.stringify(result));
  assert.ok((result.evidence.supportingArticlePairs as Array<any>).length > 0);
});

test("Phase 3.2: distinct eviction appeals with no shared case evidence are unrelated", () => {
  const sastra = event("sastra-eviction", "SASTRA files appeal against campus eviction order", "The university challenged a land eviction order in the Madras High Court.");
  const uk = event("uk-eviction", "UK couple appeals eviction from rented home", "The tenants challenged their landlord's notice in a county court.", "NPR", new Date("2026-11-21T10:00:00Z"));
  assert.equal(classifyRelationship(sastra, uk).type, "UNRELATED");
});

test("same topic but different incident is broader context, not continuation", () => {
  const one = event("asylum-one", "UK and EU plan talks on third-country asylum returns", "Governments discuss a returns policy after migration talks.");
  const two = event("asylum-two", "Five EU states announce Rwanda return hubs", "The separate asylum initiative proposes immigration processing hubs.", "NPR");
  const result = classifyRelationship(one, two);
  assert.ok(["BROADER_CONTEXT_ONLY", "UNRELATED"].includes(result.type));
  assert.notEqual(result.type, "CONTINUING_STORYLINE");
});

test("mixed cluster outlier is recorded and cannot support a relation", () => {
  const mixed = multiArticleEvent("mixed", [
    { title: "Nvidia investigates Jensen Huang board allegations", summary: "The board review concerns Huang and Nvidia leadership." },
    { title: "Nvidia board responds to Jensen Huang investigation", summary: "Nvidia said the board completed its inquiry into Huang." },
    { title: "Cricket players complain about damaged match balls", summary: "Players reported damaged balls during the cricket tournament." },
  ]);
  const other = event("nvidia", "Nvidia board concludes Jensen Huang leadership investigation", "The board announced the results of the Nvidia review.", "NPR", new Date("2026-11-22T10:00:00Z"));
  const result = classifyRelationship(mixed, other);
  assert.ok(result.evidence.outlierArticleIds instanceof Array);
  assert.ok((result.evidence.excludedOutlierPairs as unknown[]).length > 0);
  const supportedIds = result.evidence.supportingArticleIds as string[];
  assert.ok(supportedIds.every((id) => !(result.evidence.outlierArticleIds as string[]).includes(id)));
});

test("conflicting article-level evidence is surfaced rather than silently aggregated", () => {
  const left = multiArticleEvent("left-mixed", [
    { title: "APEC summit opens in Shenzhen", summary: "APEC leaders opened regional trade talks." },
    { title: "Cricket board investigates damaged match balls", summary: "Players reported damaged balls during the tournament." },
  ]);
  const right = event("right-apec", "APEC leaders open Shenzhen summit with trade declaration", "The summit began in Shenzhen with regional trade talks.", "NPR");
  const result = classifyRelationship(left, right);
  assert.equal(result.type, "SAME_EVENT");
  assert.ok(result.evidence.outlierArticleIds instanceof Array);
  assert.ok((result.evidence.supportingArticlePairs as Array<any>).every((pair) => pair.leftTitle.includes("APEC")));
});

test("genuine multi-article progression uses distinct supporting reports and chronology", () => {
  const allegation = multiArticleEvent("allegation-set", [
    { title: "Microsoft faces allegations over Azure data retention", summary: "Customers alleged Azure stored account data too long.", source: "BBC", publishedAt: new Date("2026-11-19T10:00:00Z") },
    { title: "Azure users question Microsoft retention policy", summary: "Customers raised concerns about retained Azure account data.", source: "Guardian", publishedAt: new Date("2026-11-19T12:00:00Z") },
  ]);
  const response = multiArticleEvent("response-set", [
    { title: "Microsoft responds to Azure retention allegations", summary: "The company said it changed the account retention policy.", source: "NPR", publishedAt: new Date("2026-11-21T10:00:00Z") },
    { title: "Microsoft updates Azure data retention after allegations", summary: "The updated policy followed user concerns about stored account data.", source: "AP", publishedAt: new Date("2026-11-21T12:00:00Z") },
  ]);
  const result = classifyRelationship(allegation, response);
  assert.equal(result.type, "CONTINUING_STORYLINE", JSON.stringify(result));
  assert.ok((result.evidence.supportingArticlePairs as unknown[]).length >= 2);
  assert.ok((result.evidence.supportingArticleIds as unknown[]).length >= 3);
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

function candidatePairResult(left: ReturnType<typeof event>, right: ReturnType<typeof event>, threshold = 42) {
  const analysis = analyzeNarratives([left, right], threshold);
  const excluded = analysis.candidateDiagnostics.representativeExcludedPairs.find((item) => item.left === left.label && item.right === right.label
    || item.left === right.label && item.right === left.label);
  return { analysis, relation: analysis.relationships[0], excluded: excluded?.relevance };
}

test("NCERT complaints and cricket complaints are not proposed from generic overlap", () => {
  const result = candidatePairResult(
    event("ncert", "Students raise complaints about NCERT textbook errors", "Parents complain about errors in school textbooks and lessons."),
    event("cricket", "Players raise complaints about cricket balls", "The team says match balls were damaged during practice.", "NPR"),
  );
  assert.equal(result.relation, undefined);
  assert.equal(result.excluded, undefined);
  assert.equal(result.analysis.candidateDiagnostics.consideredPairCount, 0);
  assert.equal(result.analysis.candidateDiagnostics.excludedPairCount, 0);
  assert.equal(result.analysis.candidateDiagnostics.consideredPairCount,
    result.analysis.candidateDiagnostics.includedPairCount + result.analysis.candidateDiagnostics.excludedPairCount);
  assert.equal(Object.values(result.analysis.candidateDiagnostics.scoreHistogram).reduce((sum, count) => sum + count, 0),
    result.analysis.candidateDiagnostics.consideredPairCount);
});

test("different unrelated headlines sharing government are not proposed from generic overlap", () => {
  const result = candidatePairResult(
    event("gov-a", "Government announces maritime service fee consultation", "Officials requested feedback on port charges."),
    event("gov-b", "Government cancels concert after venue safety concerns", "Organizers said the music event will not proceed.", "NPR"),
  );
  assert.equal(result.relation, undefined);
  assert.equal(result.excluded, undefined);
  assert.equal(result.analysis.candidateDiagnostics.consideredPairCount, 0);
});

test("a shared broad organization without a shared incident is not sent to classification", () => {
  const result = candidatePairResult(
    event("court-a", "Supreme Court hears Bihar judge police dispute", "The hearing concerns a local police complaint."),
    event("court-b", "Supreme Court restricts Delhi vehicles during winter", "The order applies to high-emission vehicles.", "NPR"),
  );
  assert.equal(result.relation, undefined);
  assert.ok(result.excluded?.sharedSpecificEntities.some((entity) => entity.canonical === "Supreme Court" && entity.weight < 0.5));
  assert.ok(result.excluded?.exclusionReasons.some((reason) => reason.includes("broad actors")));
});

test("different publishers reporting one incident remain candidate pairs", () => {
  const result = candidatePairResult(
    event("summit-a", "Trump and Xi open APEC summit in Shenzhen", "Leaders opened the APEC summit in Shenzhen and discussed regional trade.", "BBC"),
    event("summit-b", "APEC meeting begins as Trump and Xi arrive in Shenzhen", "The leaders gathered in Shenzhen for talks on regional trade.", "NPR", new Date("2026-11-20T13:00:00Z")),
  );
  assert.ok(result.relation);
  assert.equal(result.relation.candidateRelevance.decision, "INCLUDED");
  assert.ok(result.relation.candidateRelevance.sharedDistinctiveTerms.length > 0
    || result.relation.candidateRelevance.sharedSpecificEntities.some((entity) => entity.weight >= 0.5));
  assert.ok(["SAME_EVENT", "CONTINUING_STORYLINE"].includes(result.relation.evaluation.type));
});

test("allegation followed by an official response is discovered through structured continuity evidence", () => {
  const result = candidatePairResult(
    event("allegation", "Microsoft faces allegations over customer data collection", "Users alleged the company retained location data.", "BBC"),
    event("response", "Microsoft responds to privacy allegations over retained location data", "The company denied wrongdoing and said it changed its retention policy.", "NPR", new Date("2026-11-21T10:00:00Z")),
  );
  assert.ok(result.relation);
  assert.ok(result.relation.candidateRelevance.continuityIndicators.some((cue) => cue.includes("allegation") && cue.includes("response")));
  assert.equal(result.relation.candidateRelevance.decision, "INCLUDED");
  assert.ok(result.relation.evaluation.explanation.length > 0);
  const evidence = result.relation.candidateRelevance.articlePairEvidence.find((pair) => pair.selected)!;
  assert.ok(Array.isArray(evidence.sharedSummaryTerms));
  assert.ok(Array.isArray(evidence.sharedArticleBodyTerms));
  assert.ok(evidence.continuityEvidence.some((item) => item.leftContext.toLowerCase().includes("alleg") && item.rightContext.toLowerCase().includes("respond")));
});

test("investigation followed by regulatory action is discovered and explained", () => {
  const result = candidatePairResult(
    event("probe", "Regulator investigates Microsoft cloud security practices", "The inquiry examines data access controls.", "BBC"),
    event("action", "Regulator orders Microsoft to change cloud security controls", "The authority issued a compliance order after its investigation.", "NPR", new Date("2026-11-25T10:00:00Z")),
  );
  assert.ok(result.relation);
  assert.ok(result.relation.candidateRelevance.continuityIndicators.some((cue) => cue.includes("investigation") && cue.includes("official_action")));
  assert.equal(result.relation.candidateRelevance.decision, "INCLUDED");
});

test("long-gap continuing storyline remains a candidate when specific issue and progression evidence agree", () => {
  const result = candidatePairResult(
    event("old", "Microsoft investigates cloud data retention complaint", "An inquiry began into cloud account data retention.", "BBC", new Date("2026-01-01T10:00:00Z")),
    event("new", "Regulator rules on Microsoft cloud data retention investigation", "The authority ordered changes after the long-running inquiry.", "NPR", new Date("2026-05-01T10:00:00Z")),
  );
  assert.ok(result.relation);
  assert.ok((result.relation.candidateRelevance.temporalEvidence.gapHours || 0) > 24 * 30);
  assert.equal(result.relation.candidateRelevance.decision, "INCLUDED");
});

test("one specific person in unrelated incidents is considered but excluded", () => {
  const result = candidatePairResult(
    event("person-a", "Rahul Gandhi visits flood-hit district", "The opposition leader met families after severe monsoon flooding."),
    event("person-b", "Rahul Gandhi comments on Asia Power Index ranking", "The politician discussed India's position in a global ranking.", "NPR"),
  );
  assert.equal(result.relation, undefined);
  assert.ok(result.excluded?.sharedSpecificEntities.some((entity) => entity.canonical === "Rahul Gandhi"));
  assert.ok(result.excluded?.exclusionReasons.some((reason) => reason.includes("No compatible member-article pair")));
});

test("different broad categories do not prevent a genuine response storyline", () => {
  const result = candidatePairResult(
    event("business", "Company faces allegations over contaminated bottled water", "Customers reported illness after drinking the water.", "BBC"),
    event("health", "Health regulator investigates bottled water company after illness reports", "Officials opened a public safety inquiry into the contamination.", "NPR", new Date("2026-11-23T10:00:00Z")),
  );
  assert.ok(result.relation);
  assert.ok(result.relation.candidateRelevance.topicCompatibility !== null);
  assert.equal(result.relation.candidateRelevance.decision, "INCLUDED");
});

test("mixed-quality event contributes warnings and lowers candidate relevance", () => {
  const mixed = buildEventFeatures({
    clusterId: "mixed",
    label: "Microsoft outage / wedding photography complaints",
    topTerms: [], articleIds: ["mix-1", "mix-2"],
    articles: [
      qualityArticle("Microsoft investigates cloud service outage", "Microsoft engineers investigate a cloud outage affecting customers.", undefined, 1),
      qualityArticle("Wedding photographers complain about unpaid bookings", "Photographers report cancelled bookings and unpaid work.", undefined, 2),
    ], corpusArticles: CORPUS_BACKGROUND,
  });
  const related = event("related", "Microsoft restores cloud service after outage investigation", "The company completed a review of affected systems.", "NPR");
  const result = candidatePairResult(mixed, related);
  assert.ok(result.relation);
  assert.ok(result.relation.candidateRelevance.clusterQualityWarnings.length > 0);
  assert.deepEqual(result.relation.candidateRelevance.articlePairEvidence[0]?.leftArticleId, "article-1");
  assert.ok(!result.relation.candidateRelevance.articlePairEvidence[0]?.leftTitle.includes("Wedding"));
});

test("strong article-level Nvidia evidence survives a mixed cluster warning without borrowing its outlier", () => {
  const mixed = buildEventFeatures({
    clusterId: "mixed-nvidia", label: "Nvidia / Ukraine / Congress", topTerms: [],
    articleIds: ["nvidia-article", "unrelated-article"],
    articles: [
      qualityArticle("Nvidia reinstates Jensen Huang as CEO after espionage controversy", "The board restored Jensen Huang as chief executive after a company review.", undefined, 3),
      qualityArticle("Russian drone debris hits building near Ukraine presidential office", "The incident followed an overnight attack in Kyiv.", undefined, 4),
    ], corpusArticles: CORPUS_BACKGROUND,
  });
  const related = event("nvidia-story", "Jensen Huang returns as Nvidia CEO after board vote", "The board voted to reinstate Huang after the espionage controversy.", "NPR", new Date("2026-11-21T10:00:00Z"));
  const result = candidatePairResult(mixed, related);
  assert.ok(result.relation, JSON.stringify(result.excluded));
  assert.ok(result.relation.candidateRelevance.clusterQualityWarnings.some((warning) => warning.includes("POSSIBLE_MIXED_CLUSTER")));
  assert.ok(result.relation.candidateRelevance.sharedSpecificEntities.some((entity) => entity.canonical === "Nvidia"));
  assert.ok(!result.relation.candidateRelevance.articlePairEvidence.find((pair) => pair.selected)?.leftTitle.includes("drone"));
});

test("allegation to response to investigation to regulatory action remains discoverable", () => {
  const chain = [
    event("chain-allegation", "Microsoft faces allegations over customer data retention", "Users allege that Microsoft retained location data."),
    event("chain-response", "Microsoft responds to allegations over retained customer data", "The company denies wrongdoing and describes policy changes.", "NPR", new Date("2026-11-21T10:00:00Z")),
    event("chain-investigation", "Regulator investigates Microsoft's customer data retention", "The authority opened a formal inquiry.", "BBC", new Date("2026-11-24T10:00:00Z")),
    event("chain-action", "Regulator orders Microsoft to change customer data retention", "The order follows the inquiry into the company's practices.", "NPR", new Date("2026-12-02T10:00:00Z")),
  ];
  const analysis = analyzeNarratives(chain, 42);
  assert.ok(analysis.relationships.some((pair) => pair.left === 0 && pair.right === 1));
  assert.ok(analysis.relationships.some((pair) => pair.left === 2 && pair.right === 3));
  assert.ok(analysis.relationships.every((pair) => pair.candidateRelevance.decision === "INCLUDED"));
  assert.ok(analysis.relationships.some((pair) => pair.candidateRelevance.continuityIndicators.length > 0));
});

test("high-frequency generic postings are summarized without enumerating every possible pair", () => {
  const events = Array.from({ length: 20 }, (_, index) => event(
    `generic-${index}`, `Government reviews unrelated local issue ${index}`, `Officials review a separate matter number ${index}.`, index % 2 ? "NPR" : "BBC",
  ));
  const analysis = analyzeNarratives(events, 42);
  assert.equal(analysis.relationships.length, 0);
  assert.ok(analysis.candidateDiagnostics.suppressedHighFrequencyKeyCount > 0);
  assert.ok(analysis.candidateDiagnostics.suppressedKeyExamples.some((entry) => entry.reason === "HIGH_FANOUT_KEY"));
  assert.ok(analysis.candidateDiagnostics.consideredPairCount < events.length * (events.length - 1) / 2);
});

test("candidate term specificity uses corpus document frequency when available", () => {
  const corpus = Array.from({ length: 20 }, (_, index) => ({
    title: index < 16 ? `Cloud access policy ${index}` : `Regional planning update ${index}`,
    summary: index < 12 ? "Cloud access is reviewed by the service team." : "A separate local planning notice.",
    body: "General reporting details and background text.",
  }));
  const stats = buildCandidateCorpusStats(corpus);
  const make = (id: string, title: string, summary: string, source: string) => buildEventFeatures({
    clusterId: id, label: title, topTerms: [], articleIds: [id],
    articles: [{ _id: id, title, summary, body: `${summary} Detailed supporting text. `.repeat(5), source, url: `https://example.test/${id}`, publishedAt: new Date("2026-11-20T10:00:00Z") }],
    candidateCorpusStats: stats,
  });
  const analysis = analyzeNarratives([
    make("cf-a", "Luma cloud access service outage", "Luma reports a cloud access disruption." , "BBC"),
    make("cf-b", "Luma restores cloud access service", "Luma confirms access has returned." , "NPR"),
  ], 100);
  const relevance = analysis.candidateDiagnostics.representativeExcludedPairs[0]?.relevance;
  assert.ok(relevance);
  assert.ok(relevance.sharedDistinctiveTerms.includes("luma"));
  assert.ok(!relevance.sharedDistinctiveTerms.includes("cloud"));
  assert.ok(!relevance.sharedDistinctiveTerms.includes("access"));
});

test("high-frequency named entities retain bounded complementary-progression discovery", () => {
  const events = [
    event("freq-allegation", "Microsoft faces allegations over Aurora data handling", "Users allege the company retained account data."),
    event("freq-response", "Microsoft responds to allegations over Borealis data handling", "The company denies wrongdoing and describes changes.", "NPR", new Date("2026-11-22T10:00:00Z")),
    ...Array.from({ length: 24 }, (_, index) => event(
      `freq-neutral-${index}`, `Microsoft publishes quarterly shareholder calendar ${index}`, "The company released its regular investor schedule.", "BBC",
    )),
  ];
  const analysis = analyzeNarratives(events, 42);
  const pair = analysis.relationships.find((item) => item.left === 0 && item.right === 1);
  assert.ok(pair);
  assert.ok(pair.candidateRelevance.continuityIndicators.length > 0);
  assert.ok((analysis.candidateDiagnostics.suppressedKeyReasonCounts.HIGH_FANOUT_ENTITY_STRUCTURED_FALLBACK || 0) > 0);
  assert.ok(analysis.candidateDiagnostics.consideredPairCount < events.length * (events.length - 1) / 2);
});

test("borderline relevance is configurable and reports the threshold used", () => {
  const first = event("border-a", "Officials inspect northern coastal bridge repairs", "The local authority is reviewing repairs to the bridge.");
  const second = event("border-b", "Agency inspects coastal road repairs after storm damage", "Inspectors assessed the repair work.", "NPR");
  const belowBoundary = candidatePairResult(first, second, 100);
  assert.ok(belowBoundary.excluded);
  assert.ok(belowBoundary.excluded.score > 0);
  const atBoundary = candidatePairResult(first, second, belowBoundary.excluded.score);
  assert.ok(atBoundary.relation);
  assert.equal(atBoundary.relation.candidateRelevance.threshold, belowBoundary.excluded.score);
  const justAbove = candidatePairResult(first, second, belowBoundary.excluded.score + 1);
  assert.ok(justAbove.excluded);
  assert.equal(justAbove.excluded.score, belowBoundary.excluded.score);
});

test("Phase 2.2 unrelated live-evaluation examples are filtered with article-level evidence", () => {
  const pairs: Array<[string, ReturnType<typeof event>, ReturnType<typeof event>]> = [
    ["airport versus Nvidia", event("airport", "CJP Saurav Das detained at Delhi airport", "Police questioned the activist after his arrival."), event("nvidia", "Nvidia reinstates Jensen Huang as CEO", "The company announced a leadership decision.", "NPR")],
    ["landslide versus Nvidia", event("landslide", "Landslide susceptibility mapping identifies high-risk slopes", "Researchers mapped vulnerable mountain regions."), event("nvidia2", "Nvidia reinstates Jensen Huang as CEO", "The company announced a leadership decision.", "NPR")],
    ["airport versus cricket", event("airport2", "CJP Saurav Das detained at Delhi airport", "Police questioned the activist after his arrival."), event("cricket", "Wellington pitch dries before India cricket match", "Players assessed the surface before the match.", "NPR")],
    ["cybercrime Delhi versus Supreme Court Delhi", event("cyber", "Delhi Police bust cybercrime syndicate", "Police arrested suspects in an online fraud investigation."), event("vehicle", "Supreme Court restricts Delhi vehicles during winter", "The order applies to vehicle emissions.", "NPR")],
    ["India jobs versus COP31", event("jobs", "India white-collar jobs expected to expand in 2027", "Employers forecast hiring growth."), event("cop", "COP31 debate on India's development priorities", "Delegates discussed climate and economic development.", "NPR")],
  ];
  for (const [name, left, right] of pairs) {
    const result = candidatePairResult(left, right);
    assert.equal(result.relation, undefined, name);
    if (result.excluded) {
      assert.equal(result.excluded.decision, "EXCLUDED", name);
      assert.ok(result.excluded.articlePairEvidence.length > 0, name);
      assert.equal(result.excluded.articlePairEvidence[0]?.selected, true, name);
      assert.ok(result.excluded.exclusionReasons.length > 0, name);
    } else {
      assert.equal(result.analysis.candidateDiagnostics.consideredPairCount, 0, name);
    }
  }
});

test("Syed Modi does not resolve to Narendra Modi while exact identity still resolves", () => {
  assert.equal(extractTypedEntities("Syed Modi wins badminton title").some((entity) => entity.canonical === "Narendra Modi"), false);
  assert.ok(extractTypedEntities("Narendra Modi addresses reporters").some((entity) => entity.canonical === "Narendra Modi"));
  const result = candidatePairResult(
    event("syed", "Syed Modi tournament announces badminton draw", "The badminton competition honors former player Syed Modi."),
    event("narendra", "Narendra Modi announces cabinet decision", "The Indian prime minister announced a policy decision.", "NPR"),
  );
  assert.equal(result.relation, undefined);
  assert.ok(!result.excluded?.sharedSpecificEntities.some((entity) => entity.canonical === "Narendra Modi"));
});

test("unrelated allegation and response about the same organization do not borrow cluster cues", () => {
  const result = candidatePairResult(
    event("ms-allegation-a", "Microsoft faces allegations over a cloud billing dispute", "Customers alleged unexpected charges."),
    event("ms-response-b", "Microsoft responds to separate workplace discrimination complaint", "The company denied claims concerning staff treatment.", "NPR", new Date("2026-11-21T10:00:00Z")),
  );
  assert.equal(result.relation, undefined);
  assert.ok(result.excluded);
  assert.equal(result.excluded.continuityIndicators.length, 0);
  assert.ok(result.excluded.exclusionReasons.length > 0);
  assert.ok(result.excluded.articlePairEvidence[0]?.sharedEntities.some((entity) => entity.canonical === "Microsoft"));
  assert.equal(result.excluded.articlePairEvidence[0]?.continuityIndicators.length, 0);
});

test("two unrelated investigations at Microsoft do not create continuity evidence", () => {
  const result = candidatePairResult(
    event("investigation-a", "Regulator investigates Microsoft cloud security practices", "The inquiry examines access controls."),
    event("investigation-b", "Microsoft faces investigation over workplace conduct", "Officials opened an inquiry into staff complaints.", "NPR", new Date("2026-11-22T10:00:00Z")),
  );
  assert.equal(result.relation, undefined);
  assert.equal(result.excluded?.continuityIndicators.length, 0);
});

test("one ambiguous shared headline word without an incident anchor is insufficient for inclusion", () => {
  const result = candidatePairResult(
    event("word-a", "Cancer cells studied in microgravity", "Researchers examined cell growth in orbit."),
    event("word-b", "Cancer hospital hosts community outreach programme", "Students visited a hospital as part of a school event.", "NPR"),
  );
  assert.equal(result.relation, undefined);
  assert.ok(result.excluded);
  assert.ok(result.excluded.exclusionReasons.some((reason) => reason.includes("enough independent incident evidence")));
});

test("article-pair explanation records provenance and score contributions for retained evidence", () => {
  const result = candidatePairResult(
    event("few-words-a", "Microsoft reviews Luma account retention allegation", "A complaint concerns customer data storage policy."),
    event("few-words-b", "Regulator orders Microsoft policy change after Luma inquiry", "The authority acted after investigating customer data storage.", "NPR", new Date("2026-11-23T10:00:00Z")),
  );
  assert.ok(result.relation);
  const relevance = result.relation.candidateRelevance;
  assert.equal(relevance.decision, "INCLUDED");
  assert.ok(relevance.articlePairEvidence.some((pair) => pair.selected && pair.leftArticleId === "few-words-a" && pair.rightArticleId === "few-words-b"));
  assert.ok(relevance.scoreContributions.entities > 0);
  assert.ok(relevance.inclusionReasons.some((reason) => reason.includes("same article pair")));
});
