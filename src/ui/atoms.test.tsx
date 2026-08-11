import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect } from "effect"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import { RegistryProvider, useAtom, useAtomAsk, useAtomSet, useAtomValue } from "./atoms"

afterEach(cleanup)

const settle = (ms = 40) => act(() => new Promise((rest) => setTimeout(rest, ms)))

describe("atoms on a screen", () => {
  test("shows what an atom holds, and again whenever it changes", async () => {
    const count = Atom.make(1)
    const registry = AtomRegistry.make()

    const Screen = () => <p>{useAtomValue(count)}</p>

    render(
      <RegistryProvider registry={registry}>
        <Screen />
      </RegistryProvider>
    )

    expect(screen.getByText("1")).toBeDefined()

    await act(async () => registry.set(count, 2))

    expect(screen.getByText("2")).toBeDefined()
  })

  test("writes from a press, without the screen holding the registry itself", async () => {
    const count = Atom.make(1)
    const registry = AtomRegistry.make()

    const Screen = () => {
      const set = useAtomSet(count)
      return (
        <button type="button" onClick={() => set(9)}>
          {useAtomValue(count)}
        </button>
      )
    }

    render(
      <RegistryProvider registry={registry}>
        <Screen />
      </RegistryProvider>
    )

    await userEvent.click(screen.getByRole("button"))

    expect(screen.getByRole("button").textContent).toBe("9")
  })

  test("forgets what the last screen reading it was holding", async () => {
    /*
     * The rule worth knowing before anything is built on this: an atom nobody is
     * subscribed to is swept, and comes back at whatever it started as. Not on
     * the unsubscribe — a moment after it, which is why a value read straight
     * after an unmount still looks right and the same read a tick later does
     * not.
     *
     * So a list that should survive the reader opening a pull request and
     * coming back is `keepAlive`, and one that should be read fresh every time
     * a screen mounts is not. Below is both halves of that.
     */
    const count = Atom.make(1)
    const registry = AtomRegistry.make()

    const Screen = () => <p>{useAtomValue(count)}</p>

    const drawn = render(
      <RegistryProvider registry={registry}>
        <Screen />
      </RegistryProvider>
    )
    drawn.unmount()
    registry.set(count, 2)

    await settle(0)

    expect(registry.get(count)).toBe(1)
  })

  test("holds on to one that was kept alive", async () => {
    const count = Atom.keepAlive(Atom.make(1))
    const registry = AtomRegistry.make()

    const Screen = () => <p>{useAtomValue(count)}</p>

    const drawn = render(
      <RegistryProvider registry={registry}>
        <Screen />
      </RegistryProvider>
    )
    drawn.unmount()
    registry.set(count, 2)

    await settle(0)

    expect(registry.get(count)).toBe(2)
  })
})

describe("a read that can be written to before GitHub answers", () => {
  /** A GitHub that takes its time and can be made to refuse. */
  const server = (refuse = false) => {
    let rows = ["open", "open"]

    return {
      rows: () => rows,
      close: () =>
        Effect.sleep("10 millis").pipe(
          Effect.flatMap(() =>
            refuse
              ? Effect.fail("no")
              : Effect.sync(() => {
                  rows = ["closed", ...rows.slice(1)]
                })
          )
        )
    }
  }

  const wiring = (github: ReturnType<typeof server>) => {
    const read = Atom.make(() => github.rows())
    const shown = Atom.optimistic(read)
    const close = Atom.optimisticFn(shown, {
      reducer: (rows: ReadonlyArray<string>, _: void) => ["closed", ...rows.slice(1)],
      fn: Atom.fn((_: void) => github.close())
    })

    return { shown, close }
  }

  test("shows the change at once and keeps it once GitHub agrees", async () => {
    const github = server()
    const { shown, close } = wiring(github)
    const registry = AtomRegistry.make()

    const Screen = () => {
      const rows = useAtomValue(shown)
      const ask = useAtomSet(close)
      return (
        <button type="button" onClick={() => ask(undefined)}>
          {rows.join(",")}
        </button>
      )
    }

    render(
      <RegistryProvider registry={registry}>
        <Screen />
      </RegistryProvider>
    )

    await userEvent.click(screen.getByRole("button"))

    expect(screen.getByRole("button").textContent).toBe("closed,open")

    await settle()

    expect(screen.getByRole("button").textContent).toBe("closed,open")
  })

  test("puts it back where GitHub refused", async () => {
    const github = server(true)
    const { shown, close } = wiring(github)
    const registry = AtomRegistry.make()

    const Screen = () => {
      const rows = useAtomValue(shown)
      const ask = useAtomSet(close)
      return (
        <button type="button" onClick={() => ask(undefined)}>
          {rows.join(",")}
        </button>
      )
    }

    render(
      <RegistryProvider registry={registry}>
        <Screen />
      </RegistryProvider>
    )

    await userEvent.click(screen.getByRole("button"))

    expect(screen.getByRole("button").textContent).toBe("closed,open")

    await settle()

    expect(screen.getByRole("button").textContent).toBe("open,open")
  })
})

