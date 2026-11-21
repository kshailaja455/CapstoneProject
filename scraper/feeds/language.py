import re
import unicodedata

COMMON_ENGLISH_WORDS = {
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
}


def is_english_language_code(code):
    if not code:
        return False
    normalized = str(code).lower().strip().replace("_", "-")
    return normalized == "en" or normalized.startswith("en-") or normalized.startswith("eng")


def is_english_content(title="", summary="", body="", feed_language=""):
    # 1. If feed explicitly declares English and content has Latin letters, verify
    combined = f"{title} {summary}".strip()
    if not combined:
        combined = body[:500].strip()
    if not combined:
        return False

    # 2. Script check: Count Latin characters vs non-Latin Unicode letters
    letters = [ch for ch in combined if ch.isalpha()]
    if not letters:
        return False

    latin_count = sum(1 for ch in letters if ("a" <= ch <= "z" or "A" <= ch <= "Z"))
    latin_ratio = latin_count / len(letters)

    # If substantial non-Latin script (Hindi, Tamil, Russian, Arabic, Chinese, etc.), reject
    if latin_ratio < 0.65:
        return False

    # 3. Vocabulary word check
    words = re.findall(r"\b[a-z]{2,}\b", combined.lower())
    if not words:
        return False

    english_hits = sum(1 for w in words if w in COMMON_ENGLISH_WORDS)
    word_ratio = english_hits / len(words)

    # Feed language check as bonus signal
    if is_english_language_code(feed_language) and latin_ratio >= 0.8:
        return True

    # Standalone check: Needs reasonable English word presence
    if len(words) <= 5:
        return latin_ratio >= 0.85
    return word_ratio >= 0.10 and latin_ratio >= 0.70

