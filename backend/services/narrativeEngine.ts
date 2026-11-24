import { createHash } from "node:crypto";

export const NARRATIVE_RULE_VERSION = "rules-en-v1.1.0";
export const NARRATIVE_CLASSIFIER_VERSION = "article-evidence-v1";
export const NARRATIVE_CANDIDATE_GATE_VERSION = "candidate-relevance-v2";
export const NARRATIVE_CLUSTER_QUALITY_VERSION = "cluster-quality-v1.1";

export type RelationshipType =
  | "SAME_EVENT"
  | "CONTINUING_STORYLINE"
  | "BROADER_CONTEXT_ONLY"
  | "UNRELATED"
  | "INSUFFICIENT_EVIDENCE";

export type EntityType =
  | "PERSON"
  | "POLITICAL_PARTY"
  | "GOVERNMENT"
  | "ORGANIZATION"
  | "COMPANY"
  | "COUNTRY"
  | "CITY_REGION"
  | "PRODUCT_PROJECT"
  | "EVENT_PROGRAM";

export interface EntityMention {
  canonical: string;
  type: EntityType;
  matchedText: string;
}

export interface ArticleFacet {
  facetId: string;
  articleId: string;
  title: string;
  summary: string;
  body: string;
  text: string;
  articleUrl: string;
  source: string;
  publishedAt: Date | null;
  bodyPresent: boolean;
  summaryTerms: string[];
  bodyTerms: string[];
  qualityFlags: string[];
  entities: EntityMention[];
  terms: string[];
  titleTerms: string[];
}

export interface EventInput {
  clusterId: string;
  label: string;
  topTerms: string[];
  articleIds: string[];
  articles: Array<Record<string, any>>;
  /** Other available articles used only for corpus-wide term weighting. */
  corpusArticles?: Array<Record<string, any>>;
  candidateCorpusStats?: CandidateCorpusStats;
}

export interface CandidateCorpusStats {
  documentCount: number;
  headlineTermFrequency: Map<string, number>;
  articleTermFrequency: Map<string, number>;
}

export interface ClusterQualityAssessment {
  /** 0-100; higher means member articles are more internally coherent. */
  score: number;
  scale: "0-100";
  signals: {
    topicConsistency: number | null;
    headlineSimilarity: number | null;
    summarySimilarity: number | null;
    articleContentSimilarity: number | null;
    importantEntityOverlap: number | null;
    distinctiveTermConsistency: number | null;
    conflictingTopicRate: number | null;
  };
  flags: string[];
  outlierArticleIds: string[];
  evidence: {
    articleCount: number;
    comparedArticlePairs: number;
    categories: string[];
    conflictingCategoryPairs: string[];
    sharedImportantEntities: string[];
    consistentDistinctiveTerms: string[];
    contentAvailableArticleCount: number;
    termFrequencyScope: "AVAILABLE_ARTICLE_CORPUS" | "CLUSTER_ONLY_FALLBACK";
    outlierTitles: string[];
    outlierEvidence: Array<{
      articleId: string;
      title: string;
      peerAgreement: number;
      remainingClusterAgreement: number;
      agreementGap: number;
      peerArticleIds: string[];
    }>;
    pairExamples: Array<{
      leftArticleId: string;
      rightArticleId: string;
      leftTitle: string;
      rightTitle: string;
      cohesion: number;
      headlineSimilarity: number | null;
      summarySimilarity: number | null;
      articleContentSimilarity: number | null;
      sharedImportantEntities: string[];
      sharedHeadlineTerms: string[];
      sharedSummaryTerms: string[];
      sharedBodyTerms: string[];
      sharedDistinctiveTerms: string[];
      topicCategories: string[][];
    }>;
  };
  explanation: string;
}

export interface EventFeature {
  clusterId: string;
  label: string;
  articleIds: string[];
  articleUrls: string[];
  articleFingerprints: string[];
  sources: string[];
  publishedAtMin: Date | null;
  publishedAtMax: Date | null;
  entities: EntityMention[];
  entityKeys: string[];
  terms: string[];
  titleTerms: string[];
  issueKeys: string[];
  facets: ArticleFacet[];
  qualityFlags: string[];
  categories: string[];
  eligibleArticleCount: number;
  excludedArticleCount: number;
  fingerprint: string;
  clusterQuality: ClusterQualityAssessment;
  /** Shared, read-only corpus statistics used only by the candidate gate. */
  candidateCorpusStats?: CandidateCorpusStats;
}

export interface RelationshipEvaluation {
  type: RelationshipType;
  state: "CANDIDATE" | "REJECTED" | "INSUFFICIENT_EVIDENCE";
  supportingEntities: EntityMention[];
  supportingTerms: string[];
  temporalEvidence: { gapHours: number | null; interpretation: string };
  contradictingEvidence: string[];
  explanation: string;
  evidence: Record<string, unknown>;
  parentKeys: string[];
}

export interface CandidateRelevanceEvidence {
  score: number;
  threshold: number;
  decision: "INCLUDED" | "EXCLUDED";
  sharedDistinctiveTerms: string[];
  sharedBodyOnlyTerms: string[];
  sharedSpecificEntities: Array<{ canonical: string; type: string; weight: number; contextual: boolean }>;
  topicCompatibility: number | null;
  temporalEvidence: { gapHours: number | null; compatibility: number | null; interpretation: string };
  continuityIndicators: string[];
  clusterQualityWarnings: string[];
  inclusionReasons: string[];
  exclusionReasons: string[];
  candidateKeys: string[];
  candidateKeyEvidence: Array<{ key: string; leftArticleIds: string[]; rightArticleIds: string[] }>;
  articlePairEvidence: Array<{
    leftArticleId: string;
    rightArticleId: string;
    leftTitle: string;
    rightTitle: string;
    sharedHeadlineTerms: string[];
    sharedDistinctiveHeadlineTerms: string[];
    sharedSummaryTerms: string[];
    sharedArticleBodyTerms: string[];
    sharedBodyTerms: string[];
    sharedEntities: Array<{ canonical: string; type: string; weight: number }>;
    continuityIndicators: string[];
    continuityEvidence: Array<{ indicator: string; leftContext: string; rightContext: string }>;
    topicCompatibility: number;
    temporalGapHours: number | null;
    score: number;
    selected: boolean;
  }>;
  scoreContributions: { terms: number; entities: number; topic: number; temporal: number; continuity: number; clusterQuality: number };
}

export interface CandidateDiagnostics {
  threshold: number;
  consideredPairCount: number;
  includedPairCount: number;
  excludedPairCount: number;
  scoreHistogram: Record<string, number>;
  suppressedHighFrequencyKeyCount: number;
  suppressedKeyReasonCounts: Record<string, number>;
  suppressedKeyExamples: Array<{ key: string; memberEventCount: number; possiblePairCount: number; reason: string }>;
  excludedReasonCounts: Record<string, number>;
  representativeExcludedPairs: Array<{ left: string; right: string; relevance: CandidateRelevanceEvidence }>;
}

type AliasEntry = { canonical: string; type: EntityType; aliases: string[] };

// Conservative, curated English aliases for known reporting. Unknown
// capitalization is not promoted to an entity. Expand only with reviewed data.
const ALIASES: AliasEntry[] = [
  { canonical: "Donald Trump", type: "PERSON", aliases: ["Donald Trump", "Trump"] },
  { canonical: "Xi Jinping", type: "PERSON", aliases: ["Xi Jinping", "Xi"] },
  { canonical: "Vladimir Putin", type: "PERSON", aliases: ["Vladimir Putin", "Putin"] },
  // "Modi" alone is not identity-specific (e.g. badminton player Syed Modi).
  { canonical: "Narendra Modi", type: "PERSON", aliases: ["Narendra Modi"] },
  { canonical: "Rahul Gandhi", type: "PERSON", aliases: ["Rahul Gandhi"] },
  { canonical: "Amit Shah", type: "PERSON", aliases: ["Amit Shah"] },
  { canonical: "Sheikh Hasina", type: "PERSON", aliases: ["Sheikh Hasina", "Hasina"] },
  { canonical: "Joanne Young", type: "PERSON", aliases: ["Joanne Young"] },
  { canonical: "Gregory Meeks", type: "PERSON", aliases: ["Gregory Meeks"] },
  { canonical: "Anthony Zurcher", type: "PERSON", aliases: ["Anthony Zurcher"] },
  { canonical: "Joe Biden", type: "PERSON", aliases: ["Joe Biden", "Biden"] },
  { canonical: "Volodymyr Zelenskyy", type: "PERSON", aliases: ["Volodymyr Zelenskyy", "Zelenskyy", "Zelensky"] },
  { canonical: "Democratic Party", type: "POLITICAL_PARTY", aliases: ["Democratic Party", "Democrats", "Dems"] },
  { canonical: "Republican Party", type: "POLITICAL_PARTY", aliases: ["Republican Party", "Republicans", "GOP"] },
  { canonical: "Labour Party", type: "POLITICAL_PARTY", aliases: ["Labour Party"] },
  { canonical: "United States Government", type: "GOVERNMENT", aliases: ["US government", "U.S. government", "United States government", "Trump administration"] },
  { canonical: "United Kingdom Government", type: "GOVERNMENT", aliases: ["UK government", "British government", "United Kingdom government"] },
  { canonical: "European Union", type: "GOVERNMENT", aliases: ["European Union", "EU"] },
  { canonical: "Anthropic", type: "COMPANY", aliases: ["Anthropic"] },
  { canonical: "OpenAI", type: "COMPANY", aliases: ["OpenAI", "Open AI"] },
  { canonical: "Microsoft", type: "COMPANY", aliases: ["Microsoft"] },
  { canonical: "Apple", type: "COMPANY", aliases: ["Apple"] },
  { canonical: "Google", type: "COMPANY", aliases: ["Google"] },
  { canonical: "Meta", type: "COMPANY", aliases: ["Meta"] },
  { canonical: "Tesla", type: "COMPANY", aliases: ["Tesla"] },
  { canonical: "United Nations", type: "ORGANIZATION", aliases: ["United Nations", "UN"] },
  { canonical: "APEC", type: "EVENT_PROGRAM", aliases: ["Asia-Pacific Economic Cooperation", "APEC", "Apec"] },
  { canonical: "Grand Theft Auto VI", type: "PRODUCT_PROJECT", aliases: ["Grand Theft Auto VI", "Grand Theft Auto 6", "GTA VI", "GTA 6", "GTA"] },
  { canonical: "Claude", type: "PRODUCT_PROJECT", aliases: ["Claude"] },
  { canonical: "Ukraine", type: "COUNTRY", aliases: ["Ukraine"] },
  { canonical: "Russia", type: "COUNTRY", aliases: ["Russia"] },
  { canonical: "China", type: "COUNTRY", aliases: ["China"] },
  { canonical: "India", type: "COUNTRY", aliases: ["India"] },
  { canonical: "Pakistan", type: "COUNTRY", aliases: ["Pakistan"] },
  { canonical: "Israel", type: "COUNTRY", aliases: ["Israel"] },
  { canonical: "Palestine", type: "COUNTRY", aliases: ["Palestine"] },
  { canonical: "Iran", type: "COUNTRY", aliases: ["Iran"] },
  { canonical: "Rwanda", type: "COUNTRY", aliases: ["Rwanda"] },
  { canonical: "United Kingdom", type: "COUNTRY", aliases: ["United Kingdom", "UK", "Britain"] },
  { canonical: "United States", type: "COUNTRY", aliases: ["United States", "U.S.", "US", "America"] },
  { canonical: "Australia", type: "COUNTRY", aliases: ["Australia"] },
  { canonical: "European Union", type: "COUNTRY", aliases: ["EU"] },
  { canonical: "New York", type: "CITY_REGION", aliases: ["New York"] },
  { canonical: "San Francisco", type: "CITY_REGION", aliases: ["San Francisco"] },
  { canonical: "Washington, DC", type: "CITY_REGION", aliases: ["Washington, DC", "Washington DC"] },
  { canonical: "Berlin", type: "CITY_REGION", aliases: ["Berlin"] },
  { canonical: "Shenzhen", type: "CITY_REGION", aliases: ["Shenzhen"] },
  { canonical: "West Bank", type: "CITY_REGION", aliases: ["West Bank"] },
  { canonical: "Gaza", type: "CITY_REGION", aliases: ["Gaza", "Gaza Strip"] },
  { canonical: "Yalta Conference", type: "EVENT_PROGRAM", aliases: ["Yalta Conference", "Yalta format"] },
];

const GENERIC_TERMS = new Set((
  "about after again all also and any are around article articles as at back be because been before being between both " +
  "breaking by can could day days did do does during each even every first for from get got had has have he her here " +
  "him his how if in into is it its just latest like made make may more most new news no not now of off on one only or " +
  "other our out over said says she should since so some still story stories such than that the their them then there these " +
  "they this those through time today tomorrow two under up us very was we were what when where which while who will with " +
  "would year years bbc npr guardian reported report reports source sources live latest watch read click download " +
  "government president minister officials people world country countries state states city leaders group groups " +
  "company companies market shares stock rise fall plan plans week month week monday tuesday wednesday thursday friday " +
  "saturday sunday published updated after says across amid against around according found told including earlier following " +
  "detailed reporting officials witnesses described latest verified development discussion discussions " +
  "united states europe european british america trump xi putin china russia ukraine uk us" 
).split(/\s+/));

const CANDIDATE_GENERIC_TERMS = new Set([
  ...GENERIC_TERMS,
  "complaint", "complaints", "complained", "complaining", "announced", "announce", "announces",
  "news", "report", "reports", "reported", "says", "said", "government", "official", "officials",
  "people", "court", "recent", "latest", "india", "country", "ministry", "department", "raise", "raises", "faces",
  "allegation", "allegations", "alleged", "response", "responded", "investigation", "investigates", "investigated",
  "inquiry", "inquiries", "probe", "probes", "regulator", "regulators", "regulatory", "action", "official", "resolution",
  // Common report frames and broad place/topic words are not incident anchors.
  "case", "cases", "worker", "workers", "join", "joins", "joined", "hand", "hands", "local", "business",
  "space", "land", "develop", "develops", "developed", "development", "food", "former", "death", "deaths",
  "held", "must", "justice", "judgment", "judgements", "verdict", "verdicts", "letters", "letter", "november",
  "december", "january", "february", "march", "april", "june", "july", "august", "september", "october",
  "bengal", "west", "punjab", "haryana", "pradesh", "uttar", "telangana", "delhi", "mumbai", "chennai",
  "myanmar", "nepal", "global", "state", "states", "public", "announces", "announced",
  "woman", "women", "man", "men", "husband", "wife", "attack", "attacks", "attacked", "killed", "kill", "killing",
]);

