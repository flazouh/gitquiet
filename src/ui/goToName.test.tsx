import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { Ledger, Place, Warmth } from "../ports/Ledger"
import { GoToName } from "./GoToName"
import { LedgerProvider } from "./ledger"

/**
 * Any name the repository writes down.
 *
 * The Ledger is stood in for: whether a repository can be read out of its
 * archive is `scripts/benchmark-ledger.ts`'s question, and what this screen does
 * with an answer is this one's.
 */

afterEach(cleanup)

const place = (name: string, path: string, line: number): Place => ({
  path,
  writing: {
    name,
    kind: "function",
    line,
    from: 7,
    to: 7 + name.length,
    signature: `export const ${name} = () => 1`,
    doc: null,
    sure: true
  }
})

const PLACES = [
  place("shape", "src/one.ts", 2),
  place("shapeless", "src/two.ts", 9),
  place("holder", "src/three.ts", 4)
]

const staged = (over: { warmth?: Warmth; places?: ReadonlyArray<Place> } = {}) => {
  const asked: Array<string> = []
  const opened: Array<Place> = []
  let warms = 0

  const ledger: Ledger = {
    writingAt: () => Effect.succeed(Option.none()),
    writingNamed: () => Effect.succeed(Option.none()),
    usesIn: () => Effect.succeed([]),
    writingsIn: () => Effect.succeed([]),
    usesAcross: () => Effect.succeed({ uses: [], ready: true }),
    warm: () =>
      Effect.sync(() => {
        warms += 1
        return over.warmth ?? { ready: true, read: 12, skipped: 3 }
      }),
    namesLike: (_repo, _sha, query) =>
      Effect.sync(() => {
        asked.push(query)
        const places = over.places ?? PLACES
        return {
          ready: true,
          places:
            query.trim() === ""
              ? places
              : places.filter((one) => one.writing.name.includes(query))
        }
      })
  }

  render(
    <LedgerProvider ledger={ledger}>
      <GoToName
        repo={{ owner: "flowline-labs", repo: "flowline" }}
        sha="abc123"
        onOpen={(one) => opened.push(one)}
        onClose={() => {}}
      />
    </LedgerProvider>
  )

  return { asked, opened, warms: () => warms }
}

describe("go to name", () => {
  test("reads the repository when it opens, and lists what it writes", async () => {
    const stage = staged()

    expect(await screen.findByText("shape")).toBeTruthy()
    expect(screen.getByText("holder")).toBeTruthy()
    expect(stage.warms()).toBe(1)
  })

  test("says where each one is written, which the name alone does not", async () => {
    staged()

    expect(await screen.findByText("src/one.ts:2")).toBeTruthy()
    expect(screen.getByText("src/three.ts:4")).toBeTruthy()
  })

  test("narrows to what is typed", async () => {
    const stage = staged()
    await screen.findByText("shape")

    await userEvent.keyboard("shapel")

    expect(stage.asked.at(-1)).toBe("shapel")
  })

  test("opens the one Enter is on", async () => {
    const stage = staged()
    await screen.findByText("shape")

    await userEvent.keyboard("{Enter}")

    expect(stage.opened.map((one) => one.path)).toEqual(["src/one.ts"])
  })

  test("says so where the repository could not be read, rather than looking empty", async () => {
    staged({ warmth: { ready: false, why: "no archive" } })

    expect(await screen.findByText(/could not be read/)).toBeTruthy()
  })
})
