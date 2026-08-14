/**
 * The payload GitHub embeds in a page it rendered.
 *
 * Their React pages ship their own data inside the document, in a script tag they
 * mark themselves. Most routes also answer that data as JSON, which is what the
 * rest of this gateway asks for — but the code view answers with the route alone
 * and never with the layout around it, and the layout is where
 * `currentUserCanPush` is. So a repository's front page is read out of a document,
 * and this is the reader.
 *
 * Written with `indexOf` and `slice` rather than a regular expression or a parser.
 * A document is a few hundred kilobytes, most of it a rendered README, and both of
 * the other approaches walk all of it: a parser builds a throwaway DOM, and a
 * regular expression with a lazy body backtracks across the same text. This looks
 * at the markers and parses one substring.
 */

import { Option } from "effect"

/** How their React roots mark the script holding their data. */
const OPENING = '<script type="application/json" data-target="react-app.embeddedData">'

const CLOSING = "</script>"

/**
 * The embedded payload naming a given route, out of a page's HTML.
 *
 * Asked for by route name because a document holds several of these. A repository
 * page carries its own `react-partial` payloads for the header and the sidebar as
 * well, and on some pages more than one `react-app` — so the first script found is
 * not reliably the right one, and taking it would decode the header's data as a
 * file tree.
 *
 * Checked with `indexOf` on the slice before anything is parsed, so that a
 * document holding four payloads costs one `JSON.parse` rather than four.
 */
/**
 * Every payload a page carries, in the order the document holds them.
 *
 * For a reader that knows the shape it wants rather than the name it is under. The two
 * code view pages read this way: whichever script decodes is the answer, so nobody has
 * to spell `codeViewBlobLayoutRoute.StyledBlob` and nothing breaks when GitHub renames
 * it. A repository page has one script holding three of their route payloads side by
 * side, and a file page one holding four.
 *
 * All of them parsed, rather than the first that mentions a name. That is one `JSON.parse`
 * per script on a page whose scripts are the page, and both pages measured have one.
 */
export const embeddedPayloads = (html: string): ReadonlyArray<unknown> => {
  const payloads: Array<unknown> = []
  let from = html.indexOf(OPENING)

  while (from !== -1) {
    const opens = from + OPENING.length
    const closes = html.indexOf(CLOSING, opens)
    if (closes === -1) return payloads

    const parsed = Option.liftThrowable(JSON.parse)(html.slice(opens, closes))
    if (Option.isSome(parsed)) payloads.push(parsed.value)

    from = html.indexOf(OPENING, closes)
  }

  return payloads
}

export const embeddedPayload = (html: string, naming: string): Option.Option<unknown> => {
  let from = html.indexOf(OPENING)

  while (from !== -1) {
    const opens = from + OPENING.length
    const closes = html.indexOf(CLOSING, opens)
    if (closes === -1) return Option.none()

    const held = html.slice(opens, closes)
    if (held.includes(naming)) {
      // Their own escaping, and the reason this is worth guarding: a README
      // containing the closing tag as text would end the script early, so GitHub
      // writes it escaped and the slice above can still be invalid JSON.
      const parsed = Option.liftThrowable(JSON.parse)(held)
      if (Option.isSome(parsed)) return parsed
    }

    from = html.indexOf(OPENING, closes)
  }

  return Option.none()
}
