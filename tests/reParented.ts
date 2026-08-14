/**
 * The change GitHub keeps making, made again on purpose.
 *
 * They are moving each answer under a `<name>Route` key, one route at a time. Four of
 * those moves have blanked a screen in this extension, and each was fixed by naming the
 * new key, which taught the next reader nothing. `whereverItIs` is meant to end that,
 * and this is how that claim is checked: apply the move to a payload nobody has applied
 * it to yet, and the reads have to carry on.
 *
 * Where a payload already has one wrapper the wrapper is renamed, and where it has none
 * one is added, because those are the two shapes the move has arrived in. Nothing inside
 * is touched, because in all four moves nothing inside changed.
 *
 * Used by the contract tests against the recordings, and by `check-drift.ts` against the
 * live routes with `DRIFT_RENAMED=1`.
 */
export const reParented = (raw: unknown): unknown => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { payload: { theyRenamedThisRoute: raw } }
  }

  const held = raw as Record<string, unknown>
  const inside = held["payload"]
  if (typeof inside !== "object" || inside === null || Array.isArray(inside)) {
    return { ...held, payload: { theyRenamedThisRoute: inside ?? held } }
  }

  const keys = Object.keys(inside)
  const only = keys.length === 1 ? keys[0] : undefined
  const under = only === undefined ? inside : (inside as Record<string, unknown>)[only]

  return { ...held, payload: { theyRenamedThisRoute: under } }
}
