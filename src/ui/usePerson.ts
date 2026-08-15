import { Option } from "effect"
import { useEffect, useRef, useState } from "react"
import type { Person } from "../domain/person"

/**
 * How long the column keeps watching for the rest of itself.
 *
 * Long enough for GitHub to finish the page on a cold load and short enough that nothing
 * of ours is observing a subtree while somebody reads. Measured against the live page,
 * where their card's top arrives with the HTML and the details under it a beat later.
 */
const SETTLING = 4_000

/** The same answer twice, which is not worth a redraw. */
const same = (before: Person | undefined, now: Person): boolean =>
  before !== undefined && JSON.stringify(before) === JSON.stringify(now)

/**
 * Who the served page says they are, and who it says they are a moment later.
 *
 * The read is not free of timing, which is the whole reason this exists. A screen starts
 * at `document_start`, so the first read runs against a document a few kilobytes long,
 * and their card arrives in pieces after it: the face, the name and the bio with the
 * HTML, then the counts and every link they set once GitHub's own scripts have been
 * through the page. Read once and the column is a name over an empty box, which is what
 * was on the live page before this existed.
 *
 * So the read is repeated while the page is still being written, and the newest answer
 * wins: a later read has seen more markup than an earlier one, never less. It stops after
 * {@link SETTLING}, because a watcher on the whole document is not something to leave
 * running behind a reader.
 *
 * Nothing is waited for and nothing is lost where the answer is already in: a soft
 * navigation lands on a finished document, the first read has the whole card, and every
 * read after it agrees.
 */
export const usePerson = (
  read: (page: Document) => Option.Option<Person>,
  /** The document to read. Only a test ever passes one. */
  page: Document = document,
  /** How long to keep watching. Only a test shortens it, so it does not wait four seconds. */
  settling: number = SETTLING
): Person | undefined => {
  const [found, setFound] = useState(() => Option.getOrUndefined(read(page)))
  const had = useRef(found)
  had.current = found

  useEffect(() => {
    const look = () =>
      Option.match(read(page), {
        onNone: () => {},
        onSome: (now) => {
          if (same(had.current, now)) return
          setFound(now)
        }
      })

    const watcher = new MutationObserver(look)
    watcher.observe(page.documentElement, { childList: true, subtree: true })
    const stop = setTimeout(() => watcher.disconnect(), settling)

    return () => {
      clearTimeout(stop)
      watcher.disconnect()
    }
  }, [page, read, settling])

  return found
}
