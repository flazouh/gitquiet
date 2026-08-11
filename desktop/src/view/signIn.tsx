import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { Button } from "../components/ui/button"
import { Elevated } from "../lib/elevated"
import { fontWeights } from "../lib/font-weight"
import { spring } from "../lib/springs"
import type { Pending, Viewer } from "../shared/wire"
import { ask } from "./rpc"

/**
 * Signing in, as four things a reader can be looking at.
 *
 * Asleep, waiting on GitHub for a code, holding a code and waiting on the
 * reader, or turned away. They are one union rather than four booleans because
 * three of them have something on screen that the others must not — a code that
 * has expired, a spinner over a code, an error under a button that is already
 * gone — and a union makes each of those unrepresentable rather than merely
 * unlikely.
 */
type Step =
  | { readonly at: "asleep" }
  | { readonly at: "asking" }
  | { readonly at: "waiting"; readonly pending: Pending }
  | { readonly at: "refused"; readonly why: string }

export const SignIn = ({ onSignedIn }: { readonly onSignedIn: (viewer: Viewer) => void }) => {
  const [step, setStep] = useState<Step>({ at: "asleep" })

  const start = async () => {
    setStep({ at: "asking" })

    const begun = await ask("beginSignIn", undefined)
    if (!begun.ok) {
      setStep({ at: "refused", why: begun.why })
      return
    }

    setStep({ at: "waiting", pending: begun.it })

    // Held open for as long as the reader takes. The main process is the one
    // polling GitHub, so this is a single request that answers when they are
    // done — no timer here, and nothing to keep in step with GitHub's interval.
    const done = await ask("finishSignIn", begun.it)
    if (!done.ok) {
      setStep({ at: "refused", why: done.why })
      return
    }

    onSignedIn(done.it)
  }

  return (
    <Elevated offset={2} className="w-[360px] rounded-xl px-8 py-9">
      {/*
        `mode="wait"` because the code replaces the button rather than joining
        it: the two panels want the same middle of the same card, and crossfading
        them there would read as one panel with two overlapping labels.

        `slow` is the tier — largest surface on screen — still under 300ms,
        with no bounce.
      */}
      <AnimatePresence mode="wait" initial={false}>
        {step.at === "waiting" ? (
          <motion.div
            key="waiting"
            className="grid justify-items-center gap-2 text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, transition: spring.slow.exit }}
            transition={spring.slow}
          >
            <h1 className="m-0 text-lg tracking-tight" style={{ fontVariationSettings: fontWeights.semibold }}>
              Type this into GitHub
            </h1>
            {/*
              The code exists to be read off a screen and typed somewhere else,
              and the two mistakes that invites are a 0 read as an O and two
              characters read as one. Tabular figures and real letter spacing
              are the whole of the fix.
            */}
            <p className="m-0 mt-1 font-mono text-[32px] tracking-[0.16em] tabular-nums select-all">
              {step.pending.code}
            </p>
            <p className="m-0 text-muted-foreground">
              at <span className="text-foreground">{step.pending.url}</span>
            </p>
            <p className="m-0 mt-1 text-xs text-muted-foreground">
              Waiting for you to finish. This window will move on by itself.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="start"
            className="grid justify-items-center gap-2 text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, transition: spring.slow.exit }}
            transition={spring.slow}
          >
            <h1 className="m-0 text-lg tracking-tight" style={{ fontVariationSettings: fontWeights.semibold }}>
              GitQuiet
            </h1>
            <p className="m-0 text-muted-foreground">Your pull requests, without a browser in the way.</p>

            <AnimatePresence>
              {step.at === "refused" && (
                <motion.p
                  className="m-0 mt-1 rounded-lg bg-destructive-light px-3 py-2 text-xs text-destructive"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0, transition: spring.moderate.exit }}
                  transition={spring.moderate}
                >
                  {step.why}
                </motion.p>
              )}
            </AnimatePresence>

            <Button className="mt-3" size="lg" loading={step.at === "asking"} onClick={start}>
              {step.at === "asking" ? "Asking GitHub…" : "Sign in with GitHub"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Elevated>
  )
}
