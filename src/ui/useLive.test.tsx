import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import { type Load, useLive } from "./useLive"

afterEach(cleanup)

/**
 * Wall clock, so it is a guess at how long a flush takes rather than a fact.
 * That is fine for giving a held read somewhere to be, and it is not fine for
 * the assertion after it: `bun test --parallel` runs a worker per core, and ten
 * milliseconds bought on an idle machine buys nothing on a loaded one. Where a
 * test waits for a value to arrive, `waitFor` reads the value until it is the
 * one expected, which is the same intent without the clock in it.
 */
const settle = (ms = 40) => act(() => new Promise((rest) => setTimeout(rest, ms)))

/**
 * Reads the test finishes by hand, in the order they were asked for.
 *
 * A `sleep` inside the read with a shorter `settle` beside it says the same
 * thing in less code, and that pair is a race rather than a fact: the two are
 * counted by the same clock, so under load the sleep finishes first and an
 * assertion about a read that is still running reads one that has already
 * answered. Holding the read open until the test says otherwise makes "still
 * running" true for as long as the test needs it to be.
 */
const held = <A,>(...answers: ReadonlyArray<A>) => {
  const gates = answers.map(() => {
    let open!: () => void
    const shut = new Promise<void>((rest) => {
      open = rest
    })
    return { shut, open }
  })
  let asked = 0

  return {
    load: () => {
      const at = asked++
      const gate = gates[at]
      const answer = answers[at]
      if (gate === undefined || answer === undefined) {
        throw new Error(`Read ${at + 1} was not expected`)
      }
      return Effect.promise(() => gate.shut).pipe(Effect.as(answer))
    },

    /** Lets the read at `nth`, counting from one, answer. */
    answer: (nth: number) => {
      const gate = gates[nth - 1]
      if (gate === undefined) throw new Error(`There is no read ${nth} to answer`)
      gate.open()
      return settle(1)
    }
  }
}

/**
 * A screen with one list on it, saying which of the three states it is in.
 *
 * The same three `useLiveRead` had, because they are the three a reader can be
 * shown: nothing yet, something, or nothing and no way to get it.
 */
const Screen = ({
  load,
  preload,
  keep,
  change,
  onRefusal
}: {
  readonly load: Load<ReadonlyArray<string>>
  readonly preload?: () => Effect.Effect<Option.Option<ReadonlyArray<string>>>
  /** What this page is called in this document's memory. See `lastDrawn.ts`. */
  readonly keep?: string
  readonly change?: () => Effect.Effect<void, unknown>
  /** Told what GitHub said, where it said no, as the row menu is. */
  readonly onRefusal?: (said: unknown) => void
}) => {
  const live = useLive(load, preload, keep)

  return (
    <div>
      <p data-testid="state">{live.read.status}</p>
      <p data-testid="catching">{live.catchingUp ? "yes" : "no"}</p>
      <p data-testid="rows">
        {live.read.status === "ready" ? live.read.value.join(",") : ""}
      </p>
      <button type="button" onClick={() => live.again()}>
        again
      </button>
      {change === undefined ? null : (
        <button
          type="button"
          onClick={() =>
            Effect.runFork(
              live
                .meanwhile((rows) => rows.map((row) => (row === "open" ? "closed" : row)), change())
                .pipe(
                  Effect.catchCause((cause) =>
                    Effect.sync(() => {
                      onRefusal?.(cause)
                    })
                  )
                )
            )
          }
        >
          close
        </button>
      )}
    </div>
  )
}

const stateOf = () => screen.getByTestId("state").textContent
const rowsOf = () => screen.getByTestId("rows").textContent
const catchingUp = () => screen.getByTestId("catching").textContent

describe("a read that stays live", () => {
  test("waits, then shows what GitHub said", async () => {
    const load = () => Effect.sleep("10 millis").pipe(Effect.as(["open", "open"]))

    render(<Screen load={load} />)

    expect(stateOf()).toBe("loading")

    await settle()

    expect(stateOf()).toBe("ready")
    expect(rowsOf()).toBe("open,open")
  })

  test("says so when the first read failed, rather than waiting for ever", async () => {
    const load = () => Effect.sleep("10 millis").pipe(Effect.andThen(Effect.fail("no")))

    render(<Screen load={load} />)

    await settle()

    expect(stateOf()).toBe("failed")
  })

  test("shows what was remembered until the live read answers", async () => {
    const live = held(["fresh"])
    const preload = () => Effect.succeed(Option.some(["remembered"]))

    render(<Screen load={live.load} preload={preload} />)

    await settle(10)

    expect(rowsOf()).toBe("remembered")

    await live.answer(1)

    expect(rowsOf()).toBe("fresh")
  })

  test("keeps the list on the screen when a re-read fails", async () => {
    let asked = 0
    const load = () =>
      Effect.sleep("10 millis").pipe(
        Effect.andThen(
          Effect.suspend(() => (++asked === 1 ? Effect.succeed(["open"]) : Effect.fail("no")))
        )
      )

    render(<Screen load={load} />)
    await settle()

    expect(rowsOf()).toBe("open")

    await userEvent.click(screen.getByText("again"))
    await settle()

    // The read that failed is the second one. What is on the screen was true a
    // moment ago, which is worth more than an error page about a refresh.
    expect(stateOf()).toBe("ready")
    expect(rowsOf()).toBe("open")
  })
})

