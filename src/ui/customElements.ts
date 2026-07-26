/**
 * A custom element registry for the isolated world, which has none.
 *
 * Chrome gives a content script `customElements === null`: elements defined
 * there could never upgrade anything in the page, so there is nothing to define
 * them in. Pierre's tree and Pierre's diff renderer both read the registry as
 * their module is evaluated, without checking, and a null read is a TypeError
 * before either exports anything — which is a blank pull request page, not a
 * missing diff.
 *
 * So they get a registry: one that remembers a definition and upgrades nothing.
 * Neither library needs an upgrade to have happened. Both render imperatively
 * into an element handed to them, attaching the shadow root themselves, and the
 * tag they render is only ever a box to render into.
 *
 * Importing this module installs it. It must therefore be imported before
 * anything that touches the registry — an import of it is placed above those,
 * and the order of imports is the order they run.
 */
const install = (): void => {
  if ((globalThis as { customElements?: unknown }).customElements != null) return

  const defined = new Map<string, unknown>()
  Object.defineProperty(globalThis, "customElements", {
    configurable: true,
    value: {
      get: (name: string) => defined.get(name),
      define: (name: string, constructor: unknown) => {
        defined.set(name, constructor)
      },
      whenDefined: () => Promise.resolve(undefined),
      upgrade: () => {}
    }
  })
}

install()

export const lendCustomElements = install
