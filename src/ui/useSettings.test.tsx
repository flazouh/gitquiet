import { afterEach, describe, expect, it } from "bun:test"
import { act, cleanup, render, screen } from "@testing-library/react"
import { DEFAULTS, type Settings } from "../settings/Settings"
import type { Store } from "../settings/store"
import { useSettings } from "./useSettings"

afterEach(cleanup)

const counting = (stored: Settings = DEFAULTS) => {
  let reads = 0
  let held = stored
  let announce: ((settings: Settings) => void) | undefined
  const store: Store = {
    read: async () => {
      reads += 1
      return held
    },
    write: async (settings) => {
      held = settings
    },
    watch: (onChange) => {
      announce = onChange
      return () => {
        announce = undefined
      }
    }
  }
  return {
    store,
    reads: () => reads,
    written: () => held,
    announce: (settings: Settings) => announce?.(settings)
  }
}

const Showing = ({ store }: { readonly store: Store }) => {
  const { settings, change } = useSettings(store)
  return (
    <button onClick={() => change({ ...settings, diff: { ...settings.diff, layout: "split" } })}>
      {settings.diff.layout}
    </button>
  )
}

describe("the settings a page is looking at", () => {
  it("reads storage once, however many times it renders", async () => {
    const kept = counting()
    await act(async () => {
      render(<Showing store={kept.store} />)
    })

    expect(kept.reads()).toBe(1)
  })

  it("shows what was stored", async () => {
    const kept = counting({ ...DEFAULTS, diff: { ...DEFAULTS.diff, layout: "split" } })
    await act(async () => {
      render(<Showing store={kept.store} />)
    })

    expect(screen.getByRole("button").textContent).toBe("split")
  })

  it("applies a change at once and stores it", async () => {
    const kept = counting()
    await act(async () => {
      render(<Showing store={kept.store} />)
    })

    await act(async () => {
      screen.getByRole("button").click()
    })

    expect(screen.getByRole("button").textContent).toBe("split")
    expect(kept.written().diff.layout).toBe("split")
  })

  it("follows a change made in another tab", async () => {
    const kept = counting()
    await act(async () => {
      render(<Showing store={kept.store} />)
    })

    await act(async () => {
      kept.announce({ ...DEFAULTS, diff: { ...DEFAULTS.diff, layout: "split" } })
    })

    expect(screen.getByRole("button").textContent).toBe("split")
  })
})