/**
 * The difference between a list and a list that is being checked.
 *
 * Showing a memory is the right thing to do and it is also a small lie: the
 * reader is looking at what was true last time, and nothing on the screen says
 * so. The screens turn this into a sentence; here it is only the fact.
 */
describe("a memory with a read still running behind it", () => {
  test("says it is catching up, and stops saying it once GitHub answers", async () => {
    const live = held(["fresh"])
    const preload = () => Effect.succeed(Option.some(["remembered"]))

    render(<Screen load={live.load} preload={preload} />)

    await waitFor(() => expect(rowsOf()).toBe("remembered"))
    expect(catchingUp()).toBe("yes")

    await live.answer(1)

    await waitFor(() => expect(rowsOf()).toBe("fresh"))
    expect(catchingUp()).toBe("no")
  })

  test("says nothing where there is nothing to look at yet", async () => {
    const live = held(["fresh"])

    render(<Screen load={live.load} />)

    // The wait is already saying this, in the middle of the screen, at the size
    // of the thing that is missing. A toast beside it says it twice.
    await waitFor(() => expect(stateOf()).toBe("loading"))
    expect(catchingUp()).toBe("no")
  })

  test("says it again for the re-read that coming back to the tab starts", async () => {
    const live = held(["read 1"], ["read 2"])

    render(<Screen load={live.load} />)
    await live.answer(1)

    await waitFor(() => expect(catchingUp()).toBe("no"))

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new Event("visibilitychange"))
    })

    // Still the first read's rows, and the second read already running under them.
    await waitFor(() => expect(catchingUp()).toBe("yes"))
    expect(rowsOf()).toBe("read 1")

    await live.answer(2)

    await waitFor(() => expect(rowsOf()).toBe("read 2"))
    expect(catchingUp()).toBe("no")
  })
})

/**
 * A read that says what it has before it has all of it, over what was already there.
 *
 * The stages are what make a list arrived at cold appear in one round trip instead of
 * four, and they are only worth showing over nothing. A repository's list takes four
 * reads of GitHub to draw completely, so the first stage of any of them is the rows
 * with no Courts, no checks and no sizes. Over a whole page — a memory, or the answer
 * to the read before this one — it takes the reader's list apart and puts it back
 * together in front of them.
 *
 * Recorded on a live GitHub, arriving at `flazouh/ghpro-scratch/pulls`: the remembered
 * list whole at 1010ms, "Waiting 5" without a check on any row at 1423ms, "Needs You 5"
 * again at 1736ms. Then walking out of pull request 10 back onto the same list: whole
 * at 6394ms, "Waiting 5" at 7153ms, whole again at 7619ms. See
 * `scripts/probe-flicker-dom.js`, which is what recorded it.
 */
