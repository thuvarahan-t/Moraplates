const AVATAR = [['var(--ob)', 'var(--ot)'], ['var(--sb)', 'var(--st)'], ['var(--ab)', 'var(--at)'], ['light-dark(#EEEDFE,#2A2650)', 'light-dark(#3C3489,#C9C4FF)']]

/** Stable avatar tint from a name (avc() in index.html). */
export function avatarStyle(name) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997
  const [background, color] = AVATAR[h % 4]
  return { background, color }
}

export function timeAgo(ms) {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60_000))
  return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : Math.floor(m / 1440) + ' d ago'
}

/** 1 vote, 2 votes */
export const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`

export const RATING = { super: ['Super', 'sup'], okay: ['Okay', 'ok'], avoid: ['Avoid', 'av2'] }
