/**
 * Which URL the window should open: Vite (HMR) when it answers, else the
 * bundled Electrobun view.
 *
 * Electrobun itself has no first-class HMR. Official templates probe a Vite
 * server and load that URL in the webview; RPC still works because Electrobun
 * injects its preload into whatever URL the window opens.
 */

export type MainViewUrl = {
  readonly url: string
  readonly hmr: boolean
}

export const mainViewUrl = async (opts: {
  readonly bundled: string
  readonly vite: string
  readonly probe: (url: string) => Promise<boolean>
}): Promise<MainViewUrl> => {
  try {
    if (await opts.probe(opts.vite)) {
      return { url: opts.vite, hmr: true }
    }
  } catch {
    // Vite not up; fall through to the bundled view.
  }
  return { url: opts.bundled, hmr: false }
}

/** Probe used at app start. A live Vite answers; a refused connection throws. */
export const viteIsUp = async (url: string): Promise<boolean> => {
  await fetch(url, { method: "HEAD" })
  return true
}

/**
 * Waits for Vite during `bun run dev`, where the app and the server start together.
 *
 * A single probe loses the race; without a wait the window opens the bundled
 * view and HMR never attaches.
 */
export const waitForVite = async (
  url: string,
  opts: {
    readonly tries?: number
    readonly pauseMs?: number
    readonly probe?: (url: string) => Promise<boolean>
    readonly sleep?: (ms: number) => Promise<void>
  } = {}
): Promise<boolean> => {
  const tries = opts.tries ?? 40
  const pauseMs = opts.pauseMs ?? 250
  const probe = opts.probe ?? viteIsUp
  const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))

  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      if (await probe(url)) return true
    } catch {
      // still starting
    }
    await sleep(pauseMs)
  }
  return false
}
