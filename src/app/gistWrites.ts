import { Effect } from "effect"
import type { GistSeen } from "../domain/gist"
import type { GistDraft } from "../domain/gistEdit"
import { commentsOn, earlierCommentsIn, sayingOn } from "../github/gistComments"
import { gistFormOn, sendingGist } from "../github/gistEditForm"
import { gistOnPage } from "../github/gistView"
import { sendingOf } from "../github/theirForm"

/**
 * The three things a reader does to a gist that reach GitHub, and the reads behind them.
 *
 * Here rather than in `gist.content.tsx` for the reason every other write in this codebase
 * is behind a gateway: the entrypoint's job is deciding which screen an address is, and a
 * `fetch` in it is the wrong layer holding the wrong knowledge. Not the gateway itself,
 * which is `github.com`'s and arrives with a service, a layer and four thousand lines this
 * page has no use for — so these are plain Effects taking the page they read.
 *
 * All three post one of GitHub's own forms. Their gist pages are Rails and every control
 * that changes something is a form, whose token is signed for this render and cannot be
 * minted; the extension is in the page, so the form is right there. See `theirForm.ts`.
 */

/** How a form of theirs is sent: as a browser would, with the reader's own cookies. */
const posted = (
  action: string,
  body: string
): Effect.Effect<Response, Error> =>
  Effect.gen(function* () {
    const answer = yield* Effect.tryPromise({
      try: () =>
        fetch(action, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          credentials: "include",
          body
        }),
      catch: (cause) => new Error(String(cause))
    })

    return answer.ok
      ? answer
      : yield* Effect.fail(new Error(`GitHub answered ${answer.status}.`))
  })

/**
 * Whether GitHub drew a box to write in on this page.
 *
 * A reader who is not signed in gets "Sign in to comment" and no form, and an owner who
 * turned comments off gets neither. A box offered in either case is one that throws when
 * it is used, which is worse than no box.
 */
export const canSay = (page: Document): boolean => sayingOn(page) !== null

/**
 * Says something under a gist, and hands back the gist as it now reads.
 *
 * The page is read again rather than their answer parsed: what a Rails form post answers
 * with is theirs to change, and one extra request buys not having to guess.
 */
export const sayOnGist = (
  page: Document,
  at: { readonly owner: string; readonly id: string },
  said: string,
  readPage: (address: string) => Effect.Effect<Document, unknown>
): Effect.Effect<GistSeen | null, Error> =>
  Effect.gen(function* () {
    const posting = sayingOn(page)
    if (posting === null) {
      return yield* Effect.fail(
        new Error("GitHub drew no comment box on this page, so there is nothing to send.")
      )
    }

    yield* posted(posting.action, sendingOf(posting, said))

    const read = yield* readPage(`/${at.owner}/${at.id}`).pipe(
      Effect.mapError((cause) => new Error(String(cause)))
    )
    return gistOnPage(read, at.owner, at.id)
  })

/**
 * The comments a gist's page held back, put in above the ones it drew.
 *
 * Their pager answers with a fragment of the same markup, carrying a pager of its own
 * where there are older ones still. So one call reads one page, the way their own control
 * does, and a gist with a hundred comments is not a hundred rows nobody asked for.
 */
export const withEarlierSaid = (
  gist: GistSeen,
  readPage: (address: string) => Effect.Effect<Document, unknown>
): Effect.Effect<GistSeen, unknown> =>
  gist.earlierSaid === null
    ? Effect.succeed(gist)
    : readPage(gist.earlierSaid).pipe(
        Effect.map((fragment) => ({
          ...gist,
          said: [...commentsOn(fragment), ...gist.said],
          earlierSaid: earlierCommentsIn(fragment)
        }))
      )

/**
 * Their editor as this screen needs it: what their form holds, and the way to send it back.
 *
 * Nothing where the page carries no such form, which is what makes the screen refuse to
 * stand and hand the page back — their own editor is still under it.
 */
export const gistEditing = (
  page: Document
): {
  readonly draft: GistDraft
  readonly words: string
  readonly action: string
  readonly save: (draft: GistDraft) => Effect.Effect<string, Error>
} | null => {
  const form = gistFormOn(page)
  if (form === null) return null

  return {
    draft: form.draft,
    words: form.words,
    action: form.action,
    /*
     * Answers with where their own form would have taken the reader: the gist as it now
     * is. The caller loads it rather than standing a screen, because what was posted is a
     * new revision and every count, file and blob id on the page behind this is a version
     * old.
     */
    save: (draft: GistDraft) =>
      posted(form.action, sendingGist(form, draft)).pipe(Effect.map((answer) => answer.url))
  }
}
