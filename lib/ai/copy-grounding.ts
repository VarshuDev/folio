import type { CopyImprovementAction } from './contract';

const FUNCTION_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'he', 'her', 'here', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just',
  'less', 'many', 'may', 'me', 'might', 'more', 'most', 'much', 'must', 'my', 'near', 'neither', 'nor',
  'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'out', 'over', 'own', 'same',
  'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'us', 'very', 'was',
  'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves', 'ever', 'now', 'hereby', 'currently', 'first', 'second',
]);

const QUANTIFIER_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'dozen', 'hundred', 'thousand', 'million', 'billion', 'first', 'second', 'third', 'fourth', 'fifth',
  'once', 'twice', 'percent', 'percentage',
]);

const NEGATION_WORDS = new Set([
  'no', 'not', 'never', 'neither', 'nor', 'without', 'cannot', 'cant', 'couldnt', 'didnt', 'doesnt',
  'dont', 'hadnt', 'hasnt', 'havent', 'isnt', 'mustnt', 'shouldnt', 'wasnt', 'werent', 'wont', 'wouldnt',
]);

const CONTRACTIONS: Readonly<Record<string, string[]>> = {
  "i'm": ['i', 'am'], "you're": ['you', 'are'], "we're": ['we', 'are'], "they're": ['they', 'are'],
  "it's": ['it', 'is'], "that's": ['that', 'is'], "there's": ['there', 'is'], "he's": ['he', 'is'], "she's": ['she', 'is'],
  "i've": ['i', 'have'], "we've": ['we', 'have'], "they've": ['they', 'have'], "you've": ['you', 'have'],
  "i'll": ['i', 'will'], "we'll": ['we', 'will'], "they'll": ['they', 'will'], "you'll": ['you', 'will'],
  "can't": ['can', 'not'], "cannot": ['can', 'not'], "couldn't": ['could', 'not'], "didn't": ['did', 'not'],
  "doesn't": ['does', 'not'], "don't": ['do', 'not'], "hadn't": ['had', 'not'], "hasn't": ['has', 'not'],
  "haven't": ['have', 'not'], "isn't": ['is', 'not'], "mustn't": ['must', 'not'], "shouldn't": ['should', 'not'],
  "wasn't": ['was', 'not'], "weren't": ['were', 'not'], "won't": ['will', 'not'], "wouldn't": ['would', 'not'],
};

