import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { SpinnerIcon } from "../../../src/ui/art"
import { INK } from "../../../src/ui/bed"
import { Mark, Wordmark } from "../../../src/ui/Mark"
import { Tour } from "../../../src/ui/onboarding/Tour"
import { spring } from "../lib/springs"
import type { Pending, Viewer, WayIn } from "../shared/wire"
import { Bed } from "./bed"
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

/**
 * What the app promises before it asks for anything.
 *
 * Under the panel rather than in it, because it is true of the whole app rather than
 * of the step a reader happens to be on — and because the moment they are about to
 * hand over a GitHub token is the moment it is worth the most.
 */
const KEPT = "No account and no server. Your token stays in the macOS keychain, on this machine."

/**
 * The captures, which live beside the built view.
 *
 * The site draws these screens for real, because on a page it can: they are the
 * extension's own components with fixture data, and the page already ships them for
 * its own live demos. A window would be fetching a four-megabyte diff engine to draw a
 * picture nobody is going to read the code in, so the window shows the photograph.
 * `scripts/copy-shots.ts` puts them here.
 */
const shotAt = (shot: string) => `shots/${shot}@2x.png`

/**
 * The button the last step is built around, in the brand's own clothes.
 *
 * Not the registry's `Button`, and this is the one place in the app where that is
 * right: every variant it has is drawn out of the interface's grey surface ladder,
 * which is exactly what this screen is not standing on. The classes are the tour's own
 * — shared with the site — so the button here and the button on gitquiet.com are one
 * button in two places.
 */
const Press = ({
  quiet = false,
  busy = false,
  disabled = false,
  onClick,
  children
}: {
  readonly quiet?: boolean
  readonly busy?: boolean
  readonly disabled?: boolean
  readonly onClick: () => void
  readonly children: React.ReactNode
}) => (
  <button
    type="button"
    className={quiet ? "tour-quietly" : "tour-press"}
    disabled={disabled || busy}
    onClick={onClick}
  >
    {busy && <SpinnerIcon size={15} />}
    {children}
  </button>
)

/**
 * The first screen of the app: the site's gradient, and the same four things the site
 * says, ending in the one thing only the app can offer.
 *
 * A panel rather than the whole window. The gradient is the room and this is a sheet
 * lifted off it, which is what a window with something to say looks like — the full
 * screen version read as a landing page that had been opened by mistake.
 *
 * Four beats and then sign in. Nothing is configured here: every setting already has
 * an answer, and the ones a reader may disagree with are in the account menu once they
 * are inside.
 */
