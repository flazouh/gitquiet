import { describe, expect, it } from "bun:test"
import { DEFAULTS } from "./Settings"
import { settingsStore, type Area } from "./store"

const fake = (): Area & { held: Record<string, unknown>; fire: (value: unknown) => void } => {
  const listeners: Array<(changes: Record<string, { newValue?: unknown }>) => void> = []
  const area = {
    held: {} as Record<string, unknown>,
    get: async (key: string) => ({ [key]: area.held[key] }),
    set: async (items: Record<string, unknown>) => {
      Object.assign(area.held, items)
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
      for (const listener of [...listeners]) listener({ settings: { newValue: value } })
    }
  }
  return area
}

describe("where settings are kept", () => {
  it("answers with the defaults before anything is chosen", async () => {
    expect(await settingsStore(fake()).read()).toEqual(DEFAULTS)
  })

  it("reads back what was written", async () => {
    const store = settingsStore(fake())
    await store.write({ ...DEFAULTS, diff: { ...DEFAULTS.diff, layout: "split" } })

    expect((await store.read()).diff.layout).toBe("split")
  })

  it("answers with the defaults when storage refuses", async () => {
    const broken = { ...fake(), get: async () => Promise.reject(new Error("over quota")) }
    expect(await settingsStore(broken).read()).toEqual(DEFAULTS)
  })

  it("does not throw when a choice cannot be stored", async () => {
    const broken = { ...fake(), set: async () => Promise.reject(new Error("over quota")) }
    await settingsStore(broken).write(DEFAULTS)
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
    await store.write({ ...DEFAULTS, tree: { ...DEFAULTS.tree, width: "wide" } })

    expect((await store.read()).tree.width).toBe("wide")
  })
})
