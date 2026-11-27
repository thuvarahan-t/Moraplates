export const queryKey = (resource, ...args) => `${resource}:${JSON.stringify(args)}`

/** Short-lived reads for the current account. Each key shares one in-flight request. */
export function createQueryCache(maxAge = 30_000, maxEntries = 64) {
  const entries = new Map()

  const isFresh = entry => entry?.updatedAt !== undefined && Date.now() - entry.updatedAt < maxAge

  function load(key, loader) {
    const previous = entries.get(key)
    if (previous) {
      entries.delete(key)
      entries.set(key, previous)
      if (previous.pending) return previous.pending
      if (isFresh(previous)) return Promise.resolve(previous.data)
    }

    const entry = { data: previous?.data }
    entry.pending = Promise.resolve().then(loader).then(data => {
      if (entries.get(key) === entry) entries.set(key, { data, updatedAt: Date.now() })
      return data
    }, error => {
      if (entries.get(key) === entry) {
        if (previous) entries.set(key, previous)
        else entries.delete(key)
      }
      throw error
    })
    entries.set(key, entry)
    if (entries.size > maxEntries) entries.delete(entries.keys().next().value)
    return entry.pending
  }

  function invalidate(...resources) {
    if (!resources.length) {
      entries.clear()
      return
    }
    for (const key of entries.keys()) {
      if (resources.some(name => key === name || key.startsWith(`${name}:`))) entries.delete(key)
    }
  }

  return {
    read: key => entries.get(key)?.data,
    fresh: key => isFresh(entries.get(key)) ? entries.get(key).data : undefined,
    remove: key => entries.delete(key),
    load,
    invalidate,
  }
}
