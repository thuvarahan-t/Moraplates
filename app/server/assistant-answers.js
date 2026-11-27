const COPY = {
  en: {
    greeting: 'Hi! What are you in the mood for?',
    thanks: 'You’re welcome!',
    language: 'Sure, I’ll reply in English.',
    automatic: 'Sure, I’ll follow the language you use.',
    offTopic: 'I’m on canteen duty 😄 Ask me about Mora menus, prices, hours, or ratings.',
    clarify: {
      canteen: 'Which canteen do you mean?', dish: 'Which dish do you mean?',
      budget: 'What’s your budget in rupees?', time: 'What time are you planning to go?',
      choice: 'Which of those options do you mean?',
    },
    missingCanteen: 'I couldn’t find that canteen in the listed data.',
    missingFood: 'I couldn’t find that dish in the matching menus.',
    noMenu: 'I couldn’t find matching items in the listed menus.',
    noBudget: price => `I couldn’t find a listed item that fits the Rs. ${price} budget.`,
    noOpen: 'MoraPlates shows no matching canteen open right now.',
    noPrice: 'Price hasn’t been listed.',
    noHours: 'Hours haven’t been listed.',
    noLocation: 'Location hasn’t been listed.',
    noRatings: 'No ratings yet.',
    noVotes: 'No canteen votes have been recorded this week.',
    stock: 'I can check the menu, but MoraPlates doesn’t show live stock.',
    ingredients: 'MoraPlates doesn’t list ingredients. Please check with the canteen about dietary needs or allergies.',
    limited: 'Based on the listings I have.',
    foodAt: (food, canteen) => `${food} at ${canteen}`,
    price: price => `Rs. ${price}`,
    hours: (opens, closes) => `Regular hours ${opens}–${closes} (Colombo time)`,
    status: { open: 'Open now', closed: 'Closed now', reportedOpen: 'Reported open', reportedClosed: 'Reported closed', closedToday: 'Reported closed today' },
    rating: (positive, total) => `${positive} of ${total} ratings say Super`,
    votes: count => `${count} ${count === 1 ? 'vote' : 'votes'} this week`,
    pick: 'I’d try',
    tentative: 'Based on limited ratings.',
    practical: 'A practical pick from the listed options.',
  },
  ta: {
    greeting: 'வணக்கம்! இன்னைக்கு என்ன சாப்பிட ஆசை?',
    thanks: 'சந்தோஷம்!',
    language: 'சரி, இனிமேல் தமிழில் பதில் சொல்றேன்.',
    automatic: 'சரி, நீங்க எந்த மொழியில கேட்கிறீங்களோ அதுல பதில் சொல்றேன்.',
    offTopic: 'மோரா கேன்டீன், மெனு, விலை, நேரம் அல்லது ரேட்டிங் பற்றி கேளுங்க.',
    clarify: {
      canteen: 'எந்த கேன்டீனைப் பற்றிக் கேட்கிறீங்க?', dish: 'எந்த சாப்பாட்டைப் பற்றிக் கேட்கிறீங்க?',
      budget: 'உங்க பட்ஜெட் எவ்வளவு?', time: 'எத்தனை மணிக்குப் போகப் போறீங்க?',
      choice: 'அந்தப் பட்டியலில் எதைப் பற்றிக் கேட்கிறீங்க?',
    },
    missingCanteen: 'அந்த கேன்டீன் MoraPlates பட்டியலில் கிடைக்கல.',
    missingFood: 'அந்த சாப்பாடு இந்த மெனுக்களில் கிடைக்கல.',
    noMenu: 'பொருந்துற சாப்பாடு எதுவும் மெனுவில் கிடைக்கல.',
    noBudget: price => `ரூ. ${price} பட்ஜெட்டுக்குள்ள பொருந்துற ஐட்டம் மெனுவில் கிடைக்கல.`,
    noOpen: 'பொருந்துற கேன்டீன் எதுவும் இப்போ திறந்திருப்பதாகத் தெரியல.',
    noPrice: 'விலை பதிவு செய்யப்படல.',
    noHours: 'திறக்கும் நேரம் பதிவு செய்யப்படல.',
    noLocation: 'இடம் பதிவு செய்யப்படல.',
    noRatings: 'இன்னும் ரேட்டிங் இல்ல.',
    noVotes: 'இந்த வாரம் கேன்டீன்களுக்கு வாக்கு எதுவும் பதிவாகல.',
    stock: 'மெனுவைப் பார்க்கலாம். இப்போ இருப்பு இருக்கான்னு MoraPlates-ல் தெரியாது.',
    ingredients: 'MoraPlates-ல் சாப்பாட்டில் என்ன சேர்த்திருக்காங்கன்னு தெரியாது. உணவுத் தேவைகள் அல்லது அலர்ஜி இருந்தா கேன்டீன்ல உறுதி பண்ணுங்க.',
    limited: 'கிடைக்கிற பட்டியலை வைத்து சொல்றேன்.',
    foodAt: (food, canteen) => `${canteen}-ல ${food}`,
    price: price => `ரூ. ${price}`,
    hours: (opens, closes) => `வழக்கமான நேரம் ${opens}–${closes} (கொழும்பு நேரம்)`,
    status: { open: 'இப்போ திறந்திருக்கு', closed: 'இப்போ மூடியிருக்கு', reportedOpen: 'திறந்திருப்பதாகப் பதிவு', reportedClosed: 'மூடியிருப்பதாகப் பதிவு', closedToday: 'இன்று மூடியிருப்பதாகப் பதிவு' },
    rating: (positive, total) => `${total} ரேட்டிங்கில் ${positive} Super`,
    votes: count => `இந்த வாரம் ${count} வாக்குகள்`,
    pick: 'என் தேர்வு',
    tentative: 'ரேட்டிங் எண்ணிக்கை குறைவுதான்.',
    practical: 'மெனுவில் இருக்கிற ஒரு தேர்வு.',
  },
  si: {
    greeting: 'හායි! අද මොනවද කන්න හිතෙන්නේ?',
    thanks: 'හරි, සතුටුයි!',
    language: 'හරි, මම සිංහලෙන් උත්තර දෙන්නම්.',
    automatic: 'හරි, ඔයා අහන භාෂාවෙන් උත්තර දෙන්නම්.',
    offTopic: 'මෝරා කැන්ටිම්, මෙනු, මිල, වෙලාව හෝ රේටින් ගැන අහන්න.',
    clarify: {
      canteen: 'ඔයා අහන්නේ මොන කැන්ටිම ගැනද?', dish: 'ඔයා අහන්නේ මොන කෑම ගැනද?',
      budget: 'ඔයාගේ බජට් එක රුපියල් කීයද?', time: 'ඔයා යන්න හිතන්නේ කීයටද?',
      choice: 'ඒ ලැයිස්තුවේ මොන එක ගැනද අහන්නේ?',
    },
    missingCanteen: 'ඒ කැන්ටිම MoraPlates ලැයිස්තුවේ හම්බ වුණේ නැහැ.',
    missingFood: 'ඒ කෑම මේ මෙනුවල හම්බ වුණේ නැහැ.',
    noMenu: 'ගැළපෙන කෑමක් මෙනුවල හම්බ වුණේ නැහැ.',
    noBudget: price => `රු. ${price} බජට් එකට ගැළපෙන කෑමක් මෙනුවේ හම්බ වුණේ නැහැ.`,
    noOpen: 'ගැළපෙන කැන්ටිමක් දැන් විවෘත බව MoraPlates එකේ පේන්නේ නැහැ.',
    noPrice: 'මිල සඳහන් කරලා නැහැ.',
    noHours: 'වෙලාව සඳහන් කරලා නැහැ.',
    noLocation: 'තැන සඳහන් කරලා නැහැ.',
    noRatings: 'තාම රේටින් නැහැ.',
    noVotes: 'මේ සතියේ කැන්ටිම් ඡන්ද තාම වාර්තා වෙලා නැහැ.',
    stock: 'මෙනුව බලන්න පුළුවන්. දැන් කෑම ඉතුරුද කියලා MoraPlates එකෙන් දැනගන්න බැහැ.',
    ingredients: 'MoraPlates එකේ අමුද්‍රව්‍ය පෙන්නන්නේ නැහැ. ආහාර සීමා හෝ අසාත්මිකතා තියෙනවා නම් කැන්ටිමෙන් අහලා බලන්න.',
    limited: 'මේ තියෙන ලැයිස්තුව අනුවයි.',
    foodAt: (food, canteen) => `${canteen} එකේ ${food}`,
    price: price => `රු. ${price}`,
    hours: (opens, closes) => `සාමාන්‍ය වෙලාව ${opens}–${closes} (කොළඹ වේලාව)`,
    status: { open: 'දැන් ඇරලා', closed: 'දැන් වහලා', reportedOpen: 'ඇරලා කියලා වාර්තා වෙලා', reportedClosed: 'වහලා කියලා වාර්තා වෙලා', closedToday: 'අද වහලා කියලා වාර්තා වෙලා' },
    rating: (positive, total) => `රේටින් ${total}කින් ${positive}ක් Super`,
    votes: count => `මේ සතියේ ඡන්ද ${count}`,
    pick: 'මගේ තේරීම',
    tentative: 'රේටින් තියෙන්නේ ටිකයි.',
    practical: 'මෙනුවේ තියෙන තේරීමක්.',
  },
  tanglish: {
    greeting: 'Vanakkam! Innaikku enna saapida aasai?',
    thanks: 'Paravalla!',
    language: 'Sari, inimel Tanglish-la reply panren.',
    automatic: 'Sari, neenga kekkura language-la reply panren.',
    offTopic: 'Mora canteen, menu price, neram illa rating pathi kelunga.',
    clarify: {
      canteen: 'Endha canteen pathi kekkureenga?', dish: 'Endha dish pathi kekkureenga?',
      budget: 'Unga budget evlo?', time: 'Ethana manikku poga poringa?',
      choice: 'Andha list-la edha pathi kekkureenga?',
    },
    missingCanteen: 'Andha canteen MoraPlates list-la kidaikkala.',
    missingFood: 'Andha dish indha menu-la kidaikkala.',
    noMenu: 'Match aagura item menu-la kidaikkala.',
    noBudget: price => `Rs. ${price} budget-kulla match aagura item menu-la kidaikkala.`,
    noOpen: 'Match aagura canteen edhuvum ippo open-nu MoraPlates-la kaatala.',
    noPrice: 'Price list-la podala.',
    noHours: 'Opening neram list-la podala.',
    noLocation: 'Idam list-la podala.',
    noRatings: 'Innum rating illa.',
    noVotes: 'Indha vaaram canteen votes innum varala.',
    stock: 'Menu-a paakkalaam. Ippo stock irukka-nu MoraPlates-la theriyadhu.',
    ingredients: 'MoraPlates-la ingredients details illa. Food restriction illa allergy irundha canteen-la confirm pannunga.',
    limited: 'Kidaikkura list-a vechu solren.',
    foodAt: (food, canteen) => `${canteen}-la ${food}`,
    price: price => `Rs. ${price}`,
    hours: (opens, closes) => `Vazhakkamaana neram ${opens}–${closes} (Colombo time)`,
    status: { open: 'Ippo open', closed: 'Ippo closed', reportedOpen: 'Open-nu report pannirukkaanga', reportedClosed: 'Closed-nu report pannirukkaanga', closedToday: 'Innaikku closed-nu report pannirukkaanga' },
    rating: (positive, total) => `${total} ratings-la ${positive} Super`,
    votes: count => `Indha vaaram ${count} votes`,
    pick: 'En pick',
    tentative: 'Ratings kammiya irukku.',
    practical: 'Menu-la irukkura oru option.',
  },
  singlish: {
    greeting: 'Ayubowan! Ada monawada kanna hithenne?',
    thanks: 'Hari, sathutui!',
    language: 'Hari, mama Sinhala English akuren reply karannam.',
    automatic: 'Hari, oya ahana bhashawen uttara dennam.',
    offTopic: 'Mora canteen, menu, mila, welawa hari rating gana ahanna.',
    clarify: {
      canteen: 'Mona canteen eka ganada ahanne?', dish: 'Mona kaema eka ganada ahanne?',
      budget: 'Oyage budget eka keeyada?', time: 'Keeyatada yanna hithanne?',
      choice: 'E list eke mona eka ganada ahanne?',
    },
    missingCanteen: 'E canteen eka MoraPlates list eke hambune na.',
    missingFood: 'E kaema eka me menu wala hambune na.',
    noMenu: 'Galapena kaemak menu wala hambune na.',
    noBudget: price => `Rs. ${price} budget ekata galapena kaemak menu eke hambune na.`,
    noOpen: 'Galapena canteen ekak dan arala kiyala MoraPlates eke pennanne na.',
    noPrice: 'Mila dala na.',
    noHours: 'Welawa dala na.',
    noLocation: 'Thana dala na.',
    noRatings: 'Thama ratings na.',
    noVotes: 'Me sathiye canteen votes thama na.',
    stock: 'Menu eka balanna puluwan. Dan stock thiyenawada kiyala MoraPlates eke pennanne na.',
    ingredients: 'MoraPlates eke ingredients pennanne na. Kaema seema hari allergy thiyenawanam canteen eken ahala balanna.',
    limited: 'Me list eka anuwa.',
    foodAt: (food, canteen) => `${canteen} eke ${food}`,
    price: price => `Rs. ${price}`,
    hours: (opens, closes) => `Samanya welawa ${opens}–${closes} (Colombo time)`,
    status: { open: 'Dan arala', closed: 'Dan wahala', reportedOpen: 'Arala kiyala report karala', reportedClosed: 'Wahala kiyala report karala', closedToday: 'Ada wahala kiyala report karala' },
    rating: (positive, total) => `Ratings ${total}kin ${positive}k Super`,
    votes: count => `Me sathiye votes ${count}`,
    pick: 'Mama thoranne',
    tentative: 'Ratings thiyenne tikak witharai.',
    practical: 'Menu eke thiyena option ekak.',
  },
}

