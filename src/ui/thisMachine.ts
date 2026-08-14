/**
 * What the reader's own machine is, so that one file can be named as theirs.
 *
 * Its own module because it is the one fact on this screen that comes from neither GitHub nor
 * the store, and because the browser will lie about half of it. `navigator.platform` answers
 * `MacIntel` on a Mac with an Apple chip and has done deliberately for years, so it settles the
 * machine and can never settle the processor.
 *
 * Chrome's client hints do settle it. `getHighEntropyValues(["architecture", "bitness"])` comes
 * back `arm`/`64` on Apple silicon and `x86`/`64` on the rest, and this runs inside a Chrome
 * extension, so the hint is always there to ask for. Where it is not, or where it answers with
 * something this code has not seen, the processor stays null and no Build is named Yours: that is
 * `yoursAmong` refusing to guess, which is the whole point of the row.
 */

import { Effect } from "effect"
import { chipSaying, machineSaying, type Platform } from "../domain/release"

/** The two hints Chrome will answer with, as much of them as this reads. */
type Hints = {
  readonly platform?: string
  readonly getHighEntropyValues?: (
    wanted: ReadonlyArray<string>
  ) => PromiseLike<{ readonly architecture?: string; readonly bitness?: string }>
}

const hints = (): Hints | undefined =>
  (navigator as Navigator & { userAgentData?: Hints }).userAgentData

/**
 * The reader's machine and processor, or as much of the two as can be known.
 *
 * Fails at nothing. Every path here ends in a Platform, because a screen that could not read the
 * machine is a screen that draws every Build by name, which is a worse page than this one and
 * still a better page than GitHub's.
 */
export const thisMachine = (): Effect.Effect<Platform> =>
  Effect.suspend(() => {
    const said = hints()
    const machine = machineSaying(said?.platform ?? navigator.userAgent)

    const ask = said?.getHighEntropyValues
    if (ask === undefined) return Effect.succeed({ machine, chip: null })

    return Effect.tryPromise(() => ask.call(said, ["architecture", "bitness"])).pipe(
      Effect.map((values) => ({
        machine,
        chip: chipSaying(values.architecture ?? "", values.bitness ?? "")
      })),
      // A hint the browser declined to answer is not a failure worth reporting, and it is not
      // a reason to withhold the list either. The machine is still known and the row says so.
      Effect.catch(() => Effect.succeed({ machine, chip: null }))
    )
  })