export const Welcome = ({ onSignedIn }: { readonly onSignedIn: (viewer: Viewer) => void }) => {
  const [step, setStep] = useState<Step>({ at: "asleep" })

  /**
   * The best way in this build has credentials for, which is not known until the
   * main process answers. Null until then, and the button is drawn disabled: a
   * button that refuses on press is how the shipped app looked broken, and a
   * button that is not there yet is a panel that jumps as the answer lands.
   */
  const [way, setWay] = useState<WayIn | null>(null)

  useEffect(() => {
    let listening = true
    void ask("wayIn", undefined).then((it) => {
      if (listening) setWay(it)
    })
    return () => {
      listening = false
    }
  }, [])

  /**
   * A bridge that gives up, said on the screen rather than swallowed.
   *
   * `ask` rejects on its own deadline, and a sign-in is the one request here that
   * waits on a person. Without this the screen keeps a spinning button nobody can
   * press, on a sign-in the main process may well have finished — which is the
   * exact fault this whole screen was rewritten to remove.
   */
  const orRefuse = async (work: Promise<void>) => {
    try {
      await work
    } catch (cause) {
      setStep({ at: "refused", why: cause instanceof Error ? cause.message : String(cause) })
    }
  }

  /**
   * The way GitHub asks a window to sign somebody in: their own browser opens,
   * they approve there, and this answers when they come back. One request, held
   * open for as long as they take, because the main process is the one waiting.
   */
  const throughBrowser = () =>
    orRefuse(
      (async () => {
        setStep({ at: "inTheBrowser" })

        const done = await ask("signInThroughBrowser", undefined)
        if (!done.ok) {
          setStep({ at: "refused", why: done.why })
          return
        }

        onSignedIn(done.it)
      })()
    )

  /** The second way, for a machine with no browser to open. */
  const withACode = () =>
    orRefuse(
      (async () => {
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
      })()
    )

  /*
   * One sign-in at a time.
   *
   * Both ways end with a token in the keychain, and a reader who pressed the
   * browser button and then the code button had two of them racing there: the
   * one that lands second wins, and the window is signed in as whoever that was.
   */
  const busy = step.at === "inTheBrowser" || step.at === "asking"

  /*
   * The one button on the last step, which is a different sign-in in a build with no
   * client secret.
   *
   * Read out here rather than as two nearly identical buttons in the markup
   * below, where the only differences were the label, the handler and which step
   * counts as waiting — and where the reason for two of them was invisible.
   */
  const first =
    way === "code"
      ? { label: "Sign in with a code", waiting: "Asking GitHub…", while: "asking", go: withACode }
      : {
          label: "Sign in with GitHub",
          waiting: "Waiting for your browser…",
          while: "inTheBrowser",
          go: throughBrowser
        }

  /*
   * `mode="wait"` because the code replaces the button rather than joining it: the two
   * want the same corner of the same panel, and crossfading them there would read as
   * one control with two overlapping labels.
   *
   * `slow` is the tier — the largest thing moving on screen — still under 300ms, with
   * no bounce.
   */
  const act = (
    <AnimatePresence mode="wait" initial={false}>
      {step.at === "waiting" ? (
        <motion.div
          key="code"
          className="welcome-code"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12, transition: spring.slow.exit }}
          transition={spring.slow}
        >
          <p className="welcome-code-say">Type this into GitHub</p>
          {/*
            The code exists to be read off a screen and typed somewhere else, and the
            two mistakes that invites are a 0 read as an O and two characters read as
            one. Tabular figures and real letter spacing are the whole of the fix.
          */}
          <p className="welcome-code-is">{step.pending.code}</p>
          <p className="welcome-code-at">
            at <span>{step.pending.url}</span>
          </p>
          <p className="welcome-code-hint">Waiting for you to finish. This window will move on by itself.</p>
        </motion.div>
      ) : (
        <motion.div
          key="start"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12, transition: spring.slow.exit }}
          transition={spring.slow}
        >
          <AnimatePresence>
            {step.at === "refused" && (
              <motion.p
                className="welcome-refused"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, transition: spring.moderate.exit }}
                transition={spring.moderate}
              >
                {step.why}
              </motion.p>
            )}
          </AnimatePresence>

          {way === "none" ? (
            <p className="welcome-code-hint">{NO_APP}</p>
          ) : (
            <div className="welcome-ways">
              <Press busy={step.at === first.while} disabled={way === null || busy} onClick={() => void first.go()}>
                {step.at === first.while ? first.waiting : first.label}
              </Press>

              {step.at === "inTheBrowser" ? (
                <p className="welcome-code-hint">Approve it in the tab that opened. This window moves on by itself.</p>
              ) : (
                way === "browser" && (
                  <Press quiet busy={step.at === "asking"} disabled={busy} onClick={() => void withACode()}>
                    No browser on this machine? Use a code
                  </Press>
                )
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <main className="welcome">
      <Bed className="welcome-bed" />

      {/* The lockup a reader saw on gitquiet.com, above the panel and on every step. */}
      <div className="welcome-lockup">
        <Mark size={26} color={INK} />
        <Wordmark size={24} color={INK} />
      </div>

      <div className="welcome-sheet">
        <Tour
          show={(shot) => <img src={shotAt(shot)} alt="" />}
          ending={{
            title: "Ready when you are.",
            says: [
              "Sign in with GitHub and this window fills with your own pull requests, grouped the way you have just seen.",
              "GitQuiet asks GitHub for the one thing it needs: the repositories you can already read."
            ],
            act
          }}
        />
      </div>

      <p className="welcome-kept">{KEPT}</p>
    </main>
  )
}
