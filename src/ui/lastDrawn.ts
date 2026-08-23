import { Option } from "effect"
import type { IssueRef } from "../domain/issues"
import { keyOf, type PullRequestRef, type RepoRef } from "../domain/PullRequestRef"

/**
 * The last few pages this document has drawn, kept so that drawing one again is
 * not reading it again first.
 *
 * The back button is the reason. Every navigation of ours closes the screen and
 * stands a new one up — `show` in `src/screens/pullRequest.tsx` begins with
 * `close()` — so the React tree is destroyed, `useLive` builds new atoms, and the
 * read starts from nothing. Pressing Back onto a list that was on the screen a
 * second ago paid for a storage read before it could draw anything, and a
 * skeleton stood in the meantime.
 *
 * What is kept is the value and nothing else. Not the atoms, which hold a closure
 * over the fibers of the visit that made them — `started` and `latest` in
 * `pullRequest.tsx` are the state of one open, and a screen reopened over them
 * would write through an old read. And not the freshness either: the read runs
 * again every time, exactly as it always did, and the reader watches it happen
 * from a page rather than from a skeleton.
 *
 * As long as the document, which is the lifetime Back needs and no longer. A
 * module-level map is per screen bundle, and the bundles are held for a document
 * by the `Map` in `src/app/screens.ts` — so our own navigations keep this and a
 * real page load empties it. It holds what one screen drew and is read by that
 * same screen, so the one bundle is the whole of it. `chrome.storage` is the
 * durable copy and is what a cold open reads; this is only for the seconds
 * between two views of one page in one sitting, which is what Back is.
 */

/**
 * How many pages back the memory reaches.
 *
 * A reader walks a list, three pull requests and back out, and eight covered
 * that with room over — while the lists and the cards were the only pages named.
 * Every screen writes here now, so one sitting walks repositories, their
 * commits, an issue list and a run between two views of one page, and eight
 * slots meant the page came back to a skeleton anyway. Sixteen holds a
 * sitting's walking. What each entry costs is one page's payloads — about a
 * hundred kilobytes for a pull request, by the sizes in `src/github/cache.ts`,
 * a third of a megabyte for a repository front carrying its rendered README —
 * so a few megabytes at its very worst and well under one in practice.
 */
const HOW_MANY = 16

/**
 * Insertion-ordered, which is what makes the eviction the right one.
 *
 * A `Map` iterates in the order keys were added, and re-adding a key that is
 * already there does not move it — so `keepDrawn` deletes before it sets, and the
 * first key out of `keys()` is always the least recently drawn.
 */
const drawn = new Map<string, unknown>()

/**
 * What was last drawn for this page, if this document still has it.
 *
 * Typed by the caller, which is the one unchecked step in here: a `Map` of every
 * screen's value cannot be typed by its key without a table of them, and the
 * caller is `useLive` reading its own `T` back out of the name it wrote it
 * under. Wrong only if two reads claim one name, which is the same fault as two
 * screens standing on one page, and which no type here could catch either.
 */
export const lastDrawn = <T>(page: string): Option.Option<T> => {
  const had = drawn.get(page)
  return had === undefined ? Option.none() : Option.some(had as T)
}

/** Writes down what a page was drawn from, and forgets the oldest to make room. */
export const keepDrawn = (page: string, value: unknown): void => {
  drawn.delete(page)
  drawn.set(page, value)

  const oldest = drawn.keys().next()
  if (drawn.size > HOW_MANY && !oldest.done) drawn.delete(oldest.value)
}

/** Empties it, for a test that must not read what another test drew. */
export const forgetDrawn = (): void => {
  drawn.clear()
}

/**
 * The names the screens keep their reads under, written down in one place.
 *
 * Kept together because the only way this memory can be wrong is two reads
 * claiming one name, and that is a thing you can see here and cannot see in four
 * template strings in four files. The pull request's half of it is `keyOf`
 * rather than another spelling of it, for the reason `keyOf` gives: a key spelt
 * two ways is a lookup that silently never matches. A prefix over it because
 * issue 7 and pull request 7 are `owner/repo#7` apiece.
 */
export const pullRequestNamed = (reference: PullRequestRef): string => `pull ${keyOf(reference)}`

export const issueNamed = (reference: IssueRef): string => `issue ${keyOf(reference)}`

export const repoNamed = (repo: RepoRef, branch: string | null): string =>
  `repo ${repo.owner}/${repo.repo}${branch === null ? "" : `@${branch}`}`

export const THE_WORKING_SET = "the working set"

/**
 * A page named by the identity its screen was opened for, which is the parsed
 * address: a list and its filters, a run and its id, a person and their tab.
 * Stringified verbatim rather than spelt out field by field, because both
 * visits parse the same address into the same shape — and a field left out of a
 * hand-written spelling is two different pages sharing one memory. The kind in
 * front keeps two screens that can share one shape apart, exactly as the
 * prefixes above do.
 */
export const openedNamed = (kind: string, identity: unknown): string =>
  `${kind} ${JSON.stringify(identity)}`