describe("asking, where the answer is worth waiting for", () => {
  /*
   * The row menu shows GitHub's refusal on the item that was pressed, which it
   * can only do by waiting for one. Luminar reaches for `mode: "promise"` on
   * its setter for the same reason; here the same thing is an Effect, because
   * that is what every write in this codebase already is.
   */
  const answering = <A, E>(work: Effect.Effect<A, E>) =>
    Atom.fn((_: void) => Effect.sleep("10 millis").pipe(Effect.andThen(work)))

  test("hands back what GitHub said", async () => {
    const registry = AtomRegistry.make()
    const ask = answering(Effect.succeed("done"))

    let said: string | undefined
    const Screen = () => {
      const answer = useAtomAsk(ask)
      return (
        <button
          type="button"
          onClick={() => {
            Effect.runFork(
              answer(undefined).pipe(
                Effect.map((what) => {
                  said = what
                })
              )
            )
          }}
        >
          ask
        </button>
      )
    }

    render(
      <RegistryProvider registry={registry}>
        <Screen />
      </RegistryProvider>
    )

    await userEvent.click(screen.getByRole("button"))
    await settle()

    expect(said).toBe("done")
  })

  test("fails where GitHub refused, rather than answering with nothing", async () => {
    const registry = AtomRegistry.make()
    const ask = answering(Effect.fail("the head branch has been deleted"))

    let refusal: unknown
    const Screen = () => {
      const answer = useAtomAsk(ask)
      return (
        <button
          type="button"
          onClick={() => {
            Effect.runFork(
              answer(undefined).pipe(
                Effect.catchCause((cause) =>
                  Effect.sync(() => {
                    refusal = cause
                  })
                )
              )
            )
          }}
        >
          ask
        </button>
      )
    }

    render(
      <RegistryProvider registry={registry}>
        <Screen />
      </RegistryProvider>
    )

    await userEvent.click(screen.getByRole("button"))
    await settle()

    expect(refusal).toBeDefined()
  })
})

describe("two screens in one interface", () => {
  test("read the same atom rather than one each", async () => {
    /*
     * Why a shell names a registry instead of leaving every tree to make one.
     * In the extension the list, the card and the repository's page are three
     * React roots over one document; in the window the list is unmounted while
     * a card is being read. Sharing the registry is what makes a write on one
     * visible to the other, and coming back to a list a redraw rather than
     * eight requests.
     */
    const count = Atom.keepAlive(Atom.make(0))
    const registry = AtomRegistry.make()

    const List = () => {
      const set = useAtomSet(count)
      return (
        <button type="button" onClick={() => set(7)}>
          list {useAtomValue(count)}
        </button>
      )
    }

    const Card = () => <p>card {useAtomValue(count)}</p>

    // Two roots, as the extension has, both under the shell's own registry.
    render(
      <RegistryProvider registry={registry}>
        <List />
      </RegistryProvider>
    )
    render(
      <RegistryProvider registry={registry}>
        <Card />
      </RegistryProvider>
    )

    await userEvent.click(screen.getByRole("button"))

    expect(screen.getByText("card 7")).toBeDefined()
  })
})

describe("a screen with nobody holding a registry above it", () => {
  test("makes one of its own rather than throwing", () => {
    const count = Atom.make(4)
    const Screen = () => <p>{useAtomValue(count)}</p>

    render(<Screen />)

    expect(screen.getByText("4")).toBeDefined()
  })
})

describe("reading and writing in one", () => {
  test("hands back what it holds and the way to change it", async () => {
    const count = Atom.make(1)
    const registry = AtomRegistry.make()

    const Screen = () => {
      const [value, set] = useAtom(count)
      return (
        <button type="button" onClick={() => set(value + 1)}>
          {value}
        </button>
      )
    }

    render(
      <RegistryProvider registry={registry}>
        <Screen />
      </RegistryProvider>
    )

    await userEvent.click(screen.getByRole("button"))
    await userEvent.click(screen.getByRole("button"))

    expect(screen.getByRole("button").textContent).toBe("3")
  })
})
