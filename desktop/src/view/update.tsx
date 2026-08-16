import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { Button } from "../components/ui/button"
import { spring } from "../lib/springs"
import type { UpdateStanding } from "../shared/wire"
import { ask } from "./rpc"

/**
 * The one thing the window says about updating itself.
 *
 * Looking and downloading happen in the main process on launch, without asking,
 * so by the time this is drawn there is either a build waiting or nothing to
 * say. Nothing to say is nothing drawn: a title bar that reports "up to date" is
 * a title bar carrying a fact nobody needed.
 *
 * A failed check is not drawn either. There is nothing a reader can do about a
 * release page that was briefly unreachable, and the app they have works. It
 * goes to the console, where the next launch will try again anyway.
 */

/**
 * How long before asking again while the main process is still looking.
 *
 * Asked again rather than pushed, because the check starts before this window
 * exists — see `updateStanding` on the wire. Three seconds because the wait is a
 * download of about twenty megabytes on the first update of a machine and a few
 * hundred kilobytes on every one after, and because a reader who quits within
 * three seconds was never going to see this.
 */
const LOOK_AGAIN = 3_000

export const Update = () => {
  const [standing, setStanding] = useState<UpdateStanding>({ at: "looking" })
  const [restarting, setRestarting] = useState(false)
  /** Why the restart did not happen, which is the only failure a reader sees. */
  const [refused, setRefused] = useState<string | null>(null)

  useEffect(() => {
    let watching = true
    let waiting: ReturnType<typeof setTimeout> | undefined

    const look = async () => {
      // Caught, because a bridge that gave up would otherwise stop the asking
      // silently and leave this at `looking` for the rest of the run.
      const it = await ask("updateStanding", undefined).catch(
        (cause: unknown): UpdateStanding => ({
          at: "failed",
          why: cause instanceof Error ? cause.message : String(cause)
        })
      )
      if (!watching) return

      setStanding(it)
      if (it.at === "failed") console.warn("[working-set] update:", it.why)
      // Only while it is still going, so an app that is current asks once and
      // then leaves the bridge alone for the rest of the run.
      if (it.at === "looking") waiting = setTimeout(() => void look(), LOOK_AGAIN)
    }

    void look()

    return () => {
      watching = false
      if (waiting !== undefined) clearTimeout(waiting)
    }
  }, [])

  return (
    <AnimatePresence>
      {standing.at === "ready" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96, transition: spring.moderate.exit }}
          transition={spring.moderate}
        >
          <Button
            size="sm"
            variant="secondary"
            loading={restarting}
            disabled={refused !== null}
            title={refused ?? `GitQuiet ${standing.version} is downloaded and waiting.`}
            onClick={() => {
              setRestarting(true)
              /*
               * An answer arrives only when the restart did not happen: a restart
               * that works replaces the bundle, starts it and quits this window
               * mid-press. So the reader is left looking at a button that says
               * "Restarting…" precisely in the case where nothing is going to
               * happen, and it has to say so.
               */
              void ask("applyUpdate", undefined).then(
                (said) => {
                  if (said.ok) return
                  console.warn("[working-set] update:", said.why)
                  setRestarting(false)
                  setRefused(said.why)
                },
                (cause: unknown) => {
                  console.warn("[working-set] update:", cause)
                  setRestarting(false)
                  setRefused(cause instanceof Error ? cause.message : String(cause))
                }
              )
            }}
          >
            {refused !== null ? "Update failed" : restarting ? "Restarting…" : "Restart to update"}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
