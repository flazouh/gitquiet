import { Effect, Fiber } from "effect"

/**
 * Reading pages the reader has not asked for, and getting out of their way when they do.
 *
 * Two rules, and they are both about one connection to one host. One page is read at a
 * time, because a reader sweeping a list would otherwise have every route they passed
 * over in the air at once. And nothing at all is read from the moment they press until
 * the screen they pressed for is up, because from there every guess is competing with
 * the one thing somebody is actually waiting on.
 *
 * The second rule was expensive to learn. Measured on a press between two pull requests
 * with the pointer rested on the row first, which is how anybody presses anything: the
 * read made on the guess was still in the air when the press landed, the screen's own
 * seven requests went out 1,141ms behind it, and the page took 2,252ms to become
 * readable — against 341ms for the same press made cold. Resting on a link made the
 * press six times slower, which is the exact opposite of the thing this is for.
 *
 * Lives here rather than in the shell's `main` because both rules are about time and
 * cancellation, and neither could be asserted about from inside a 600 line closure.
 * Every bug this module has had was in the part that had no test.
 */

/**
 * A page the reader pressed for, until it is on the screen.
 *
 * `there` is asked whether that page is up yet, and `by` is when to stop asking — the
 * press was swallowed, or it turned into a document load, and either way nobody is
 * waiting on this any more.
 */
export type Waiting = {
  readonly there: () => boolean
  readonly by: number
}

/**
 * The same, once `now` has been taken into account, or nothing if the wait is over.
 *
 * Returned rather than mutated, so the rule is a function of the two things it depends
 * on. `there` is not asked once the deadline has passed, because the answer cannot
 * change and the caller would go on asking every frame for the rest of the session.
 */
const stillWaiting = (waiting: Waiting | undefined, now: number): Waiting | undefined =>
  waiting === undefined || now > waiting.by || waiting.there() ? undefined : waiting

/** What the shell holds: one of these per document, made once. */
export type ReadingAhead = {
  /**
   * A page worth reading, offered as soon as the pointer has earned it.
   *
   * Read now if nothing else is being read, held if something is, and dropped if the
   * reader is waiting on a press. Only the newest held page is kept: a reader who has
   * moved on has moved on.
   */
  readonly offer: (key: string, read: Effect.Effect<unknown, unknown>) => void
  /** Whether this page was already read ahead in this visit. */
  readonly already: (key: string) => boolean
  /** How many pages this visit has read ahead, which is what `AT_MOST` is about. */
  readonly read: () => number
  /**
   * The reader pressed something, so the connection is theirs until it arrives.
   *
   * `keep` is the page they asked for, whose read is the one thing the resting before
   * the press bought: it lands in the store, and the screen draws that store before
   * GitHub has answered anything. Calling that one off cost exactly what it was worth —
   * measured on a press from the list, 238ms rested became 1,256ms. Every other read is
   * competing with them and is called off.
   *
   * `null` is a press with nothing to spare, and it has to be a different value from
   * "no read is in the air". Both were `undefined` once, so a moment where the key was
   * missing read as "this is the page they asked for" and spared the read it was called
   * to stop.
   */
  readonly pressed: (keep: string | null, waiting: Waiting) => void
  /** Whether the page the reader pressed for is still on its way. */
  readonly waiting: (now: number) => boolean
}

export const readingAhead = (): ReadingAhead => {
  const asked = new Set<string>()
  let reading = false
  /** The one waiting behind the read in the air, which is always the most recently wanted. */
  let after: { readonly key: string; readonly read: Effect.Effect<unknown, unknown> } | undefined
  /** The read in the air, and which page it is for, so a press can call it off. */
  let inFlight: Fiber.Fiber<unknown, unknown> | undefined
  let inFlightKey: string | null = null
  /**
   * Which read the three names above belong to.
   *
   * A read does not always end while it is still the current one. An interrupt is asked
   * for rather than done, so a read called off by a press can end after the next one has
   * begun, and a finalizer that clears state belonging to that later read would leave it
   * with nothing able to call it off and `reading` false with a read in the air. So the
   * finalizer checks that it is still the read the state names before it clears anything.
   */
  let reads = 0
  let arriving: Waiting | undefined

  const start = (key: string, read: Effect.Effect<unknown, unknown>): void => {
    reading = true
    // Said here rather than by the caller, so that a page nobody got round to
    // reading is not written down as one that was read.
    asked.add(key)

    const mine = ++reads
    /*
     * Whether this read ended before the fork that started it handed back the fiber,
     * which `Effect.runFork` allows: a read that never reaches the network runs to
     * completion inside the call. Assigning the fiber afterwards would leave `inFlight`
     * naming a finished read, and the next press would call off a ghost and spare the
     * read that is really in the air.
     */
    let ended = false

    inFlightKey = key
    const fiber = Effect.runFork(
      read.pipe(
        // Nobody asked for this and nobody is waiting for it. A page that could not be
        // read ahead is read again, out loud, when it is opened — and that is where
        // saying so belongs.
        Effect.ignore,
        Effect.ensuring(
          Effect.sync(() => {
            ended = true
            if (mine !== reads) return

            reading = false
            inFlight = undefined
            inFlightKey = null

            const held = after
            after = undefined
            if (held !== undefined && !asked.has(held.key)) start(held.key, held.read)
          })
        )
      )
    )

    if (!ended) inFlight = fiber
  }

  return {
    offer: (key, read) => {
      if (arriving !== undefined) return
      if (reading) {
        /*
         * Held rather than dropped, and this is the whole of why the queue exists: the
         * drop used to happen after the caller had written the page down as asked for,
         * so a page offered while another was in flight was never read ahead and never
         * offered again.
         */
        after = { key, read }
        return
      }
      start(key, read)
    },

    already: (key) => asked.has(key),

    read: () => asked.size,

    pressed: (keep, waiting) => {
      arriving = waiting
      after = undefined
      if (inFlight === undefined) return
      if (keep !== null && inFlightKey === keep) return

      const held = inFlight
      inFlight = undefined
      inFlightKey = null
      Effect.runFork(Fiber.interrupt(held))
    },

    waiting: (now) => {
      arriving = stillWaiting(arriving, now)
      return arriving !== undefined
    }
  }
}
