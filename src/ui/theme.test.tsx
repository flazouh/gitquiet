import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup } from "@testing-library/react"
import { Effect } from "effect"
import { createRoot } from "react-dom/client"
import { DEFAULTS, type Settings } from "../domain/Settings"

import { packOf, tokensOf } from "../domain/theme"
import type { Store } from "../ports/Settings"
import { PACK_KEY, SCHEME_KEY } from "./applyTheme"
import { ROOT_ID } from "./mount"
import { SettingsProvider } from "./settings"
import { Theme } from "./Theme"

afterEach(() => {
  cleanup()
  for (const found of document.querySelectorAll(`#${ROOT_ID}`)) found.remove()
  localStorage.clear()
})

const settle = (ms = 40) => act(() => new Promise((rest) => setTimeout(rest, ms)))

/** A store that answers with one set of choices and hears nothing afterwards. */
const holding = (settings: Settings): Store => ({
  read: Effect.sync(() => settings),
  write: () => Effect.void,
  watch: () => () => {}
})

const dracula = { ...DEFAULTS, theme: { appearance: "dark", pack: "dracula" } } as Settings

/**
 * A container made the way a screen makes one: off the page.
 *
 * `interfaceContainer` returns a detached div, and the screen renders into it
 * before the takeover appends it — GitHub has not built the region yet at the
 * moment a content script runs.
 */
const aContainer = (): HTMLElement => {
  const made = document.createElement("div")
  made.id = ROOT_ID
  return made
}

/** A screen mounting: its container named, the way `Supplied` names it. */
const paint = async (container: HTMLElement, settings: Settings) => {
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <SettingsProvider store={holding(settings)}>
        <Theme element={container} />
      </SettingsProvider>
    )
  })
  await settle()
}

describe("the pack a reader chose, on the page they are looking at", () => {
  test("paints the screen's own container once the takeover puts it on the page", async () => {
    const container = aContainer()

    await paint(container, dracula)
    document.body.append(container)
    await settle()

    expect(container.style.getPropertyValue("--color-canvas")).toBe(
      tokensOf("dracula", "dark")["--color-canvas"]
    )
  })

  test("paints the arriving screen rather than the one being replaced", async () => {
    const leaving = aContainer()
    document.body.append(leaving)

    const arriving = aContainer()
    await paint(arriving, dracula)
    leaving.remove()
    document.body.append(arriving)
    await settle()

    expect(arriving.style.getPropertyValue("--color-canvas")).toBe(
      tokensOf("dracula", "dark")["--color-canvas"]
    )
  })
})

/** A store that has not answered yet, which is every screen's first frame. */
const stillReading = (): Store => ({
  read: Effect.callback<Settings>(() => {}),
  write: () => Effect.void,
  watch: () => () => {}
})

/**
 * The frame between React drawing the interface and storage saying how to paint it.
 *
 * Reading the choices is asynchronous and painting them happens after, so that frame
 * used to resolve the stylesheet's defaults — which are the light pack. On GitHub's dark
 * page that is a white flash of our own interface, recorded at one frame of a hundred
 * and twenty on a live pull request.
 */
describe("the frame before the store has answered", () => {
  test("paints the pack it remembered last time rather than the light default", async () => {
    localStorage.setItem(SCHEME_KEY, "dark")
    localStorage.setItem(PACK_KEY, "dracula")

    const container = aContainer()
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <SettingsProvider store={stillReading()}>
          <Theme element={container} />
        </SettingsProvider>
      )
    })

    expect(container.style.getPropertyValue("--color-canvas")).toBe(
      tokensOf("dracula", "dark")["--color-canvas"]
    )
  })

  test("follows the page rather than the machine where the choice is to follow the page", async () => {
    // "System" on GitHub means GitHub. A reader on their dark theme with a light
    // desktop is the case that first put a white panel in a black page.
    document.documentElement.setAttribute("data-color-mode", "dark")
    localStorage.setItem(SCHEME_KEY, "system")
    localStorage.setItem(PACK_KEY, "gitquiet")

    const container = aContainer()
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <SettingsProvider store={stillReading()}>
          <Theme element={container} />
        </SettingsProvider>
      )
    })
    document.documentElement.removeAttribute("data-color-mode")

    expect(container.style.getPropertyValue("--color-canvas")).toBe(
      tokensOf("gitquiet", "dark")["--color-canvas"]
    )
  })

  test("paints the defaults where nothing was remembered, which is what a new reader gets", async () => {
    document.documentElement.setAttribute("data-color-mode", "dark")

    const container = aContainer()
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <SettingsProvider store={stillReading()}>
          <Theme element={container} />
        </SettingsProvider>
      )
    })
    document.documentElement.removeAttribute("data-color-mode")

    expect(container.style.getPropertyValue("--color-canvas")).toBe(
      // Resolved, because the default answer is `match` and a test rendering a
      // screen with no shell around it is the window case.
      tokensOf(packOf(DEFAULTS.theme.pack, "gitquiet"), "dark")["--color-canvas"]
    )
  })

  /**
   * Guessing is not choosing.
   *
   * `desktop/src/view/index.html` reads the remembered scheme in its head to colour
   * the window before React boots. A guess written back as if it were the reader's
   * answer would overwrite a real one, and the next launch would flash the very
   * thing this paint exists to stop.
   */
  test("writes nothing while it is guessing", async () => {
    const container = aContainer()
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <SettingsProvider store={stillReading()}>
          <Theme element={container} />
        </SettingsProvider>
      )
    })

    expect(localStorage.getItem(SCHEME_KEY)).toBeNull()
    expect(localStorage.getItem(PACK_KEY)).toBeNull()
  })

  test("remembers the pack as well as the scheme, or the next frame has half an answer", async () => {
    const container = aContainer()

    await paint(container, dracula)

    expect(localStorage.getItem(PACK_KEY)).toBe("dracula")
  })
})