const SOCIAL = new Set(['greeting', 'thanks', 'language', 'off_topic'])
const CANTEEN_INTENTS = new Set(['hours', 'open', 'location', 'favorites'])
const MAX_REPLY_LENGTH = 600

function result(status, answer) { return { status, answer } }

function hasPrice(food) { return Number.isFinite(food.priceLkr) && food.priceLkr >= 0 }

function ratings(food) {
  const total = food.totalRatings ?? 0
  return { total, super: food.superCount ?? (Number.isFinite(food.superPercent) ? Math.round(total * food.superPercent / 100) : 0) }
}

// Rank by a 95% Wilson lower bound so a single positive vote need not outrank many good ratings.
function ratingScore(food) {
  const { total, super: positive } = ratings(food)
  if (!total) return 0
  const z = 1.96
  const ratio = positive / total
  return (ratio + z ** 2 / (2 * total) - z * Math.sqrt((ratio * (1 - ratio) + z ** 2 / (4 * total)) / total)) /
    (1 + z ** 2 / total)
}

function byPrice(a, b) {
  return (hasPrice(a) ? a.priceLkr : Infinity) - (hasPrice(b) ? b.priceLkr : Infinity)
}

function byRating(a, b) {
  return ratingScore(b) - ratingScore(a) || ratings(b).total - ratings(a).total || byPrice(a, b)
}

