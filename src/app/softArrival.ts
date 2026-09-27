/**
 * What a screen does when it cannot read the page it was pressed to.
 *
 * A press this extension answers itself loads no document, so GitHub's server never sees
 * the address. Some addresses are only settled there: `/owner/repo/issues/99` is a pull
 * request's number as often as an issue's, and GitHub redirects it; `/fluentai-pro` is an
 * organisation as often as a person, and GitHub serves a different page. A screen that
 * finds it cannot read what it was sent to loads the address once and lets their server say.
 */

import { servedFor, type Timings } from "../github/persisted"

/**
 * Loads the address once, where no document was served for it.
 *
 * A document served for this address is never loaded again, so this cannot loop. And a
 * read ahead for a page the reader is not on never moves them.
 */
export const loadWhereNoDocumentWasServed = (
  view: {
    readonly location: Pick<Location, "pathname" | "href" | "replace">
    readonly performance: Timings
  },
  route: string
): boolean => {
  if (view.location.pathname !== route || servedFor(view.performance, route)) return false
  view.location.replace(view.location.href)
  return true
}
