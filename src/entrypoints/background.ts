import { defineBackground } from "wxt/utils/define-background"
import { initialiseErrorReporting } from "@/observability/sentry"

/**
 * The worker, which has nothing left to do but be reachable.
 *
 * It used to inject an interface on request: a content script is matched against
 * the address a document was *loaded* with, GitHub loads no documents, and
 * injecting is a privilege a page does not have — so every soft navigation to one
 * of these pages went through a message to here. The cost was the worker itself.
 * MV3 stops an idle one after about thirty seconds, and waking it took long enough
 * for GitHub's own list to be on the screen: 587 milliseconds, measured on a live
 * page, coming and going depending on whether the reader's last press had happened
 * to warm it.
 *
 * The shell imports the screen instead — an extension file the manifest publishes,
 * fetched from disk with nobody to wake. See `src/app/screens.ts`.
 *
 * Kept because a worker is where errors from anywhere in the extension are
 * reported from, and because an extension without one has no way to be told it has
 * been updated.
 */
export default defineBackground(() => {
  initialiseErrorReporting("service-worker")
})