// These words can establish a shared setting for BROADER_CONTEXT_ONLY, but
// cannot identify an incident or support SAME_EVENT/CONTINUING_STORYLINE.
const CLASSIFIER_CONTEXT_TERMS = new Set(["summit", "leader", "leaders", "leadership", "speech", "talk", "talks", "meeting", "conference", "visit"]);
const CLASSIFIER_GENERIC_TERMS = new Set([
  ...CANDIDATE_GENERIC_TERMS,
  ...CLASSIFIER_CONTEXT_TERMS,
  // Common page chrome copied into scraped summaries or bodies.
  "closed", "continue", "continues", "continued", "reading", "click", "watch", "live", "readers", "related",
  // Broad legal and housing vocabulary can establish a subject area, but not
  // the identity of a specific case (for example two unrelated evictions).
  "eviction", "evictions", "evicted", "appeal", "appeals", "housing", "dispute", "disputes",
  // Generic social-event vocabulary must not connect separate wedding stories.
  "wedding", "marriage", "family", "families", "father", "bride", "groom", "cop", "police", "constable", "demand",
  // Repeated press language, jurisdiction, and page boilerplate are not issue anchors.
  "bright", "red", "flags", "conduct", "scandal", "raises", "opened", "company", "chief", "executive", "officials",
  "whether",
]);
const CLASSIFIER_STAGE_TERMS = new Set([
  "allegation", "allegations", "alleged", "accused", "accusation", "accusations", "claim", "claims",
  "response", "responds", "responded", "denies", "denied", "investigation", "investigations", "investigates",
  "investigated", "probe", "probes", "probing", "inquiry", "inquiries", "inquest", "audit", "subpoena",
  "subpoenas", "regulator", "regulators", "regulatory", "sanction", "sanctions", "fine", "fined", "penalty",
  "order", "orders", "ruling", "verdict", "charged", "charge", "charges", "resolved", "resolution",
  "settlement", "withdrawn", "reversed", "overturned", "cleared", "acquitted", "suspended", "suspension",
  "cancelled", "canceled", "after", "following", "since", "later", "subsequent",
]);
const CLASSIFIER_AUTHORITY_AND_JURISDICTION_TERMS = new Set([
  "california", "bonta", "attorney", "general", "lawyer", "prosecutor", "prosecutors", "authority", "authorities",
  "agency", "agencies", "department", "commission", "commissioner", "state", "states", "county", "counties",
  "district", "jurisdiction", "federal", "national", "china", "delhi", "india",
]);

const CONTINUITY_CUE_GROUPS: Array<[string, RegExp]> = [
  ["allegation", /\b(?:allegations?|alleg(?:e|es|ed)|accused|accusations?|claims?)\b/i],
  ["response", /\b(?:respond(?:s|ed|ing)?|response|denies|denied|rebuts?|answers?|apologizes?|apologised)\b/i],
  ["investigation", /\b(?:investigat\w*|probe|inquiry|inquest|audit)\b/i],
  ["official_action", /\b(?:regulator\w*|regulatory|sanction\w*|fined|fine|penalt\w*|orders?|rules?|ruling|verdict|charged|charges|recall\w*)\b/i],
  ["resolution", /\b(?:resolved|resolution|settlement|withdraw\w*|reversed|overturned|cleared|acquitted)\b/i],
  ["escalation", /\b(?:escalat\w*|expanded|widened|intensif\w*|further action)\b/i],
];

