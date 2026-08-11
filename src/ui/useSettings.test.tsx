import { afterEach, describe, expect, it } from "bun:test"
import { act, cleanup, render, screen } from "@testing-library/react"
import { Effect } from "effect"
import type { Store } from "../ports/Settings"
import { DEFAULTS, type Settings } from "../domain/Settings"
import { SCHEME_KEY } from "./applyTheme"
import { SettingsProvider } from "./settings"
import { useSettings } from "./useSettings"

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const counting = (stored: Settings = DEFAULTS) => {
  let reads = 0
  let held = stored
  let announce: ((settings: Settings) => void) | undefined
  const store: Store = {
    read: Effect.sync(() => {
      reads += 1
      return held
    }),
    write: (settings) =>
      Effect.sync(() => {
        held = settings
      }),
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

const Choosing = () => {
  const { settings, change } = useSettings()
  return (
    <button onClick={() => change({ ...settings, diff: { ...settings.diff, layout: "split" } })}>
      {settings.diff.layout}
    </button>
  )
}

const Showing = ({ store }: { readonly store: Store }) => (
  <SettingsProvider store={store}>
    <Choosing />
  </SettingsProvider>
)

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

  it("still applies a choice with nowhere to keep it", async () => {
    // A screen outside any provider, which is a test, a browser that has taken
    // the storage permission away, and an interface not yet inside a shell. The
    // choice holds for as long as the page does rather than being refused.
    await act(async () => {
      render(<Choosing />)
    })

    await act(async () => {
      screen.getByRole("button").click()
    })

    expect(screen.getByRole("button").textContent).toBe("split")
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

const Appearance = () => {
  const { settings } = useSettings()
  return <span>{settings.theme.appearance}</span>
}

describe("lifting a desktop appearance into settings", () => {
  it("adopts light or dark remembered before themes existed", async () => {
    localStorage.setItem(SCHEME_KEY, "dark")
    const kept = counting(DEFAULTS)

    await act(async () => {
      render(
        <SettingsProvider store={kept.store}>
          <Appearance />
        </SettingsProvider>
      )
    })

    expect(screen.getByText("dark")).toBeDefined()
    expect(kept.written().theme.appearance).toBe("dark")
  })

  it("does not override an appearance already stored", async () => {
    localStorage.setItem(SCHEME_KEY, "dark")
    const kept = counting({
      ...DEFAULTS,
      theme: { appearance: "light", pack: "gitquiet", art: "match" }
    })

    await act(async () => {
      render(
        <SettingsProvider store={kept.store}>
          <Appearance />
        </SettingsProvider>
      )
    })

    expect(screen.getByText("light")).toBeDefined()
  })
})
