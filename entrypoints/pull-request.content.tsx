import { Effect, Option } from "effect"
import { createRoot } from "react-dom/client"
import { defineContentScript } from "wxt/utils/define-content-script"
import { fromPathname } from "../src/domain/PullRequestRef"
import { readPullRequestHeader } from "../src/github/PageHeader"
import { initialiseErrorReporting, reportError } from "../src/observability/sentry"
import { App } from "../src/ui/App"
import { takeOverPage } from "../src/ui/mount"
import "../src/ui/styles.css"

export default defineContentScript({
  matches: ["*://github.com/*/*/pull/*"],
  runAt: "document_end",
  async main() {
    initialiseErrorReporting("content-script")

    const reference = fromPathname(window.location.pathname)
    if (Option.isNone(reference)) return

    // GitHub's payload lives in the document we are about to replace, so it
    // has to be read first. If it cannot be read we leave their page alone
    // rather than showing a half-rendered one.
    const header = await Effect.runPromise(readPullRequestHeader(document)).catch(
      (error: unknown) => {
        reportError(error)
        return undefined
      }
    )
    if (header === undefined) return

    takeOverPage(document, (container) => {
      createRoot(container).render(<App reference={reference.value} header={header} />)
    })
  }
})
