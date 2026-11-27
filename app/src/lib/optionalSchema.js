// During a rolling deployment the frontend may reach a database that has not
// installed the social migration yet. Only fall back for its missing relation;
// genuine network, permission and unrelated query errors must still surface.
export function isMissingSeenSchema(error) {
  if (!error) return false
  const detail = [error.message,error.details,error.hint].filter(Boolean).join(' ')
  return ['PGRST200','PGRST205','42P01'].includes(error.code) && /\bpost_views\b/i.test(detail)
}
export async function queryWithSeenFallback(query, useSeen) {
  const result = await query(useSeen)
  if (useSeen && isMissingSeenSchema(result.error)) return query(false)
  return result
}
