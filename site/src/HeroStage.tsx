import { useEffect, useState, type ReactNode } from "react"
import { Held } from "@/ui/onboarding/Held"
import { Supplied } from "../../shots/Supplied"
import type { View } from "../../shots/view"

/**
 * Live product mount for the home hero — same fixture path as `/welcome`
 * (`Held` + `Supplied` + one `View`), without welcome light theme override.
 *
 * Dark stage pack comes from `Supplied` default STAGE_CHOSEN. Each scene's
 * fixture is dynamic-imported so Inbox/Repo never pull the pull-request mock.
 * Diff-engine stays lazy inside `Supplied` and only fetches when a PR / Review
 * screen asks the renderer. Review reuses the same pullRequest mock chunk.
 */

export type HeroLiveScene = "working-set" | "repo-home" | "pull-request" | "pull-request-review"

const loadScene = (scene: HeroLiveScene): Promise<View> => {
  switch (scene) {
    case "working-set":
      return import("../../shots/mock/workingSet").then((m) => m.WORKING_SET_VIEW)
    case "repo-home":
      return import("../../shots/mock/repoHome").then((m) => m.REPO_HOME_VIEW)
    case "pull-request":
      return import("../../shots/mock/pullRequest").then((m) => m.PULL_REQUEST_VIEW)
    case "pull-request-review":
      return import("../../shots/mock/pullRequest").then((m) => m.PULL_REQUEST_REVIEW_VIEW)
  }
}

/**
 * View.ready may name a node inside the diff engine's shadow root (`[data-code]`).
 * Plain `querySelector` from the host never sees that; pierce open shadow roots
 * the same way `shots/capture.js` does.
 */
const somewhere = (within: ParentNode, selector: string): boolean => {
  if (within.querySelector(selector) !== null) return true
  for (const node of within.querySelectorAll("*")) {
    if (node.shadowRoot !== null && somewhere(node.shadowRoot, selector)) return true
  }
  return false
}

const Screen = ({
  view,
  host,
  onReady
}: {
  readonly view: View
  readonly host: HTMLElement
  readonly onReady?: () => void
}) => {
  useEffect(() => {
    host.setAttribute("data-live", view.name)
  }, [host, view.name])

  useEffect(() => {
    let cancelled = false
    const done = () => {
      if (!cancelled) onReady?.()
    }

    const gate = view.ready
    if (gate === undefined) {
      /*
       * Held hides until the room is measured; one frame later scale is on and the
       * PNG underneath can leave. Working Set has no late ready selector.
       */
      const id = window.requestAnimationFrame(() => done())
      return () => {
        cancelled = true
        window.cancelAnimationFrame(id)
      }
    }

    if (somewhere(host, gate)) {
      done()
      return () => {
        cancelled = true
      }
    }

    /*
     * Poll rather than MutationObserver alone: shadow-root content updates do not
     * notify an observer on the light host, and the PR gate lives in one.
     */
    const poll = window.setInterval(() => {
      if (somewhere(host, gate)) {
        window.clearInterval(poll)
        done()
      }
    }, 100)
    const timeout = window.setTimeout(() => {
      window.clearInterval(poll)
      done()
    }, 8000)

    return () => {
      cancelled = true
      window.clearInterval(poll)
      window.clearTimeout(timeout)
    }
  }, [host, view, onReady])

  return (
    <Supplied chosen={view.chosen} element={host}>
      <div data-screen className="h-full">
        {view.draw()}
      </div>
    </Supplied>
  )
}

/**
 * One active fixture scene, scaled into the hero frame. Parent keeps the PNG up
 * until `onReady` so Held pre-measure hide never flashes unscaled UI.
 */
export const HeroStage = ({
  scene,
  onReady
}: {
  readonly scene: HeroLiveScene
  readonly onReady?: () => void
}): ReactNode => {
  const [view, setView] = useState<View | null>(null)

  useEffect(() => {
    let cancelled = false
    setView(null)
    void loadScene(scene).then((next) => {
      if (!cancelled) setView(next)
    })
    return () => {
      cancelled = true
    }
  }, [scene])

  if (view === null) return null

  return (
    <div className="hero-stage absolute inset-0 h-full w-full" data-hero-scene={scene}>
      <Held view={view}>{(host) => <Screen view={view} host={host} onReady={onReady} />}</Held>
    </div>
  )
}

export default HeroStage
