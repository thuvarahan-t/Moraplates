/** Optimistic transition preserves exactly one vote and never returns negative totals. */
export function applyVote(canteens, previous, next) {
  return canteens.map(c=>({...c,votes:Math.max(0,c.votes+(c.id===next?1:0)-(c.id===previous?1:0))}))
}
