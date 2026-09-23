import { useEffect, type ReactNode } from "react"
import { Held } from "@/ui/onboarding/Held"
import { REPO_HOME_VIEW } from "../../shots/mock/repoHome"
import { WORKING_SET_VIEW } from "../../shots/mock/workingSet"
import { Supplied } from "../../shots/Supplied"
import type { View } from "../../shots/view"

/**
 * Live product mount for the home hero — same fixture path as `/welcome`
 * (`Held` + `Supplied` + one `View`), without welcome light theme override.
 *
 * Dark stage pack comes from `Supplied` default STAGE_CHOSEN. Inbox and Repo
 * only: import fixtures directly so the home carousel never pulls the pull-request
 * mock (or its diff-engine graph) for these scenes.
 */

export type HeroLiveScene = "working-set" | "repo-home"

const SCENES: Record<HeroLiveScene, View> = {
  "working-set": WORKING_SET_VIEW,
  "repo-home": REPO_HOME_VIEW
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

    if (host.querySelector(gate) !== null) {
      done()
      return () => {
        cancelled = true
      }
    }

    const watch = new MutationObserver(() => {
      if (host.querySelector(gate) !== null) {
        watch.disconnect()
        done()
      }
    })
    watch.observe(host, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => {
      watch.disconnect()
      done()
    }, 8000)

    return () => {
      cancelled = true
      watch.disconnect()
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
  const view = SCENES[scene]

  return (
    <div className="hero-stage absolute inset-0 h-full w-full" data-hero-scene={scene}>
      <Held view={view}>{(host) => <Screen view={view} host={host} onReady={onReady} />}</Held>
    </div>
  )
}

export default HeroStage