describe("a read that says what it has on the way", () => {
  /** One wait, ended by whoever holds the handle rather than by a clock. */
  const gate = () => {
    let open = (): void => {}
    const waited = new Promise<void>((done) => {
      open = () => done()
    })

    return { open: () => open(), waited }
  }

  /**
   * A staged read whose two stages this test hands out, one at a time.
   *
   * Held rather than timed. On a clock these tests stand in a window between the
   * stage landing and the read finishing, and they read the screen in the middle
   * of it — 15ms into a window 25ms wide, which is the margin that failed twice
   * elsewhere in this file. Here the window is as wide as the test needs, and
   * `told` says the stage was really reported, so a test can prove the screen
   * ignored a stage rather than waiting long enough to believe it did.
   */
  const staging = () => {
    let asked = 0
    let told = 0
    const rounds = new Map<number, { rows: ReturnType<typeof gate>; checks: ReturnType<typeof gate> }>()

    const roundOf = (round: number) => {
      const already = rounds.get(round)
      if (already !== undefined) return already

      const made = { rows: gate(), checks: gate() }
      rounds.set(round, made)
      return made
    }

    const load: Load<ReadonlyArray<string>> = (partly) =>
      Effect.suspend(() => {
        const round = ++asked
        const held = roundOf(round)

        return Effect.promise(() => held.rows.waited).pipe(
          // The rows, and nothing that goes beside them. Every screen with a staged
          // read reports this stage, and every one of them is missing most of a row.
          Effect.tap(() =>
            Effect.sync(() => {
              told += 1
              partly([`round ${round} rows`])
            })
          ),
          Effect.andThen(Effect.promise(() => held.checks.waited)),
          Effect.as([`round ${round} rows`, `round ${round} checks`])
        )
      })

    return {
      load,
      /** Lets that round's rows land, which is the stage every staged screen reports. */
      rows: (round = 1) => roundOf(round).rows.open(),
      /** Lets that round finish. */
      checks: (round = 1) => roundOf(round).checks.open(),
      /** How many stages have been reported, over every round. */
      told: () => told
    }
  }

  test("shows the stages of the first read, which is what they are for", async () => {
    const read = staging()
    render(<Screen load={read.load} />)

    read.rows()
    await waitFor(() => expect(rowsOf()).toBe("round 1 rows"))

    read.checks()
    await waitFor(() => expect(rowsOf()).toBe("round 1 rows,round 1 checks"))
  })

  test("never shows a stage of a re-read over the finished list", async () => {
    const read = staging()
    render(<Screen load={read.load} />)

    read.rows()
    read.checks()
    await waitFor(() => expect(rowsOf()).toBe("round 1 rows,round 1 checks"))

    // Coming back to the tab, which is the same re-read a reader gets for walking
    // out of a pull request onto the list they came from.
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new Event("visibilitychange"))
    })

    // The second read's rows have landed — reported, not merely due — and its
    // checks have not. What is on the screen is a whole list, and half of one is
    // not an improvement on it.
    read.rows(2)
    await waitFor(() => expect(read.told()).toBe(2))

    expect(rowsOf()).toBe("round 1 rows,round 1 checks")

    read.checks(2)
    await waitFor(() => expect(rowsOf()).toBe("round 2 rows,round 2 checks"))
  })

  test("shows no stage over a memory, which is a whole page where a stage is part of one", async () => {
    // The recorded flicker, at the size a test can hold: the remembered list, then
    // its own rows handed back with every check taken off them.
    const preload = () => Effect.succeed(Option.some(["remembered rows", "remembered checks"]))

    const read = staging()
    render(<Screen load={read.load} preload={preload} />)
    await waitFor(() => expect(rowsOf()).toBe("remembered rows,remembered checks"))

    read.rows()
    await waitFor(() => expect(read.told()).toBe(1))

    expect(rowsOf()).toBe("remembered rows,remembered checks")

    // And the answer, which is the only thing worth replacing a whole page with.
    read.checks()
    await waitFor(() => expect(rowsOf()).toBe("round 1 rows,round 1 checks"))
  })

  test("says it is catching up while it holds the memory back, so the wait is not silent", async () => {
    const preload = () => Effect.succeed(Option.some(["remembered rows", "remembered checks"]))

    const read = staging()
    render(<Screen load={read.load} preload={preload} />)
    await waitFor(() => expect(catchingUp()).toBe("yes"))

    read.rows()
    read.checks()
    await waitFor(() => expect(catchingUp()).toBe("no"))
  })
})

describe("coming back to the tab", () => {
  test("reads again, because what is here was true when the reader looked away", async () => {
    let asked = 0
    const load = () =>
      Effect.sleep("5 millis").pipe(Effect.map(() => [`read ${++asked}`]))

    render(<Screen load={load} />)
    await settle()

    expect(rowsOf()).toBe("read 1")

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new Event("visibilitychange"))
    })
    await settle()

    expect(rowsOf()).toBe("read 2")
  })
})

