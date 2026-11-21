const COMMON_ENGLISH_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
  "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
  "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
  "is", "was", "are", "were", "been", "has", "had", "said", "india", "minister",
  "government", "police", "court", "news", "report", "state", "delhi", "bjp", "congress"
]);

export function isEnglishLanguageCode(code?: string | null): boolean {
  if (!code) return false;
  const normalized = code.toLowerCase().trim().replace(/_/g, "-");
  return normalized === "en" || normalized.startsWith("en-") || normalized.startsWith("eng");
}

export function detectEnglish(text: string): { isEnglish: boolean; confidence: number; reason: string } {
  if (!text || text.trim().length === 0) {
    return { isEnglish: false, confidence: 0, reason: "Empty text" };
  }

  const clean = text.replace(/<[^>]+>/g, " ").trim();
  
  // 1. Script check: Ratio of Latin alphabet characters
  const letters = clean.match(/[\p{L}]/gu) || [];
  if (letters.length === 0) {
    return { isEnglish: false, confidence: 0, reason: "No letters found" };
  }

  const latinLetters = clean.match(/[a-zA-Z]/g) || [];
  const latinRatio = latinLetters.length / letters.length;
  
  if (latinRatio < 0.6) {
    return {
      isEnglish: false,
      confidence: Math.round(latinRatio * 100),
      reason: `Non-Latin script detected (${Math.round((1 - latinRatio) * 100)}% non-Latin)`,
    };
  }

  // 2. Vocabulary / Stop-word check
  const tokens = clean
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (tokens.length === 0) {
    return { isEnglish: false, confidence: 0, reason: "No usable words" };
  }

  let englishHits = 0;
  for (const token of tokens) {
    if (COMMON_ENGLISH_WORDS.has(token)) {
      englishHits++;
    }
  }

  const wordRatio = englishHits / tokens.length;
  
  // Require reasonable word match or high Latin ratio for short titles
  const isEnglish = tokens.length <= 4 ? latinRatio >= 0.8 : (wordRatio >= 0.12 && latinRatio >= 0.7);

  return {
    isEnglish,
    confidence: Math.min(100, Math.round(Math.max(wordRatio * 200, latinRatio * 90))),
    reason: isEnglish ? "Verified English language" : "Insufficient English vocabulary",
  };
}

