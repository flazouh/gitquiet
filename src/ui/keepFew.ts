/**
 * A short memory: the last few of something, newest last, oldest let go.
 *
 * Four of the caches a sitting leans on are this exact shape — the pages last
 * drawn, the live screen snapshots, the armed screen modules, a module's own
 * lists — and each had written the five lines out again. A `Map` iterates in
 * insertion order and re-adding a key does not move it, so deleting before
 * setting is what makes the first key out of `keys()` the least recently kept.
 *
 * `letGo` is told about the value being replaced under its own key as well as
 * the one falling off the end, because both are a value nothing will hand back:
 * the live screen cache disposes a React root either way.
 */
export const keepFew = <K, V>(
  held: Map<K, V>,
  key: K,
  value: V,
  howMany: number,
  letGo?: (value: V) => void
): void => {
  const replaced = held.get(key)
  if (replaced !== undefined) letGo?.(replaced)
  held.delete(key)
  held.set(key, value)

  const oldest = held.keys().next()
  if (held.size > howMany && !oldest.done) {
    const evicted = held.get(oldest.value)
    if (evicted !== undefined) letGo?.(evicted)
    held.delete(oldest.value)
  }
}