describe("a change shown before GitHub has agreed to it", () => {
  test("shows it at once, and keeps it once the read comes back the same", async () => {
    let closed = false
    const load = () =>
      Effect.sleep("5 millis").pipe(Effect.map(() => (closed ? ["closed"] : ["open"])))
    const change = () =>
      Effect.sleep("20 millis").pipe(
        Effect.map(() => {
          closed = true
        })
      )

    render(<Screen load={load} change={change} />)
    await settle()

    expect(rowsOf()).toBe("open")

    await userEvent.click(screen.getByText("close"))

    expect(rowsOf()).toBe("closed")

    await settle(80)

    expect(rowsOf()).toBe("closed")
  })

  test("puts it back where GitHub refused, and says who refused", async () => {
    const load = () => Effect.sleep("5 millis").pipe(Effect.as(["open"]))

    /*
     * Held until this test refuses, rather than refused on a timer. What the first
     * assertion is about is the list while the write is still out, and a timer long
     * enough to assert against here is one a loaded runner beats: at zero the
     * assertion reads `open`, which is the same failure a slow runner produces.
     */
    let refuse = (): void => {}
    const refused = new Promise<void>((done) => {
      refuse = () => done()
    })
    const change = () => Effect.promise(() => refused).pipe(Effect.andThen(Effect.fail("no")))

    let refusal: unknown
    render(
      <Screen
        load={load}
        change={change}
        onRefusal={(said) => {
          refusal = said
        }}
      />
    )
    await settle()

    await userEvent.click(screen.getByText("close"))

    expect(rowsOf()).toBe("closed")

    refuse()
    await waitFor(() => {
      expect(rowsOf()).toBe("open")
      expect(refusal).toBeDefined()
    })
  })
})

/**
 * A page the reader has already seen, drawn again without being read again first.
 *
 * The back button is what this is for. A screen is closed and stood up again on
 * every navigation of ours, and until now that threw away everything the last one
 * knew: new atoms, an empty `early`, and a skeleton on the screen until either the
 * store or GitHub answered. Pressing Back onto a list read a second ago cost a
 * storage round trip to redraw a list that had not changed.
 */
describe("a page that has been on the screen before", () => {
  // The memory outlives a test as it outlives a screen, and `tests/setup.ts`
  // empties it after every test in the suite for that reason. These are the tests
  // that would read each other's pages without it.
  test("draws on the first frame, with no wait in between", async () => {
    const first = held(["open", "open"])
    const { unmount } = render(<Screen load={first.load} keep="/octo-org/octo-repo/pull/7" />)
    await first.answer(1)
    await waitFor(() => expect(rowsOf()).toBe("open,open"))
    unmount()

    // A read that never answers, so what is on the screen can only be the memory.
    const again = held(["never"])
    render(<Screen load={again.load} keep="/octo-org/octo-repo/pull/7" />)

    expect(stateOf()).toBe("ready")
    expect(rowsOf()).toBe("open,open")
  })

  test("says it is catching up, because what is shown is a moment old", async () => {
    const first = held(["open"])
    const { unmount } = render(<Screen load={first.load} keep="/one" />)
    await first.answer(1)
    await waitFor(() => expect(rowsOf()).toBe("open"))
    unmount()

    const again = held(["never"])
    render(<Screen load={again.load} keep="/one" />)
    await settle(1)

    expect(catchingUp()).toBe("yes")
  })

  test("is replaced the moment GitHub answers, which is the whole policy", async () => {
    const first = held(["open"])
    const { unmount } = render(<Screen load={first.load} keep="/one" />)
    await first.answer(1)
    await waitFor(() => expect(rowsOf()).toBe("open"))
    unmount()

    const again = held(["closed"])
    render(<Screen load={again.load} keep="/one" />)
    await again.answer(1)

    await waitFor(() => expect(rowsOf()).toBe("closed"))
  })

  test("is one page's memory and not another's", async () => {
    const first = held(["open"])
    const { unmount } = render(<Screen load={first.load} keep="/one" />)
    await first.answer(1)
    await waitFor(() => expect(rowsOf()).toBe("open"))
    unmount()

    const other = held(["never"])
    render(<Screen load={other.load} keep="/two" />)

    expect(stateOf()).toBe("loading")
  })

  /*
   * A screen with no address of its own keeps nothing, which is most of them: two
   * reads on one page would otherwise answer each other's questions.
   */
  test("keeps nothing at all for a screen that named no page", async () => {
    const first = held(["open"])
    const { unmount } = render(<Screen load={first.load} />)
    await first.answer(1)
    await waitFor(() => expect(rowsOf()).toBe("open"))
    unmount()

    const again = held(["never"])
    render(<Screen load={again.load} />)

    expect(stateOf()).toBe("loading")
  })

  /*
   * A read that failed is not a page. Keeping it would draw the failure again on
   * the next visit, over a GitHub that has since recovered.
   */
  test("remembers nothing from a read that failed", async () => {
    const { unmount } = render(<Screen load={() => Effect.fail("no")} keep="/one" />)
    await waitFor(() => expect(stateOf()).toBe("failed"))
    unmount()

    const again = held(["never"])
    render(<Screen load={again.load} keep="/one" />)

    expect(stateOf()).toBe("loading")
  })
})
