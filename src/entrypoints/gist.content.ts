import { defineContentScript } from "wxt/utils/define-content-script"
import { plantSecretBanner } from "@/ui/gistBanner"
import { plantGistSearch } from "@/ui/gistSearch"

/**
 * `gist.github.com`'s own content script, separate from `shell.content.ts` on
 * purpose. See `docs/spec/gists.md`: this page carries no React application
 * and this extension replaces no region of it, so there is no place for
 * `place.ts` or `mount.ts`'s takeover machinery to stand on. Everything here
 * appends beside GitHub's own markup instead.
 *
 * A `MutationObserver` on the whole document rather than a URL watch alone.
 * `gist-pjax-container` can swap the header in without changing the address at
 * all, and `plantSecretBanner` is cheap and idempotent — two element lookups
 * that give up at once where nothing has changed — so running it on every
 * mutation costs nothing worth avoiding.
 */
export default defineContentScript({
  matches: ["*://gist.github.com/*"],
  runAt: "document_idle",
  main() {
    const plantEverything = (): void => {
      plantSecretBanner(document)
      plantGistSearch(document)
    }

    plantEverything()

    const watching = new MutationObserver(plantEverything)
    watching.observe(document.body, { childList: true, subtree: true })
  }
})
