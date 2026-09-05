import { Effect } from "effect"
import { defineContentScript } from "wxt/utils/define-content-script"
import { gistLabelsArea, readKeptGists, writeKeptGists } from "@/app/gistLabels"
import { readOwnGists } from "@/app/ownGists"
import { withLabels, withName, type KeptGists } from "@/domain/gistLabels"
import type { GistRow } from "@/domain/gistList"
import { reportError } from "@/observability/report"
import { standAScreen, type Standing } from "@/shell/screen"
import { gistViewIn, isGistEditing } from "@/domain/gist"
import type { GistSeen } from "@/domain/gist"
import { gistOnPage } from "@/github/gistView"
import { commentsOn, earlierCommentsIn, sayingOn } from "@/github/gistComments"
import { sendingOf } from "@/github/theirForm"
import { faceOnPage, loginOnPage } from "@/ui/viewer"
import { gistFormOn, sendingGist } from "@/github/gistEditForm"
import type { GistDraft } from "@/domain/gistEdit"
import { GistEditScreen } from "@/ui/GistEditScreen"
import { GistListScreen } from "@/ui/GistListScreen"
import { GistScreen } from "@/ui/GistScreen"
import { GIST_EDIT, GIST_LIST, GIST_STARRED, GIST_VIEW } from "@/ui/gistPlace"
import { Option } from "effect"
import { handBack } from "@/ui/mount"
import { whenAddressChanges } from "@/ui/navigation"
import "@/ui/styles.css"
import "@/ui/gistEditing.css"

/**
 * `gist.github.com`'s own content script, separate from `shell.content.ts` on purpose.
 *
 * Separate, but no longer a different kind of thing. It used to append beside GitHub's
 * markup and nothing else, because `docs/spec/gists.md` reasoned that a page with no
 * React application under it had no region to take over. `plans/006` disposed of that:
 * a full-replacement screen stands on `document.body` and needs no application beneath
 * it. So the list is a screen now, standing the way `/pulls` and `/notifications` do,
 * and this file is the small shell that stands it. See
 * `plans/007-give-the-gists-a-screen.md`.
 *
 * What it still does not do is import `place.ts`. That module is `github.com`'s router,
 * where `/{owner}` names a person; here it names a gist list. The two Places live in
 * `gistPlace.ts` instead.
 */

/**
 * Their list, one page of it, fetched the way the page itself would.
 *
 * Same-origin with the reader's own cookies, because this runs on `gist.github.com` and
 * a reader's secret gists are only in their list while they are signed in.
 */
const readPage = (address: string): Effect.Effect<Document, unknown> =>
  Effect.gen(function* () {
    const answer = yield* Effect.tryPromise({
      try: () => fetch(address, { credentials: "include" }),
      catch: (cause) => cause
    })
    if (!answer.ok) return yield* Effect.fail(new Error(`${address} answered ${answer.status}`))

    const source = yield* Effect.tryPromise({
      try: () => answer.text(),
      catch: (cause) => cause
    })
    return new DOMParser().parseFromString(source, "text/html")
  })

/**
 * Whoever GitHub says is here, for the box at the foot of a gist to be signed with.
 *
 * Off their own markup, which carries it on every page, so this costs no request and
 * cannot itself fail.
 */
const viewerOnPage = (): { readonly login: string; readonly faceUrl?: string } | undefined => {
  const login = loginOnPage()
  return login === undefined ? undefined : { login, faceUrl: faceOnPage() }
}

