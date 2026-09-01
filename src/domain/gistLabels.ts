import { Option } from "effect"

/**
 * A Label and a Name for a reader's own gist, kept by this extension because
 * GitHub keeps neither. See `docs/spec/gists.md`.
 */
export type StoredGist = {
  readonly labels: ReadonlyArray<string>
  readonly name: string | null
}

/** Every gist a reader has marked, keyed by id. */
export type KeptGists = ReadonlyMap<string, StoredGist>

const EMPTY: StoredGist = { labels: [], name: null }

/** The Labels a gist carries, or none where it has never been marked. */
export const labelsOf = (kept: KeptGists, id: string): ReadonlyArray<string> =>
  kept.get(id)?.labels ?? []

/** The Name a gist was given, or nothing where it has never been named. */
export const nameOf = (kept: KeptGists, id: string): string | null =>
  kept.get(id)?.name ?? null

/**
 * Every Label a reader has written before, across every gist — so a Label
 * typed once is offered again rather than retyped, per `docs/spec/gists.md`.
 */
export const everyLabelKnown = (kept: KeptGists): ReadonlyArray<string> => {
  const seen = new Set<string>()
  for (const { labels } of kept.values()) for (const label of labels) seen.add(label)
  return [...seen].sort((one, two) => one.localeCompare(two))
}

/**
 * Trims, drops the empty ones, and keeps one of each — a Label typed twice by
 * mistake is one Label, not a badge repeated on the same row.
 */
const cleaned = (labels: ReadonlyArray<string>): ReadonlyArray<string> => {
  const seen = new Set<string>()
  const kept: Array<string> = []
  for (const label of labels) {
    const trimmed = label.trim()
    if (trimmed.length === 0 || seen.has(trimmed)) continue
    seen.add(trimmed)
    kept.push(trimmed)
  }
  return kept
}

/** The Labels of one gist, replaced — its Name, if it has one, is untouched. */
export const withLabels = (kept: KeptGists, id: string, labels: ReadonlyArray<string>): KeptGists => {
  const before = kept.get(id) ?? EMPTY
  return new Map(kept).set(id, { ...before, labels: cleaned(labels) })
}

/** The Name of one gist, replaced — its Labels, if it has any, are untouched. */
export const withName = (kept: KeptGists, id: string, name: string | null): KeptGists => {
  const before = kept.get(id) ?? EMPTY
  const trimmed = name === null ? null : name.trim()
  return new Map(kept).set(id, { ...before, name: trimmed === "" ? null : trimmed })
}

/** Whether a gist's own Labels answer one asked for. No Label asked matches everything. */
export const matchesLabel = (labels: ReadonlyArray<string>, asked: string | null): boolean =>
  asked === null || labels.includes(asked)

/** The stored shape, as the one string `storage.sync` holds it as. */
export const encodeGistLabels = (kept: KeptGists): string =>
  JSON.stringify(Object.fromEntries(kept))

/**
 * The stored shape, read back — never throwing, because a value written by an
 * older version of this extension, or corrupted by nothing more than the
 * reader's own browser, is not a reason to lose every Label kept before it.
 */
export const decodeGistLabels = (raw: string | undefined): KeptGists => {
  if (raw === undefined) return new Map()

  const parsed = Option.getOrNull(Option.liftThrowable(JSON.parse)(raw)) as unknown
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return new Map()

  const kept = new Map<string, StoredGist>()
  for (const [id, value] of Object.entries(parsed)) {
    if (typeof value !== "object" || value === null) continue
    const { labels, name } = value as { readonly labels?: unknown; readonly name?: unknown }
    const strings = Array.isArray(labels) ? labels.filter((one): one is string => typeof one === "string") : []
    kept.set(id, { labels: strings, name: typeof name === "string" ? name : null })
  }
  return kept
}
