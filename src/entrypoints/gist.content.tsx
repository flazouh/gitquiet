import { Effect } from "effect"
import { defineContentScript } from "wxt/utils/define-content-script"
import { gistLabelsArea, readKeptGists, writeKeptGists } from "@/app/gistLabels"
import { readOwnGists } from "@/app/ownGists"
import { withLabels, withName, type KeptGists } from "@/domain/gistLabels"
import type { GistRow } from "@/domain/gistList"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { standAScreen, type Standing } from "@/shell/screen"
import { gistViewIn, isGistEditing } from "@/domain/gist"
import type { GistSeen } from "@/domain/gist"
import { gistOnPage } from "@/github/gistView"
import { GistListScreen } from "@/ui/GistListScreen"
import { GistScreen } from "@/ui/GistScreen"
import { GIST_LIST, GIST_VIEW } from "@/ui/gistPlace"
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

export default defineContentScript({
  matches: ["*://gist.github.com/*"],
  runAt: "document_idle",
  main() {
    initialiseErrorReporting("gist-list")

    let kept: KeptGists = new Map()
    let rows: ReadonlyArray<GistRow> = []
    let whole = true
    const area = gistLabelsArea()

    /** What is on the page now, so a second arrival replaces rather than stacks. */
    let standing: Standing | null = null
    let stood: string | null = null

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
      handBack(document)
    }

    const drawList = (): Standing =>
      standAScreen({
        place: GIST_LIST,
        draw: () => (
          <GistListScreen
            rows={rows}
            whole={whole}
            kept={kept}
            onChange={onChange}
            onStepAside={stepAside}
          />
        )
      })

    const drawGist = (gist: GistSeen): Standing =>
      standAScreen({
        place: GIST_VIEW,
        draw: () => (
          <GistScreen gist={gist} kept={kept} onChange={onChange} onStepAside={stepAside} />
        )
      })

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
       * Their editor, given room. Set before anything else decides what to draw, because
       * this is the one page here that gets a stylesheet and no screen: it is a form
       * GitHub already knows how to post, and the complaint about it is that it is too
       * small rather than that it is wrong.
       */
      const editing = isGistEditing(`https://gist.github.com${path}${search}`)
      document.documentElement.toggleAttribute(EDITING, editing)
      if (editing) {
        stepAside()
        return
      }

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

      if (!GIST_LIST.owns(path, search)) {
        stepAside()
        return
      }

      if (stood === path) return
      stood = path
      standing = drawList()

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
