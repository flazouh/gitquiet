import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import { type Load, useLive } from "./useLive"

afterEach(cleanup)

const settle = (ms = 40) => act(() => new Promise((rest) => setTimeout(rest, ms)))

/**
 * A screen with one list on it, saying which of the three states it is in.
 *
 * The same three `useLiveRead` had, because they are the three a reader can be
 * shown: nothing yet, something, or nothing and no way to get it.
 */
const Screen = ({
  load,
  preload,
  change,
  onRefusal
}: {
  readonly load: Load<ReadonlyArray<string>>
  readonly preload?: () => Effect.Effect<Option.Option<ReadonlyArray<string>>>
  readonly change?: () => Effect.Effect<void, unknown>
  /** Told what GitHub said, where it said no, as the row menu is. */
  readonly onRefusal?: (said: unknown) => void
}) => {
  const live = useLive(load, preload)

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
    const load = () => Effect.sleep("30 millis").pipe(Effect.as(["fresh"]))
    const preload = () => Effect.succeed(Option.some(["remembered"]))

    render(<Screen load={load} preload={preload} />)

    await settle(10)

    expect(rowsOf()).toBe("remembered")

    await settle(50)

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
    const load = () => Effect.sleep("30 millis").pipe(Effect.as(["fresh"]))
    const preload = () => Effect.succeed(Option.some(["remembered"]))

    render(<Screen load={load} preload={preload} />)
    await settle(10)

    expect(rowsOf()).toBe("remembered")
    expect(catchingUp()).toBe("yes")

    await settle(50)

    expect(rowsOf()).toBe("fresh")
    expect(catchingUp()).toBe("no")
  })

  test("says nothing where there is nothing to look at yet", async () => {
    const load = () => Effect.sleep("30 millis").pipe(Effect.as(["fresh"]))

    render(<Screen load={load} />)
    await settle(10)

    // The wait is already saying this, in the middle of the screen, at the size
    // of the thing that is missing. A toast beside it says it twice.
    expect(stateOf()).toBe("loading")
    expect(catchingUp()).toBe("no")
  })

  test("says it again for the re-read that coming back to the tab starts", async () => {
    let asked = 0
    const load = () =>
      Effect.sleep("20 millis").pipe(Effect.map(() => [`read ${++asked}`]))

    render(<Screen load={load} />)
    await settle(60)

    expect(catchingUp()).toBe("no")

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new Event("visibilitychange"))
    })
    await settle(5)

    // Still the first read's rows, and the second read already running under them.
    expect(rowsOf()).toBe("read 1")
    expect(catchingUp()).toBe("yes")

    await settle(60)

    expect(rowsOf()).toBe("read 2")
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
 * list whole at 1010ms, "Waiting 5" without a check on any row at 1423ms, "Your Move 5"
 * again at 1736ms. Then walking out of pull request 10 back onto the same list: whole
 * at 6394ms, "Waiting 5" at 7153ms, whole again at 7619ms. See
 * `scripts/probe-flicker-dom.js`, which is what recorded it.
 */
describe("a read that says what it has on the way", () => {
  const staging = (): Load<ReadonlyArray<string>> => {
    let asked = 0
    return (partly) =>
      Effect.suspend(() => {
        const round = ++asked
        return Effect.sleep("5 millis").pipe(
          // The rows, and nothing that goes beside them. Every screen with a staged
          // read reports this stage, and every one of them is missing most of a row.
          Effect.tap(() => Effect.sync(() => partly([`round ${round} rows`]))),
          Effect.andThen(Effect.sleep("25 millis")),
          Effect.as([`round ${round} rows`, `round ${round} checks`])
        )
      })
  }

  test("shows the stages of the first read, which is what they are for", async () => {
    render(<Screen load={staging()} />)
    await settle(15)

    expect(rowsOf()).toBe("round 1 rows")

    await settle(40)

    expect(rowsOf()).toBe("round 1 rows,round 1 checks")
  })

  test("never shows a stage of a re-read over the finished list", async () => {
    render(<Screen load={staging()} />)
    await settle(60)

    expect(rowsOf()).toBe("round 1 rows,round 1 checks")

    // Coming back to the tab, which is the same re-read a reader gets for walking
    // out of a pull request onto the list they came from.
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new Event("visibilitychange"))
    })
    await settle(15)

    // The second read's rows have landed and its checks have not. What is on the
    // screen is a whole list, and half of one is not an improvement on it.
    expect(rowsOf()).toBe("round 1 rows,round 1 checks")

    await settle(40)

    expect(rowsOf()).toBe("round 2 rows,round 2 checks")
  })

  test("shows no stage over a memory, which is a whole page where a stage is part of one", async () => {
    // The recorded flicker, at the size a test can hold: the remembered list, then
    // its own rows handed back with every check taken off them.
    const preload = () => Effect.succeed(Option.some(["remembered rows", "remembered checks"]))

    render(<Screen load={staging()} preload={preload} />)
    await settle(15)

    expect(rowsOf()).toBe("remembered rows,remembered checks")

    // And the answer, which is the only thing worth replacing a whole page with.
    await settle(40)

    expect(rowsOf()).toBe("round 1 rows,round 1 checks")
  })

  test("says it is catching up while it holds the memory back, so the wait is not silent", async () => {
    const preload = () => Effect.succeed(Option.some(["remembered rows", "remembered checks"]))

    render(<Screen load={staging()} preload={preload} />)
    await settle(15)

    expect(catchingUp()).toBe("yes")

    await settle(40)

    expect(catchingUp()).toBe("no")
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
    const change = () => Effect.sleep("20 millis").pipe(Effect.andThen(Effect.fail("no")))

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

    await settle(80)

    expect(rowsOf()).toBe("open")
    expect(refusal).toBeDefined()
  })
})