const NAVIGATION_TITLE = /^(?:download now|click here|read more|continue reading|subscribe|sign in|page not found)$/i;
const PROMOTIONAL = /\b(?:official trailer|watch the trailer|teaser|streaming now|in cinemas|tickets on sale|tune in|don't miss|do not miss|download now|every .{2,70} has its secrets)\b/i;
const SAME_EVENT_MARKERS = /\b(?:summit|meeting|launch|trial|verdict|attack|crash|storm|earthquake|election|vote|strike|fire|agreement|declaration|conference|final|match)\b/i;
const SAME_INCIDENT_MARKERS = /\b(?:summit|meeting|launch|trial|verdict|investigat\w*|inquiry|probe|subpoena|attack|crash|storm|earthquake|election|vote|strike|fire|agreement|declaration|conference|final|match|reinstat\w*|appoint\w*|elect\w*|suspend\w*|cancel\w*|called off|dowry)\b/i;
const HISTORICAL_CUE = /\b(?:historical|history|in \d{4}|years ago|anniversary|legacy|remembering|century|ancient|archive)\b/i;

const ENTITY_PATTERN = new RegExp(
  ALIASES.flatMap((entry) => entry.aliases.map((alias) => ({ entry, alias })))
    .sort((left, right) => right.alias.length - left.alias.length)
    .map(({ alias }) => `(?<![\\p{L}\\p{N}])${alias.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(?:[’']s)?(?![\\p{L}\\p{N}])`)
    .join("|"),
  "giu",
);

const ALIAS_BY_NORMALIZED = new Map<string, AliasEntry>();
for (const entry of ALIASES) {
  for (const alias of entry.aliases) ALIAS_BY_NORMALIZED.set(alias.toLocaleLowerCase(), entry);
}

function normalize(value: unknown): string {
  return String(value ?? "").normalize("NFKC").replace(/\uFFFD/g, " ").replace(/\s+/g, " ").trim();
}

export function extractTypedEntities(text: string): EntityMention[] {
  const mentions: EntityMention[] = [];
  const seen = new Set<string>();
  const expression = new RegExp(ENTITY_PATTERN.source, ENTITY_PATTERN.flags);
  for (const match of text.matchAll(expression)) {
    const matchedText = match[0];
    const lookup = matchedText.replace(/[’']s$/i, "").toLocaleLowerCase();
    const entry = ALIAS_BY_NORMALIZED.get(lookup);
    if (!entry) continue;
    const key = `${entry.type}:${entry.canonical}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mentions.push({ canonical: entry.canonical, type: entry.type, matchedText });
  }
  return mentions;
}

// Quality-only aliases expand validation evidence without changing the
// entity features consumed by relationship classification.
const QUALITY_ALIASES: AliasEntry[] = [
  ...ALIASES,
  { canonical: "CV Dhanraj", type: "PERSON", aliases: ["CV Dhanraj", "C. V. Dhanraj", "Dhanraj"] },
  { canonical: "Compass Group", type: "COMPANY", aliases: ["Compass Group", "Compass"] },
  { canonical: "Nvidia", type: "COMPANY", aliases: ["Nvidia"] },
  { canonical: "WhatsApp", type: "PRODUCT_PROJECT", aliases: ["WhatsApp", "WhatsApp Web"] },
  { canonical: "CPI(M)", type: "POLITICAL_PARTY", aliases: ["CPI(M)", "CPI (M)", "CPI-M"] },
  { canonical: "Supreme Court", type: "ORGANIZATION", aliases: ["Supreme Court"] },
];

function normalizedAlias(value: string): string {
  return normalize(value).toLocaleLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const QUALITY_ALIAS_LOOKUP = new Map<string, AliasEntry>();
for (const entry of QUALITY_ALIASES) for (const alias of entry.aliases) QUALITY_ALIAS_LOOKUP.set(normalizedAlias(alias), entry);
const QUALITY_ENTITY_PATTERN = new RegExp(
  QUALITY_ALIASES.flatMap((entry) => entry.aliases.map((alias) => ({ entry, alias })))
    .sort((left, right) => right.alias.length - left.alias.length)
    .map(({ alias }) => "(?<![\\p{L}\\p{N}])" + alias.replace(/[.*+?^$()|[\]\\]/g, "\\$&") + "(?:[’']s)?(?![\\p{L}\\p{N}])")
    .join("|"),
  "giu",
);

export function extractQualityEntities(text: string): EntityMention[] {
  const mentions: EntityMention[] = [];
  const seen = new Set<string>();
  const expression = new RegExp(QUALITY_ENTITY_PATTERN.source, QUALITY_ENTITY_PATTERN.flags);
  for (const match of text.matchAll(expression)) {
    const matchedText = match[0].replace(/[’']s$/i, "");
    const entry = QUALITY_ALIAS_LOOKUP.get(normalizedAlias(matchedText));
    if (!entry) continue;
    const key = entry.type + ":" + entry.canonical;
    if (seen.has(key)) continue;
    seen.add(key);
    mentions.push({ canonical: entry.canonical, type: entry.type, matchedText });
  }
  return mentions;
}

function termsFor(text: string): string[] {
  const tokens = text.toLocaleLowerCase().match(/[a-z][a-z0-9'-]{3,}/g) ?? [];
  return [...new Set(tokens.filter((token) => !GENERIC_TERMS.has(token) && !/^\d+$/.test(token)))].sort();
}

export function buildCandidateCorpusStats(articles: Array<Record<string, any>>): CandidateCorpusStats {
  const headlineTermFrequency = new Map<string, number>();
  const articleTermFrequency = new Map<string, number>();
  const rawTerms = (text: string) => new Set(text.toLocaleLowerCase().match(/[a-z][a-z0-9'-]{3,}/g) || []);
  for (const article of articles) {
    for (const term of rawTerms(normalize(article.title))) headlineTermFrequency.set(term, (headlineTermFrequency.get(term) || 0) + 1);
    const terms = rawTerms([article.title, article.summary, article.body].map(normalize).join(" "));
    for (const term of terms) articleTermFrequency.set(term, (articleTermFrequency.get(term) || 0) + 1);
  }
  return { documentCount: articles.length, headlineTermFrequency, articleTermFrequency };
}

const CATEGORY_RULES: Array<[string, RegExp]> = [
  ["politics", /\b(?:election|parliament|congress|senate|minister|president|party|vote|government|policy|democrat|republican)\b/i],
  ["business_technology", /\b(?:company|shares|stock|market|ipo|technology|artificial intelligence|ai|software|startup|business|investment|earnings)\b/i],
  ["conflict_diplomacy", /\b(?:war|conflict|ceasefire|peace talks|summit|diplomacy|military|attack|troops|ukraine|gaza|russia)\b/i],
  ["climate_environment", /\b(?:climate|environment|emissions|flood|wildfire|drought|storm|weather|pollution|conservation)\b/i],
  ["entertainment", /\b(?:film|movie|music|actor|actress|celebrity|television|tv|podcast|game|gaming|album|theatre)\b/i],
  ["crime_public_safety", /\b(?:police|court|trial|guilty|murder|crime|arrest|charged|prosecutor|rape|abuse|fire|safety)\b/i],
  ["social_issues", /\b(?:asylum|immigration|health|education|rights|poverty|housing|society|consent|protest|community)\b/i],
  ["sports", /\b(?:football|soccer|basketball|cricket|tennis|rugby|nba|nfl|premier league|championship|match|tournament)\b/i],
];

function categoriesFor(text: string): string[] {
  return CATEGORY_RULES.filter(([, expression]) => expression.test(text)).map(([category]) => category);
}

const QUALITY_GENERIC_TERMS = new Set([
  "annual", "applicant", "applicants", "application", "applications", "announced", "announce", "announces",
  "official", "officials", "government", "minister", "people", "company", "companies", "according", "report",
  "reports", "reported", "source", "sources", "statement", "statements", "today", "yesterday", "latest",
  "breaking", "read", "more", "click", "subscribe", "follow", "news", "published", "updated", "said", "says",
  "complain", "complains", "complaints", "india", "china", "russia", "ukraine", "britain", "europe",
  "worker", "workers", "activist", "activists", "judge", "judges", "court", "courts",
  "officer", "officers", "service", "services", "group", "groups",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
]);
const MIN_QUALITY_CONTENT_CHARS = 120;
const QUALITY_SOURCE_WEIGHTS = { headline: 1, summary: 0.75, body: 0.25 };

type QualityProfile = {
  id: string;
  title: string;
  headlineTerms: Set<string>;
  summaryTerms: Set<string>;
  bodyTerms: Set<string>;
  categories: Set<string>;
  entities: Map<string, number>;
  primaryEntityKeys: Set<string>;
  contextEntities: Set<string>;
  sourceTerms: Map<string, number>;
  contentAvailable: boolean;
};

function qualityTerms(text: string): Set<string> {
  const cleaned = normalize(text)
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
    .replace(/\b(?:read more|also read|subscribe now|follow us|click here|advertisement|related stories)\b[\s\S]{0,180}/gi, " ");
  return new Set(termsFor(cleaned).filter((term) => !QUALITY_GENERIC_TERMS.has(term)));
}

function cosineSimilarity(left: Set<string>, right: Set<string>): number | null {
  if (!left.size || !right.size) return null;
  let shared = 0;
  for (const term of left) if (right.has(term)) shared += 1;
  return shared / Math.sqrt(left.size * right.size);
}

function weightedCosine(left: Map<string, number>, right: Map<string, number>): number | null {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const value of left.values()) leftNorm += value * value;
  for (const value of right.values()) rightNorm += value * value;
  if (!leftNorm || !rightNorm) return null;
  for (const [term, value] of left) dot += value * (right.get(term) || 0);
  return dot / Math.sqrt(leftNorm * rightNorm);
}

function entityWeight(entity: EntityMention): number {
  if (["PERSON", "PRODUCT_PROJECT", "EVENT_PROGRAM"].includes(entity.type)) return 1;
  if (entity.type === "COMPANY") return 0.9;
  if (entity.type === "POLITICAL_PARTY") return 0.6;
  if (["ORGANIZATION", "GOVERNMENT"].includes(entity.type)) return 0.4;
  return 0;
}

/**
 * Read-only cluster validation. Scores use 0-100. A null signal is unavailable,
 * not a mismatch. At least 120 characters of summary/body text count as
 * substantive content. Singleton clusters are insufficient cluster evidence,
 * but only receive LIMITED_ARTICLE_CONTENT when that text is actually absent.
 */
export function assessClusterQuality(input: EventInput): ClusterQualityAssessment {
  const profiles: QualityProfile[] = input.articles.map((article, index) => {
    const title = normalize(article.title);
    const summary = normalize(article.summary);
    const body = normalize(article.body).slice(0, 12_000);
    const headlineTerms = qualityTerms(title);
    const summaryTerms = qualityTerms(summary);
    const bodyTerms = qualityTerms(body);
    const entities = new Map<string, number>();
    const primaryEntityKeys = new Set<string>();
    const contextEntities = new Set<string>();
    const primaryEntities = extractQualityEntities(title + " " + summary);
    const bodyEntities = extractQualityEntities(body.slice(0, 4_000))
      .filter((entity) => ["PERSON", "COMPANY", "PRODUCT_PROJECT", "EVENT_PROGRAM"].includes(entity.type));
    for (const entity of [...primaryEntities, ...bodyEntities]) {
      const key = entity.type + ":" + entity.canonical;
      const weight = entityWeight(entity);
      if (weight > 0) {
        entities.set(key, Math.max(entities.get(key) || 0, weight));
        if (primaryEntities.includes(entity)) primaryEntityKeys.add(key);
      }
      else if (entity.type === "CITY_REGION") contextEntities.add(key);
    }
    const sourceTerms = new Map<string, number>();
    for (const term of headlineTerms) sourceTerms.set(term, QUALITY_SOURCE_WEIGHTS.headline);
    for (const term of summaryTerms) sourceTerms.set(term, Math.max(sourceTerms.get(term) || 0, QUALITY_SOURCE_WEIGHTS.summary));
    for (const term of bodyTerms) sourceTerms.set(term, Math.max(sourceTerms.get(term) || 0, QUALITY_SOURCE_WEIGHTS.body));
    const contentText = summary + " " + body;
    return {
      id: normalize(article.narrativeArticleId || article._id || article.id || input.articleIds[index] || ("article-" + index)),
      title: title || ("Article " + (index + 1)),
      headlineTerms, summaryTerms, bodyTerms,
      categories: new Set(categoriesFor(title + " " + summary)),
      entities, primaryEntityKeys, contextEntities, sourceTerms,
      contentAvailable: contentText.trim().length >= MIN_QUALITY_CONTENT_CHARS,
    };
  });

  const corpus = input.corpusArticles?.length ? input.corpusArticles : input.articles;
  const hasBroaderCorpus = corpus.length > profiles.length;
  const corpusFrequencies = new Map<string, number>();
  for (const article of corpus) {
    const terms = new Set([
      ...qualityTerms(normalize(article.title) + " " + normalize(article.summary) + " " + normalize(article.body).slice(0, 12_000)),
    ]);
    for (const term of terms) corpusFrequencies.set(term, (corpusFrequencies.get(term) || 0) + 1);
  }
  const corpusSize = Math.max(1, corpus.length);
  const idf = (term: string) => {
    if (QUALITY_GENERIC_TERMS.has(term)) return 0;
    const frequency = corpusFrequencies.get(term) || 0;
    return Math.log((corpusSize + 1) / (frequency + 1));
  };
  const weightedTerms = profiles.map((profile) => new Map([...profile.sourceTerms]
    .map(([term, sourceWeight]) => [term, idf(term) * sourceWeight] as [string, number])
    .filter(([, weight]) => weight > 0)));

  const sums: Record<"topic" | "headline" | "summary" | "body" | "entity" | "distinctive" | "conflict", number[]> = {
    topic: [], headline: [], summary: [], body: [], entity: [], distinctive: [], conflict: [],
  };
  const pairScores: Array<{ left: number; right: number; score: number }> = [];
  const pairEvidence: ClusterQualityAssessment["evidence"]["pairExamples"] = [];
  const conflicts = new Set<string>();
  const pairCount = profiles.length * (profiles.length - 1) / 2;

  for (let left = 0; left < profiles.length; left += 1) {
    for (let right = left + 1; right < profiles.length; right += 1) {
      const a = profiles[left]!;
      const b = profiles[right]!;
      const headline = cosineSimilarity(a.headlineTerms, b.headlineTerms);
      const summary = cosineSimilarity(a.summaryTerms, b.summaryTerms);
      const body = a.contentAvailable && b.contentAvailable ? cosineSimilarity(a.bodyTerms, b.bodyTerms) : null;
      // Body-only entity mentions count only when the other article names that
      // entity in its own headline or summary; this suppresses passing mentions.
      const supportedEntitiesA = new Map([...a.entities].filter(([key]) => a.primaryEntityKeys.has(key) || b.primaryEntityKeys.has(key)));
      const supportedEntitiesB = new Map([...b.entities].filter(([key]) => b.primaryEntityKeys.has(key) || a.primaryEntityKeys.has(key)));
      const entity = weightedCosine(supportedEntitiesA, supportedEntitiesB);
      const distinctive = hasBroaderCorpus ? weightedCosine(weightedTerms[left]!, weightedTerms[right]!) : null;
      const category = cosineSimilarity(a.categories, b.categories);
      const topicParts: Array<[number | null, number]> = [
        [headline, 0.45], [summary, 0.40], [body, 0.10], [category, 0.05],
      ];
      const usableTopic = topicParts.filter((entry): entry is [number, number] => entry[0] !== null);
      let topic = usableTopic.length
        ? usableTopic.reduce((sum, entry) => sum + entry[0] * entry[1], 0) / usableTopic.reduce((sum, entry) => sum + entry[1], 0)
        : null;
      const sharedEntityKeys = [...supportedEntitiesA.keys()].filter((key) => supportedEntitiesB.has(key));
      const sharedAnchors = sharedEntityKeys.map((key) => key.split(":")[0] || "");
      const sharedIncidentTerms = [...a.headlineTerms, ...a.summaryTerms]
        .filter((term, index, terms) => terms.indexOf(term) === index && (b.headlineTerms.has(term) || b.summaryTerms.has(term)) && idf(term) >= 0.7);
      const sharedEntityWords = new Set(sharedEntityKeys.flatMap((key) => key.split(":").slice(1).join(" ").toLocaleLowerCase().split(/\s+/)));
      const nonEntityIncidentTerms = sharedIncidentTerms.filter((term) => !sharedEntityWords.has(term));
      const hasSharedNamedIncidentAnchor = sharedAnchors.some((type) => ["PERSON", "PRODUCT_PROJECT", "EVENT_PROGRAM", "COMPANY"].includes(type))
        && nonEntityIncidentTerms.length >= 1;
      const sharedPlace = [...a.contextEntities].some((key) => b.contextEntities.has(key));
      const hasNamedEventAndPlace = sharedAnchors.includes("EVENT_PROGRAM") && sharedPlace;
      if (topic !== null && (hasSharedNamedIncidentAnchor || hasNamedEventAndPlace)) topic = Math.max(topic, 0.70);
      const textSimilarityParts = [[headline, 0.55], [summary, 0.40], [body, 0.05]] as Array<[number | null, number]>;
      const usableText = textSimilarityParts.filter((entry): entry is [number, number] => entry[0] !== null);
      const textSimilarity = usableText.length
        ? usableText.reduce((sum, entry) => sum + entry[0] * entry[1], 0) / usableText.reduce((sum, entry) => sum + entry[1], 0)
        : null;
      // Category disagreement is a conflict only when lexical/incident evidence
      // is also weak and no recognized incident-specific entity bridges the pair.
      const categoryDisjoint = a.categories.size > 0 && b.categories.size > 0 && category === 0;
      const conflict = categoryDisjoint && (textSimilarity ?? 0) < 0.16 && sharedEntityKeys.length === 0;
      if (conflict) for (const x of a.categories) for (const y of b.categories) conflicts.add([x, y].sort().join(" ↔ "));
      if (topic !== null) sums.topic.push(topic);
      if (headline !== null) sums.headline.push(headline);
      if (summary !== null) sums.summary.push(summary);
      if (body !== null) sums.body.push(body);
      if (entity !== null) sums.entity.push(entity);
      if (distinctive !== null) sums.distinctive.push(distinctive);
      if (categoryDisjoint) sums.conflict.push(conflict ? 1 : 0);

      const signals: Array<[number | null, number]> = [
        [topic, 0.25], [headline, 0.20], [summary, 0.15], [body, 0.07],
        [entity, 0.15], [distinctive, 0.13], [categoryDisjoint ? (conflict ? 0 : 1) : null, 0.05],
      ];
      const available = signals.filter((entry): entry is [number, number] => entry[0] !== null);
      const cohesion = available.reduce((sum, entry) => sum + entry[0] * entry[1], 0)
        / available.reduce((sum, entry) => sum + entry[1], 0);
      pairScores.push({ left, right, score: cohesion });
      const sharedBySource = (leftTerms: Set<string>, rightTerms: Set<string>) => [...leftTerms]
        .filter((term) => rightTerms.has(term)).sort((x, y) => idf(y) - idf(x) || x.localeCompare(y)).slice(0, 12);
      const sharedDistinctiveTerms = hasBroaderCorpus
        ? sharedBySource(new Set([...a.sourceTerms.keys()].filter((term) => idf(term) > 0.7)), new Set([...b.sourceTerms.keys()].filter((term) => idf(term) > 0.7)))
        : [];
      pairEvidence.push({
        leftArticleId: a.id, rightArticleId: b.id, leftTitle: a.title, rightTitle: b.title,
        cohesion: Math.round(cohesion * 100),
        headlineSimilarity: headline === null ? null : Math.round(headline * 100),
        summarySimilarity: summary === null ? null : Math.round(summary * 100),
        articleContentSimilarity: body === null ? null : Math.round(body * 100),
        sharedImportantEntities: sharedEntityKeys.map((key) => key.split(":").slice(1).join(":")).sort(),
        sharedHeadlineTerms: sharedBySource(a.headlineTerms, b.headlineTerms),
        sharedSummaryTerms: sharedBySource(a.summaryTerms, b.summaryTerms),
        sharedBodyTerms: sharedBySource(a.bodyTerms, b.bodyTerms),
        sharedDistinctiveTerms,
        topicCategories: [[...a.categories].sort(), [...b.categories].sort()],
      });
    }
  }
  const mean = (items: number[]) => items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : null;
  const raw = {
    topic: mean(sums.topic), headline: mean(sums.headline), summary: mean(sums.summary),
    body: mean(sums.body), entity: mean(sums.entity), distinctive: mean(sums.distinctive),
    conflict: mean(sums.conflict),
  };
  const finalSignals: Array<[number | null, number]> = [
    [raw.topic, 0.25], [raw.headline, 0.20], [raw.summary, 0.15], [raw.body, 0.07],
    [raw.entity, 0.15], [raw.distinctive, 0.13], [raw.conflict === null ? null : 1 - raw.conflict, 0.05],
  ];
  const availableFinal = finalSignals.filter((entry): entry is [number, number] => entry[0] !== null);
  const score = availableFinal.length
    ? Math.round(100 * availableFinal.reduce((sum, entry) => sum + entry[0] * entry[1], 0)
      / availableFinal.reduce((sum, entry) => sum + entry[1], 0))
    : 50;

  // An outlier must be weak against peers while the remaining members agree
  // with each other; wording differences alone cannot satisfy both conditions.
  const outlierEvidence: ClusterQualityAssessment["evidence"]["outlierEvidence"] = [];
  if (profiles.length >= 3) {
    for (let candidate = 0; candidate < profiles.length; candidate += 1) {
      const peerPairs = pairScores.filter((pair) => pair.left === candidate || pair.right === candidate);
      const peerAgreement = mean(peerPairs.map((pair) => pair.score));
      const corePairs = pairScores.filter((pair) => pair.left !== candidate && pair.right !== candidate);
      const remainingAgreement = mean(corePairs.map((pair) => pair.score));
      if (peerAgreement !== null && remainingAgreement !== null && peerAgreement <= 0.30
        && remainingAgreement >= 0.45 && remainingAgreement - peerAgreement >= 0.24) {
        outlierEvidence.push({
          articleId: profiles[candidate]!.id,
          title: profiles[candidate]!.title,
          peerAgreement: Math.round(peerAgreement * 100),
          remainingClusterAgreement: Math.round(remainingAgreement * 100),
          agreementGap: Math.round((remainingAgreement - peerAgreement) * 100),
          peerArticleIds: profiles.filter((_, index) => index !== candidate).map((profile) => profile.id),
        });
      }
    }
  }
  const entityNames = new Set(profiles.flatMap((profile) => [...profile.primaryEntityKeys]));
  const sharedEntities = [...new Set(pairEvidence.flatMap((pair) => pair.sharedImportantEntities))].sort();
  const headlineSummaryFrequencies = new Map<string, number>();
  for (const profile of profiles) {
    for (const term of new Set([...profile.headlineTerms, ...profile.summaryTerms])) {
      headlineSummaryFrequencies.set(term, (headlineSummaryFrequencies.get(term) || 0) + 1);
    }
  }
  const consistentTerms = [...headlineSummaryFrequencies.entries()]
    .filter(([term, count]) => count >= Math.max(2, Math.ceil(profiles.length * 0.6)) && hasBroaderCorpus && idf(term) >= 0.7)
    .sort((a, b) => idf(b[0]) - idf(a[0]) || b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term).slice(0, 20);
  const flags: string[] = [];
  if (profiles.length >= 2 && score < 40) flags.push("LOW_TOPIC_COHERENCE");
  if (entityNames.size >= 2 && (raw.entity ?? 1) < 0.25) flags.push("ENTITY_MISMATCH");
  if ((raw.conflict ?? 0) >= 0.34 || (raw.topic ?? 1) < 0.25) flags.push("POSSIBLE_MIXED_CLUSTER");
  if (outlierEvidence.length) flags.push("POSSIBLE_OUTLIER_ARTICLE");
  const contentCount = profiles.filter((profile) => profile.contentAvailable).length;
  if (contentCount < Math.min(2, profiles.length)) flags.push("LIMITED_ARTICLE_CONTENT");
  if (profiles.length < 2) flags.push("INSUFFICIENT_CLUSTER_EVIDENCE");
  const percent = (value: number | null) => value === null ? null : Math.round(value * 100);
  const outlierTitles = outlierEvidence.map((item) => item.title);
  const sortedEvidence = pairEvidence.slice().sort((a, b) => a.cohesion - b.cohesion);
  const representativePairs = [...sortedEvidence.slice(0, 10), ...sortedEvidence.slice(-10)]
    .filter((pair, index, list) => list.findIndex((candidate) => candidate.leftArticleId === pair.leftArticleId && candidate.rightArticleId === pair.rightArticleId) === index);
  const termScope = hasBroaderCorpus ? "AVAILABLE_ARTICLE_CORPUS" as const : "CLUSTER_ONLY_FALLBACK" as const;
  let explanation: string;
  if (profiles.length < 2) {
    explanation = "Only one member article is available, so within-cluster consistency cannot be compared. The neutral score is a placeholder, not evidence of quality.";
  } else if (flags.includes("POSSIBLE_MIXED_CLUSTER") || flags.includes("POSSIBLE_OUTLIER_ARTICLE")) {
    explanation = "The cluster has a coherence score of " + score + "/100. "
      + (conflicts.size ? "Some pairs have conflicting topic categories and weak incident evidence. " : "Member articles show weak topic-specific agreement. ")
      + (outlierEvidence.length ? outlierEvidence.length + " article(s) disagree with a more coherent peer group. " : "")
      + "Review the article-level comparisons before drawing conclusions.";
  } else {
    explanation = "The cluster has a coherence score of " + score + "/100 across " + pairCount + " article comparison(s). "
      + (contentCount < Math.min(2, profiles.length) ? "Some members lack substantive article text. " : "")
      + (sharedEntities.length ? "Repeated specific entities include " + sharedEntities.slice(0, 4).map((value) => value.split(":").slice(1).join(":")).join(", ") + ". " : "No recognized specific entity repeats across multiple members. ")
      + "This is a review signal only; cluster membership is unchanged.";
  }
  return {
    score, scale: "0-100",
    signals: {
      topicConsistency: percent(raw.topic), headlineSimilarity: percent(raw.headline),
      summarySimilarity: percent(raw.summary), articleContentSimilarity: percent(raw.body),
      importantEntityOverlap: percent(raw.entity), distinctiveTermConsistency: percent(raw.distinctive),
      conflictingTopicRate: percent(raw.conflict),
    },
    flags: flags.sort(),
    outlierArticleIds: outlierEvidence.map((item) => item.articleId),
    evidence: {
      articleCount: profiles.length, comparedArticlePairs: pairCount,
      categories: [...new Set(profiles.flatMap((profile) => [...profile.categories]))].sort(),
      conflictingCategoryPairs: [...conflicts].sort(),
      sharedImportantEntities: sharedEntities,
      consistentDistinctiveTerms: consistentTerms,
      contentAvailableArticleCount: contentCount,
      termFrequencyScope: termScope,
      outlierTitles,
      outlierEvidence,
      pairExamples: representativePairs,
    },
    explanation,
  };
}

function sentenceFacets(title: string): string[] {
  const source = title.trim();
  const parts = source.split(/\.\s*(?=(?:and|plus|meanwhile)\s*,?\s*)|\s+[|]\s+|\s*;\s*/i)
    .map((part) => part.trim().replace(/^(?:and|plus|meanwhile)\s*,?\s*/i, ""))
    .filter(Boolean);
  return parts.length > 1 ? parts : [source];
}

function dateValue(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function articleFacets(article: Record<string, any>, index: number, articleId: string): ArticleFacet[] {
  const title = normalize(article.title);
  const summary = normalize(article.summary);
  const body = normalize(article.body);
  const url = normalize(article.url);
  const source = normalize(article.source) || "Unknown";
  const publishedAt = dateValue(article.publishedAt);
  const parts = sentenceFacets(title);
  const titleCompound = parts.length > 1;
  const bodyPresent = body.length >= 80;
  const summaryPresent = summary.length >= 80;
  const flags: string[] = [];
  if (NAVIGATION_TITLE.test(title)) flags.push("navigation_or_download");
  if (PROMOTIONAL.test(`${title} ${summary}`)) flags.push("promotional_copy");
  if (titleCompound) flags.push("mixed_topic_headline");
  if (!bodyPresent) flags.push("body_missing_or_short");
  if (!summaryPresent) flags.push("summary_missing_or_short");
  if (publishedAt && (Date.now() - publishedAt.getTime()) > 365 * 24 * 60 * 60 * 1000) {
    flags.push(HISTORICAL_CUE.test(`${title} ${summary} ${body}`) ? "historical_reporting_context" : "older_item_review");
  }
  if (title.length < 18 || title.split(/\s+/).length < 3) flags.push("short_headline_review");

  return parts.map((part, partIndex) => {
    // The full summary and article text support only the primary facet of a
    // compound headline. A secondary headline facet must match its own text.
    const primary = partIndex === 0;
    const text = [part, primary ? summary : "", primary ? body.slice(0, 12_000) : ""].filter(Boolean).join(" ");
    return {
      facetId: `${index}:${partIndex}`,
      articleId,
      title: part,
      summary: primary ? summary : "",
      body: primary ? body.slice(0, 12_000) : "",
      text,
      articleUrl: url,
      source,
      publishedAt,
      bodyPresent,
      summaryTerms: primary ? termsFor(summary) : [],
      bodyTerms: primary ? termsFor(body.slice(0, 12_000)) : [],
      qualityFlags: [...flags],
      // Relationship entities must be visibly supported by the article title;
      // publisher boilerplate and unrelated body mentions cannot become links.
      entities: extractTypedEntities(part),
      terms: termsFor(text),
      titleTerms: termsFor(part),
    };
  });
}

function eventFingerprint(urls: string[], title: string): string {
  const basis = urls.length ? [...urls].sort().join("\n") : normalize(title).toLocaleLowerCase();
  return createHash("sha256").update(basis).digest("hex");
}

export function buildEventFeatures(input: EventInput): EventFeature {
  const facets = input.articles.flatMap((article, index) => articleFacets(article, index,
    normalize(article._id || article.id || input.articleIds[index]) || `article-${index}`));
  const articleUrls = [...new Set(input.articles.map((article) => normalize(article.url)).filter(Boolean))].sort();
  const articleIds = [...new Set(input.articleIds.map(String))].sort();
  const entities = new Map<string, EntityMention>();
  const terms = new Set<string>();
  const titleTerms = new Set<string>();
  const sources = new Set<string>();
  const dates: Date[] = [];
  for (const facet of facets) {
    for (const entity of facet.entities) entities.set(`${entity.type}:${entity.canonical}`, entity);
    for (const term of facet.terms) terms.add(term);
    for (const term of facet.titleTerms) titleTerms.add(term);
    sources.add(facet.source);
    if (facet.publishedAt) dates.push(facet.publishedAt);
  }
  for (const term of input.topTerms || []) for (const item of termsFor(term)) terms.add(item);
  const entityList = [...entities.values()].sort((left, right) => `${left.type}:${left.canonical}`.localeCompare(`${right.type}:${right.canonical}`));
  const entityKeys = entityList.map((entity) => `${entity.type}:${entity.canonical}`);
  const issueKeys = [...new Set(entityList.filter((entity) => !["PERSON", "COUNTRY", "CITY_REGION"].includes(entity.type)).map((entity) => `${entity.type}:${entity.canonical}`))];
  const qualityFlags = [...new Set(facets.flatMap((facet) => facet.qualityFlags))].sort();
  const categories = categoriesFor(facets.map((facet) => `${facet.title} ${facet.text}`).join(" "));
  const excludedArticleCount = input.articles.filter((article) => NAVIGATION_TITLE.test(normalize(article.title))).length;
  const articleFingerprints = input.articles.map((article) => createHash("sha256")
    .update(`${normalize(article.url)}\n${normalize(article.title)}\n${normalize(article.publishedAt)}`)
    .digest("hex"));
  const datesSorted = dates.sort((left, right) => left.getTime() - right.getTime());

  return {
    clusterId: input.clusterId,
    label: normalize(input.label) || "Untitled event",
    articleIds,
    articleUrls,
    articleFingerprints,
    sources: [...sources].sort(),
    publishedAtMin: datesSorted[0] ?? null,
    publishedAtMax: datesSorted[datesSorted.length - 1] ?? null,
    entities: entityList,
    entityKeys,
    terms: [...terms].sort(),
    titleTerms: [...titleTerms].sort(),
    issueKeys,
    facets,
    qualityFlags,
    categories,
    eligibleArticleCount: input.articles.length - excludedArticleCount,
    excludedArticleCount,
    fingerprint: eventFingerprint(articleUrls, input.label),
    clusterQuality: assessClusterQuality(input),
    ...(input.candidateCorpusStats ? { candidateCorpusStats: input.candidateCorpusStats } : {}),
  };
}

function gapHours(left: EventFeature, right: EventFeature): number | null {
  const leftDate = left.publishedAtMax;
  const rightDate = right.publishedAtMax;
  if (!leftDate || !rightDate) return null;
  return Math.abs(leftDate.getTime() - rightDate.getTime()) / 3_600_000;
}

function facetPairs(left: EventFeature, right: EventFeature): Array<{ left: ArticleFacet; right: ArticleFacet; sharedTerms: string[]; sharedTitleTerms: string[]; sharedEntities: EntityMention[] }> {
  const pairs = [];
  for (const a of left.facets) {
    for (const b of right.facets) {
      const bEntities = new Set(b.entities.map((entity) => `${entity.type}:${entity.canonical}`));
      const sharedEntities = a.entities.filter((entity) => bEntities.has(`${entity.type}:${entity.canonical}`));
      const bTerms = new Set(b.terms);
      const sharedTerms = a.terms.filter((term) => bTerms.has(term));
      const bTitleTerms = new Set(b.titleTerms);
      const sharedTitleTerms = a.titleTerms.filter((term) => bTitleTerms.has(term));
      pairs.push({ left: a, right: b, sharedTerms, sharedTitleTerms, sharedEntities });
    }
  }
  return pairs;
}

function isDistinctiveTerm(term: string, frequency?: Map<string, number>, eventCount = 0): boolean {
  if (term.length < 5 || GENERIC_TERMS.has(term)) return false;
  if (frequency && eventCount > 0) {
    const documentFrequency = frequency.get(term) ?? 0;
    return documentFrequency <= Math.max(2, Math.ceil(Math.sqrt(eventCount)));
  }
  return true;
}

export function classifyRelationship(left: EventFeature, right: EventFeature, frequency?: Map<string, number>, eventCount = 0): RelationshipEvaluation {
  const allPairs = facetPairs(left, right).map((pair) => {
    // Quality-only aliases (for example CV Dhanraj and Nvidia) are available
    // to the classifier, but only when they occur in the member headline.
    const leftEntities = new Map([...pair.left.entities, ...extractQualityEntities(`${pair.left.title} ${pair.left.summary || ""}`)]
      .map((item) => [`${item.type}:${item.canonical}`, item]));
    const rightEntities = [...pair.right.entities, ...extractQualityEntities(`${pair.right.title} ${pair.right.summary || ""}`)];
    const rightKeys = new Set(rightEntities.map((item) => `${item.type}:${item.canonical}`));
    const sharedEntities = [...leftEntities.values()].filter((item) => rightKeys.has(`${item.type}:${item.canonical}`));
    const allArticleEntities = [...leftEntities.values(), ...rightEntities];
    const anchorTerms = new Set(allArticleEntities.flatMap((entity) =>
      entity.canonical.toLocaleLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || []));
    // A shared name is reported as an entity anchor, not double-counted as
    // incident-specific lexical evidence.
    const normalizedTerm = (term: string) => term.toLocaleLowerCase().replace(/[’'-]+$/g, "");
    const meaningful = (term: string) => !anchorTerms.has(normalizedTerm(term)) && !CLASSIFIER_GENERIC_TERMS.has(normalizedTerm(term))
      && !CLASSIFIER_STAGE_TERMS.has(normalizedTerm(term))
      && !CLASSIFIER_AUTHORITY_AND_JURISDICTION_TERMS.has(normalizedTerm(term))
      && isDistinctiveTerm(term, frequency, eventCount);
    const distinctiveTerms = pair.sharedTitleTerms.filter(meaningful);
    const contextualTerms = pair.sharedTitleTerms.filter((term) => CLASSIFIER_CONTEXT_TERMS.has(normalizedTerm(term)) && !anchorTerms.has(normalizedTerm(term)));
    const rightSummary = new Set(pair.right.summaryTerms || []);
    const summaryTerms = (pair.left.summaryTerms || []).filter((term) => rightSummary.has(term) && meaningful(term));
    const rightBody = new Set(pair.right.bodyTerms || []);
    const bodyTerms = (pair.left.bodyTerms || []).filter((term) => rightBody.has(term) && meaningful(term));
    const issueTerms = [...new Set([...distinctiveTerms, ...summaryTerms])];
    const bodyIssueTerms = bodyTerms.filter(meaningful);
    const evidenceTerms = [...new Set([...issueTerms, ...bodyIssueTerms])];
    const relevantPassages = (facet: ArticleFacet) => {
      const text = `${facet.summary || ""}\n${facet.body || ""}`;
      const passages = text.split(/(?<=[.!?])\s+|\n+/).map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
      const escapeRegex = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return passages.filter((passage) => evidenceTerms.some((term) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegex(term)}(?:$|[^\\p{L}\\p{N}])`, "iu").test(passage)))
        .slice(0, 3);
    };
    const leftPassages = relevantPassages(pair.left);
    const rightPassages = relevantPassages(pair.right);
    const classifierStageNames = (facet: ArticleFacet, passages: string[]) => {
      const titleText = facet.title;
      const text = `${titleText} ${passages.join(" ")}`;
      const matches = (candidate: string) => CONTINUITY_CUE_GROUPS.filter(([name, pattern]) => pattern.test(candidate)
        && (name !== "official_action" || /\b(?:regulatory|sanction\w*|fined|fine|penalt\w*|orders?|rules?|ruling|verdict|charged|charges|subpoenas?|suspend\w*)\b/i.test(candidate)))
        .map(([name]) => name);
      const names = matches(titleText);
      if (!names.length) names.push(...matches(text));
      if (names.includes("official_action")) {
        const investigationIndex = names.indexOf("investigation");
        if (investigationIndex >= 0) names.splice(investigationIndex, 1);
      }
      if (/\b(?:cancelled|canceled|called off|withdrawn|settled)\b/i.test(titleText) && !names.includes("resolution")) names.push("resolution");
      if (/\b(?:subpoenas?|summons(?:es)?|suspend\w*|arrest\w*|charges? filed)\b/i.test(titleText) && !names.includes("official_action")) names.push("official_action");
      return names;
    };
    const stagesLeft = classifierStageNames(pair.left, leftPassages);
    const stagesRight = classifierStageNames(pair.right, rightPassages);
    const pairText = `${pair.left.title} ${pair.left.summary || ""} ${pair.right.title} ${pair.right.summary || ""} ${leftPassages.join(" ")} ${rightPassages.join(" ")}`;
    const explicitCaseLink = /\b(?:as part of (?:the )?(?:same |ongoing |earlier |previous )?(?:investigation|probe|inquiry|case)|(?:an?|the|this|that|same|ongoing|earlier|previous) (?:investigation|probe|inquiry|case) into|following (?:the )?(?:investigation|probe|inquiry) into|stemming from the (?:investigation|probe|inquiry|case)|in relation to the (?:same )?(?:allegation|investigation|probe|inquiry|case))\b/i.test(pairText);
    const explicitDevelopmentLink = /\b(?:after|following) (?:its|the company's|the) (?:ipo|public (?:market )?debut|stock market debut|listing)\b/i.test(pairText);
    const pairGap = pair.left.publishedAt && pair.right.publishedAt
      ? Math.abs(pair.left.publishedAt.getTime() - pair.right.publishedAt.getTime()) / 3_600_000 : null;
    const specificEntities = sharedEntities.filter((entity) => ["PERSON", "COMPANY", "PRODUCT_PROJECT", "EVENT_PROGRAM"].includes(entity.type));
    const sharedEvidenceTerms = evidenceTerms;
    const leftTitleEvidence = new Set([...pair.left.titleTerms, ...(pair.left.summaryTerms || [])].filter(meaningful));
    const rightTitleEvidence = new Set([...pair.right.titleTerms, ...(pair.right.summaryTerms || [])].filter(meaningful));
    const leftBodyEvidence = new Set(pair.left.bodyTerms.filter(meaningful));
    const rightBodyEvidence = new Set(pair.right.bodyTerms.filter(meaningful));
    const crossLayerLeft = [...leftTitleEvidence].filter((term) => rightBodyEvidence.has(term));
    const crossLayerRight = [...rightTitleEvidence].filter((term) => leftBodyEvidence.has(term));
    const bilateralCrossLayerSupport = crossLayerLeft.length > 0 && crossLayerRight.length > 0;
    const incidentIdentitySupport = issueTerms.length >= 2
      || (issueTerms.length >= 1 && bilateralCrossLayerSupport && specificEntities.some((entity) => entity.type === "EVENT_PROGRAM"))
      || (bodyIssueTerms.length >= 2 && bilateralCrossLayerSupport)
      || (issueTerms.length >= 1 && (explicitCaseLink || explicitDevelopmentLink) && specificEntities.length > 0);
    const broadContextSupport = specificEntities.length >= 2 && contextualTerms.length >= 1;
    const support = incidentIdentitySupport || broadContextSupport;
    return { ...pair, sharedEntities, distinctiveTerms, contextualTerms, summaryTerms, bodyTerms, specificEntities, issueTerms, bodyIssueTerms, sharedEvidenceTerms, stagesLeft, stagesRight, leftPassages, rightPassages, explicitCaseLink, explicitDevelopmentLink, bilateralCrossLayerSupport, crossLayerLeft, crossLayerRight, incidentIdentitySupport, pairGap, support };
  });
  // Never let members already identified as quality outliers vote for a
  // relationship. Keep their evidence visible as a conflict below.
  const outlierIds = new Set([...left.clusterQuality.outlierArticleIds, ...right.clusterQuality.outlierArticleIds]);
  const pairs = allPairs.filter((pair) => !outlierIds.has(pair.left.articleId) && !outlierIds.has(pair.right.articleId));
  const pairSpecificity = (pair: (typeof allPairs)[number]) => pair.issueTerms.length * 5 + pair.bodyIssueTerms.length * 2
    + pair.specificEntities.length * 3 + pair.sharedEntities.length + (pair.left.facetId.endsWith(":0") ? 1 : 0) + (pair.right.facetId.endsWith(":0") ? 1 : 0);
  const articlePairBest = new Map<string, (typeof allPairs)[number]>();
  for (const pair of pairs) {
    const key = [pair.left.articleId, pair.right.articleId].sort().join("|");
    const previous = articlePairBest.get(key);
    if (!previous || pairSpecificity(pair) > pairSpecificity(previous)) articlePairBest.set(key, pair);
  }
  const evidencePairs = [...articlePairBest.values()];
  const supportedPairs = evidencePairs.filter((pair) => pair.support);
  const bestPair = [...supportedPairs].sort((a, b) => (b.specificEntities.length * 3 + b.sharedEvidenceTerms.length * 2) - (a.specificEntities.length * 3 + a.sharedEvidenceTerms.length * 2))[0]
    || [...pairs].sort((a, b) => (b.sharedEntities.length + b.sharedEvidenceTerms.length) - (a.sharedEntities.length + a.sharedEvidenceTerms.length))[0];
  const supportingEntities = [...new Map(supportedPairs.flatMap((pair) => pair.sharedEntities).map((entity) => [`${entity.type}:${entity.canonical}`, entity])).values()];
  const supportingTerms = [...new Set(supportedPairs.flatMap((pair) => pair.sharedEvidenceTerms))]
    .sort((a, b) => (frequency?.get(a) ?? 0) - (frequency?.get(b) ?? 0) || a.localeCompare(b)).slice(0, 20);
  const sharedDistinctiveTerms = supportingTerms;
  const gap = gapHours(left, right);
  const temporalInterpretation = gap === null ? "No usable publication-time evidence." : gap <= 72
    ? "Close publication times support a shared event but do not prove one."
    : gap <= 24 * 30
      ? "The timing is compatible with a continuing storyline."
      : "The publication gap is long; historical relevance must be supported by explicit issue evidence.";
  const temporalEvidence = { gapHours: gap === null ? null : Math.round(gap), interpretation: temporalInterpretation };
  const contradictory: string[] = [];
  if (outlierIds.size) contradictory.push(`Potential outlier member(s) excluded from positive support: ${[...outlierIds].join(", ")}.`);

  if (left.eligibleArticleCount === 0 || right.eligibleArticleCount === 0) {
    return {
      type: "INSUFFICIENT_EVIDENCE", state: "INSUFFICIENT_EVIDENCE", supportingEntities, supportingTerms,
      temporalEvidence, contradictingEvidence: ["One or both event clusters contain no narrative-eligible articles."],
      explanation: "The available items are navigation-only; abstain from relationship classification.", evidence: { facetsCompared: pairs.length }, parentKeys: [],
    };
  }
  const eventSparse = (event: EventFeature) => event.facets.length > 0 && event.facets.every((facet) =>
    !facet.bodyPresent && !(facet.summaryTerms || []).length && facet.text.length < facet.title.length + 24);
  const bothSparse = eventSparse(left) && eventSparse(right);
  if (bothSparse) {
    return {
      type: "INSUFFICIENT_EVIDENCE", state: "INSUFFICIENT_EVIDENCE", supportingEntities, supportingTerms,
      temporalEvidence, contradictingEvidence: ["Both event clusters lack substantive summaries and article bodies."],
      explanation: "Headline-only resemblance is not enough to determine the relationship; abstain until fuller source text is available.", evidence: { facetsCompared: pairs.length, bothSparse: true }, parentKeys: [],
    };
  }
  if (!bestPair || supportedPairs.length === 0) {
    if (eventSparse(left) || eventSparse(right)) {
      return {
        type: "INSUFFICIENT_EVIDENCE", state: "INSUFFICIENT_EVIDENCE", supportingEntities, supportingTerms,
        temporalEvidence, contradictingEvidence: [...contradictory, "At least one event has headline-only evidence without enough article content to rule in or rule out a relationship."],
        explanation: "At least one member set has too little article text to determine whether the overlap is meaningful. Keep this as insufficient evidence rather than asserting a relationship or unrelatedness.",
        evidence: { facetsCompared: allPairs.length, outlierArticleIds: [...outlierIds], missingEvidence: ["substantive summary or body evidence"] }, parentKeys: [],
      };
    }
    return {
      type: "UNRELATED", state: "REJECTED", supportingEntities, supportingTerms,
      temporalEvidence, contradictingEvidence: [...contradictory, "No compatible article pair shares a specific incident anchor or enough distinctive terms."],
      explanation: "The available member articles describe separate events. Any shared organization or generic vocabulary is incidental, with no article-level incident or storyline evidence.",
      evidence: { facetsCompared: allPairs.length, supportingArticlePairs: [], outlierArticleIds: [...outlierIds], missingEvidence: ["specific shared incident anchor", "distinctive event terms", "linked development"] }, parentKeys: [],
    };
  }

  const sharedSignals = [...new Map(supportedPairs.flatMap((pair) => pair.specificEntities).map((entity) => [`${entity.type}:${entity.canonical}`, entity])).values()];
  const sharedTitleTerms = [...new Set(supportedPairs.flatMap((pair) => pair.distinctiveTerms))];
  const contextualTitleTerms = [...new Set(supportedPairs.flatMap((pair) => pair.contextualTerms))];
  const sharedContext = sharedTitleTerms.length >= 2 || supportingTerms.length >= 3
    || (sharedSignals.length > 0 && [...sharedTitleTerms, ...contextualTitleTerms].length >= 1);
  const missingBodies = left.qualityFlags.includes("body_missing_or_short") || right.qualityFlags.includes("body_missing_or_short");
  const composite = left.qualityFlags.includes("mixed_topic_headline") || right.qualityFlags.includes("mixed_topic_headline");
  const historical = left.qualityFlags.some((flag) => flag.includes("historical") || flag.includes("older_item")) || right.qualityFlags.some((flag) => flag.includes("historical") || flag.includes("older_item"));
  const bodyContextTerms = [...new Set(supportedPairs.flatMap((pair) => pair.bodyTerms.filter((term) => !pair.sharedTitleTerms.includes(term))))].slice(0, 12);
  const leftSources = new Set(left.sources);
  const sharedPublishers = right.sources.filter((source) => leftSources.has(source));
  const publisherCoverage = { left: left.sources, right: right.sources, shared: sharedPublishers, crossPublisher: sharedPublishers.length === 0 && left.sources.length + right.sources.length > 1 };
  const pairEvidence = supportedPairs.slice(0, 12).map((pair) => ({
    leftArticleId: pair.left.articleId, rightArticleId: pair.right.articleId,
    leftTitle: pair.left.title, rightTitle: pair.right.title,
    sharedEntities: pair.specificEntities.map((entity) => `${entity.type}:${entity.canonical}`),
    distinctiveHeadlineTerms: pair.distinctiveTerms,
    broaderContextTerms: pair.contextualTerms,
    distinctiveSummaryTerms: pair.summaryTerms,
    distinctiveBodyTerms: pair.bodyTerms,
    crossLayerTerms: { leftHeadlineToRightBody: pair.crossLayerLeft, rightHeadlineToLeftBody: pair.crossLayerRight },
    leftStages: pair.stagesLeft, rightStages: pair.stagesRight, gapHours: pair.pairGap === null ? null : Math.round(pair.pairGap),
  }));
  const allStagesLeft = new Set(supportedPairs.flatMap((pair) => pair.stagesLeft));
  const allStagesRight = new Set(supportedPairs.flatMap((pair) => pair.stagesRight));
  const stagePairs: Array<[string, string]> = [["allegation", "response"], ["investigation", "official_action"], ["investigation", "resolution"], ["official_action", "resolution"]];
  const complementaryStagePairs = supportedPairs.filter((pair) => stagePairs.some(([a, b]) =>
    (pair.stagesLeft.includes(a) && pair.stagesRight.includes(b) && !pair.stagesLeft.includes(b))
    || (pair.stagesLeft.includes(b) && pair.stagesRight.includes(a) && !pair.stagesLeft.includes(a))));
  const complementaryStages = complementaryStagePairs.length > 0;
  const chronologicalPairs = supportedPairs.filter((pair) => pair.pairGap !== null && pair.pairGap > 2);
  const explicitFollowUp = supportedPairs.some((pair) => pair.explicitCaseLink || pair.explicitDevelopmentLink);
  const continuityPairs = supportedPairs.filter((pair) => pair.incidentIdentitySupport
    && (stagePairs.some(([a, b]) => (pair.stagesLeft.includes(a) && pair.stagesRight.includes(b) && !pair.stagesLeft.includes(b))
      || (pair.stagesLeft.includes(b) && pair.stagesRight.includes(a) && !pair.stagesLeft.includes(a)))
      || (pair.explicitCaseLink && pair.sharedEvidenceTerms.length >= 1)
      || (pair.explicitDevelopmentLink && pair.sharedEvidenceTerms.length >= 1)));
  const continuity = continuityPairs.length > 0;
  const closeSameEventPairs = supportedPairs.filter((pair) => pair.pairGap !== null && pair.pairGap <= 72);
  const sameIncidentTerms = closeSameEventPairs.some((pair) => {
    const incidentTerms = pair.sharedEvidenceTerms.filter((term) => !["summit", "meeting", "conference", "talks", "speech", "visit"].includes(term));
    const identityAnchor = pair.specificEntities.some((entity) => ["PERSON", "COMPANY", "PRODUCT_PROJECT"].includes(entity.type));
    const sameLinkedStage = identityAnchor && pair.issueTerms.length >= 1
      && pair.stagesLeft.some((stage) => pair.stagesRight.includes(stage));
    return (sameLinkedStage || (identityAnchor && incidentTerms.length >= 1 || incidentTerms.length >= 2))
      && (sameLinkedStage || pair.issueTerms.length >= 2
        || (pair.issueTerms.length >= 1 && pair.bilateralCrossLayerSupport && pair.specificEntities.some((entity) => entity.type === "EVENT_PROGRAM"))
        || (pair.bodyIssueTerms.length >= 2 && pair.bilateralCrossLayerSupport))
      && SAME_INCIDENT_MARKERS.test(pair.left.title) && SAME_INCIDENT_MARKERS.test(pair.right.title);
  });
  const sameOccurrence = sameIncidentTerms;
  const evidenceBase = {
    facetsCompared: allPairs.length,
    classifierVersion: NARRATIVE_CLASSIFIER_VERSION,
    compatibleArticlePairs: supportedPairs.length,
    supportingArticlePairs: pairEvidence,
    supportingArticleIds: [...new Set(pairEvidence.flatMap((pair) => [pair.leftArticleId, pair.rightArticleId]))],
    incidentAnchors: sharedSignals.map((entity) => `${entity.type}:${entity.canonical}`),
    distinctiveSharedTerms: supportingTerms,
    stages: { left: [...allStagesLeft], right: [...allStagesRight], complementary: complementaryStages },
    publicationChronology: supportedPairs.filter((pair) => pair.left.publishedAt && pair.right.publishedAt).map((pair) => ({
      leftArticleId: pair.left.articleId, rightArticleId: pair.right.articleId,
      leftPublishedAt: pair.left.publishedAt!.toISOString(), rightPublishedAt: pair.right.publishedAt!.toISOString(),
      earlierArticleId: pair.left.publishedAt!.getTime() <= pair.right.publishedAt!.getTime() ? pair.left.articleId : pair.right.articleId,
      gapHours: pair.pairGap === null ? null : Math.round(pair.pairGap),
    })).slice(0, 12),
    outlierArticleIds: [...outlierIds],
    clusterQuality: {
      left: { score: left.clusterQuality.score, flags: left.clusterQuality.flags },
      right: { score: right.clusterQuality.score, flags: right.clusterQuality.flags },
    },
    excludedOutlierPairs: allPairs.filter((pair) => outlierIds.has(pair.left.articleId) || outlierIds.has(pair.right.articleId)).slice(0, 8).map((pair) => ({ leftArticleId: pair.left.articleId, rightArticleId: pair.right.articleId, leftTitle: pair.left.title, rightTitle: pair.right.title })),
    nonSupportingArticlePairs: pairs.filter((pair) => !pair.support).slice(0, 8).map((pair) => ({
      leftArticleId: pair.left.articleId, rightArticleId: pair.right.articleId,
      leftTitle: pair.left.title, rightTitle: pair.right.title,
      sharedEntities: pair.sharedEntities.map((entity) => `${entity.type}:${entity.canonical}`),
      sharedHeadlineTerms: pair.sharedTitleTerms, sharedSummaryTerms: pair.summaryTerms, sharedBodyTerms: pair.bodyTerms,
      reason: "No specific incident anchor plus distinctive headline/summary evidence, and fewer than three distinctive terms were shared.",
    })),
    publisherCoverage,
    missingEvidence: [] as string[],
  };
  if (sameOccurrence) {
    const state = missingBodies && sharedSignals.length === 0 ? "INSUFFICIENT_EVIDENCE" : "CANDIDATE";
    const type = state === "CANDIDATE" ? "SAME_EVENT" : "INSUFFICIENT_EVIDENCE";
    return {
      type, state, supportingEntities, supportingTerms, temporalEvidence, contradictingEvidence: contradictory,
      explanation: state === "CANDIDATE"
        ? `Member articles from ${pairEvidence.length} compatible article pair(s) identify the same incident through ${sharedSignals.map((entity) => entity.canonical).join(", ") || "distinctive incident terms"}. Matching occurrence markers and close, cross-publisher coverage favor SAME_EVENT over a later development. ${temporalInterpretation} Supporting headlines: ${pairEvidence.slice(0, 3).map((pair) => `“${pair.leftTitle}” / “${pair.rightTitle}”`).join("; ")}.`
        : "The apparent incident match relies on sparse text and lacks a sufficiently specific named anchor; abstain until fuller article evidence is available.",
      evidence: { ...evidenceBase, missingEvidence: ["evidence of a later linked development; the member reports identify the same occurrence"], closeSameEventPairCount: closeSameEventPairs.length, bodyContextTerms, missingBodies, alternatives: { continuingStoryline: continuity, broaderContext: sharedContext } },
      parentKeys: [],
    };
  }

  if (continuity) {
    const state = missingBodies && supportingTerms.length < 2 ? "INSUFFICIENT_EVIDENCE" : "CANDIDATE";
    const type = state === "CANDIDATE" ? "CONTINUING_STORYLINE" : "INSUFFICIENT_EVIDENCE";
    return {
      type, state, supportingEntities, supportingTerms, temporalEvidence, contradictingEvidence: contradictory,
      explanation: state === "CANDIDATE"
        ? `The member articles share ${sharedSignals.map((entity) => entity.canonical).join(", ") || "distinctive issue terms"} and show ${complementaryStages ? "complementary development stages" : "an explicitly linked follow-up"}; those separate developments belong to one storyline, so CONTINUING_STORYLINE fits better than one shared occurrence. ${temporalInterpretation}`
        : "A possible follow-up is indicated, but the available article text is too limited to establish a connected storyline.",
      evidence: { ...evidenceBase, missingEvidence: ["a single shared occurrence; the reports describe linked later developments"], bodyContextTerms, missingBodies, chronologicalPairCount: chronologicalPairs.length, explicitFollowUp, alternatives: { sameEvent: false, broaderContext: true } },
      parentKeys: [],
    };
  }

  const meaningfulBroaderContext = contextualTitleTerms.length >= 1
    || (sharedSignals.length >= 2 && [...sharedTitleTerms, ...contextualTitleTerms].length >= 1);
  if (sharedContext && meaningfulBroaderContext && (supportingTerms.length >= 2 || (sharedSignals.length >= 2 && [...sharedTitleTerms, ...contextualTitleTerms].length >= 1))) {
    const parentKeys = sharedTitleTerms.filter((term) => term.length >= 6).slice(0, 3).map((term) => `ISSUE:${term}`);
    return {
      type: "BROADER_CONTEXT_ONLY", state: "CANDIDATE", supportingEntities, supportingTerms,
      temporalEvidence, contradictingEvidence: [...contradictory, ...(historical ? ["At least one item is historical; date alone does not establish continuity."] : [])],
      explanation: `The member articles share broader context (${[...supportingTerms, ...contextualTitleTerms].slice(0, 5).join(", ")}) but do not identify the same occurrence or establish a linked later development. This is broader context only. ${temporalInterpretation}`,
      evidence: { ...evidenceBase, missingEvidence: ["same identifiable incident", "explicit linked progression"], broaderContextTerms: contextualTitleTerms, historical, composite, bodyContextTerms, alternatives: { sameEvent: false, continuingStoryline: false } },
      parentKeys,
    };
  }

  return {
    type: "UNRELATED", state: "REJECTED", supportingEntities, supportingTerms, temporalEvidence,
    contradictingEvidence: [...contradictory, ...(supportingEntities.length ? ["A shared actor or organization appears, but the articles describe different incidents without a linked development."] : []), "No sufficiently shared distinctive issue context or continuity evidence."],
    explanation: "The available member articles do not connect these incidents. Shared names or generic vocabulary are incidental, and no shared event identity or linked progression is supported.",
    evidence: { ...evidenceBase, missingEvidence: ["shared incident anchor", "shared distinctive issue context", "explicit linked development"], historical, composite, bodyContextTerms, alternatives: { sameEvent: false, continuingStoryline: false, broaderContext: false } }, parentKeys: [],
  };
}