const TOKEN_PATTERN = /\d+(?:,\d{3})*(?:\.\d+)?%?|[\p{L}][\p{L}\p{N}]*(?:['’][\p{L}]+)?(?:[+#][\p{L}\p{N}+#]*)*(?:\.[\p{L}\p{N}]+)*/gu;
const EXPLICIT_URL_PATTERN = /\b(?:(?:https?:\/\/)|www\.)[^\s<>"']+/giu;
const DOMAIN_PATTERN = /\b[a-z\d][a-z\d.-]*\.[a-z]{2,}(?:\/[^\s<>"']*)?/giu;
const INSTRUCTION_LIKE_SOURCE = /\b(?:ignore|disregard|override|forget)\b[^.!?\n]{0,100}\b(?:(?:all|the|previous|earlier|above|system|developer)\s+){0,3}(?:instructions?|rules?|prompts?)\b/i;

function normalizeWord(word: string): string {
  return word.normalize('NFKC').toLocaleLowerCase().replace(/[’]/g, "'");
}

function expandToken(raw: string): string[] {
  const normalized = normalizeWord(raw);
  return CONTRACTIONS[normalized] ?? [normalized];
}

function wordTokens(text: string): Array<{ raw: string; normalized: string }> {
  const matches = text.normalize('NFKC').match(TOKEN_PATTERN) ?? [];
  return matches.flatMap((raw) => expandToken(raw).map((normalized) => ({ raw, normalized })));
}

function countBy<T>(values: T[]): Map<T, number> {
  const result = new Map<T, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function numericFacts(text: string): string[] {
  return (text.normalize('NFKC').match(/\b\d+(?:,\d{3})*(?:\.\d+)?%?\b/g) ?? [])
    .map((value) => value.replaceAll(',', '').toLocaleLowerCase()).sort();
}

function referenceUrls(text: string): string[] {
  const values = new Set<string>();
  for (const match of text.matchAll(EXPLICIT_URL_PATTERN)) {
    values.add(match[0].replace(/[),.!?;:'"\]}]+$/g, '').toLocaleLowerCase());
  }
  for (const match of text.matchAll(DOMAIN_PATTERN)) {
    const value = match[0].replace(/[),.!?;:'"\]}]+$/g, '').toLocaleLowerCase();
    if (/\.[a-z]{2,}(?:\/|$)/i.test(value)) values.add(value);
  }
  return [...values].sort();
}

function negationFacts(text: string): string[] {
  return wordTokens(text).map(({ normalized }) => normalized.replaceAll("'", '')).filter((word) => NEGATION_WORDS.has(word)).sort();
}

function isProtectedSourceTerm(raw: string, normalized: string): boolean {
  if (QUANTIFIER_WORDS.has(normalized)) return true;
  if (/\d/.test(raw) || /[+#]/.test(raw)) return true;
  if (/^[A-Z\d+#.]{2,}$/.test(raw) && /[A-Z]/.test(raw)) return true;
  // Preserve likely names, tools, acronyms, and branded technologies, including at sentence start.
  return raw.length > 1 && /[A-Z]/.test(raw) && /[a-z]/.test(raw);
}

function sourceProtectedTerms(text: string): string[] {
  const matches = text.normalize('NFKC').match(TOKEN_PATTERN) ?? [];
  return matches.filter((raw) => isProtectedSourceTerm(raw, normalizeWord(raw))).map(normalizeWord);
}

function hasCreationContext(originalText: string): boolean {
  return /\b(?:built|made|created|developed|designed|coded|programmed|prototyped|wrote)\b/i.test(originalText)
    && /\b(?:app|website|web\s+site|site|program|prototype|tool|game|project|bot|model|page|platform)\b/i.test(originalText);
}

function isSafeNeutralAddition(token: string, originalText: string): boolean {
  if (FUNCTION_WORDS.has(token)) return true;
  // "project" and "hands-on" are low-risk framing only when the source itself
  // explicitly describes making a concrete thing; no results or impact are inferred.
  if ((token === 'project' || token === 'hands') && hasCreationContext(originalText)) return true;
  return false;
}

/**
 * Conservative, deterministic lexical checks for AI rewrites. New content-bearing
 * tokens, quantitative claims, links, and negation changes are rejected. This is
 * deliberately stricter than semantic similarity: a rejected rewrite falls back
 * to the ordinary editor rather than being shown as grounded.
 */
export function isGroundedCopyRewrite(
  originalText: string,
  proposedText: string,
  action: 'clearer' | 'shorten' | 'professional',
): boolean {
  if (!originalText.trim() || !proposedText.trim()) return false;
  if (INSTRUCTION_LIKE_SOURCE.test(originalText)) return false;
  if (originalText.normalize('NFKC').trim() === proposedText.normalize('NFKC').trim()) return false;
  if (action === 'shorten' && proposedText.trim().length >= originalText.trim().length) return false;
  if (JSON.stringify(numericFacts(originalText)) !== JSON.stringify(numericFacts(proposedText))) return false;
  if (JSON.stringify(referenceUrls(originalText)) !== JSON.stringify(referenceUrls(proposedText))) return false;
  if (JSON.stringify(negationFacts(originalText)) !== JSON.stringify(negationFacts(proposedText))) return false;

  const sourceTokens = wordTokens(originalText).map(({ normalized }) => normalized);
  const proposedTokens = wordTokens(proposedText).map(({ normalized }) => normalized);
  if (!proposedTokens.some((token) => !FUNCTION_WORDS.has(token))) return false;

  const sourceCounts = countBy(sourceTokens);
  const proposedCounts = countBy(proposedTokens);
  for (const [token, count] of proposedCounts) {
    if ((sourceCounts.get(token) ?? 0) >= count) continue;
    if (count === 1 && isSafeNeutralAddition(token, originalText)) continue;
    return false;
  }

  const protectedCounts = countBy(sourceProtectedTerms(originalText));
  for (const [term, count] of protectedCounts) {
    if ((proposedCounts.get(term) ?? 0) < count) return false;
  }
  return true;
}

/** Keep reasons factual and server-authored; provider explanations are not trusted. */
export function copyImprovementReason(action: CopyImprovementAction): string {
  switch (action) {
    case 'clearer': return 'This version aims to make the same details easier to follow.';
    case 'shorten': return 'This version aims to say the same thing in fewer words.';
    case 'professional': return 'This version aims for a more professional tone without adding details.';
  }
}
