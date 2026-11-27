export const ASSISTANT_LANGUAGES = ['en', 'ta', 'si', 'tanglish', 'singlish']
export const CATALOG_INTENTS = ['menu', 'recommend', 'price', 'hours', 'open', 'location', 'ratings', 'favorites']
export const ASSISTANT_INTENTS = ['greeting', 'thanks', 'language', 'off_topic', 'clarify', ...CATALOG_INTENTS]
export const ANSWER_DETAILS = ['price', 'hours', 'open', 'location', 'ratings', 'stock', 'ingredients']
export const ASSISTANT_SORTS = ['default', 'cheapest', 'highestRated', 'mostRated']
export const CLARIFICATION_FIELDS = ['canteen', 'dish', 'budget', 'time', 'choice']

const ROMAN_TAMIL_GRAMMAR = /\b(?:kulla|kulle|pann(?:u|unga)|enn[aa]+|evlo|adhoda|athoda|(?:atha|adha) vida)\b/i
const ROMAN_SINHALA_GRAMMAR = /\b(?:kochchara|kochchra|koheda|ekee? mila|aduwen|tiyenawada|thiyenawada)\b/i
const ENGLISH_GRAMMAR = /\b(?:(?:can|could|do|did|should|would|will) (?:i|you|we)|for up to|what time|how much|which canteen)\b/gi

export function clearQuestionLanguage(question) {
  const phrase = question.replace(/"[^"]+"|“[^”]+”|‘[^’]+’|(?<![\p{L}\p{N}])'[^']+'(?![\p{L}\p{N}])/gu, ' ')
  const tamil = phrase.match(/\p{Script=Tamil}+/gu)?.length ?? 0
  const sinhala = phrase.match(/\p{Script=Sinhala}+/gu)?.length ?? 0
  if (tamil > 1 && !sinhala) return 'ta'
  if (sinhala > 1 && !tamil) return 'si'

  // Check distinctive grammar only. Leave short, unfamiliar and ambiguous forms to Gemini.
  if (tamil || sinhala) return null
  const romanTamil = ROMAN_TAMIL_GRAMMAR.test(phrase)
  const romanSinhala = ROMAN_SINHALA_GRAMMAR.test(phrase)
  if (romanTamil !== romanSinhala) return romanTamil ? 'tanglish' : 'singlish'
  return !romanTamil && (phrase.match(ENGLISH_GRAMMAR)?.length ?? 0) > 1 ? 'en' : null
}

export function stripContactDetails(text) {
  return text
    .replace(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.[a-z]{2,}/gi, '[redacted]')
    .replace(/(?<!\d)\+?\d(?:[ ()-]*\d){8,}(?!\d)/g, '[redacted]')
}

function cleanQuery(value) {
  return typeof value === 'string' ? stripContactDetails(value.trim()).slice(0, 100) || null : null
}

function cleanIds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(id => typeof id === 'string' && /^[\w-]{1,80}$/.test(id)))].slice(0, 12)
}

function cleanSelection(value) {
  return {
    canteenIds: cleanIds(value.canteenIds),
    foodIds: cleanIds(value.foodIds),
    foodQuery: cleanQuery(value.foodQuery),
    canteenQuery: cleanQuery(value.canteenQuery),
    maxPriceLkr: Number.isFinite(value.maxPriceLkr) && value.maxPriceLkr >= 0 && value.maxPriceLkr <= 100_000
      ? value.maxPriceLkr : null,
    exclusive: value.exclusive === true,
    openOnly: value.openOnly === true,
    limit: Number.isInteger(value.limit) && value.limit > 0 ? Math.min(value.limit, 12) : null,
    sort: ASSISTANT_SORTS.includes(value.sort) ? value.sort : 'default',
    details: Array.isArray(value.details) ? ANSWER_DETAILS.filter(detail => value.details.includes(detail)) : [],
  }
}

export function normalizeAssistantContext(value) {
  return {
    languagePreference: ASSISTANT_LANGUAGES.includes(value?.languagePreference) ? value.languagePreference : null,
    lastLanguage: ASSISTANT_LANGUAGES.includes(value?.lastLanguage) ? value.lastLanguage : null,
    focus: CATALOG_INTENTS.includes(value?.focus?.intent)
      ? { intent: value.focus.intent, ...cleanSelection(value.focus) }
      : null,
  }
}

export function validateAssistantPlan(value) {
  if (!ASSISTANT_INTENTS.includes(value?.intent)) throw new Error('Invalid assistant intent')
  return {
    intent: value.intent,
    language: ASSISTANT_LANGUAGES.includes(value.language) ? value.language : 'inherit',
    preference: ['auto', ...ASSISTANT_LANGUAGES].includes(value.preference) ? value.preference : 'keep',
    clarification: CLARIFICATION_FIELDS.includes(value.clarification) ? value.clarification : 'choice',
    ...cleanSelection(value),
  }
}
