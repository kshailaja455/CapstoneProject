import { createHash } from "node:crypto";

export const NARRATIVE_RULE_VERSION = "rules-en-v1.1.0";

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
  title: string;
  text: string;
  articleUrl: string;
  source: string;
  publishedAt: Date | null;
  bodyPresent: boolean;
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

type AliasEntry = { canonical: string; type: EntityType; aliases: string[] };

// Conservative, curated English aliases for known reporting. Unknown
// capitalization is not promoted to an entity. Expand only with reviewed data.
const ALIASES: AliasEntry[] = [
  { canonical: "Donald Trump", type: "PERSON", aliases: ["Donald Trump", "Trump"] },
  { canonical: "Xi Jinping", type: "PERSON", aliases: ["Xi Jinping", "Xi"] },
  { canonical: "Vladimir Putin", type: "PERSON", aliases: ["Vladimir Putin", "Putin"] },
  { canonical: "Narendra Modi", type: "PERSON", aliases: ["Narendra Modi", "Modi"] },
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

const NAVIGATION_TITLE = /^(?:download now|click here|read more|continue reading|subscribe|sign in|page not found)$/i;
const PROMOTIONAL = /\b(?:official trailer|watch the trailer|teaser|streaming now|in cinemas|tickets on sale|tune in|don't miss|do not miss|download now|every .{2,70} has its secrets)\b/i;
const UPDATE_MARKERS = /\b(?:update|updated|follow-up|after|since|resigns|sentenced|verdict|appeal|response|reacts|announces|launches|agreement|deal|ceasefire|election|vote|release|returns|again)\b/i;
const SAME_EVENT_MARKERS = /\b(?:summit|meeting|launch|trial|verdict|attack|crash|storm|earthquake|election|vote|strike|fire|agreement|declaration|conference|final|match)\b/i;
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

function termsFor(text: string): string[] {
  const tokens = text.toLocaleLowerCase().match(/[a-z][a-z0-9'-]{3,}/g) ?? [];
  return [...new Set(tokens.filter((token) => !GENERIC_TERMS.has(token) && !/^\d+$/.test(token)))].sort();
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

function articleFacets(article: Record<string, any>, index: number): ArticleFacet[] {
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
      title: part,
      text,
      articleUrl: url,
      source,
      publishedAt,
      bodyPresent,
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
  const facets = input.articles.flatMap((article, index) => articleFacets(article, index));
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

function contextOf(facet: ArticleFacet): string {
  return `${facet.title} ${facet.text}`.toLocaleLowerCase();
}

function highSignalEntity(entity: EntityMention): boolean {
  return ["COMPANY", "PRODUCT_PROJECT", "EVENT_PROGRAM", "POLITICAL_PARTY", "GOVERNMENT", "ORGANIZATION"].includes(entity.type);
}

function updatePhrase(text: string): boolean {
  return UPDATE_MARKERS.test(text);
}

export function classifyRelationship(left: EventFeature, right: EventFeature, frequency?: Map<string, number>, eventCount = 0): RelationshipEvaluation {
  const pairs = facetPairs(left, right)
    .map((pair) => ({ ...pair, distinctiveTerms: pair.sharedTitleTerms.filter((term) => isDistinctiveTerm(term, frequency, eventCount)) }))
    .sort((a, b) => (b.sharedEntities.length + 2 * b.distinctiveTerms.length) - (a.sharedEntities.length + 2 * a.distinctiveTerms.length));
  const bestPair = pairs[0];
  const supportingEntities = [...new Map((bestPair?.sharedEntities || []).map((entity) => [`${entity.type}:${entity.canonical}`, entity])).values()];
  const allDistinctiveTerms = [...new Set(bestPair?.distinctiveTerms || [])];
  const supportingTerms = allDistinctiveTerms.sort((a, b) => (frequency?.get(a) ?? 0) - (frequency?.get(b) ?? 0) || a.localeCompare(b)).slice(0, 20);
  const gap = gapHours(left, right);
  const temporalInterpretation = gap === null ? "No usable publication-time evidence." : gap <= 72
    ? "Close publication times support a shared event but do not prove one."
    : gap <= 24 * 30
      ? "The timing is compatible with a continuing storyline."
      : "The publication gap is long; historical relevance must be supported by explicit issue evidence.";
  const temporalEvidence = { gapHours: gap === null ? null : Math.round(gap), interpretation: temporalInterpretation };
  const contradictory: string[] = [];

  if (left.eligibleArticleCount === 0 || right.eligibleArticleCount === 0) {
    return {
      type: "INSUFFICIENT_EVIDENCE", state: "INSUFFICIENT_EVIDENCE", supportingEntities, supportingTerms,
      temporalEvidence, contradictingEvidence: ["One or both event clusters contain no narrative-eligible articles."],
      explanation: "The available items are navigation-only; abstain from relationship classification.", evidence: { facetsCompared: pairs.length }, parentKeys: [],
    };
  }
  if (left.qualityFlags.includes("mixed_topic_headline") || right.qualityFlags.includes("mixed_topic_headline")) {
    return {
      type: "INSUFFICIENT_EVIDENCE", state: "INSUFFICIENT_EVIDENCE", supportingEntities, supportingTerms,
      temporalEvidence, contradictingEvidence: ["A saved production event contains a mixed-topic headline facet."],
      explanation: "This event cluster contains a compound headline. The prototype retains its article facets for inspection but abstains from grouping the entire saved event until the source event is unambiguous.",
      evidence: { facetsCompared: pairs.length, mixedHeadline: true }, parentKeys: [],
    };
  }
  // Production clusters can themselves contain mixed or drifted headlines.
  // A single member article pair must not promote their whole clusters unless
  // the persisted event labels corroborate the same identity or issue.
  // Fallback: strong article-level evidence (high-signal entity OR ≥2 distinctive terms)
  // is accepted as corroboration when the cluster label is a keyword-fragment summary
  // rather than a full title (e.g. "Bihar / Nitish / Modi" for a multi-article cluster).
  const sharedLabelTerms = termsFor(left.label).filter((term) => termsFor(right.label).includes(term));
  const leftLabelEntities = extractTypedEntities(left.label);
  const rightLabelEntityKeys = new Set(extractTypedEntities(right.label).map((entity) => `${entity.type}:${entity.canonical}`));
  const sharedLabelEntities = leftLabelEntities.filter((entity) => rightLabelEntityKeys.has(`${entity.type}:${entity.canonical}`));
  const articleLevelCorroboration = supportingEntities.some(highSignalEntity) || allDistinctiveTerms.length >= 2;
  const labelCorroboration = sharedLabelTerms.filter((term) => isDistinctiveTerm(term, frequency, eventCount)).length >= 2
    || (sharedLabelEntities.some((entity) => ["COMPANY", "PRODUCT_PROJECT", "EVENT_PROGRAM", "ORGANIZATION"].includes(entity.type)) && sharedLabelTerms.length >= 1)
    || (sharedLabelEntities.filter((entity) => entity.type === "PERSON").length >= 2 && sharedLabelTerms.length >= 1)
    || articleLevelCorroboration;
  if (!labelCorroboration) {
    return {
      type: "INSUFFICIENT_EVIDENCE", state: "INSUFFICIENT_EVIDENCE", supportingEntities, supportingTerms,
      temporalEvidence, contradictingEvidence: ["The saved event labels do not corroborate a shared identity or specific issue."],
      explanation: "Member article overlap is insufficient because the saved event clusters may contain mixed topics; the cluster labels do not independently confirm a narrative relationship.",
      evidence: { facetsCompared: pairs.length, leftEventLabel: left.label, rightEventLabel: right.label, sharedLabelTerms, sharedLabelEntities: sharedLabelEntities.map((entity) => entity.canonical) }, parentKeys: [],
    };
  }
  const bothSparse = [left, right].every((event) => event.facets.length > 0 && event.facets.every((facet) => !facet.bodyPresent && facet.text.length < facet.title.length + 24));
  if (bothSparse && !bestPair?.sharedEntities.some(highSignalEntity)) {
    return {
      type: "INSUFFICIENT_EVIDENCE", state: "INSUFFICIENT_EVIDENCE", supportingEntities, supportingTerms,
      temporalEvidence, contradictingEvidence: ["Both event clusters lack substantive summaries and article bodies."],
      explanation: "Headline-only resemblance is not enough to determine the relationship; abstain until fuller source text is available.", evidence: { facetsCompared: pairs.length, bothSparse: true }, parentKeys: [],
    };
  }
  if (!bestPair || (supportingEntities.length === 0 && supportingTerms.length < 2)) {
    return {
      type: "INSUFFICIENT_EVIDENCE", state: "INSUFFICIENT_EVIDENCE", supportingEntities, supportingTerms,
      temporalEvidence, contradictingEvidence: [],
      explanation: "The available title, summary, and body do not contain enough specific shared evidence; no relationship is asserted.", evidence: { facetsCompared: pairs.length }, parentKeys: [],
    };
  }

  const bestLeftContext = contextOf(bestPair.left);
  const bestRightContext = contextOf(bestPair.right);
  const sharedSignals = bestPair.sharedEntities.filter(highSignalEntity);
  const sharedPerson = bestPair.sharedEntities.some((entity) => entity.type === "PERSON");
  const sharedTerms = bestPair.distinctiveTerms;
  const rawSharedTitleTerms = bestPair.sharedTitleTerms;
  const sharedTitleTerms = bestPair.sharedTitleTerms.filter((term) => isDistinctiveTerm(term, frequency, eventCount));
  const sharedContext = sharedTitleTerms.length >= 2;
  const missingBodies = left.qualityFlags.includes("body_missing_or_short") || right.qualityFlags.includes("body_missing_or_short");
  const composite = left.qualityFlags.includes("mixed_topic_headline") || right.qualityFlags.includes("mixed_topic_headline");
  const historical = left.qualityFlags.some((flag) => flag.includes("historical") || flag.includes("older_item")) || right.qualityFlags.some((flag) => flag.includes("historical") || flag.includes("older_item"));
  const bodyContextTerms = bestPair.sharedTerms
    .filter((term) => !bestPair.sharedTitleTerms.includes(term) && isDistinctiveTerm(term, frequency, eventCount))
    .slice(0, 12);
  const leftSources = new Set(left.sources);
  const sharedPublishers = right.sources.filter((source) => leftSources.has(source));
  const publisherCoverage = { left: left.sources, right: right.sources, shared: sharedPublishers, crossPublisher: sharedPublishers.length === 0 && left.sources.length + right.sources.length > 1 };

  // A mixed-title secondary facet is compared independently. It cannot borrow
  // the primary facet's entities or summary as support.
  if (composite && bestPair.left.facetId.endsWith(":0") !== bestPair.right.facetId.endsWith(":0") && !sharedContext) {
    return {
      type: "INSUFFICIENT_EVIDENCE", state: "INSUFFICIENT_EVIDENCE", supportingEntities, supportingTerms,
      temporalEvidence, contradictingEvidence: ["A mixed-topic headline facet did not independently match the other event."],
      explanation: "The mixed article's secondary headline topic is not supported as a link to this event.", evidence: { facetsCompared: pairs.length, selectedFacets: [bestPair.left.title, bestPair.right.title] }, parentKeys: [],
    };
  }

  const commonNamedEvent = bestPair.sharedEntities.some((entity) => entity.type === "EVENT_PROGRAM") && sharedTitleTerms.length >= 1;
  const closeTime = gap !== null && gap <= 72;
  const bothHeadlinesNameOccurrence = SAME_EVENT_MARKERS.test(bestPair.left.title) && SAME_EVENT_MARKERS.test(bestPair.right.title);
  const sameOccurrence = closeTime && sharedContext && (sharedSignals.length > 0 || (sharedPerson && bestPair.sharedEntities.filter((entity) => entity.type === "PERSON").length >= 2)) && bothHeadlinesNameOccurrence;
  if (sameOccurrence || commonNamedEvent) {
    const state = missingBodies && !commonNamedEvent ? "INSUFFICIENT_EVIDENCE" : "CANDIDATE";
    const type = state === "CANDIDATE" ? "SAME_EVENT" : "INSUFFICIENT_EVIDENCE";
    return {
      type, state, supportingEntities, supportingTerms, temporalEvidence, contradictingEvidence: contradictory,
      explanation: state === "CANDIDATE"
        ? "A named event/context and multiple distinctive shared terms point to the same occurrence; this remains a candidate pending review."
        : "The apparent event match relies on sparse content; abstain until article text is available.",
      evidence: { facetsCompared: pairs.length, selectedFacets: [bestPair.left.title, bestPair.right.title], closeTime, missingBodies, bodyContextTerms, publisherCoverage },
      parentKeys: [],
    };
  }

  const continuityMarker = updatePhrase(`${bestPair.left.title} ${bestPair.right.title}`);
  if ((sharedContext || (sharedSignals.length > 0 && rawSharedTitleTerms.length >= 1)) && (sharedSignals.length > 0 || (sharedPerson && supportingTerms.length >= 3)) && continuityMarker && (gap === null || gap <= 24 * 180)) {
    const state = missingBodies && supportingTerms.length < 3 ? "INSUFFICIENT_EVIDENCE" : "CANDIDATE";
    const type = state === "CANDIDATE" ? "CONTINUING_STORYLINE" : "INSUFFICIENT_EVIDENCE";
    return {
      type, state, supportingEntities, supportingTerms, temporalEvidence, contradictingEvidence: contradictory,
      explanation: state === "CANDIDATE"
        ? "Distinctive terms and specific entity/context evidence support a continuing development; neither shared names nor timing alone was sufficient."
        : "A possible follow-up has limited article text; abstain rather than promote it.",
      evidence: { facetsCompared: pairs.length, selectedFacets: [bestPair.left.title, bestPair.right.title], continuityMarker, missingBodies, bodyContextTerms, publisherCoverage },
      parentKeys: [],
    };
  }

  const parentKeys = sharedTitleTerms.length >= 2
    ? sharedTitleTerms.filter((term) => term.length >= 6).slice(0, 3).map((term) => `ISSUE:${term}`)
    : [];
  if (sharedContext || supportingEntities.length > 0) {
    const multipleSharedPeopleOnSpecificTopic = sharedPerson
      && bestPair.sharedEntities.filter((entity) => entity.type === "PERSON").length >= 2
      && sharedTerms.length >= 1;
    const hasTopicEvidence = sharedTerms.length >= 2 || sharedSignals.length > 0 || multipleSharedPeopleOnSpecificTopic;
    const type: RelationshipType = hasTopicEvidence ? "BROADER_CONTEXT_ONLY" : "UNRELATED";
    return {
      type, state: type === "BROADER_CONTEXT_ONLY" ? "CANDIDATE" : "REJECTED", supportingEntities, supportingTerms,
      temporalEvidence, contradictingEvidence: historical ? ["At least one item is older/historical; date alone is not treated as continuing coverage."] : contradictory,
      explanation: type === "BROADER_CONTEXT_ONLY"
        ? "The events share an issue or public context but lack evidence that they are the same occurrence or continuing storyline; keep them separate under any parent."
        : "The overlap is generic or incidental and does not support a meaningful relationship.",
      evidence: { facetsCompared: pairs.length, selectedFacets: [bestPair.left.title, bestPair.right.title], sharedSignals: sharedSignals.map((entity) => entity.canonical), historical, composite, bodyContextTerms, publisherCoverage },
      parentKeys: type === "BROADER_CONTEXT_ONLY" ? parentKeys : [],
    };
  }

  return {
    type: "UNRELATED", state: "REJECTED", supportingEntities, supportingTerms, temporalEvidence,
    contradictingEvidence: ["No shared specific entities or distinctive issue terms."],
    explanation: "No meaningful relationship was found; the events remain separate.", evidence: { facetsCompared: pairs.length }, parentKeys: [],
  };
}

function eventCandidateKeys(event: EventFeature): string[] {
  const keys = event.entities
    .filter((entity) => !["COUNTRY", "CITY_REGION", "PERSON"].includes(entity.type))
    .map((entity) => `ENTITY:${entity.type}:${entity.canonical}`);
  for (const term of event.terms) keys.push(`TERM:${term}`);
  return keys;
}

export function candidateEventPairs(events: EventFeature[]): Array<[number, number]> {
  const termFrequency = new Map<string, number>();
  for (const event of events) for (const term of new Set(event.titleTerms)) termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1);
  const postings = new Map<string, number[]>();
  events.forEach((event, index) => {
    const rareTerms = [...event.titleTerms]
      .sort((left, right) => ((termFrequency.get(left) ?? 0) - (termFrequency.get(right) ?? 0)) || right.length - left.length)
      .slice(0, 12);
    const keys = [
      ...event.entities.filter((entity) => !["COUNTRY", "CITY_REGION"].includes(entity.type)).map((entity) => `ENTITY:${entity.type}:${entity.canonical}`),
      ...rareTerms.map((term) => `TERM:${term}`),
    ];
    for (const key of keys) {
      const list = postings.get(key) ?? [];
      list.push(index);
      postings.set(key, list);
    }
  });
  const pairKeys = new Set<string>();
  for (const indexes of postings.values()) {
    for (let left = 0; left < indexes.length; left += 1) {
      for (let right = left + 1; right < indexes.length; right += 1) {
        const a = indexes[left];
        const b = indexes[right];
        if (a === undefined || b === undefined || a === b) continue;
        const low = Math.min(a, b);
        const high = Math.max(a, b);
        pairKeys.add(`${low}:${high}`);
      }
    }
  }
  return [...pairKeys].map((key) => key.split(":").map(Number) as [number, number]);
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
  relationships: Array<{ left: number; right: number; evaluation: RelationshipEvaluation }>;
  children: Array<{ eventIndexes: number[]; title: string; eventKeys: string[]; entityKeys: string[]; terms: string[]; categories: string[] }>;
  parents: Array<{ childIndexes: number[]; title: string; keys: string[] }>;
  candidatePairCount: number;
}

export function analyzeNarratives(events: EventFeature[]): NarrativeAnalysis {
  const candidatePairs = candidateEventPairs(events);
  const termFrequency = new Map<string, number>();
  for (const event of events) for (const term of new Set(event.titleTerms)) termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1);
  const relationMap = new Map<string, RelationshipEvaluation>();
  const relationships = candidatePairs.map(([left, right]) => {
    const evaluation = classifyRelationship(events[left]!, events[right]!, termFrequency, events.length);
    relationMap.set(`${left}:${right}`, evaluation);
    return { left, right, evaluation };
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

  return { events, relationships, children, parents, candidatePairCount: candidatePairs.length };
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
