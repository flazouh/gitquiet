import { useEffect, useRef, useState } from "react"
import { SETTINGS } from "@/ui/keeping"
import { Supplied } from "../../shots/Supplied"
import type { View } from "../../shots/view"
import { SCREEN_EDGE, SCREEN_SHADOW } from "./brand"
import type { Focus } from "./features"

const LIGHT = { [SETTINGS]: { theme: { appearance: "light", pack: "gitquiet" } } }

const useNear = (host: HTMLElement | null, eager: boolean): boolean => {
  const [near, setNear] = useState(eager)

  const already = useRef(eager)

  useEffect(() => {
    if (host === null || already.current) return

    const watch = new IntersectionObserver(
      (entries) => {
        if (!entries.some((one) => one.isIntersecting)) return
        already.current = true
        setNear(true)
        watch.disconnect()
      },
      { rootMargin: "800px 0px" }
    )

    watch.observe(host)
    return () => watch.disconnect()
  }, [host])

  return near
}

export const Live = ({
  view,
  eager = false,
  focus
}: {
  readonly view: View

  readonly eager?: boolean

  readonly focus?: Focus
}) => {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const near = useNear(host, eager)

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        position: "relative",
        width: focus === undefined ? "100%" : focus.width,
        height: focus === undefined ? view.height : focus.height,

        borderColor: SCREEN_EDGE,
        boxShadow: SCREEN_SHADOW,
        background: "var(--color-canvas)"
      }}
    >
      <div
        ref={setHost}

        data-gitquiet-outside

        data-live={view.name}
        style={{
          background: "var(--color-canvas)",

          position: focus === undefined ? "relative" : "absolute",
          left: focus === undefined ? undefined : -focus.x,
          top: focus === undefined ? undefined : -focus.y,
          width: focus === undefined ? "100%" : view.width,
          height: focus === undefined ? "100%" : view.height,

          contain: "paint",

          overflow: "hidden",
          isolation: "isolate"
        }}
      >
        {host === null || !near ? null : (
          <Supplied chosen={{ ...view.chosen, ...LIGHT }} element={host}>
            <div data-screen className="live-in">
              {view.draw()}
            </div>
          </Supplied>
        )}
      </div>
    </div>
  )
}