function candidateEntityWeight(entity: EntityMention): number {
  if (entity.type === "PERSON") return 0.95;
  if (["EVENT_PROGRAM", "PRODUCT_PROJECT"].includes(entity.type)) return 1;
  if (entity.type === "COMPANY") return 0.78;
  if (entity.type === "CITY_REGION") return 0.65;
  if (entity.type === "POLITICAL_PARTY") return 0.55;
  if (entity.type === "ORGANIZATION") return ["Supreme Court", "United Nations"].includes(entity.canonical) ? 0.35 : 0.68;
  if (entity.type === "GOVERNMENT") return 0.2;
  return 0.15;
}

function candidateHeadlineTerms(event: EventFeature): Set<string> {
  return new Set(event.facets.flatMap((facet) => facet.titleTerms));
}

function candidateRawHeadlineTerms(event: EventFeature): Set<string> {
  const terms = new Set(candidateHeadlineTerms(event));
  for (const facet of event.facets) {
    for (const term of facet.title.toLocaleLowerCase().match(/[a-z][a-z0-9'-]{3,}/g) || []) {
      if (CANDIDATE_GENERIC_TERMS.has(term)) terms.add(term);
    }
  }
  return terms;
}

function candidateAllTerms(event: EventFeature): Set<string> {
  return new Set(event.facets.flatMap((facet) => facet.terms));
}

function candidateEntityMap(event: EventFeature): Map<string, EntityMention> {
  const entities = new Map(event.entities.map((entity) => [`${entity.type}:${entity.canonical}`, entity]));
  for (const entity of event.facets.flatMap((facet) => extractQualityEntities(facet.title))) {
    entities.set(`${entity.type}:${entity.canonical}`, entity);
  }
  return entities;
}

function cueGroups(event: EventFeature): Set<string> {
  const text = event.facets.map((facet) => `${facet.title} ${facet.text}`).join(" ");
  return new Set(CONTINUITY_CUE_GROUPS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name));
}

function continuityContext(facet: ArticleFacet, cueName: string): string {
  const pattern = CONTINUITY_CUE_GROUPS.find(([name]) => name === cueName)?.[1];
  if (!pattern) return "";
  const text = `${facet.title} ${facet.text}`;
  const match = pattern.exec(text);
  if (!match || match.index === undefined) return "";
  const start = Math.max(0, match.index - 55);
  const end = Math.min(text.length, match.index + match[0].length + 65);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function compatibleTopic(left: EventFeature, right: EventFeature, sharedTerms: string[]): number | null {
  const a = new Set(left.facets.flatMap((facet) => categoriesFor(facet.title)));
  const b = new Set(right.facets.flatMap((facet) => categoriesFor(facet.title)));
  if (!a.size && !b.size) return sharedTerms.length ? 0.62 : null;
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  const categoryScore = union ? intersection / union : 0.5;
  // Broad category mismatch is a soft signal; incident terms and entities
  // can still establish compatibility across (for example) legal and business.
  const termSupport = Math.min(1, sharedTerms.length / 3);
  const base = categoryScore * 0.45 + termSupport * 0.4 + (intersection ? 0.15 : 0.1);
  const qualityFactor = 0.5 + ((left.clusterQuality.score + right.clusterQuality.score) / 200);
  return Math.max(0, Math.min(1, base * qualityFactor));
}

function pairRelevance(
  left: EventFeature,
  right: EventFeature,
  sharedCandidateKeys: string[],
  headlineDf: Map<string, number>,
  allDf: Map<string, number>,
  eventCount: number,
  threshold: number,
): CandidateRelevanceEvidence {
  const termIdf = (term: string, df: number) => 1 + Math.max(0, Math.log((eventCount + 1) / (df + 1)));
  const qualityWarnings = [left, right].flatMap((event) => event.clusterQuality.flags
    .filter((flag) => ["POSSIBLE_MIXED_CLUSTER", "POSSIBLE_OUTLIER_ARTICLE", "LOW_TOPIC_COHERENCE"].includes(flag))
    .map((flag) => `${event.clusterId}:${flag}`));
  const qualityPenalty = Math.min(26, qualityWarnings.reduce((sum, warning) => sum + (warning.includes("POSSIBLE_MIXED_CLUSTER") ? 18 : warning.includes("OUTLIER") ? 10 : 5), 0));
  const bodyLimit = Math.max(3, Math.ceil(eventCount * 0.2));
  const articlePairs: CandidateRelevanceEvidence["articlePairEvidence"] = [];
  const usableFacets = (event: EventFeature) => event.facets.filter((facet) =>
    !facet.qualityFlags.includes("navigation_or_download") && !facet.qualityFlags.includes("promotional_copy"));
  for (const a of usableFacets(left)) for (const b of usableFacets(right)) {
    const titleB = new Set(b.titleTerms);
    const aTitleEntities = new Map([...a.entities, ...extractQualityEntities(a.title)].map((entity) => [`${entity.type}:${entity.canonical}`, entity]));
    const bTitleEntities = new Map([...b.entities, ...extractQualityEntities(b.title)].map((entity) => [`${entity.type}:${entity.canonical}`, entity]));
    const entityWords = new Set([...aTitleEntities.values(), ...bTitleEntities.values()]
      .flatMap((entity) => entity.canonical.toLocaleLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || []));
    const sharedHeadlineTerms = [...new Set(a.titleTerms.filter((term) => titleB.has(term)
      && !CANDIDATE_GENERIC_TERMS.has(term) && !entityWords.has(term) && term.length >= 4))];
    const sharedDistinctiveHeadlineTerms = sharedHeadlineTerms.filter((term) =>
      (headlineDf.get(term) || 0) <= Math.max(3, Math.ceil(eventCount * 0.25)));
    const isSupportingTextTerm = (term: string) => !a.titleTerms.includes(term) && !b.titleTerms.includes(term)
      && !CANDIDATE_GENERIC_TERMS.has(term) && !entityWords.has(term) && term.length >= 5
      && (allDf.get(term) || 0) <= bodyLimit;
    const sharedSummaryTerms = [...new Set(a.summaryTerms.filter((term) => b.summaryTerms.includes(term) && isSupportingTextTerm(term)))].slice(0, 12);
    const sharedArticleBodyTerms = [...new Set(a.bodyTerms.filter((term) => b.bodyTerms.includes(term) && isSupportingTextTerm(term)))].slice(0, 12);
    const sharedBodyTerms = [...new Set([...sharedSummaryTerms, ...sharedArticleBodyTerms])].slice(0, 12);
    const sharedEntities = [...aTitleEntities.entries()].flatMap(([key, entity]) => {
      const other = bTitleEntities.get(key);
      if (!other) return [];
      const weight = Math.min(candidateEntityWeight(entity), candidateEntityWeight(other));
      return [{ canonical: entity.canonical, type: entity.type, weight }];
    }).sort((x, y) => y.weight - x.weight || x.canonical.localeCompare(y.canonical));
    const gap = a.publishedAt && b.publishedAt ? Math.abs(a.publishedAt.getTime() - b.publishedAt.getTime()) / 3_600_000 : null;
    const temporalCompatibility = gap === null ? null : gap <= 72 ? 1 : gap <= 24 * 30 ? 0.82 : gap <= 24 * 180 ? 0.66 : 0.35;
    const aCues = new Set(CONTINUITY_CUE_GROUPS.filter(([, pattern]) => pattern.test(`${a.title} ${a.text}`)).map(([name]) => name));
    const bCues = new Set(CONTINUITY_CUE_GROUPS.filter(([, pattern]) => pattern.test(`${b.title} ${b.text}`)).map(([name]) => name));
    const continuityIndicators = [...aCues].flatMap((x) => [...bCues].filter((y) => x !== y).map((y) => `${x} → ${y}`));
    const specificEntity = sharedEntities.some((entity) => entity.weight >= 0.5);
    const hasIncidentContext = sharedDistinctiveHeadlineTerms.length >= 1 || sharedHeadlineTerms.length >= 2 || sharedBodyTerms.length >= 2;
    // Generic stages count only when this same article pair shares incident context
    // or a specific named entity. Cluster-wide cue unions are never used.
    const qualifiedContinuity = (specificEntity && hasIncidentContext) ? continuityIndicators : [];
    const continuityEvidence = qualifiedContinuity.map((indicator) => {
      const [leftCue, rightCue] = indicator.split(" → ");
      return { indicator, leftContext: continuityContext(a, leftCue || ""), rightContext: continuityContext(b, rightCue || "") };
    });
    const titleStrength = sharedDistinctiveHeadlineTerms.reduce((sum, term) => sum + termIdf(term, headlineDf.get(term) || 0) * 16, 0)
      + sharedHeadlineTerms.filter((term) => !sharedDistinctiveHeadlineTerms.includes(term)).reduce((sum, term) => sum + termIdf(term, headlineDf.get(term) || 0) * 4, 0);
    const bodyStrength = sharedBodyTerms.reduce((sum, term) => sum + termIdf(term, allDf.get(term) || 0), 0);
    // Per article pair, score = min(34, distinctive headline IDF*16 + other
    // non-generic headline IDF*4 + summary/body IDF*2) + strongest entity
    // (specific entity weight*24, broad entity weight*8) + topic*10 + time*5 + qualified
    // complementary cues*6 (cap 12) + structured entity/context 15 - the
    // cluster warning penalty (cap 26), clamped to 0..100. Gate eligibility
    // also requires independent evidence; a numeric score alone cannot pass.
    const termPoints = Math.min(34, titleStrength + bodyStrength * 2);
    const entityPoints = Math.max(0, ...sharedEntities.map((entity) => entity.weight * (entity.weight >= 0.5 ? 24 : 8)));
    const localTopic = compatibleTopic(
      { ...left, facets: [a] }, { ...right, facets: [b] }, [...sharedHeadlineTerms, ...sharedBodyTerms],
    ) ?? 0.35;
    const topicPoints = localTopic * 10;
    const temporalPoints = (temporalCompatibility ?? 0.5) * 5;
    const continuityPoints = qualifiedContinuity.length ? Math.min(12, qualifiedContinuity.length * 6) : 0;
    const structuredPoints = specificEntity && hasIncidentContext ? 15 : 0;
    const score = Math.max(0, Math.min(100, Math.round(termPoints + entityPoints + topicPoints + temporalPoints + continuityPoints + structuredPoints - qualityPenalty)));
    articlePairs.push({
      leftArticleId: a.articleId, rightArticleId: b.articleId, leftTitle: a.title, rightTitle: b.title,
      sharedHeadlineTerms, sharedDistinctiveHeadlineTerms, sharedSummaryTerms, sharedArticleBodyTerms,
      sharedBodyTerms, sharedEntities, continuityIndicators: qualifiedContinuity, continuityEvidence,
      topicCompatibility: localTopic,
      temporalGapHours: gap === null ? null : Math.round(gap), score, selected: false,
    });
  }
  articlePairs.sort((a, b) => b.score - a.score || a.leftArticleId.localeCompare(b.leftArticleId) || a.rightArticleId.localeCompare(b.rightArticleId));
  const best = articlePairs[0];
  if (best) best.selected = true;
  const sharedDistinctiveTerms = best?.sharedDistinctiveHeadlineTerms || [];
  const sharedBodyOnlyTerms = best?.sharedBodyTerms || [];
  const sharedSpecificEntities = (best?.sharedEntities || []).map((entity) => ({ ...entity, contextual: Boolean(best && (best.sharedHeadlineTerms.length || best.sharedBodyTerms.length || best.continuityIndicators.length)) }));
  const continuityIndicators = best?.continuityIndicators || [];
  const gap = best?.temporalGapHours ?? null;
  const temporalCompatibility = gap === null ? null : gap <= 72 ? 1 : gap <= 24 * 30 ? 0.82 : gap <= 24 * 180 ? 0.66 : 0.35;
  const topicCompatibility = best?.topicCompatibility ?? null;
  const specificEntity = sharedSpecificEntities.some((entity) => entity.weight >= 0.5);
  const closeGap = gap !== null && gap <= 72;
  const namedEventEvidence = Boolean(best?.sharedEntities.some((entity) => entity.type === "EVENT_PROGRAM")
    && sharedBodyOnlyTerms.length >= 2 && closeGap && SAME_EVENT_MARKERS.test(best.leftTitle) && SAME_EVENT_MARKERS.test(best.rightTitle));
  const contextualHeadlineTerms = best?.sharedHeadlineTerms || [];
  const meaningfulBasis = sharedDistinctiveTerms.length >= 2
    || (specificEntity && (sharedDistinctiveTerms.length >= 1 || contextualHeadlineTerms.length >= 2
      || (sharedBodyOnlyTerms.length >= 2 && continuityIndicators.length > 0)))
    || namedEventEvidence;
  const score = best?.score ?? 0;
  const included = score >= threshold && meaningfulBasis;
  const inclusionReasons: string[] = [];
  if (sharedDistinctiveTerms.length) inclusionReasons.push("Shared distinctive headline terms: " + sharedDistinctiveTerms.slice(0, 5).join(", ") + ".");
  else if (contextualHeadlineTerms.length >= 2) inclusionReasons.push("Shared non-generic headline context terms on the same article pair: " + contextualHeadlineTerms.slice(0, 5).join(", ") + ".");
  if (sharedBodyOnlyTerms.length) inclusionReasons.push("Supporting summary/article-body terms: " + sharedBodyOnlyTerms.slice(0, 5).join(", ") + ".");
  if (specificEntity) inclusionReasons.push((sharedDistinctiveTerms.length || sharedBodyOnlyTerms.length ? "Specific shared entity is supported by the same article pair's incident terms: " : "Specific shared headline entity: ")
    + sharedSpecificEntities.filter((entity) => entity.weight >= 0.5).map((entity) => entity.canonical).join(", ") + ".");
  if (namedEventEvidence) inclusionReasons.push("A named event entity, compatible occurrence markers, close publication timing, and shared context terms occur in this article pair.");
  if (continuityIndicators.length) inclusionReasons.push("Complementary continuity cues: " + continuityIndicators.join(", ") + ".");
  if (gap !== null) inclusionReasons.push("Publication gap is " + Math.round(gap) + " hours and is treated as compatible evidence, not a cutoff.");
  const exclusionReasons: string[] = [];
  if (score < threshold) exclusionReasons.push(`Relevance score ${score} is below configured threshold ${threshold}.`);
  if (!meaningfulBasis) exclusionReasons.push("No compatible member-article pair has enough independent incident evidence (two distinctive terms, or a specific entity plus incident context).");
  if (!specificEntity && sharedSpecificEntities.length) exclusionReasons.push("Shared entities are broad actors or organizations and cannot establish a relationship alone.");
  if (!sharedDistinctiveTerms.length && !sharedBodyOnlyTerms.length && sharedCandidateKeys.some((key) => key.startsWith("GENERIC:"))) exclusionReasons.push("The proposal was discovered by a generic key, but no member-article pair validates it.");
  if (qualityWarnings.length) exclusionReasons.push("Cluster-quality warnings reduce confidence: " + qualityWarnings.join(", ") + ".");
  const scoreContributions = best ? {
    terms: Math.min(34,
      sharedDistinctiveTerms.reduce((sum, term) => sum + termIdf(term, headlineDf.get(term) || 0) * 16, 0)
      + contextualHeadlineTerms.filter((term) => !sharedDistinctiveTerms.includes(term))
        .reduce((sum, term) => sum + termIdf(term, headlineDf.get(term) || 0) * 4, 0)
      + sharedBodyOnlyTerms.reduce((sum, term) => sum + termIdf(term, allDf.get(term) || 0), 0) * 2),
    entities: Math.max(0, ...sharedSpecificEntities.map((entity) => entity.weight * (entity.weight >= 0.5 ? 24 : 8))),
    topic: (topicCompatibility ?? 0.35) * 10, temporal: (temporalCompatibility ?? 0.5) * 5,
    continuity: Math.min(12, continuityIndicators.length * 6), clusterQuality: -qualityPenalty,
  } : { terms: 0, entities: 0, topic: 0, temporal: 0, continuity: 0, clusterQuality: -qualityPenalty };
  const candidateKeyEvidence = sharedCandidateKeys.map((key) => {
    const [kind, value] = key.split(":", 2);
    const matchingIds = (event: EventFeature) => event.facets.filter((facet) => kind === "TERM"
      ? facet.titleTerms.includes(value || "")
      : [...facet.entities, ...extractQualityEntities(facet.title)].some((entity) => `${entity.type}:${entity.canonical}` === key.slice("ENTITY:".length)))
      .map((facet) => facet.articleId).filter((id, index, ids) => ids.indexOf(id) === index).slice(0, 12);
    return { key, leftArticleIds: matchingIds(left), rightArticleIds: matchingIds(right) };
  }).slice(0, 30);
  return {
    score, threshold, decision: included ? "INCLUDED" : "EXCLUDED",
    sharedDistinctiveTerms, sharedBodyOnlyTerms, sharedSpecificEntities,
    topicCompatibility: topicCompatibility === null ? null : Math.round(topicCompatibility * 100) / 100,
    temporalEvidence: {
      gapHours: gap === null ? null : Math.round(gap),
      compatibility: temporalCompatibility,
      interpretation: gap === null ? "No usable publication dates; timing is neutral." : gap <= 72
        ? "Close publication timing supports a possible link but does not prove one."
        : gap <= 24 * 180 ? "The interval is compatible with a continuing story; no rigid time cutoff is applied."
          : continuityIndicators.length && sharedDistinctiveTerms.length ? "A long interval is retained because issue evidence and progression cues support continuity."
            : "A long interval needs stronger issue or progression evidence.",
    },
    continuityIndicators, clusterQualityWarnings: [...new Set(qualityWarnings)],
    inclusionReasons: included ? inclusionReasons : [],
    exclusionReasons: included ? [] : exclusionReasons,
    candidateKeys: sharedCandidateKeys,
    candidateKeyEvidence,
    articlePairEvidence: articlePairs.slice(0, 12),
    scoreContributions,
  };
}

const DEFAULT_CANDIDATE_RELEVANCE_THRESHOLD = 42;
export function candidateRelevanceThreshold(): number {
  const value = Number(process.env.NARRATIVE_CANDIDATE_RELEVANCE_THRESHOLD || DEFAULT_CANDIDATE_RELEVANCE_THRESHOLD);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : DEFAULT_CANDIDATE_RELEVANCE_THRESHOLD;
}

function candidatePairDecisions(events: EventFeature[], threshold: number) {
  const corpusStats = events.find((event) => event.candidateCorpusStats)?.candidateCorpusStats;
  const headlineDf = corpusStats?.headlineTermFrequency || new Map<string, number>();
  const allDf = corpusStats?.articleTermFrequency || new Map<string, number>();
  const corpusSize = Math.max(1, corpusStats?.documentCount || events.length);
  if (!corpusStats) events.forEach((event) => {
    for (const term of candidateRawHeadlineTerms(event)) headlineDf.set(term, (headlineDf.get(term) || 0) + 1);
    for (const term of candidateAllTerms(event)) allDf.set(term, (allDf.get(term) || 0) + 1);
  });
  const postings = new Map<string, number[]>();
  const eventCues = events.map((event) => cueGroups(event));
  events.forEach((event, index) => {
    const keys = new Set<string>();
    // Generic words may be scored as context after discovery, but never create
    // event-pair proposals. Retain article provenance in each key for audits.
    for (const facet of event.facets) for (const term of facet.titleTerms) {
      if (!CANDIDATE_GENERIC_TERMS.has(term) && term.length >= 4) keys.add(`TERM:${term}`);
    }
    for (const entity of candidateEntityMap(event).values()) {
      if (!(["PERSON", "COMPANY", "PRODUCT_PROJECT", "EVENT_PROGRAM"].includes(entity.type)
        && candidateEntityWeight(entity) >= 0.5)) continue;
      keys.add(`ENTITY:${entity.type}:${entity.canonical}`);
    }
    for (const key of keys) {
      const values = postings.get(key) || [];
      values.push(index);
      postings.set(key, values);
    }
  });
  const pairKeys = new Map<string, Set<string>>();
  let suppressedHighFrequencyKeyCount = 0;
  const suppressedKeyReasonCounts: Record<string, number> = {};
  const suppressedKeyExamples: CandidateDiagnostics["suppressedKeyExamples"] = [];
  const maxPosting = Math.max(12, Math.ceil(Math.sqrt(events.length) * 4));
  for (const [key, indexes] of postings) {
    if (indexes.length > maxPosting) {
      suppressedHighFrequencyKeyCount += 1;
      const entityType = key.startsWith("ENTITY:") ? key.split(":")[1] : "";
      const structuredEntity = ["PERSON", "COMPANY", "PRODUCT_PROJECT", "EVENT_PROGRAM"].includes(entityType || "");
      const reason = key.startsWith("GENERIC:") ? "HIGH_FANOUT_GENERIC_KEY"
        : structuredEntity ? "HIGH_FANOUT_ENTITY_STRUCTURED_FALLBACK" : "HIGH_FANOUT_KEY";
      suppressedKeyReasonCounts[reason] = (suppressedKeyReasonCounts[reason] || 0) + 1;
      if (suppressedKeyExamples.length < 20) suppressedKeyExamples.push({
        key, memberEventCount: indexes.length,
        possiblePairCount: indexes.length * (indexes.length - 1) / 2,
        reason,
      });
      // A frequent named person/company may still link a progression. Generate
      // a bounded set of pairs only when both sides carry different narrative
      // stages; entity frequency alone never creates these fallback pairs.
      if (structuredEntity) {
        let added = 0;
        const maxFallbackPairs = 250;
        for (let i = 0; i < indexes.length && added < maxFallbackPairs; i += 1) {
          for (let j = i + 1; j < indexes.length && added < maxFallbackPairs; j += 1) {
            const left = indexes[i]!;
            const right = indexes[j]!;
            if (![...eventCues[left]!].some((cue) => [...eventCues[right]!].some((other) => cue !== other))) continue;
            const pairKey = `${Math.min(left, right)}:${Math.max(left, right)}`;
            const shared = pairKeys.get(pairKey) || new Set<string>();
            const wasNewPair = !pairKeys.has(pairKey);
            shared.add(key);
            pairKeys.set(pairKey, shared);
            if (wasNewPair) added += 1;
          }
        }
      }
      continue;
    }
    for (let i = 0; i < indexes.length; i += 1) for (let j = i + 1; j < indexes.length; j += 1) {
      const left = Math.min(indexes[i]!, indexes[j]!);
      const right = Math.max(indexes[i]!, indexes[j]!);
      const pairKey = `${left}:${right}`;
      const shared = pairKeys.get(pairKey) || new Set<string>();
      shared.add(key);
      pairKeys.set(pairKey, shared);
    }
  }
  const decisions = [...pairKeys.entries()].map(([key, sharedKeys]) => {
    const [leftIndex, rightIndex] = key.split(":").map(Number) as [number, number];
    const relevance = pairRelevance(events[leftIndex]!, events[rightIndex]!, [...sharedKeys], headlineDf, allDf, corpusSize, threshold);
    return { left: leftIndex, right: rightIndex, relevance };
  });
  return { decisions, suppressedHighFrequencyKeyCount, suppressedKeyReasonCounts, suppressedKeyExamples };
}

/** Returns only gate-approved pairs; deterministic order preserves stable analysis output. */
export function candidateEventPairs(events: EventFeature[], threshold = candidateRelevanceThreshold()): Array<[number, number]> {
  return candidatePairDecisions(events, threshold).decisions
    .filter((decision) => decision.relevance.decision === "INCLUDED")
    .map((decision) => [decision.left, decision.right]);
}

function eventIssueKeys(event: EventFeature): Set<string> {
  return new Set([
    ...event.entities.filter((entity) => ["POLITICAL_PARTY", "GOVERNMENT", "COUNTRY", "CITY_REGION"].includes(entity.type)).map((entity) => `${entity.type}:${entity.canonical}`),
    ...event.terms.filter((term) => term.length >= 7).map((term) => `ISSUE:${term}`),
  ]);
}

function canMerge(groups: number[][], leftIndex: number, rightIndex: number, relations: Map<string, RelationshipEvaluation>): boolean {
  const leftGroup = groups.find((group) => group.includes(leftIndex));
  const rightGroup = groups.find((group) => group.includes(rightIndex));
  if (!leftGroup || !rightGroup || leftGroup === rightGroup) return false;
  // Get the direct connecting relationship
  const connectingRelation = relations.get(`${Math.min(leftIndex, rightIndex)}:${Math.max(leftIndex, rightIndex)}`);
  if (!connectingRelation || !["SAME_EVENT", "CONTINUING_STORYLINE"].includes(connectingRelation.type) || connectingRelation.state !== "CANDIDATE") return false;
  if (connectingRelation.type === "SAME_EVENT") {
    // Complete-link: every node pair across the two groups must qualify
    for (const left of leftGroup) {
      for (const right of rightGroup) {
        const relation = relations.get(`${Math.min(left, right)}:${Math.max(left, right)}`);
        if (!relation || !["SAME_EVENT", "CONTINUING_STORYLINE"].includes(relation.type) || relation.state !== "CANDIDATE") return false;
      }
    }
    return true;
  }
  // CONTINUING_STORYLINE: allow merging only when both groups are singletons
  // (forming a new 2-node group). Bridging into an existing multi-node group via
  // a single CONTINUING_STORYLINE edge would create spurious transitive connections.
  return leftGroup.length === 1 && rightGroup.length === 1;
}

export function completeLinkGroups(
  eventCount: number,
  acceptedPairs: Array<{ left: number; right: number; type: "SAME_EVENT" | "CONTINUING_STORYLINE" }>,
) {
  const relations = new Map<string, RelationshipEvaluation>();
  for (const pair of acceptedPairs) {
    relations.set(`${Math.min(pair.left, pair.right)}:${Math.max(pair.left, pair.right)}`, {
      type: pair.type,
      state: "CANDIDATE",
      supportingEntities: [], supportingTerms: [],
      temporalEvidence: { gapHours: null, interpretation: "unit test" },
      contradictingEvidence: [], explanation: "unit test", evidence: {}, parentKeys: [],
    });
  }
  const groups = acceptedPairs
    .slice()
    .sort((left, right) => (left.type === "SAME_EVENT" ? 0 : 1) - (right.type === "SAME_EVENT" ? 0 : 1))
    .reduce<number[][]>((current, relation) => {
      const left = relation.left;
      const right = relation.right;
      if (!current.some((group) => group.includes(left))) current.push([left]);
      if (!current.some((group) => group.includes(right))) current.push([right]);
      if (canMerge(current, left, right, relations)) {
        const leftGroup = current.find((group) => group.includes(left))!;
        const rightGroup = current.find((group) => group.includes(right))!;
        leftGroup.push(...rightGroup);
        current.splice(current.indexOf(rightGroup), 1);
      }
      return current;
    }, []);
  return groups.filter((group) => group.length > 1 && group.every((index) => index >= 0 && index < eventCount));
}

export interface NarrativeAnalysis {
  events: EventFeature[];
  /** All pairs actually assessed by the candidate gate; this is indexed discovery output, not a Cartesian product. */
  candidateDecisions: Array<{ left: number; right: number; relevance: CandidateRelevanceEvidence }>;
  relationships: Array<{ left: number; right: number; evaluation: RelationshipEvaluation; candidateRelevance: CandidateRelevanceEvidence }>;
  children: Array<{ eventIndexes: number[]; title: string; eventKeys: string[]; entityKeys: string[]; terms: string[]; categories: string[] }>;
  parents: Array<{ childIndexes: number[]; title: string; keys: string[] }>;
  candidatePairCount: number;
  candidateDiagnostics: CandidateDiagnostics;
}

export function analyzeNarratives(events: EventFeature[], threshold = candidateRelevanceThreshold()): NarrativeAnalysis {
  const assessedPairs = candidatePairDecisions(events, threshold);
  const includedPairs = assessedPairs.decisions.filter((item) => item.relevance.decision === "INCLUDED");
  const termFrequency = new Map<string, number>();
  for (const event of events) for (const term of new Set(event.titleTerms)) termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1);
  const relationMap = new Map<string, RelationshipEvaluation>();
  const relationships = includedPairs.map(({ left, right, relevance }) => {
    const evaluation = classifyRelationship(events[left]!, events[right]!, termFrequency, events.length);
    relationMap.set(`${left}:${right}`, evaluation);
    return { left, right, evaluation, candidateRelevance: relevance };
  });

  const children: NarrativeAnalysis["children"] = [];
  const groups = completeLinkGroups(events.length, relationships
    .filter((item) => ["SAME_EVENT", "CONTINUING_STORYLINE"].includes(item.evaluation.type) && item.evaluation.state === "CANDIDATE")
    .map((item) => ({ left: item.left, right: item.right, type: item.evaluation.type as "SAME_EVENT" | "CONTINUING_STORYLINE" })));

  for (const indexes of groups.filter((group) => group.length > 1)) {
    const eventList = indexes.map((index) => events[index]!);
    const entityKeys = [...new Set(eventList.flatMap((event) => event.entityKeys))].sort();
    const terms = [...new Set(eventList.flatMap((event) => event.terms))].sort();
    const name = entityKeys.map((key) => key.split(":").slice(1).join(":")).filter((value) => value.length > 2).slice(0, 3);
    children.push({
      eventIndexes: [...indexes].sort((a, b) => a - b),
      title: name.length ? `${name.join(" / ")} — candidate storyline` : `${eventList[0]!.label} — candidate storyline`,
      eventKeys: eventList.map((event) => event.fingerprint),
      entityKeys,
      terms,
      categories: [...new Set(eventList.flatMap((event) => event.categories))].sort(),
    });
  }

  const parents: NarrativeAnalysis["parents"] = [];
  const parentEdges = new Map<string, Set<string>>();
  for (const relationship of relationships.filter((item) => item.evaluation.type === "BROADER_CONTEXT_ONLY" && item.evaluation.state === "CANDIDATE")) {
    const leftChild = children.findIndex((child) => child.eventIndexes.includes(relationship.left));
    const rightChild = children.findIndex((child) => child.eventIndexes.includes(relationship.right));
    if (leftChild < 0 || rightChild < 0 || leftChild === rightChild) continue;
    const keys = relationship.evaluation.parentKeys;
    for (const key of keys) {
      const set = parentEdges.get(key) ?? new Set<string>();
      set.add(`${Math.min(leftChild, rightChild)}:${Math.max(leftChild, rightChild)}`);
      parentEdges.set(key, set);
    }
  }
  const coherentParents = new Map<string, { childIndexes: number[]; keys: Set<string> }>();
  for (const [key, edgeSet] of parentEdges) {
    const linkedPairs = [...edgeSet].map((pair) => pair.split(":").map(Number) as [number, number]);
    const groups: number[][] = [];
    for (const [left, right] of linkedPairs) {
      if (!groups.some((group) => group.includes(left))) groups.push([left]);
      if (!groups.some((group) => group.includes(right))) groups.push([right]);
      const leftGroup = groups.find((group) => group.includes(left))!;
      const rightGroup = groups.find((group) => group.includes(right))!;
      if (leftGroup === rightGroup) continue;
      const complete = leftGroup.every((a) => rightGroup.every((b) => edgeSet.has(`${Math.min(a, b)}:${Math.max(a, b)}`)));
      if (complete) {
        leftGroup.push(...rightGroup);
        groups.splice(groups.indexOf(rightGroup), 1);
      }
    }
    for (const childIndexes of groups.filter((group) => group.length > 1)) {
      const sorted = childIndexes.sort((a, b) => a - b);
      const signature = sorted.join(":");
      const existing = coherentParents.get(signature) ?? { childIndexes: sorted, keys: new Set<string>() };
      existing.keys.add(key);
      coherentParents.set(signature, existing);
    }
  }
  for (const parent of coherentParents.values()) {
    const keys = [...parent.keys].sort();
    parents.push({
      childIndexes: parent.childIndexes,
      title: `${keys.map((key) => key.split(":").slice(1).join(":")).slice(0, 3).join(" / ")} — broader context`,
      keys,
    });
  }

  const excluded = assessedPairs.decisions.filter((item) => item.relevance.decision === "EXCLUDED");
  const scoreHistogram: Record<string, number> = {};
  for (const item of assessedPairs.decisions) {
    const lower = Math.floor(item.relevance.score / 10) * 10;
    const bin = `${lower}-${lower + 9}`;
    scoreHistogram[bin] = (scoreHistogram[bin] || 0) + 1;
  }
  const excludedReasonCounts: Record<string, number> = {};
  for (const item of excluded) for (const reason of item.relevance.exclusionReasons) {
    const key = reason.startsWith("Relevance score") ? "BELOW_THRESHOLD"
      : reason.startsWith("No distinctive") ? "NO_MEANINGFUL_BASIS"
        : reason.startsWith("No compatible member-article pair") ? "NO_COMPATIBLE_ARTICLE_EVIDENCE"
        : reason.startsWith("Shared entities") ? "BROAD_ENTITY_ONLY"
          : reason.startsWith("The pair shares only") ? "GENERIC_TERMS_ONLY"
            : reason.startsWith("Cluster-quality") ? "CLUSTER_QUALITY_PENALTY" : "OTHER";
    excludedReasonCounts[key] = (excludedReasonCounts[key] || 0) + 1;
  }
  const representativeExcludedPairs = [...excluded]
    .sort((a, b) => a.relevance.score - b.relevance.score || a.left - b.left || a.right - b.right)
    .slice(0, 30)
    .map((item) => ({ left: events[item.left]!.label, right: events[item.right]!.label, relevance: item.relevance }));
  const candidateDiagnostics: CandidateDiagnostics = {
    threshold,
    consideredPairCount: assessedPairs.decisions.length,
    includedPairCount: includedPairs.length,
    excludedPairCount: excluded.length,
      scoreHistogram,
    suppressedHighFrequencyKeyCount: assessedPairs.suppressedHighFrequencyKeyCount,
    suppressedKeyReasonCounts: assessedPairs.suppressedKeyReasonCounts,
    suppressedKeyExamples: assessedPairs.suppressedKeyExamples,
    excludedReasonCounts,
    representativeExcludedPairs,
  };
  return { events, candidateDecisions: assessedPairs.decisions, relationships, children, parents, candidatePairCount: includedPairs.length, candidateDiagnostics };
}

export function stableNarrativeKey(eventKeys: string[], type: "parent" | "child", parentKey?: string): string {
  const basis = [type, parentKey ?? "", ...[...eventKeys].sort()].join("|");
  return `narrative-${createHash("sha256").update(basis).digest("hex").slice(0, 24)}`;
}

export function stableEventKey(articleUrls: string[], fallbackTitle: string): string {
  return `event-${eventFingerprint(articleUrls, fallbackTitle).slice(0, 24)}`;
}

export function overlapRatio(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

export function publicFacetQuality(facets: ArticleFacet[]): string[] {
  return [...new Set(facets.flatMap((facet) => facet.qualityFlags))].sort();
}
