/**
 * The stylesheet's clock, put where a test can hold it.
 *
 * `millisOf` reads every motion duration off `#gitquiet-root`, so that the CSS
 * owns the timing — see `src/ui/motion.ts`. In a test there is no stylesheet, so
 * the fallbacks apply, and the fallbacks are production's numbers. That turns a
 * test about the wait into a race between two wall clocks: the threshold that
 * draws it and the answer that ends it. `bun test --parallel` runs a worker per
 * core, and under that load the two clocks stall together and either can win.
 *
 * This plants a root and writes the durations a test needs onto it, which is the
 * seam production already uses. A threshold of `0ms` says the wait goes up at
 * once and nothing that arrives afterwards counts as too quick to have been
 * seen; one of `600s` says the wait never goes up at all. Between those two, a
 * test states the order of events instead of betting on it.
 *
 * Returns the undoing, for the file's `afterwards` collector: a root left
 * standing would hand its durations to every test after it.
 */
export const paced = (durations: Readonly<Record<string, string>>): (() => void) => {
  const root = document.createElement("div")
  root.id = "gitquiet-root"
  for (const [name, value] of Object.entries(durations)) {
    root.style.setProperty(name, value)
  }
  document.body.appendChild(root)

  return () => root.remove()
}
