import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { Button } from "../components/ui/button"
import { Elevated } from "../lib/elevated"
import { fontWeights } from "../lib/font-weight"
import { spring } from "../lib/springs"
import type { Pending, Viewer, WaysToSignIn } from "../shared/wire"
import { ask } from "./rpc"

/**
 * Signing in, as five things a reader can be looking at.
 *
 * Asleep, waiting on their browser, waiting on GitHub for a code, holding a code
 * and waiting on the reader, or turned away. They are one union rather than five
 * booleans because several of them have something on screen that the others must
 * not — a code that has expired, a spinner over a code, an error under a button
 * that is already gone — and a union makes each of those unrepresentable rather
 * than merely unlikely.
 */
type Step =
  | { readonly at: "asleep" }
  | { readonly at: "inTheBrowser" }
  | { readonly at: "asking" }
  | { readonly at: "waiting"; readonly pending: Pending }
  | { readonly at: "refused"; readonly why: string }

/**
 * Said here rather than by the main process, because it is the one refusal a
 * reader can act on: it is their build that has no OAuth app, and the fix is on
 * github.com. Everything else on this panel is GitHub's own words.
 */
const NO_APP = "This build was made without an OAuth app of its own, so it has nothing to sign in with."

export const SignIn = ({ onSignedIn }: { readonly onSignedIn: (viewer: Viewer) => void }) => {
  const [step, setStep] = useState<Step>({ at: "asleep" })

  /**
   * Which ways in this build has credentials for, which is not known until the
   * main process answers. Null until then, and the button waits rather than
   * being drawn as something that might not work: a button that refuses on
   * press is how the shipped app looked broken.
   */
  const [ways, setWays] = useState<WaysToSignIn | null>(null)

  useEffect(() => {
    let listening = true
    void ask("waysToSignIn", undefined).then((it) => {
      if (listening) setWays(it)
    })
    return () => {
      listening = false
    }
  }, [])

  /**
   * The way GitHub asks a window to sign somebody in: their own browser opens,
   * they approve there, and this answers when they come back. One request, held
   * open for as long as they take, because the main process is the one waiting.
   */
  const throughBrowser = async () => {
    setStep({ at: "inTheBrowser" })

    const done = await ask("signInThroughBrowser", undefined)
    if (!done.ok) {
      setStep({ at: "refused", why: done.why })
      return
    }

    onSignedIn(done.it)
  }

  /** The second way, for a machine with no browser to open. */
  const withACode = async () => {
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

  const nothingToSignInWith = ways !== null && !ways.browser && !ways.code

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

            {nothingToSignInWith ? (
              <p className="m-0 mt-3 text-xs text-muted-foreground">{NO_APP}</p>
            ) : (
              <>
                {ways?.browser === false ? (
                  <Button
                    className="mt-3"
                    size="lg"
                    loading={step.at === "asking"}
                    disabled={ways === null}
                    onClick={withACode}
                  >
                    {step.at === "asking" ? "Asking GitHub…" : "Sign in with a code"}
                  </Button>
                ) : (
                  <Button
                    className="mt-3"
                    size="lg"
                    loading={step.at === "inTheBrowser"}
                    disabled={ways === null}
                    onClick={throughBrowser}
                  >
                    {step.at === "inTheBrowser" ? "Waiting for your browser…" : "Sign in with GitHub"}
                  </Button>
                )}

                {step.at === "inTheBrowser" ? (
                  <p className="m-0 mt-1 text-xs text-muted-foreground">
                    Approve it in the tab that opened. This window will move on by itself.
                  </p>
                ) : (
                  ways?.browser === true &&
                  ways.code && (
                    <Button variant="ghost" size="sm" onClick={withACode}>
                      No browser on this machine? Use a code
                    </Button>
                  )
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Elevated>
  )
}
