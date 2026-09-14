/**
 * Asks the background page to open an address in a new tab.
 *
 * `window.open` and `target=_blank` are both fragile here: same-origin Turbo can
 * keep a blank target in this tab, and a synthetic click (or a popup blocker)
 * turns `window.open` into a no-op. The background's `tabs.create` is neither.
 */
export const OPEN_TAB = "gitquiet/open-tab" as const

export type OpenTab = {
  readonly kind: typeof OPEN_TAB
  readonly url: string
}

export const isOpenTab = (message: unknown): message is OpenTab =>
  typeof message === "object" &&
  message !== null &&
  (message as { kind?: unknown }).kind === OPEN_TAB &&
  typeof (message as { url?: unknown }).url === "string"

type Runtime = {
  readonly sendMessage: (message: unknown) => PromiseLike<unknown>
}

/** The extension runtime, or nothing outside a browser that has one. */
const runtimeOf = (): Runtime | null => {
  const found = (globalThis as { browser?: { runtime?: Runtime } }).browser?.runtime
  return found === undefined ? null : found
}

export const openTab = (url: string): void => {
  const runtime = runtimeOf()
  if (runtime === null) return
  void runtime.sendMessage({ kind: OPEN_TAB, url } satisfies OpenTab)
}