function canteenStatus(canteen, copy) {
  if (canteen.status === 'Closed today') return copy.status.closedToday
  if (canteen.status === 'Closed now') return copy.status.reportedClosed
  if (canteen.status === 'Opened' && canteen.statusOverrideUntil) return copy.status.reportedOpen
  return canteen.openNow ? copy.status.open : copy.status.closed
}

function hours(canteen, copy) {
  return canteen.opensAt && canteen.closesAt ? copy.hours(canteen.opensAt, canteen.closesAt) : copy.noHours
}

function location(canteen, copy) {
  if (canteen.location) return canteen.location
  if (Number.isFinite(canteen.lat) && Number.isFinite(canteen.lng)) return `${canteen.lat}, ${canteen.lng}`
  return copy.noLocation
}

function ratingsText(food, copy) {
  const { total, super: positive } = ratings(food)
  return total ? copy.rating(positive, total) : copy.noRatings
}

function venueDetails(canteen, copy, details) {
  const fragments = []
  if (details.has('location')) fragments.push(location(canteen, copy))
  if (details.has('hours')) fragments.push(hours(canteen, copy))
  if (details.has('open') || (details.has('hours') && canteen.statusOverrideUntil)) {
    fragments.push(canteenStatus(canteen, copy))
  }
  return fragments
}

