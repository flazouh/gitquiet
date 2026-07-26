import { Effect, Layer, Option } from "effect"
import { createRoot } from "react-dom/client"
import { defineContentScript } from "wxt/utils/define-content-script"
import { correctCourt, loadPullRequest } from "@/app/pullRequest"
import { layer as courtsLayer } from "@/attention/CourtOverrides"
import type { CourtOverride } from "@/domain/Attention"
import { fromPathname } from "@/domain/PullRequestRef"
import { layer as gatewayLayer } from "@/github/GitHubGateway"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { PullRequestScreen } from "@/ui/PullRequestScreen"
import { takeOverSlotWhenReady } from "@/ui/mount"
import "@/ui/styles.css"

const services = Layer.merge(gatewayLayer, courtsLayer)

export default defineContentScript({
  // Wider than the interface itself, because GitHub navigates between the tabs
  // without reloading: the script has to already be running when someone comes
  // back to the conversation from Files.
  matches: ["*://github.com/*/*/pull/*"],
  runAt: "document_end",
  async main() {
    initialiseErrorReporting("content-script")

    // Only the conversation. Files, Commits and Checks are GitHub's own, and
    // they are good.
    const reference = fromPathname(window.location.pathname)
    if (Option.isNone(reference)) return

    const takeover = await takeOverSlotWhenReady(document)
    if (takeover === null) return

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

    createRoot(takeover.container).render(
      <PullRequestScreen
        reference={reference.value}
        load={load}
        correct={correct}
        onStepAside={takeover.stepAside}
      />
    )
  }
})