export default defineContentScript({
  matches: ["*://gist.github.com/*"],
  runAt: "document_idle",
  main() {

    let kept: KeptGists = new Map()
    let rows: ReadonlyArray<GistRow> = []
    let whole = true
    const area = gistLabelsArea()

    /** What is on the page now, so a second arrival replaces rather than stacks. */
    let standing: Standing | null = null
    let stood: string | null = null

    /**
     * The gist on the screen, which changes without the page changing.
     *
     * Comments arrive after the first draw — the older ones come from a fetch, and one
     * this reader writes comes from a re-read — and every one of those is the same gist
     * said again rather than a different screen. See `drawGist`.
     */
    let seen: GistSeen | null = null
    let readingEarlier = false

    const onChange = (
      id: string,
      labels: ReadonlyArray<string>,
      name: string | null
    ): void => {
      kept = withName(withLabels(kept, id, labels), id, name)
      if (area !== undefined) Effect.runFork(writeKeptGists(area, kept))
      standing?.redraw()
    }

    const stepAside = (): void => {
      standing?.close()
      standing = null
      stood = null
      seen = null
      handBack(document)
    }

    const drawList = (place: typeof GIST_LIST, whose: "own" | "starred"): Standing =>
      standAScreen({
        place,
        draw: () => (
          <GistListScreen
            rows={rows}
            whose={whose}
            whole={whole}
            kept={kept}
            onChange={onChange}
            onStepAside={stepAside}
          />
        )
      })

    /**
     * The comments their page held back, oldest first, put in above the ones it drew.
     *
     * Their pager answers with a fragment of the same markup, carrying a pager of its own
     * where there are older ones still. So one press reads one page, the way their own
     * control does, and a gist with a hundred comments is not a hundred rows nobody asked
     * for on arrival.
     */
    const readEarlier = (): void => {
      const gist = seen
      if (gist === null || gist.earlierSaid === null || readingEarlier) return

      readingEarlier = true
      standing?.redraw()

      Effect.runFork(
        readPage(gist.earlierSaid).pipe(
          Effect.map((fragment) => {
            seen = {
              ...gist,
              said: [...commentsOn(fragment), ...gist.said],
              earlierSaid: earlierCommentsIn(fragment)
            }
          }),
          Effect.catch((cause) => Effect.sync(() => reportError(cause))),
          Effect.map(() => {
            readingEarlier = false
            standing?.redraw()
          })
        )
      )
    }

    /**
     * Says something under this gist, by sending back the form GitHub put on the page.
     *
     * Their gist page is Rails and their comment box is a form, so the write is that form
     * with the reader's words in it. The token is signed for this render of this form and
     * cannot be minted, which is why the form has to be read rather than a route guessed
     * at — see `theirForm.ts`. Their own markup is still in the document behind this
     * screen, which is what makes it readable at all.
     *
     * The page is read again afterwards rather than the answer parsed: what a Rails form
     * post answers with is theirs to change, and one extra request buys not having to
     * guess. A refusal is left to the box, which keeps the words and says what GitHub said.
     */
    const say = (owner: string, id: string) => (body: string) =>
      Effect.gen(function* () {
        const posting = sayingOn(document)
        if (posting === null) {
          return yield* Effect.fail(
            new Error("GitHub drew no comment box on this page, so there is nothing to send.")
          )
        }

        const answer = yield* Effect.tryPromise({
          try: () =>
            fetch(posting.action, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              credentials: "include",
              body: sendingOf(posting, body)
            }),
          catch: (cause) => new Error(String(cause))
        })
        if (!answer.ok) {
          return yield* Effect.fail(new Error(`GitHub answered ${answer.status}.`))
        }

        const page = yield* readPage(`/${owner}/${id}`).pipe(
          Effect.mapError((cause) => new Error(String(cause)))
        )
        const read = gistOnPage(page, owner, id)
        if (read !== null) {
          seen = read
          standing?.redraw()
        }
      })

    const drawGist = (gist: GistSeen): Standing => {
      seen = gist

      return standAScreen({
        place: GIST_VIEW,
        draw: () => (
          <GistScreen
            gist={seen ?? gist}
            kept={kept}
            onChange={onChange}
            viewer={viewerOnPage()}
            reading={readingEarlier}
            onEarlier={(seen ?? gist).earlierSaid === null ? undefined : readEarlier}
            /*
             * Offered only where GitHub drew a box. A reader who is not signed in gets
             * "Sign in to comment" and no form, and an owner who turned comments off gets
             * neither — in both cases a box here would be one that throws when it is used.
             */
            onSay={sayingOn(document) === null ? undefined : say(gist.owner, gist.id)}
            onStepAside={stepAside}
          />
        )
      })
    }

    /**
     * Their editor, as a screen of ours posting their own form.
     *
     * Their form is read out of the document rather than fetched, for the reason the
     * comment box is: this content script is running in the page, their markup is still
     * under this screen, and the token in it is signed for this render and cannot be
     * minted. See `gistEditForm.ts`.
     *
     * A success is a page load — their route answers a redirect to the gist — so nothing
     * here draws what happened. The address moving is what says it worked, and `show`
     * takes it from there.
     */
    const drawEditor = (): Standing | null => {
      const form = gistFormOn(document)
      if (form === null) return null

      const send = (draft: GistDraft) =>
        Effect.gen(function* () {
          const answer = yield* Effect.tryPromise({
            try: () =>
              fetch(form.action, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                credentials: "include",
                body: sendingGist(form, draft)
              }),
            catch: (cause) => new Error(String(cause))
          })
          if (!answer.ok) {
            return yield* Effect.fail(new Error(`GitHub answered ${answer.status}.`))
          }

          /*
           * Where their own form would have taken the reader: the gist as it now is.
           * A whole load rather than a screen stood here, because what was posted is a
           * new revision and every count, file and oid on the page behind this is a
           * version old.
           */
          window.location.assign(answer.url)
        })

      return standAScreen({
        place: GIST_EDIT,
        draw: () => (
          <GistEditScreen
            draft={form.draft}
            words={form.words}
            onSave={send}
            back={form.action === "/" ? "/" : form.action}
            onStepAside={stepAside}
          />
        )
      })
    }

    /**
     * Whichever screen this address is, or GitHub's own page where it is neither.
     *
     * A gist's own page keeps GitHub's for now — `plans/007` step 4 — which is why this
     * only ever stands the list. `GIST_VIEW` is imported so that the one place deciding
     * between them is this function, and adding the second screen is a branch here
     * rather than a second reader of the address somewhere else.
     */
    /** The mark `gistEditing.css` hangs on, and nothing else. */
    const EDITING = "data-gitquiet-gist-editing"

    const show = (): void => {
      const path = window.location.pathname
      const search = window.location.search

      /*
       * Their editor, drawn as ours where their form can be read and given room where it
       * cannot. The stylesheet is the fallback rather than the answer now: it is what a
       * reader gets on a page whose form has stopped looking like this, which is the same
       * bargain every screen here makes.
       *
       * Their form is read on arrival rather than watched for, because the editor pages
       * are ordinary document loads: their `gist-pjax-container` swaps lists, not forms.
       */
      const editing = isGistEditing(`https://gist.github.com${path}${search}`)
      if (editing) {
        if (stood === path) return

        const drawn = drawEditor()
        document.documentElement.toggleAttribute(EDITING, drawn === null)
        if (drawn === null) {
          stepAside()
          return
        }

        stood = path
        standing = drawn
        return
      }
      document.documentElement.toggleAttribute(EDITING, false)

      const one = gistViewIn(`https://gist.github.com${path}${search}`)
      if (Option.isSome(one)) {
        if (stood === path) return

        /*
         * Read before anything is stood, and their page kept where it cannot be.
         *
         * The list can draw an empty screen and fill it, because the rows arrive from a
         * fetch this file makes. A gist is already in the document, so there is nothing
         * to wait for — and a page this cannot read is a page with nothing to put in
         * front of the reader, which is GitHub's to keep.
         */
        const seen = gistOnPage(document, one.value.owner, one.value.id)
        if (seen === null) return

        stood = path
        standing = drawGist(seen)
        return
      }

      const starred = GIST_STARRED.owns(path, search)
      if (!starred && !GIST_LIST.owns(path, search)) {
        stepAside()
        return
      }

      if (stood === path) return
      stood = path
      standing = drawList(starred ? GIST_STARRED : GIST_LIST, starred ? "starred" : "own")

      Effect.runFork(
        readOwnGists(document, readPage).pipe(
          Effect.map((found) => {
            rows = found.rows
            whole = found.whole
            standing?.redraw()
          }),
          Effect.catch((cause) => Effect.sync(() => reportError(cause)))
        )
      )
    }

    if (area !== undefined) {
      Effect.runFork(
        readKeptGists(area).pipe(
          Effect.map((read) => {
            kept = read
            standing?.redraw()
          }),
          Effect.catch((cause) => Effect.sync(() => reportError(cause)))
        )
      )
    }

    show()

    /*
     * Their `gist-pjax-container` swaps the list in without loading a document, and the
     * address moves with it. Watching the address rather than the DOM: every plant this
     * file used to do was cheap and idempotent, so running them on every mutation cost
     * nothing — standing a screen is neither, and a mutation observer here would fight
     * its own render.
     */
    whenAddressChanges(window, () => show())
  }
})