function linesAnswer(lines, note = '') {
  const picked = []
  let length = note.length
  for (const line of lines) {
    if (length + line.length + 1 > MAX_REPLY_LENGTH) break
    length += line.length + 1
    picked.push(line)
  }
  return [...(picked.length ? picked : [lines[0].slice(0, MAX_REPLY_LENGTH - note.length - 2)]), ...(note ? [note] : [])].join('\n')
}

export function renderAssistantAnswer({ plan, language, catalog }) {
  const copy = COPY[language] ?? COPY.en
  const { intent, canteenIds = [], foodIds = [] } = plan
  if (intent === 'off_topic') return result(intent, copy.offTopic)
  if (intent === 'language' && plan.preference === 'auto') return result(intent, copy.automatic)
  if (SOCIAL.has(intent)) return result(intent, copy[intent])
  if (intent === 'clarify') return result(intent, copy.clarify[plan.clarification] ?? copy.clarify.choice)
  const details = new Set(plan.details)
  if (details.has('ingredients')) return result('no_data', copy.ingredients)
  if (plan.canteenQuery && !canteenIds.length) return result('no_data', copy.missingCanteen)
  if (plan.foodQuery && !foodIds.length) return result('no_data', copy.missingFood)

  const budget = plan.maxPriceLkr
  const hasBudget = Number.isFinite(budget)
  const canteensById = new Map(catalog.canteens.map(canteen => [canteen.id, canteen]))
  const scopedFoods = catalog.foods.filter(food => canteensById.has(food.canteenId) &&
    (!canteenIds.length || canteenIds.includes(food.canteenId)) && (!foodIds.length || foodIds.includes(food.id)))
  const scopedVenues = new Set(scopedFoods.map(food => food.canteenId))
  const canteens = catalog.canteens.filter(canteen => (!canteenIds.length || canteenIds.includes(canteen.id)) &&
    (!foodIds.length || scopedVenues.has(canteen.id)))
  const defaultLimit = intent === 'recommend' ? 1 : intent === 'favorites' ? 3 : intent === 'open' || intent === 'menu' ? 8 : 5
  const limit = Math.min(8, Math.max(1, plan.limit ?? defaultLimit))
  const partialNote = catalog.truncated ? copy.limited : ''

  if (CANTEEN_INTENTS.has(intent)) {
    const onlyOpen = intent === 'open'
      ? (!canteenIds.length && !foodIds.length) || (plan.openOnly && canteens.length > 1)
      : plan.openOnly
    const current = onlyOpen ? canteens.filter(canteen => canteen.openNow) : canteens
    if (!current.length) return result('no_data', onlyOpen ? copy.noOpen : copy.missingCanteen)
    if (intent === 'favorites') {
      current.sort((a, b) => b.votesThisWeek - a.votesThisWeek)
      if (!canteenIds.length && !current.some(canteen => canteen.votesThisWeek > 0)) return result('no_data', copy.noVotes)
    } else {
      details.add(intent)
    }
    const lines = current.slice(0, limit).map(canteen => [
      canteen.name,
      ...venueDetails(canteen, copy, details),
      ...(intent === 'favorites' ? [copy.votes(canteen.votesThisWeek ?? 0)] : []),
    ].join(' · '))
    let missing
    if (intent === 'hours') missing = current.every(canteen => !canteen.opensAt || !canteen.closesAt)
    if (intent === 'location') missing = current.every(canteen => location(canteen, copy) === copy.noLocation)
    return result(missing ? 'no_data' : 'answer', linesAnswer(lines, partialNote))
  }

  const withinBudget = hasBudget
    ? scopedFoods.filter(food => hasPrice(food) && (plan.exclusive ? food.priceLkr < budget : food.priceLkr <= budget))
    : scopedFoods
  const menu = plan.openOnly ? withinBudget.filter(food => canteensById.get(food.canteenId).openNow) : withinBudget
  if (!menu.length) {
    let message = foodIds.length ? copy.missingFood : copy.noMenu
    if (plan.openOnly && withinBudget.length) message = copy.noOpen
    else if (hasBudget && scopedFoods.length) message = copy.noBudget(budget)
    if (details.has('stock')) message += ` ${copy.stock}`
    return result('no_data', partialNote ? `${message} ${partialNote}` : message)
  }

  if (intent === 'ratings' && canteenIds.length && !foodIds.length && plan.sort === 'default') {
    const lines = canteens.filter(canteen => !plan.openOnly || canteen.openNow).slice(0, limit).map(canteen => {
      const totals = menu.filter(food => food.canteenId === canteen.id).map(ratings)
        .reduce((aggregate, row) => ({ total: aggregate.total + row.total, super: aggregate.super + row.super }), { total: 0, super: 0 })
      return `${canteen.name} · ${totals.total ? copy.rating(totals.super, totals.total) : copy.noRatings}`
    })
    return result(menu.some(food => ratings(food).total) ? 'answer' : 'no_data', linesAnswer(lines, partialNote))
  }

  if (plan.sort === 'cheapest') menu.sort(byPrice)
  else if (plan.sort === 'mostRated') menu.sort((a, b) => ratings(b).total - ratings(a).total || byRating(a, b))
  else if (plan.sort === 'highestRated' || intent === 'recommend' || intent === 'ratings') menu.sort(byRating)
  if (intent === 'menu' || intent === 'recommend' || intent === 'price') details.add('price')
  if (intent === 'recommend' || intent === 'ratings') details.add('ratings')
  if (plan.openOnly) details.add('open')

  const lines = menu.slice(0, limit).map(food => {
    const canteen = canteensById.get(food.canteenId)
    return [
      copy.foodAt(food.name, canteen.name),
      ...(details.has('price') ? [hasPrice(food) ? copy.price(food.priceLkr) : copy.noPrice] : []),
      ...(details.has('ratings') ? [ratingsText(food, copy)] : []),
      ...venueDetails(canteen, copy, details),
    ].join(' · ')
  })
  const notes = []
  if (intent === 'recommend') {
    lines[0] = `${copy.pick} — ${lines[0]}`
    const count = ratings(menu[0]).total
    if (!count) notes.push(copy.practical)
    else if (count < 5) notes.push(copy.tentative)
  }
  if (details.has('stock')) notes.push(copy.stock)
  if (partialNote) notes.push(partialNote)
  const missing = (intent === 'price' && !menu.some(hasPrice)) ||
    (intent === 'ratings' && !menu.some(food => ratings(food).total))
  return result(missing ? 'no_data' : 'answer', linesAnswer(lines, notes.join(' ')))
}
