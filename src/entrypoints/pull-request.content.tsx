import { Effect, Layer, Option } from "effect"
import { createRoot } from "react-dom/client"
import { defineContentScript } from "wxt/utils/define-content-script"
import { correctCourt, loadPullRequest } from "@/app/pullRequest"
import { layer as courtsLayer } from "@/attention/CourtOverrides"
import type { CourtOverride } from "@/domain/Attention"
import { fromPathname } from "@/domain/PullRequestRef"
import { layer as gatewayLayer } from "@/github/GitHubGateway"
import { readPullRequestHeader } from "@/github/PageHeader"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { PullRequestScreen } from "@/ui/PullRequestScreen"
import { takeOverPage } from "@/ui/mount"
import "@/ui/styles.css"

const services = Layer.merge(gatewayLayer, courtsLayer)

export default defineContentScript({
  matches: ["*://github.com/*/*/pull/*"],
  runAt: "document_end",
  async main() {
    initialiseErrorReporting("content-script")

    const reference = fromPathname(window.location.pathname)
    if (Option.isNone(reference)) return

    // Read GitHub's own payload before replacing the page that carries it, so
    // the Participant sees the title with no network round trip.
    const header = await Effect.runPromise(
      readPullRequestHeader(document).pipe(Effect.result)
    )
    const knownTitle = header._tag === "Success" ? header.success.title : undefined

    const load = () =>
      Effect.runPromise(
        loadPullRequest(reference.value).pipe(Effect.provide(services))
      ).catch((error: unknown) => {
        reportError(error)
        throw error
      })

    const correct = (override: CourtOverride) =>
      Effect.runPromise(
        correctCourt(reference.value, override).pipe(Effect.provide(services))
      )

    takeOverPage(document, (container) => {
      createRoot(container).render(
        <PullRequestScreen
          reference={reference.value}
          load={load}
          correct={correct}
          knownTitle={knownTitle}
        />
      )
    })
  }
})
