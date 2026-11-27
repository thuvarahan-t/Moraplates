import { renderAssistantAnswer } from './assistant-answers.js'
import { CATALOG_INTENTS, clearQuestionLanguage, normalizeAssistantContext, validateAssistantPlan } from './assistant-context.js'
import { interpretAssistantQuestion } from './assistant-intent.js'

const GREETINGS = {
  en: /^(?:hi|hey|hello|hiya)(?:[ ,]+helena)?$/i,
  ta: /^(?:வணக்கம்|ஹாய்|ஹலோ)(?:[ ,]+ஹெலினா)?$/u,
  si: /^(?:ආයුබෝවන්|හායි|හෙලෝ)(?:[ ,]+හෙලේනා)?$/u,
  tanglish: /^(?:vanakkam|vanakam)(?:[ ,]+helena)?$/i,
  singlish: /^(?:ayubowan|aayubowan)(?:[ ,]+helena)?$/i,
}
const UNRESOLVED_CANTEEN = /\bthat (?:canteen|place)\b|\bandha canteen\b|அந்த\s+கேன்டீன்|ඒ\s+කැන්ටිම|\be canteen\b/iu

export function greetAssistant(question, previousContext) {
  const text = question.trim().replace(/[\s.,!?👋]+$/u, '')
  const match = Object.keys(GREETINGS).find(language => GREETINGS[language].test(text))
  if (!match) return null

  const context = normalizeAssistantContext(previousContext)
  const language = context.languagePreference ?? (match === 'en' ? context.lastLanguage ?? 'en' : match)
  return {
    ...renderAssistantAnswer({ plan: { intent: 'greeting' }, language }),
    language,
    context: { ...context, lastLanguage: language },
  }
}

// The model selects short references. Browser context keeps stable Supabase IDs across catalog updates.
function indexRecords(rows, prefix) {
  const toReference = new Map()
  const toId = new Map()
  for (const [index, { id }] of rows.entries()) {
    const reference = prefix + '-' + (index + 1)
    toReference.set(id, reference)
    toId.set(reference, id)
  }
  return { toReference, toId }
}

function translateSelection(selection, canteens, foods) {
  if (!selection) return null
  const canteenIds = selection.canteenIds.map(id => canteens.get(id)).filter(Boolean)
  const foodIds = selection.foodIds.map(id => foods.get(id)).filter(Boolean)
  return {
    ...selection,
    canteenIds,
    foodIds,
    // A deleted or invalid reference must not broaden the query to the entire catalog.
    canteenQuery: canteenIds.length ? null : selection.canteenQuery ?? (selection.canteenIds.length ? '?' : null),
    foodQuery: foodIds.length ? null : selection.foodQuery ?? (selection.foodIds.length ? '?' : null),
  }
}

export async function askAssistantModel({ apiKey, question, history = [], context: previousContext, catalog, fetchImpl = fetch }) {
  const context = normalizeAssistantContext(previousContext)
  const canteens = indexRecords(catalog.canteens, 'canteen')
  const foods = indexRecords(catalog.foods, 'food')
  const modelCatalog = {
    ...catalog,
    canteens: catalog.canteens.map(canteen => ({ ...canteen, id: canteens.toReference.get(canteen.id) })),
    foods: catalog.foods.map(food => ({
      ...food, id: foods.toReference.get(food.id), canteenId: canteens.toReference.get(food.canteenId),
    })),
  }
  const proposed = await interpretAssistantQuestion({
    apiKey,
    question,
    history,
    context: { ...context, focus: translateSelection(context.focus, canteens.toReference, foods.toReference) },
    catalog: modelCatalog,
    fetchImpl,
  })
  let plan = translateSelection(validateAssistantPlan(proposed), canteens.toId, foods.toId)
  if (!context.focus && !plan.canteenIds.length && !plan.foodIds.length && !plan.canteenQuery &&
      ['hours', 'open', 'location'].includes(plan.intent) && UNRESOLVED_CANTEEN.test(question)) {
    plan = { ...plan, intent: 'clarify', clarification: 'canteen' }
  }
  const languagePreference = plan.preference === 'keep' ? context.languagePreference
    : plan.preference === 'auto' ? null : plan.preference
  const language = languagePreference ?? clearQuestionLanguage(question) ??
    (plan.language === 'inherit' ? context.lastLanguage ?? 'en' : plan.language)
  const answer = renderAssistantAnswer({ plan, language, catalog })
  const nextContext = normalizeAssistantContext({
    languagePreference,
    lastLanguage: language,
    focus: CATALOG_INTENTS.includes(plan.intent) ? plan : context.focus,
  })
  return { ...answer, language, context: nextContext }
}
