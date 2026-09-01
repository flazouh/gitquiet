import { Effect } from "effect"
import { defineContentScript } from "wxt/utils/define-content-script"
import { gistLabelsArea, readKeptGists, writeKeptGists } from "@/app/gistLabels"
import { withLabels, withName, type KeptGists } from "@/domain/gistLabels"
import { plantSecretBanner } from "@/ui/gistBanner"
import { plantGistLabelsPanel } from "@/ui/gistLabelsPanel"
import { plantGistSearch, reapplyGistSearch } from "@/ui/gistSearch"

/**
 * `gist.github.com`'s own content script, separate from `shell.content.ts` on
 * purpose. See `docs/spec/gists.md`: this page carries no React application
 * and this extension replaces no region of it, so there is no place for
 * `place.ts` or `mount.ts`'s takeover machinery to stand on. Everything here
 * appends beside GitHub's own markup instead.
 *
 * A `MutationObserver` on the whole document rather than a URL watch alone.
 * `gist-pjax-container` can swap the list or a gist's header in without
 * changing the address at all, and every plant function here is cheap and
 * idempotent, so running them on every mutation costs nothing worth avoiding.
 */
export default defineContentScript({
  matches: ["*://gist.github.com/*"],
  runAt: "document_idle",
  main() {
    // What this extension has kept about the reader's own gists — a Label, a
    // Name — read once and held here rather than re-read on every mutation:
    // `readKeptGists` is the one request in this whole content script, and a
    // reader's own Labels do not change from outside this page.
    let kept: KeptGists = new Map()
    const area = gistLabelsArea()

    const extraTextFor = (id: string): string =>
      [...(kept.get(id)?.labels ?? []), kept.get(id)?.name ?? ""].join(" ")

    const commit = (next: KeptGists): void => {
      kept = next
      if (area !== undefined) Effect.runFork(writeKeptGists(area, next))
      plantGistLabelsPanel(document, kept, onChange)
      reapplyGistSearch(document, extraTextFor)
    }

    const onChange = (id: string, labels: ReadonlyArray<string>, name: string | null): void => {
      commit(withName(withLabels(kept, id, labels), id, name))
    }

    const plantEverything = (): void => {
      plantSecretBanner(document)
      plantGistSearch(document, extraTextFor)
      plantGistLabelsPanel(document, kept, onChange)
    }

    plantEverything()

    const watching = new MutationObserver(plantEverything)
    watching.observe(document.body, { childList: true, subtree: true })

    if (area !== undefined) {
      Effect.runFork(
        readKeptGists(area).pipe(
          Effect.map((read) => {
            kept = read
            plantGistLabelsPanel(document, kept, onChange)
            // A search typed before this read landed only matched GitHub's
            // own text; now that Labels and Names are in, the same query
            // should answer against them too.
            reapplyGistSearch(document, extraTextFor)
          })
        )
      )
    }
  }
})
