import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import type { WatchedKeyValue } from "../ports/KeyValue"
import { chosenView, rememberView } from "../app/settings"
import { DEFAULTS } from "../domain/Settings"
import { SETTINGS } from "../ui/keeping"
import { settingsStore } from "./store"

const fake = (): WatchedKeyValue & {
  held: Record<string, unknown>
  fire: (value: unknown) => void
} => {
  const listeners: Array<(changes: Record<string, { newValue?: unknown }>) => void> = []
  const area = {
    held: {} as Record<string, unknown>,
    get: (keys: string | Array<string>) =>
      Promise.resolve(
        Object.fromEntries(
          (Array.isArray(keys) ? keys : [keys]).map((key) => [key, area.held[key]])
        )
      ),
    set: (items: Record<string, unknown>) => {
      Object.assign(area.held, items)
      return Promise.resolve()
    },
    onChanged: {
      addListener: (listener: (changes: Record<string, { newValue?: unknown }>) => void) => {
        listeners.push(listener)
      },
      removeListener: (listener: (changes: Record<string, { newValue?: unknown }>) => void) => {
        listeners.splice(listeners.indexOf(listener), 1)
      }
    },
    fire: (value: unknown) => {
      for (const listener of [...listeners]) listener({ [SETTINGS]: { newValue: value } })
    }
  }
  return area
}

const ran = <A>(effect: Effect.Effect<A>): Promise<A> => Effect.runPromise(effect)

describe("where settings are kept", () => {
  it("answers with the defaults before anything is chosen", async () => {
    expect(await ran(settingsStore(fake()).read)).toEqual(DEFAULTS)
  })

  it("reads back what was written", async () => {
    const store = settingsStore(fake())
    await ran(store.write({ ...DEFAULTS, diff: { ...DEFAULTS.diff, layout: "split" } }))

    expect((await ran(store.read)).diff.layout).toBe("split")
  })

  it("writes under the one name this app keeps things under", async () => {
    // Named rather than bare. Settings sat under `settings` until every name this
    // app writes was brought together in `keeping.ts`; a webview's storage is one
    // flat space, and a word that generic in it belongs to nobody.
    const area = fake()
    const store = settingsStore(area)

    await ran(store.write({ ...DEFAULTS, tree: { ...DEFAULTS.tree, width: "wide" } }))

    expect(Object.keys(area.held)).toEqual([SETTINGS])
    expect((await ran(store.read)).tree.width).toBe("wide")
  })

  it("answers with the defaults when storage refuses", async () => {
    const broken = { ...fake(), get: () => Promise.reject(new Error("over quota")) }
    expect(await ran(settingsStore(broken).read)).toEqual(DEFAULTS)
  })

  it("does not fail when a choice cannot be stored", async () => {
    const broken = { ...fake(), set: () => Promise.reject(new Error("over quota")) }
    await ran(settingsStore(broken).write(DEFAULTS))
  })

  it("hears a change made in another tab", () => {
    const area = fake()
    let heard: string | undefined
    settingsStore(area).watch((settings) => {
      heard = settings.diff.layout
    })

    area.fire({ diff: { layout: "split" } })
    expect(heard).toBe("split")
  })

  it("stops listening when asked", () => {
    const area = fake()
    let heard = 0
    const stop = settingsStore(area).watch(() => {
      heard += 1
    })

    stop()
    area.fire({ diff: { layout: "split" } })
    expect(heard).toBe(0)
  })

  it("keeps settings in memory when there is no storage at all", async () => {
    const store = settingsStore(undefined)
    await ran(store.write({ ...DEFAULTS, tree: { ...DEFAULTS.tree, width: "wide" } }))

    expect((await ran(store.read)).tree.width).toBe("wide")
  })
})

describe("remembering whose page to open", () => {
  it("keeps the choice for the next pull request", async () => {
    const store = settingsStore(fake())
    await ran(rememberView(store, "github"))

    expect((await ran(store.read)).page.view).toBe("github")
  })

  it("changes nothing else on the way past", async () => {
    const store = settingsStore(fake())
    await ran(store.write({ ...DEFAULTS, diff: { ...DEFAULTS.diff, layout: "split" } }))

    await ran(rememberView(store, "github"))

    expect((await ran(store.read)).diff.layout).toBe("split")
  })

  it("comes back, without having to be reinstalled to do it", async () => {
    const store = settingsStore(fake())
    await ran(rememberView(store, "github"))
    await ran(rememberView(store, "ours"))

    expect((await ran(store.read)).page.view).toBe("ours")
  })
})

describe("which interface a page should put up", () => {
  it("is what the reader chose", async () => {
    const store = settingsStore(fake())
    await ran(rememberView(store, "github"))

    expect(await ran(chosenView(store))).toBe("github")
  })

  it("is ours when storage never answers, rather than a page that never draws", async () => {
    // Extension storage that hangs is the case this exists for: the interface
    // has to decide something, and ours is what all but a few readers chose.
    const silent = { ...fake(), get: () => new Promise<Record<string, unknown>>(() => {}) }

    expect(await ran(chosenView(settingsStore(silent)))).toBe("ours")
  })
})

