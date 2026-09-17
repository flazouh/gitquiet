import { theHost } from "../src/ui/theHost"

/**
 * The stylesheet's clock, put where a test can hold it.
 *
 * `millisOf` reads every motion duration off the host — see `src/ui/motion.ts`.
 * In a test there is no stylesheet, so the fallbacks apply, and the fallbacks are
 * production's numbers. That turns a test about the wait into a race between two
 * wall clocks: the threshold that draws it and the answer that ends it. `bun test
 * --parallel` runs a worker per core, and under that load the two clocks stall
 * together and either can win.
 *
 * This writes the durations a test needs onto the host, which is the seam
 * production reads. A threshold of `0ms` says the wait goes up at once and nothing
 * that arrives afterwards counts as too quick to have been seen; one of `600s` says
 * the wait never goes up at all. Between those two, a test states the order of
 * events instead of betting on it.
 *
 * The host rather than a planted `#gitquiet-root`, which is what this was. A suite
 * is one document, and a test that plants a root while a screen stands its own is
 * two roots and a coin toss about which one a lookup answers with — green here and
 * red on a runner with a different number of cores, which is exactly how that
 * arrived. There is one host in a document and `theHost` hands back the same one
 * every time it is asked.
 *
 * Returns the undoing, for the file's `afterwards` collector: durations left on the
 * host would be handed to every test after it.
 */
export const paced = (durations: Readonly<Record<string, string>>): (() => void) => {
  const { host } = theHost(document)
  for (const [name, value] of Object.entries(durations)) {
    host.style.setProperty(name, value)
  }

  return () => {
    for (const name of Object.keys(durations)) host.style.removeProperty(name)
  }
}
